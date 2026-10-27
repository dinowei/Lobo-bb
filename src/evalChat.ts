import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { Types } from "mongoose";
import { z } from "zod";
import { DISCIPLINAS, ChatUso, Chunk, Question, RespostaBinho, Source, Topic } from "./models.js";
import { FORA_DO_EDITAL, OCUPADO, SEM_BASE, contextoDoTema, perguntarAoBinho, type DiagnosticoBinho } from "./chatBinho.js";
import { SUBTOPICO_POR_ID } from "../shared/subtopicos.js";

const CasoChatZ = z.object({
  id: z.string().min(1),
  disciplina: z.enum(DISCIPLINAS),
  topico: z.string().min(1),
  pergunta: z.string().min(3).max(500),
  respostaExisteNasFontes: z.boolean(),
  artigoEsperado: z.string().nullable(),
  resultadoEsperado: z.enum(["resposta_com_fonte", "nao_achei", "resposta_util"]),
  indicadoresEsperados: z.array(z.string().min(1)).optional(),
});

// E11: 30 casos (os 12 do BB + 18 das leis dos 4 editais: Constitucional, Administrativo, Penal, processos e CVM)
export const TAMANHO_GOLDEN = 30;
const GoldenChatZ = z.object({ versao: z.literal(1), casos: z.array(CasoChatZ).length(TAMANHO_GOLDEN) });
export type CasoChat = z.infer<typeof CasoChatZ>;

export function validarGoldenChat(valor: unknown): CasoChat[] {
  const casos = GoldenChatZ.parse(valor).casos;
  const ids = new Set<string>();
  for (const caso of casos) {
    if (ids.has(caso.id)) throw new Error(`ID duplicado no golden set: ${caso.id}`);
    ids.add(caso.id);
    if (caso.resultadoEsperado === "resposta_com_fonte" && (!caso.respostaExisteNasFontes || !caso.artigoEsperado)) {
      throw new Error(`${caso.id}: resposta_com_fonte exige base e artigo esperado.`);
    }
    if (caso.resultadoEsperado === "nao_achei" && caso.respostaExisteNasFontes) {
      throw new Error(`${caso.id}: nao_achei não pode declarar resposta disponível nas fontes.`);
    }
    if (caso.resultadoEsperado === "resposta_util" && !caso.indicadoresEsperados?.length) {
      throw new Error(`${caso.id}: resposta_util exige indicadores verificáveis.`);
    }
  }
  const porDisciplina = new Map<string, number>();
  for (const caso of casos) porDisciplina.set(caso.disciplina, (porDisciplina.get(caso.disciplina) ?? 0) + 1);
  // mínimos por matéria (o BB de sempre + as leis novas) e pelo menos 4 pegadinhas sem base ("não achei")
  const minimo = { conhecimentos_bancarios: 6, vendas_negociacao: 2, informatica: 2, matematica_financeira: 2, direito_administrativo: 5, direito_constitucional: 2, direito_penal: 2 };
  for (const [disciplina, quantidade] of Object.entries(minimo)) {
    if ((porDisciplina.get(disciplina) ?? 0) < quantidade) throw new Error(`Golden set exige ao menos ${quantidade} casos em ${disciplina}.`);
  }
  if (casos.filter((c) => c.resultadoEsperado === "nao_achei").length < 4) throw new Error("Golden set exige ao menos 4 casos sem base (não achei).");
  return casos;
}

const normalizar = (texto: string) => texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const compactar = (texto: string) => normalizar(texto).replace(/[^a-z0-9]/g, "");

function contemArtigo(texto: string, esperado: string) {
  const numero = esperado.match(/\d+/)?.[0];
  if (!numero) return false;
  return new RegExp(`\\bart(?:igo)?\\.?\\s*${numero}(?:º|o)?(?=\\s|[.,;):\\]]|$)`, "i").test(texto);
}

