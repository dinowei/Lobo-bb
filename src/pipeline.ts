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
  FrasesCraseZ,
  FraseUnicaCraseZ,
  CRASE_ESCRITOR_SYSTEM,
  craseEscritorUser,
  craseReescritaUser,
  VereditoFraseZ,
  AUDITOR_FRASE_SYSTEM,
  AUDITOR_CEGO_SYSTEM,
  auditorCegoUser,
  AUDITOR_REVISAO_SYSTEM,
  auditorRevisaoUser,
  type QuestaoGerada,
} from "./prompts.js";
import { chatJSON, chatJSONAuditor, validarOuReparar, embed, gerador, escritorPT, modelo } from "./llm.js";
import { construir, temConstrucao, type Montada } from "./construcao.js";
import {
  construirCrase,
  conferirFrase,
  explicarAlternativa,
  explicacaoGeralCrase,
  DICA_CRASE,
  REGRAS_CRASE,
  type HistoricoCrase,
} from "./portugues.js";
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
export async function gerarQuestao(topicId: string, dificuldade = 3, opcoes: { tipo?: string } = {}): Promise<Resultado> {
  const estado: { variacao?: Variacao; tipo?: string } = { tipo: opcoes.tipo };
  try {
    return { ...(await gerarQuestaoInterna(topicId, dificuldade, estado)), variacao: estado.variacao };
  } catch (e) {
    return { ok: false, motivo: "erro_inesperado", detalhes: [umaLinha(e)], variacao: estado.variacao };
  }
}

