import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { Types } from "mongoose";
import { z } from "zod";
import { DISCIPLINAS, ChatUso, Chunk, RespostaBinho, Source, Topic } from "./models.js";
import { FORA_DO_EDITAL, OCUPADO, SEM_BASE, perguntarAoBinho, type DiagnosticoBinho } from "./chatBinho.js";

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