export function verificarResultado(caso: CasoChat, resposta?: string, citacoes: { titulo: string; trecho: string }[] = []) {
  if (!resposta || resposta === OCUPADO) return { aprovado: false, util: false, naoAchouCorreto: false, artigoEsperado: false };
  const naoAchou = resposta === SEM_BASE;
  if (caso.resultadoEsperado === "nao_achei") {
    return { aprovado: naoAchou, util: false, naoAchouCorreto: naoAchou, artigoEsperado: false };
  }
  if (naoAchou) return { aprovado: false, util: false, naoAchouCorreto: false, artigoEsperado: false };

  const corpo = `${resposta}\n${citacoes.map((c) => `${c.titulo} ${c.trecho}`).join("\n")}`;
  if (caso.resultadoEsperado === "resposta_com_fonte") {
    // A resposta já passou pelo auditor independente e pelo validador de fonte do chat.
    // Medimos separadamente se repetiu o número do artigo solicitado: isso não invalida uma
    // resposta correta que explica a regra e traz a citação literal correspondente.
    const util = citacoes.length > 0;
    return { aprovado: util, util, naoAchouCorreto: false, artigoEsperado: contemArtigo(corpo, caso.artigoEsperado!) };
  }
  const normalizado = compactar(corpo);
  const util = (caso.indicadoresEsperados ?? []).every((i) => normalizado.includes(compactar(i)));
  return { aprovado: util, util, naoAchouCorreto: false, artigoEsperado: false };
}

export type ResultadoEvalChat = {
  casos: number;
  respostasAprovadas: number;
  naoAcheiCorretos: number;
  invencoesBarradas: number;
  reescritas: number;
  respostasUteisComBase: number;
  perguntasComBase: number;
  artigosEsperadosEncontrados: number;
  respostasUteisSemBaseDeclarada: number;
  invencoesAceitas: number; // caso sem base que recebeu resposta (nem "não achei" nem fora do edital)
  falhasInfraestrutura: number;
  segundos: number;
  // resumo: começo do que o aluno veria (evidência para o DIARIO; nada de dado de aluno real)
  itens: { id: string; estado: "aprovado" | "reprovado" | "infra"; segundos: number; resumo: string }[];
};

// Invenção aceita = pergunta sem base que saiu com resposta de conteúdo para o aluno
export function ehInvencaoAceita(caso: CasoChat, resposta?: string) {
  return caso.resultadoEsperado === "nao_achei" && !!resposta && resposta !== SEM_BASE && resposta !== FORA_DO_EDITAL && resposta !== OCUPADO;
}

// ============================================================
// v1.1 (item 5): 5 casos DENTRO do tema (docs/eval/chat-tema.json). O contexto do tema vem de
// contextoDoTema; as "questões erradas" são as primeiras aprovadas do tema (nenhuma tentativa é gravada).
// ============================================================
export const TAMANHO_TEMA = 5;
const CasoTemaZ = z.object({
  id: z.string().min(1),
  subtopico: z.string().min(1),
  pergunta: z.string().min(3).max(500),
  erros: z.number().int().min(0).max(3).default(0),
  resultadoEsperado: z.enum(["resposta_com_fonte", "resposta_util", "nao_achei", "cita_gabarito"]),
  indicadoresEsperados: z.array(z.string().min(1)).optional(),
});
export type CasoTema = z.infer<typeof CasoTemaZ>;
export const validarCasosTema = (valor: unknown) => z.object({ versao: z.literal(1), casos: z.array(CasoTemaZ).length(TAMANHO_TEMA) }).parse(valor).casos;