async function gerarQuestaoInterna(
  topicId: string,
  dificuldadePedida: number,
  estado: { variacao?: Variacao; tipo?: string }
): Promise<Resultado> {
  const topic = await Topic.findById(topicId);
  if (!topic) return { ok: false, motivo: "topico_inexistente" };

  // Variedade sorteada pelo código: tipo + contexto (+ duas etapas em cálculo)
  const variacao = await sortearVariacao(topic, estado.tipo);
  estado.variacao = variacao;
  const dificuldade = variacao.duasEtapas ? Math.max(3, dificuldadePedida) : dificuldadePedida;

  // 1. Fontes
  const fontes = await buscarFontesVariadas(topic._id);
  const exigeFonte =
    topic.volatil || DISCIPLINAS_COM_FONTE_OBRIGATORIA.includes(topic.disciplina as Disciplina);
  if (exigeFonte && fontes.length === 0) return { ok: false, motivo: "sem_fontes_para_o_topico" };

  // Português por construção (Crase): caminho próprio, com auditoria frase a frase
  if (variacao.tipo === TIPO_CRASE) return gerarCraseConstruida(topic, variacao);

  const recentes = await Question.find({ topicId: topic._id, status: "aprovada" })
    .sort({ createdAt: -1 })
    .limit(15)
    .select("enunciado");

  // 2. Geração
  const gabaritoObrigatorio = letraAleatoria();

  // Matemática por construção: o código fixa números, alternativas e gabarito; a IA só escreve
  let montada: Montada | null = null;
  if (ehDisciplinaDeCalculo(topic.disciplina) && temConstrucao(topic.assunto)) {
    montada = construir(topic.assunto, variacao.tipo, gabaritoObrigatorio);
    if (!montada) return { ok: false, motivo: "construcao_falhou", detalhes: [`sem template para "${variacao.tipo}"`] };
    variacao.duasEtapas = montada.etapas >= 2; // a verdade vem do template
  }

  const userGerador = montada
    ? geradorConstruidoUser({
        disciplina: topic.disciplina,
        assunto: topic.assunto,
        dificuldade: montada.dificuldade,
        contexto: variacao.contexto,
        duasEtapas: montada.etapas >= 2,
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
    // por construção, a dificuldade vem do template (nº de etapas), nunca da IA
    dificuldade: montada ? montada.dificuldade : variacao.duasEtapas ? Math.max(3, q.dificuldade) : q.dificuldade,
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
// Crase por construção: o código sorteia 1 regra correta + 4 de erro e a letra;
// a IA escreve as frases; o auditor julga cada frase isolada (sem saber a regra).
// Aprova só se exatamente 1 frase for "correta" e for a do gabarito; depois, revisão completa.
// ------------------------------------------------------------
export const TIPO_CRASE = "crase (por construção)";

// Regras da última questão montada neste processo (mesmo se foi descartada antes de salvar)
let regrasDaUltimaCrase: Set<string> | null = null;

// Contagem de uso por regra nas aprovadas + regras da questão anterior (para não repetir)
async function historicoCrase(topicId: Types.ObjectId): Promise<HistoricoCrase> {
  const idPorNome = new Map(REGRAS_CRASE.map((r) => [r.nome, r.id]));
  const aprovadas = await Question.find({ topicId, "variacao.tipo": TIPO_CRASE, status: "aprovada" })
    .select("auditoria.porFrase.regraEsperada")
    .lean();
  const uso = new Map<string, number>();
  for (const q of aprovadas)
    for (const p of q.auditoria?.porFrase ?? []) {
      const id = idPorNome.get(p.regraEsperada ?? "");
      if (id) uso.set(id, (uso.get(id) ?? 0) + 1);
    }
  let anterior = regrasDaUltimaCrase;
  if (!anterior) {
    const ultima = await Question.findOne({ topicId, "variacao.tipo": TIPO_CRASE })
      .sort({ _id: -1 })
      .select("auditoria.porFrase.regraEsperada")
      .lean();
    anterior = new Set((ultima?.auditoria?.porFrase ?? []).flatMap((p) => idPorNome.get(p.regraEsperada ?? "") ?? []));
  }
  return { uso, anterior };
}

async function gerarCraseConstruida(
  topic: { _id: Types.ObjectId; disciplina: string; assunto: string },
  variacao: Variacao
): Promise<Resultado> {
  const gabarito = letraAleatoria();
  const m = construirCrase(gabarito, variacao.contexto, await historicoCrase(topic._id));
  regrasDaUltimaCrase = new Set(m.frases.map((f) => f.regra.id));
  const anteriores = await Question.find({ topicId: topic._id, "variacao.tipo": TIPO_CRASE })
    .sort({ createdAt: -1 })
    .limit(6)
    .select("alternativas");
  const user = craseEscritorUser({
    contexto: variacao.contexto,
    frases: m.frases,
    frasesRecentes: anteriores.flatMap((a) => a.alternativas.map((x) => x.texto)),
  });

  // o escritor de Português é um modelo diferente do auditor (ESCRITOR_PT_MODEL)
  const escritor = { client: escritorPT(), model: modelo("ESCRITOR_PT_MODEL") };
  let escrito: z.infer<typeof FrasesCraseZ>;
  try {
    const bruto = await chatJSON(escritor.client, escritor.model, CRASE_ESCRITOR_SYSTEM, user, 0.7, 2000);
    escrito = await validarOuReparar(FrasesCraseZ, bruto, { ...escritor, system: CRASE_ESCRITOR_SYSTEM, user });
  } catch (e) {
    return { ok: false, motivo: "geracao_invalida", detalhes: [umaLinha(e)] };
  }
  const porLetra = new Map(escrito.frases.map((f) => [f.letra, { frase: f.frase, trecho: f.trecho }]));
  if (porLetra.size !== 5) return { ok: false, motivo: "letras_repetidas" };

  // Trava "frase fora da regra": o "à" tem que estar (ou não) exatamente onde a regra manda.
  // Frase que não bate é descartada e só ela é pedida de novo (1 tentativa).
  const reescritas: string[] = [];
  for (const f of m.frases) {
    const atual = porLetra.get(f.letra)!;
    const problema = conferirFrase(atual.frase, atual.trecho, f.regra);
    if (!problema) continue;
    try {
      const userUma = craseReescritaUser({ contexto: variacao.contexto, regra: f.regra, fraseAnterior: atual.frase, problema });
      const bruto = await chatJSON(escritor.client, escritor.model, CRASE_ESCRITOR_SYSTEM, userUma, 0.7, 600);
      const nova = await validarOuReparar(FraseUnicaCraseZ, bruto, { ...escritor, system: CRASE_ESCRITOR_SYSTEM, user: userUma });
      const problema2 = conferirFrase(nova.frase, nova.trecho, f.regra);
      if (problema2)
        return {
          ok: false,
          motivo: "frase_fora_da_regra",
          detalhes: [`${f.letra} [${f.regra.nome}]: "${atual.frase}" → ${problema}; reescrita "${nova.frase}" → ${problema2}`],
        };
      porLetra.set(f.letra, nova);
      reescritas.push(`${f.letra} reescrita (${problema})`);
    } catch (e) {
      return { ok: false, motivo: "geracao_invalida", detalhes: [`reescrita da ${f.letra}: ${umaLinha(e)}`] };
    }
  }
  if (reescritas.length) console.log(`  ✎ ${reescritas.join("; ")}`);
  const linhas = m.frases.map((f) => `${f.letra}) ${porLetra.get(f.letra)!.frase} [regra: ${f.regra.nome}]`);

  // explicação, pegadinha e explicação geral vêm da REGRA (banco), não da IA
  const certa = m.frases.find((f) => f.letra === gabarito)!.regra;
  const q: QuestaoGerada = {
    enunciado: m.enunciado,
    alternativas: m.frases.map((f) => {
      const e = porLetra.get(f.letra)!;
      return { letra: f.letra, texto: e.frase, correta: f.letra === gabarito, ...explicarAlternativa(f.regra, e.trecho) };
    }),
    gabarito,
    explicacaoGeral: explicacaoGeralCrase(certa),
    dicaDeProva: DICA_CRASE,
    trechoFonte: null,
    dificuldade: m.dificuldade,
    verificacao: null,
  };
  // o enunciado é fixo: o que identifica a questão são as frases
  const h = hashTexto(q.enunciado + q.alternativas.map((a) => a.texto).join("|"));
  if (await Question.exists({ hashEnunciado: h })) return { ok: false, motivo: "duplicada" };

  // auditoria por frase, cada uma isolada
  const modelos = new Set<string>();
  const porFrase: { letra: Letra; regraEsperada: string; correta: boolean; regra: string }[] = [];
  try {
    for (const f of m.frases) {
      const r = await chatJSONAuditor(AUDITOR_FRASE_SYSTEM, `FRASE: ${porLetra.get(f.letra)!.frase}`, 0, 600);
      modelos.add(r.modelo);
      const v = VereditoFraseZ.parse(r.json);
      porFrase.push({ letra: f.letra, regraEsperada: f.regra.nome, correta: v.correta, regra: v.regra });
    }
  } catch (e) {
    return { ok: false, motivo: "auditor_falhou", detalhes: [umaLinha(e), ...linhas] };
  }
  const vereditos = porFrase.map(
    (p, k) => `${p.letra}) "${porLetra.get(p.letra)!.frase}" → auditor: ${p.correta ? "SIM" : "não"} (${p.regra}) | esperado: ${m.frases[k].regra.correta ? "SIM" : "não"}`
  );
  const sims = porFrase.filter((p) => p.correta);
  if (sims.length !== 1 || sims[0].letra !== gabarito)
    return {
      ok: false,
      motivo: "auditor_por_frase_discordou",
      detalhes: [`auditor disse SIM para: ${sims.map((p) => p.letra).join(", ") || "nenhuma"}; gabarito ${gabarito}`, ...vereditos],
    };

  // revisão completa de sempre
  let rev: z.infer<typeof RevisaoZ>;
  try {
    const r = await chatJSONAuditor(AUDITOR_REVISAO_SYSTEM, auditorRevisaoUser(q, []), 0, 2000);
    modelos.add(r.modelo);
    rev = RevisaoZ.parse(r.json);
  } catch (e) {
    return { ok: false, motivo: "auditor_falhou", detalhes: [umaLinha(e), ...vereditos] };
  }
  const aprovada = rev.veredito === "aprovada";

  const doc = await Question.create({
    topicId: topic._id,
    origem: "gerada",
    dificuldade: m.dificuldade,
    enunciado: q.enunciado,
    alternativas: q.alternativas.map((a) => ({ ...a, pegadinha: a.correta ? undefined : a.pegadinha ?? undefined })),
    gabarito,
    explicacaoGeral: q.explicacaoGeral,
    dicaDeProva: q.dicaDeProva ?? undefined,
    fontes: [],
    status: aprovada ? "aprovada" : "rejeitada",
    geradaPor: modelo("GERADOR_MODEL"),
    auditoria: {
      modelo: [...modelos].join(" + "),
      respostaCega: sims[0].letra,
      veredito: rev.veredito,
      problemas: rev.problemas,
      porFrase,
    },
    variacao,
    hashEnunciado: h,
  });
  return aprovada
    ? { ok: true, questionId: doc._id }
    : { ok: false, motivo: "reprovada_na_revisao", detalhes: [...rev.problemas, ...vereditos] };
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
