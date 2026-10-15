// ============================================================
// BB Estudos — Pipeline: tópico → fontes → gerador → auditor → banco
// ============================================================
import { Types } from "mongoose";
import type { z } from "zod";
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
  geradorConstruidoUser,
  AUDITOR_CEGO_SYSTEM,
  auditorCegoUser,
  AUDITOR_REVISAO_SYSTEM,
  auditorRevisaoUser,
  type QuestaoGerada,
} from "./prompts.js";
import { chatJSON, chatJSONAuditor, validarOuReparar, embed, gerador, modelo } from "./llm.js";
import { construir, temConstrucao, type Montada } from "./construcao.js";
import { normalizar, hashTexto } from "./extrair.js";
import { ehDisciplinaDeCalculo, verificarConta } from "./verificacao.js";
import { sortearVariacao, type Variacao } from "./variacao.js";

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
export type Resultado = (
  | { ok: true; questionId: Types.ObjectId }
  | { ok: false; motivo: string; detalhes?: string[] }
) & { variacao?: Variacao };

// erro em uma linha só (zod e afins vêm em várias)
const umaLinha = (e: unknown) => String(e instanceof Error ? e.message : e).replace(/\s*\n\s*/g, " ⏎ ");

// confere se o enunciado trouxe cada dado fixado pelo código, sem alterar número
function dadosFaltando(enunciado: string, dados: string[]): string[] {
  const norm = (t: string) => t.replace(/[\s ]+/g, " ").toLowerCase();
  const e = norm(enunciado);
  return dados.filter((d) => {
    const [esq, dir] = d.split(" = "); // fator "1,04^8 = 1,3686": exige a base e o valor
    return dir ? !(e.includes(norm(dir)) && e.includes(norm(esq.split("^")[0]))) : !e.includes(norm(d));
  });
}

// Nenhuma falha (rede, banco, IA) derruba o lote: vira um Resultado com o motivo
export async function gerarQuestao(topicId: string, dificuldade = 3): Promise<Resultado> {
  const estado: { variacao?: Variacao } = {};
  try {
    return { ...(await gerarQuestaoInterna(topicId, dificuldade, estado)), variacao: estado.variacao };
  } catch (e) {
    return { ok: false, motivo: "erro_inesperado", detalhes: [umaLinha(e)], variacao: estado.variacao };
  }
}