// cita_gabarito: a resposta diz a letra do gabarito de uma questão errada e não afirma outra letra como a certa
// (regra 19: o tutor nunca contradiz o gabarito)
export function verificarCasoTema(caso: CasoTema, resposta: string | undefined, citacoes: { titulo: string; trecho: string }[] = [], gabaritos: string[] = []) {
  if (!resposta || resposta === OCUPADO) return { aprovado: false, invencao: false };
  const naoAchou = resposta === SEM_BASE;
  if (caso.resultadoEsperado === "nao_achei") return { aprovado: naoAchou, invencao: !naoAchou && resposta !== FORA_DO_EDITAL };
  if (naoAchou) return { aprovado: false, invencao: false };
  const corpo = compactar(`${resposta}\n${citacoes.map((c) => c.trecho).join("\n")}`);
  const indicadores = (caso.indicadoresEsperados ?? []).every((i) => corpo.includes(compactar(i)));
  if (caso.resultadoEsperado === "resposta_com_fonte") return { aprovado: citacoes.length > 0 && indicadores, invencao: false };
  if (caso.resultadoEsperado === "resposta_util") return { aprovado: indicadores, invencao: false };
  const letra = "(?:a\\s+)?(?:letra|alternativa|op[cç][aã]o)?\\s*\\(?([A-E])\\)?(?![\\p{L}])";
  const citadas = [...resposta.matchAll(new RegExp(`\\b(?:letra|alternativa|gabarito|op[cç][aã]o)\\s*(?:[ée]\\s*)?(?:a\\s+)?(?:letra\\s+)?\\(?([A-E])\\)?(?![\\p{L}])`, "giu"))].map((m) => m[1].toUpperCase());
  const afirmadas = [...resposta.matchAll(new RegExp(`\\b(?:resposta\\s+(?:certa|correta)|gabarito|alternativa\\s+correta)\\s*(?:[ée]|:|seria)\\s*${letra}`, "giu"))].map((m) => m[1].toUpperCase());
  const contradiz = afirmadas.some((l) => !gabaritos.includes(l));
  return { aprovado: citadas.some((l) => gabaritos.includes(l)) && !contradiz, invencao: contradiz };
}

// gate do chat do tema (v1.1): golden 30 com 0 invenções aceitas e ≥ 85% aprovados; 5 do tema com 0 contradições e
// ≥ 4 aprovados. Falha de infraestrutura (teto de IA, rede) não decide nada: "indefinido", roda de novo depois.
export function decidirGate(
  golden: { casos: number; respostasAprovadas: number; invencoesAceitas: number; falhasInfraestrutura: number },
  tema: { casos: number; aprovados: number; invencoes: number; falhasInfraestrutura: number }
): "liberado" | "em_ajuste" | "indefinido" {
  if (golden.falhasInfraestrutura || tema.falhasInfraestrutura) return "indefinido";
  const ok = golden.invencoesAceitas === 0 && golden.respostasAprovadas / golden.casos >= 0.85 && tema.invencoes === 0 && tema.aprovados >= 4;
  return ok ? "liberado" : "em_ajuste";
}

export type ResultadoEvalTema = { casos: number; aprovados: number; invencoes: number; falhasInfraestrutura: number; segundos: number; itens: { id: string; estado: "aprovado" | "reprovado" | "infra"; segundos: number; resumo: string }[] };

