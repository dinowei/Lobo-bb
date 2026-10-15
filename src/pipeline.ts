// ============================================================
// BB Estudos — Pipeline: tópico → fontes → gerador → auditor → banco
// ============================================================
import { Types } from "mongoose";
import {
  Topic,
  Source,
  Chunk,
  Question,
  INDICE_VETORIAL,
  DISCIPLINAS_COM_FONTE_OBRIGATORIA,
  type Disciplina,
  type Letra,
} from "./models.js";
import {
  QuestaoGeradaZ,
  RespostaCegaZ,
  RevisaoZ,
  GERADOR_SYSTEM,
  geradorUser,
  AUDITOR_CEGO_SYSTEM,
  auditorCegoUser,
  AUDITOR_REVISAO_SYSTEM,
  auditorRevisaoUser,
  type QuestaoGerada,
} from "./prompts.js";
import { chatJSON, embed, gerador, auditor, modelo } from "./llm.js";
import { normalizar, hashTexto } from "./extrair.js";

// ------------------------------------------------------------
// RAG (Atlas Vector Search na coleção de trechos)
// ------------------------------------------------------------
export type FonteTrecho = { sourceId: Types.ObjectId; titulo: string; texto: string };

async function vizinhos(topicId: Types.ObjectId, vetor: number[], k: number): Promise<FonteTrecho[]> {
  return Chunk.aggregate<FonteTrecho>([
    {
      $vectorSearch: {
        index: INDICE_VETORIAL(),
        path: "embedding",
        queryVector: vetor,
        numCandidates: Math.max(100, k * 20),
        limit: k,
        filter: { topicIds: topicId, revogada: false },
      },
    },
    { $lookup: { from: Source.collection.name, localField: "sourceId", foreignField: "_id", as: "fonte" } },
    { $unwind: "$fonte" },
    { $project: { _id: 0, sourceId: 1, texto: 1, titulo: "$fonte.titulo" } },
  ]);
}

// Para GERAR: sorteia um trecho-semente do tópico e pega a vizinhança dele.
// Assim cada questão nasce de um pedaço diferente da matéria.
export async function buscarFontesVariadas(topicId: Types.ObjectId, k = 5): Promise<FonteTrecho[]> {
  const [semente] = await Chunk.aggregate<{ embedding?: number[] }>([
    { $match: { topicIds: topicId, revogada: false } },
    { $sample: { size: 1 } },
    { $project: { _id: 0, embedding: 1 } },
  ]);
  if (!semente?.embedding?.length) return [];
  return vizinhos(topicId, semente.embedding, k);
}

// Para EXPLICAR/AUDITAR uma questão já existente: busca pelo próprio enunciado.
export async function buscarFontesPorConsulta(
  topicId: Types.ObjectId,
  consulta: string,
  k = 5
): Promise<FonteTrecho[]> {
  if (!(await Chunk.exists({ topicIds: topicId, revogada: false }))) return [];
  return vizinhos(topicId, await embed(consulta, "query"), k);
}

async function exemplosOficiais(topicId: Types.ObjectId, n = 2) {
  const qs = await Question.aggregate<{ enunciado: string; alternativas: { letra: string; texto: string }[]; gabarito: string }>([
    { $match: { topicId, origem: "oficial", status: "aprovada" } },
    { $sample: { size: n } },
    { $project: { enunciado: 1, alternativas: 1, gabarito: 1 } },
  ]);
  return qs.map(
    (q) => `${q.enunciado}\n${q.alternativas.map((a) => `(${a.letra}) ${a.texto}`).join("\n")}\nGabarito: ${q.gabarito}`
  );
}

const letraAleatoria = (): Letra => (["A", "B", "C", "D", "E"] as const)[Math.floor(Math.random() * 5)];

// ------------------------------------------------------------
// O pipeline completo
// ------------------------------------------------------------
export type Resultado =
  | { ok: true; questionId: Types.ObjectId }
  | { ok: false; motivo: string; detalhes?: string[] };