async function gerarQuestaoInterna(
  topicId: string,
  dificuldadePedida: number,
  estado: { variacao?: Variacao }
): Promise<Resultado> {
  const topic = await Topic.findById(topicId);
  if (!topic) return { ok: false, motivo: "topico_inexistente" };

  // Variedade sorteada pelo código: tipo + contexto (+ duas etapas em cálculo)
  const variacao = await sortearVariacao(topic);
  estado.variacao = variacao;
  const dificuldade = variacao.duasEtapas ? Math.max(3, dificuldadePedida) : dificuldadePedida;

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

  // Matemática por construção: o código fixa números, alternativas e gabarito; a IA só escreve
  let montada: Montada | null = null;
  if (ehDisciplinaDeCalculo(topic.disciplina) && temConstrucao(topic.assunto)) {
    montada = construir(topic.assunto, variacao.tipo, variacao.duasEtapas, gabaritoObrigatorio);
    if (!montada) return { ok: false, motivo: "construcao_falhou", detalhes: [`sem template para "${variacao.tipo}"`] };
    variacao.tipo = montada.tipo;
    variacao.duasEtapas = montada.duasEtapas;
  }

  const userGerador = montada
    ? geradorConstruidoUser({
        disciplina: topic.disciplina,
        assunto: topic.assunto,
        dificuldade,
        contexto: variacao.contexto,
        duasEtapas: montada.duasEtapas,
        pergunta: montada.pergunta,
        dados: montada.dados,
        resolucao: montada.resolucao,
        alternativas: montada.alternativas,
        gabarito: montada.gabarito,
        enunciadosRecentes: recentes.map((r) => r.enunciado),
      })
    : geradorUser({
        disciplina: topic.disciplina,
        assunto: topic.assunto,
        subtopicos: topic.subtopicos,
        dificuldade,
        gabaritoObrigatorio,
        fontes,
        exemplosOficiais: await exemplosOficiais(topic._id),
        enunciadosRecentes: recentes.map((r) => r.enunciado),
        variacao,
      });
  let q: QuestaoGerada;
  try {
    const bruto = await chatJSON(gerador(), modelo("GERADOR_MODEL"), GERADOR_SYSTEM, userGerador, 0.8, 4000);
    if (bruto && typeof bruto === "object" && "erro" in bruto) return { ok: false, motivo: "fonte_insuficiente" };
    // zod falhou → o mesmo modelo recebe a resposta + o erro e devolve só o JSON corrigido
    q = await validarOuReparar(QuestaoGeradaZ, bruto, {
      client: gerador(),
      model: modelo("GERADOR_MODEL"),
      system: GERADOR_SYSTEM,
      user: userGerador,
    });
  } catch (e) {
    return { ok: false, motivo: "geracao_invalida", detalhes: [umaLinha(e)] };
  }

  if (montada) {
    // números são do código: a IA não pode ter mexido em nenhum
    const textoIA = new Map(q.alternativas.map((a) => [a.letra, a]));
    const alterada = montada.alternativas.find((a) => textoIA.get(a.letra)?.texto.replace(/\s+/g, " ").trim() !== a.texto);
    if (alterada)
      return { ok: false, motivo: "numero_alterado", detalhes: [`alternativa ${alterada.letra}: esperado "${alterada.texto}", veio "${textoIA.get(alterada.letra)?.texto}"`] };
    const faltam = dadosFaltando(q.enunciado, montada.dados);
    if (faltam.length) return { ok: false, motivo: "numero_alterado", detalhes: [`enunciado sem os dados: ${faltam.join(" ; ")}`] };
    const certa = montada.alternativas.find((a) => a.correta)!;
    if (q.enunciado.includes(certa.texto)) return { ok: false, motivo: "resposta_no_enunciado", detalhes: [certa.texto] };
    q = {
      ...q,
      gabarito: montada.gabarito,
      alternativas: montada.alternativas.map((a) => ({
        letra: a.letra,
        texto: a.texto,
        correta: a.correta,
        explicacao: textoIA.get(a.letra)!.explicacao,
        pegadinha: a.correta ? null : textoIA.get(a.letra)?.pegadinha ?? a.erro,
      })),
      verificacao: { expressao: montada.expressao, fatoresDados: montada.fatoresDados },
    };
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

  // Regra 10: em cálculo, o número da correta é conferido por código, nunca só pela IA
  let valorEsperado: number | null = null;
  if (ehDisciplinaDeCalculo(topic.disciplina)) {
    const conta = verificarConta(q);
    if (!conta.ok) return { ok: false, motivo: conta.motivo, detalhes: conta.detalhes };
    valorEsperado = conta.valorEsperado;
  }

  const fontesTxt = fontes.map((f) => `${f.titulo}\n${f.texto}`);
  let modeloAuditor = modelo("AUDITOR_MODEL");

  // 4. Auditoria cega: o auditor resolve sem ver o gabarito
  let cego: z.infer<typeof RespostaCegaZ>;
  try {
    const r = await chatJSONAuditor(AUDITOR_CEGO_SYSTEM, auditorCegoUser(q, fontesTxt), 0, 2000);
    modeloAuditor = r.modelo;
    cego = RespostaCegaZ.parse(r.json);
  } catch (e) {
    return { ok: false, motivo: "auditor_falhou", detalhes: [umaLinha(e)] };
  }
  if (cego.resposta !== q.gabarito) {
    return {
      ok: false,
      motivo: "auditor_discordou",
      detalhes: [`auditor marcou ${cego.resposta}: ${cego.raciocinio}`],
    };
  }

  // 5. Revisão completa
  let rev: z.infer<typeof RevisaoZ>;
  try {
    const r = await chatJSONAuditor(AUDITOR_REVISAO_SYSTEM, auditorRevisaoUser(q, fontesTxt), 0, 2000);
    if (r.modelo !== modeloAuditor) modeloAuditor = `${modeloAuditor} + ${r.modelo}`;
    rev = RevisaoZ.parse(r.json);
  } catch (e) {
    return { ok: false, motivo: "auditor_falhou", detalhes: [umaLinha(e)] };
  }
  const aprovada = rev.veredito === "aprovada";

  // 6. Salva (rejeitadas também, para você analisar onde o gerador erra)
  const doc = await Question.create({
    topicId: topic._id,
    origem: "gerada",
    dificuldade: variacao.duasEtapas ? Math.max(3, q.dificuldade) : q.dificuldade,
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
    variacao,
    verificacao: q.verificacao ? { ...q.verificacao, valorEsperado } : undefined,
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