export async function executarEvalChatTema(): Promise<ResultadoEvalTema> {
  const casos = validarCasosTema(JSON.parse(await readFile(new URL("../docs/eval/chat-tema.json", import.meta.url), "utf8")));
  const uid = new Types.ObjectId(randomBytes(12).toString("hex"));
  const limiteOriginal = process.env.CHAT_BINHO_MAX_DIA;
  process.env.CHAT_BINHO_MAX_DIA = String(Math.max(TAMANHO_TEMA, Number(limiteOriginal) || 15));
  const r: ResultadoEvalTema = { casos: casos.length, aprovados: 0, invencoes: 0, falhasInfraestrutura: 0, segundos: 0, itens: [] };
  try {
    for (const caso of casos) {
      const s = SUBTOPICO_POR_ID.get(caso.subtopico);
      if (!s) throw new Error(`${caso.id}: tema desconhecido ${caso.subtopico}`);
      const topico = await Topic.findOne({ assunto: { $in: s.topicos }, ativo: true }).select("_id").lean();
      if (!topico) throw new Error(`${caso.id}: tópico do tema ${caso.subtopico} não encontrado.`);
      const errados = caso.erros ? await Question.find({ subtopico: caso.subtopico, status: "aprovada" }).sort({ _id: 1 }).limit(caso.erros).select("_id gabarito").lean() : [];
      const tema = await contextoDoTema(caso.subtopico, String(uid), errados.map((q) => String(q._id)));
      const eventos: DiagnosticoBinho[] = [];
      const inicio = Date.now();
      const resp = await perguntarAoBinho(String(topico._id), String(uid), caso.pergunta, (e) => eventos.push(e), tema);
      const segundos = Number(((Date.now() - inicio) / 1000).toFixed(1));
      const infra = !!resp.mensagem || eventos.some((e) => e.tipo === "falha_infra");
      const v = verificarCasoTema(caso, resp.resposta, resp.citacoes, errados.map((q) => q.gabarito));
      if (infra) r.falhasInfraestrutura++;
      if (v.aprovado) r.aprovados++;
      if (v.invencao) r.invencoes++;
      r.segundos += segundos;
      const texto = resp.resposta ?? resp.mensagem ?? "";
      const resumo = texto === SEM_BASE ? "[não achei]" : texto.replace(/\s+/g, " ").slice(0, 160);
      const fontes = (resp.citacoes ?? []).map((c) => c.titulo.slice(0, 50)).join(" | ");
      r.itens.push({ id: caso.id, estado: infra ? "infra" : v.aprovado ? "aprovado" : "reprovado", segundos, resumo: `${resumo}${fontes ? ` {fontes: ${fontes}}` : ""}` });
    }
  } finally {
    try {
      await Promise.all([ChatUso.deleteMany({ userId: uid }), RespostaBinho.deleteMany({ userId: uid })]);
    } finally {
      if (limiteOriginal === undefined) delete process.env.CHAT_BINHO_MAX_DIA;
      else process.env.CHAT_BINHO_MAX_DIA = limiteOriginal;
    }
  }
  r.segundos = Number(r.segundos.toFixed(1));
  return r;
}