export async function gerarQuestao(topicId: string, dificuldade = 3): Promise<Resultado> {
  const topic = await Topic.findById(topicId);
  if (!topic) return { ok: false, motivo: "topico_inexistente" };

  // 1. Fontes
  const fontes = await buscarFontesVariadas(topic._id);
  const exigeFonte =
    topic.volatil || DISCIPLINAS_COM_FONTE_OBRIGATORIA.includes(topic.disciplina as Disciplina);
  if (exigeFonte && fontes.length === 0) return { ok: false, motivo: "sem_fontes_para_o_topico" };

  const recentes = await Question.find({ topicId: topic._id, status: "aprovada" })
    .sort({ createdAt: -1 })
    .limit(15)
    .select("enunciado");

  // 2. Geração
  const gabaritoObrigatorio = letraAleatoria();
  let q: QuestaoGerada;
  try {
    const bruto = await chatJSON(
      gerador(),
      modelo("GERADOR_MODEL"),
      GERADOR_SYSTEM,
      geradorUser({
        disciplina: topic.disciplina,
        assunto: topic.assunto,
        subtopicos: topic.subtopicos,
        dificuldade,
        gabaritoObrigatorio,
        fontes,
        exemplosOficiais: await exemplosOficiais(topic._id),
        enunciadosRecentes: recentes.map((r) => r.enunciado),
      }),
      0.8,
      4000
    );
    if (bruto && typeof bruto === "object" && "erro" in bruto) return { ok: false, motivo: "fonte_insuficiente" };
    q = QuestaoGeradaZ.parse(bruto);
  } catch (e) {
    return { ok: false, motivo: "geracao_invalida", detalhes: [String(e)] };
  }

  // 3. Checagens determinísticas (de graça, antes de gastar com o auditor)
  const corretas = q.alternativas.filter((a) => a.correta);
  if (corretas.length !== 1 || corretas[0].letra !== q.gabarito)
    return { ok: false, motivo: "gabarito_inconsistente" };
  if (q.gabarito !== gabaritoObrigatorio) return { ok: false, motivo: "ignorou_gabarito_obrigatorio" };
  if (new Set(q.alternativas.map((a) => a.letra)).size !== 5) return { ok: false, motivo: "letras_repetidas" };

  let fonteDoTrecho: FonteTrecho | undefined;
  if (fontes.length) {
    if (!q.trechoFonte || q.trechoFonte.length < 10) return { ok: false, motivo: "sem_trecho_fonte" };
    const alvo = normalizar(q.trechoFonte).slice(0, 80);
    fonteDoTrecho = fontes.find((f) => normalizar(f.texto).includes(alvo));
    if (!fonteDoTrecho) return { ok: false, motivo: "trecho_fonte_inventado" };
  }

  const h = hashTexto(q.enunciado);
  if (await Question.exists({ hashEnunciado: h })) return { ok: false, motivo: "duplicada" };

  const fontesTxt = fontes.map((f) => `${f.titulo}\n${f.texto}`);
  const modeloAuditor = modelo("AUDITOR_MODEL");

  // 4. Auditoria cega: o auditor resolve sem ver o gabarito
  const cego = RespostaCegaZ.parse(
    await chatJSON(auditor(), modeloAuditor, AUDITOR_CEGO_SYSTEM, auditorCegoUser(q, fontesTxt), 0, 2000)
  );
  if (cego.resposta !== q.gabarito) {
    return {
      ok: false,
      motivo: "auditor_discordou",
      detalhes: [`auditor marcou ${cego.resposta}: ${cego.raciocinio}`],
    };
  }

  // 5. Revisão completa
  const rev = RevisaoZ.parse(
    await chatJSON(auditor(), modeloAuditor, AUDITOR_REVISAO_SYSTEM, auditorRevisaoUser(q, fontesTxt), 0, 2000)
  );
  const aprovada = rev.veredito === "aprovada";

  // 6. Salva (rejeitadas também, para você analisar onde o gerador erra)
  const doc = await Question.create({
    topicId: topic._id,
    origem: "gerada",
    dificuldade: q.dificuldade,
    enunciado: q.enunciado,
    alternativas: q.alternativas.map((a) => ({ ...a, pegadinha: a.correta ? undefined : a.pegadinha ?? undefined })),
    gabarito: q.gabarito,
    explicacaoGeral: q.explicacaoGeral,
    dicaDeProva: q.dicaDeProva ?? undefined,
    fontes: fonteDoTrecho ? [{ sourceId: fonteDoTrecho.sourceId, trecho: q.trechoFonte }] : [],
    status: aprovada ? "aprovada" : "rejeitada",
    geradaPor: modelo("GERADOR_MODEL"),
    auditoria: {
      modelo: modeloAuditor,
      respostaCega: cego.resposta,
      veredito: rev.veredito,
      problemas: rev.problemas,
    },
    hashEnunciado: h,
  });

  return aprovada
    ? { ok: true, questionId: doc._id }
    : { ok: false, motivo: "reprovada_na_revisao", detalhes: rev.problemas };
}

// ------------------------------------------------------------
// "Infinito" na prática: mantém um estoque mínimo por tópico.
// Roda em background (cron) e o aluno nunca espera a IA.
// ------------------------------------------------------------
export async function reabastecerEstoque(minPorTopico = 30, maxTentativas = 3) {
  const topicos = await Topic.find({ ativo: true });
  for (const t of topicos) {
    const estoque = await Question.countDocuments({ topicId: t._id, status: "aprovada" });
    const faltam = Math.max(0, minPorTopico - estoque);
    if (faltam) console.log(`[${t.assunto}] estoque ${estoque}/${minPorTopico}, gerando ${faltam}…`);
    for (let i = 0; i < faltam; i++) {
      for (let tentativa = 0; tentativa < maxTentativas; tentativa++) {
        const r = await gerarQuestao(String(t._id), 1 + Math.floor(Math.random() * 5));
        if (r.ok) break;
        console.warn(`  ✖ ${r.motivo}`, r.detalhes?.join(" | ") ?? "");
        if (r.motivo === "sem_fontes_para_o_topico") {
          i = faltam; // não adianta insistir: falta ingerir fonte para esse tópico
          break;
        }
      }
    }
  }
}