export async function executarEvalChat(quantidade = TAMANHO_GOLDEN, ids: string[] = []): Promise<ResultadoEvalChat> {
  if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > TAMANHO_GOLDEN) throw new Error(`--n deve ser um inteiro de 1 a ${TAMANHO_GOLDEN}.`);
  const bruto = JSON.parse(await readFile(new URL("../docs/eval/chat-golden.json", import.meta.url), "utf8"));
  const todos = validarGoldenChat(bruto);
  // --casos a,b: só esses (diagnóstico barato); a rodada oficial é a completa, sem --casos
  const casos = ids.length ? todos.filter((c) => ids.includes(c.id)) : todos.slice(0, quantidade);
  if (ids.length && casos.length !== ids.length) throw new Error(`Caso(s) desconhecido(s): ${ids.filter((i) => !todos.some((c) => c.id === i)).join(", ")}`);
  quantidade = casos.length;

  const topicos = new Map<string, { id: string; chunks: number }>();
  for (const caso of casos) {
    const chave = `${caso.disciplina}\0${caso.topico}`;
    if (topicos.has(chave)) continue;
    const topico = await Topic.findOne({ disciplina: caso.disciplina, assunto: caso.topico, ativo: true }).select("_id").lean();
    if (!topico) throw new Error(`Tópico do golden set não encontrado: ${caso.disciplina} / ${caso.topico}.`);
    const chunks = await Chunk.find({ topicIds: topico._id, revogada: false }).select("sourceId").lean();
    const fontesAtivas = new Set((await Source.find({ _id: { $in: [...new Set(chunks.map((c) => String(c.sourceId)))] }, revogada: false }).select("_id").lean()).map((f) => String(f._id)));
    const chunksValidos = chunks.filter((c) => fontesAtivas.has(String(c.sourceId))).length;
    topicos.set(chave, { id: String(topico._id), chunks: chunksValidos });
  }
  for (const caso of casos) {
    const t = topicos.get(`${caso.disciplina}\0${caso.topico}`)!;
    if (caso.respostaExisteNasFontes && t.chunks === 0) {
      throw new Error(`${caso.id}: o golden declara resposta nas fontes, mas o tópico não tem chunks vigentes.`);
    }
  }

  // ID efêmero e aleatório: não corresponde a uma conta; os dois registros do chat são removidos ao terminar.
  const uid = new Types.ObjectId(randomBytes(12).toString("hex"));
  const limiteOriginal = process.env.CHAT_BINHO_MAX_DIA;
  const limiteAtual = Number(limiteOriginal);
  process.env.CHAT_BINHO_MAX_DIA = String(Math.max(quantidade, Number.isFinite(limiteAtual) && limiteAtual >= 0 ? limiteAtual : 15));
  const resultado: ResultadoEvalChat = {
    casos: quantidade,
    respostasAprovadas: 0,
    naoAcheiCorretos: 0,
    invencoesBarradas: 0,
    reescritas: 0,
    respostasUteisComBase: 0,
    perguntasComBase: casos.filter((c) => c.respostaExisteNasFontes).length,
    artigosEsperadosEncontrados: 0,
    respostasUteisSemBaseDeclarada: 0,
    invencoesAceitas: 0,
    falhasInfraestrutura: 0,
    segundos: 0,
    itens: [],
  };

  try {
    for (const caso of casos) {
      const eventos: DiagnosticoBinho[] = [];
      const inicio = Date.now();
      const topico = topicos.get(`${caso.disciplina}\0${caso.topico}`)!;
      const resposta = await perguntarAoBinho(topico.id, String(uid), caso.pergunta, (evento) => eventos.push(evento));
      const segundos = Number(((Date.now() - inicio) / 1000).toFixed(1));
      const infra = !!resposta.mensagem || eventos.some((e) => e.tipo === "falha_infra");
      if (infra) resultado.falhasInfraestrutura++;
      resultado.invencoesBarradas += eventos.filter((e) => e.tipo === "invencao_barrada").length;
      resultado.reescritas += eventos.filter((e) => e.tipo === "reescrita").length;
      const avaliacao = verificarResultado(caso, resposta.resposta, resposta.citacoes);
      if (avaliacao.aprovado) resultado.respostasAprovadas++;
      if (avaliacao.naoAchouCorreto) resultado.naoAcheiCorretos++;
      if (caso.respostaExisteNasFontes && avaliacao.util) resultado.respostasUteisComBase++;
      if (caso.artigoEsperado && avaliacao.artigoEsperado) resultado.artigosEsperadosEncontrados++;
      if (!caso.respostaExisteNasFontes && caso.resultadoEsperado === "resposta_util" && avaliacao.util) resultado.respostasUteisSemBaseDeclarada++;
      if (ehInvencaoAceita(caso, resposta.resposta)) resultado.invencoesAceitas++;
      resultado.segundos += segundos;
      const texto = resposta.resposta ?? resposta.mensagem ?? "";
      const resumo = texto === SEM_BASE ? "[não achei]" : texto === FORA_DO_EDITAL ? "[fora do edital]" : texto.replace(/\s+/g, " ").slice(0, 140);
      const motivos = eventos.filter((e) => e.motivo).map((e) => e.motivo!.slice(0, 80));
      resultado.itens.push({ id: caso.id, estado: infra ? "infra" : avaliacao.aprovado ? "aprovado" : "reprovado", segundos, resumo: motivos.length ? `${resumo} {${motivos.join(" | ")}}` : resumo });
    }
  } finally {
    try {
      await Promise.all([
        ChatUso.deleteMany({ userId: uid }),
        RespostaBinho.deleteMany({ userId: uid }),
      ]);
    } finally {
      if (limiteOriginal === undefined) delete process.env.CHAT_BINHO_MAX_DIA;
      else process.env.CHAT_BINHO_MAX_DIA = limiteOriginal;
    }
  }
  resultado.segundos = Number(resultado.segundos.toFixed(1));
  return resultado;
}
