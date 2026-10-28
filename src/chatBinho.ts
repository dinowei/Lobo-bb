// ============================================================
// BB Estudos — "Pergunte ao Binho" por tópico (invenção zero: sem trecho que sustente, "não achei")
// Contexto: a aula conferida do tópico + os trechos de fonte mais ligados à pergunta (RAG simples por
// palavras). O tutor responde (corrente "tutor"); um auditor de OUTRA família confere; em Conhecimentos
// Bancários, Atualidades e Vendas, resposta sobre norma só sai com citação literal conferida por código.
// Cache por aluno/tópico/pergunta normalizada; cota diária CHAT_BINHO_MAX_DIA; uma IA por vez (fila).
// O aluno nunca vê menção a IA: falhou, "O Binho está ocupado".
// ============================================================
import { Types } from "mongoose";
import { createHash } from "node:crypto";
import { basename } from "node:path";
import { Attempt, Aula, ChatUso, Chunk, Config, Ficha, INDICE_VETORIAL, Question, RespostaBinho, Source, Topic } from "./models.js";
import { SUBTOPICO_POR_ID } from "../shared/subtopicos.js";
import { errosDoTema } from "../shared/estudoTema.js";
import { chatJSONFuncao } from "./corrente.js";
import { embedLote, validarOuReparar } from "./llm.js";
import { BINHO_CHAT_SYSTEM, binhoChatUser, CONFERE_BINHO_SYSTEM, ConferenciaBinhoZ, RespostaBinhoZ } from "./prompts.js";
import { ancorarCitacao } from "./aulas.js";
import { seFilaLivre } from "./fila.js";
import type { RespostaBinhoDTO } from "../shared/tipos.js";

export const OCUPADO = "O Binho está ocupado, tenta de novo em instantes.";
export const FORA_DO_EDITAL = "Aqui eu só te ajudo com o conteúdo da prova do BB. Manda uma dúvida sobre este tópico!";
export const SEM_BASE ="Não achei isso nas fontes que tenho deste tópico, então prefiro não chutar. Tenta perguntar de outro jeito ou veja a aula.";
const MAX_TRECHOS = 5;

export type DiagnosticoBinho = { tipo: "invencao_barrada" | "reescrita" | "falha_infra"; motivo?: string };

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const normalizar = (s: string) => semAcento(s).toLowerCase().replace(/\s+/g, " ").trim();
export const hashPergunta = (p: string) => createHash("sha256").update(normalizar(p).replace(/[?!.]+$/, "")).digest("hex");
const PARADAS = new Set("que para com uma uns umas por como qual quais quando onde porque sobre isso essa esse esta este pode ser sao nao mais mas tem ter dos das nos nas pela pelo entre".split(" "));
const termos = (s: string) => new Set((normalizar(s).match(/[\p{L}\p{N}]{3,}/gu) ?? []).filter((w) => !PARADAS.has(w)));

// Artigo citado na pergunta ("art. 2º", "artigo 7") e número da norma ("3.919", "13.709", "105"):
// "2º" é curto demais para virar termo e "art" aparece em todo trecho, então o código procura o artigo
export const artigosDaPergunta = (pergunta: string) => [...pergunta.matchAll(/\bart(?:igo)?\.?\s*(\d{1,3})\s*[ºo°]?/gi)].map((m) => m[1]);
const numerosDeNorma = (pergunta: string) =>
  [...pergunta.replace(/\bart(?:igo)?\.?\s*\d{1,3}\s*[ºo°]?/gi, " ").matchAll(/\b(\d{1,2}\.\d{3}|\d{2,5})(?:\/\d{2,4})?\b/g)].map((m) => m[1]);
// 28/10: a lei escreve "Art. 28." e "Art.\n302." (ponto depois do número, a partir do art. 10); antes o detector
// exigia "nada de ponto" e perdia todo artigo ≥ 10. Agora só não aceita outro dígito ("Art. 280") nem "2.1".
export const RE_ARTIGO = (n: string) => new RegExp(`\\bArt\\.?\\s*${n}\\s*[ºo°]?(?!\\d|\\.\\d)`, "i");
export const temArtigo = (texto: string, n: string) => RE_ARTIGO(n).test(texto);
// citação conferida: o MESMO texto, tolerante só ao que o PDF muda (espaço, quebra de linha, hífen de fim de
// linha, aspas e travessões); nunca a sentido
export const normalizarCitacao = (s: string) =>
  normalizar(s.replace(/(\p{L})-[ \t]*\r?\n[ \t]*(\p{L})/gu, "$1$2").replace(/[“”«»"]/g, "\"").replace(/[‘’`']/g, "'").replace(/[–—−]/g, "-"));

// RAG simples: o trecho do artigo citado primeiro; depois os com mais termos da pergunta (bônus para a norma
// citada pelo número); empate: ordem da fonte; sem termo em comum, os primeiros
export function escolherTrechos<T extends { texto: string; titulo?: string }>(pergunta: string, fontes: T[], n = MAX_TRECHOS): T[] {
  const alvo = termos(pergunta);
  const artigos = artigosDaPergunta(pergunta);
  const normas = numerosDeNorma(pergunta);
  const pontuados = fontes.map((f, i) => {
    const t = termos(f.texto);
    const daNorma = normas.length > 0 && normas.some((num) => (f.titulo ?? "").includes(num));
    const doArtigo = artigos.some((a) => temArtigo(f.texto, a)) && (normas.length === 0 || daNorma);
    return { f, i, pontos: [...alvo].filter((w) => t.has(w)).length + (doArtigo ? 100 : 0) + (daNorma ? 3 : 0) };
  });
  const com = pontuados.filter((p) => p.pontos > 0).sort((a, b) => b.pontos - a.pontos || a.i - b.i);
  return (com.length ? com : pontuados).slice(0, n).map((p) => p.f);
}

// Citações: o índice informado tem de apontar para o próprio trecho citado.
export function conferirCitacoes(fontesResp: { indice: number; trecho: string }[], trechos: { indice: number; titulo: string; texto: string }[]) {
  const validas: { titulo: string; trecho: string }[] = [];
  for (const c of fontesResp) {
    const t = trechos.find((item) => item.indice === c.indice);
    if (!t) return { invalida: true as const };
    const trecho = ancorarCitacao(c.trecho, t.texto);
    if (!normalizarCitacao(t.texto).includes(normalizarCitacao(trecho))) return { invalida: true as const };
    const achou = { titulo: t.titulo, trecho };
    if (!validas.some((v) => v.trecho === achou.trecho)) validas.push(achou);
  }
  return { invalida: false as const, citacoes: validas };
}

const AFIRMACAO_LEGAL = /\b(?:lei|art(?:igo)?|inciso|paragrafo|resolucao|circular|decreto|cmn|bcb|cvm|sac|lgpd|coaf|vigente|revogad\w*|tarifa\w*|sigilo|regulament\w*|consentimento|consumidor|dados pessoais|tratamento de dados|instituicao financeira|instituicao de pagamento|obrigator\w*|proibid\w*|vedad\w*)\b/i;
const STOP_GENERICOS_PERGUNTA = new Set(
  "qual quais quem quando onde como porque artigo art inciso paragrafo lei resolucao circular decreto cmn bcb cvm norma regulamento segundo conforme preve determina dispoe regra objetivo finalidade prazo valor percentual sobre pode pessoa toda todos cada faz fazer sao ser tem ter".split(" ")
);

export function trechosSustentamPergunta(pergunta: string, trechos: { texto: string }[]): boolean {
  if (!trechos.length) return false;
  const pTermos = termos(pergunta);
  const nucleo = [...pTermos].filter((w) => !STOP_GENERICOS_PERGUNTA.has(w));
  if (!nucleo.length) return true;
  const textoFontes = normalizar(trechos.map((t) => t.texto).join(" "));
  const presentes = nucleo.filter((w) => textoFontes.includes(w));
  return presentes.length > 0 && (presentes.length / nucleo.length >= 0.3 || presentes.length >= 2);
}

const ehFraseDeEnchimento = (s: string) => /^(?:claro|boa pergunta|vamos la|entendi|sim|nao)[.!?]*$/i.test(normalizar(s));
const separarFrases = (s: string) => s.split(/\n+|(?<=[!?])\s+|(?<=\.)\s+(?=[A-ZÁÉÍÓÚÀÈÌÒÙÃÕÇ])/u).map((x) => x.trim()).filter(Boolean);

/**
 * Gera o [n] no código. Usa primeiro citações do tutor que foram conferidas no índice exato;
 * se faltarem ou forem inválidas, tenta ancorar a frase em um dos trechos selecionados. O auditor
 * continua decidindo se o trecho realmente sustenta a frase.
 */
export function prepararCitacoesDaResposta(
  resposta: string,
  fontesResp: { indice: number; trecho: string }[],
  trechos: { indice: number; titulo: string; texto: string }[],
  exigirTodas = false,
): { resposta: string; fontes: { indice: number; trecho: string }[] } | null {
  const conferidas = conferirCitacoes(fontesResp, trechos);
  const fontesDoTutor = conferidas.invalida ? [] : fontesResp.flatMap((fonte) => {
    const trecho = trechos.find((t) => t.indice === fonte.indice);
    if (!trecho) return [];
    return [{ indice: trecho.indice, texto: trecho.texto, citacao: ancorarCitacao(fonte.trecho, trecho.texto) }];
  });
  const usadas = new Map<number, string>();
  const frases = separarFrases(resposta).map((frase) => {
    if (ehFraseDeEnchimento(frase) || (!exigirTodas && !AFIRMACAO_LEGAL.test(normalizar(frase)))) return frase;
    const alvo = termos(frase);
    if (!alvo.size) return null;
    const pontuados = trechos.map((fonte, ordem) => {
      const palavras = termos(fonte.texto);
      const comuns = [...alvo].filter((p) => palavras.has(p)).length;
      return { fonte, ordem, comuns, cobertura: comuns / alvo.size };
    }).sort((a, b) => b.comuns - a.comuns || b.cobertura - a.cobertura || a.ordem - b.ordem);
    const pontuadosDoTutor = pontuados.filter((p) => fontesDoTutor.some((f) => f.indice === p.fonte.indice));
    const melhorCitado = pontuadosDoTutor[0];
    const citaUnicaDoTutor = fontesDoTutor.length === 1 ? fontesDoTutor[0] : undefined;
    const melhor = melhorCitado && melhorCitado.comuns >= 1
      ? melhorCitado
      : pontuados[0];
    const minComuns = Math.min(2, alvo.size);
    if (!melhor || melhor.comuns < minComuns || melhor.cobertura < 0.25) return null;
    const trecho = melhor.fonte.indice === citaUnicaDoTutor?.indice
      ? citaUnicaDoTutor.citacao
      : melhorCitado === melhor
        ? fontesDoTutor.find((f) => f.indice === melhor.fonte.indice)!.citacao
        : ancorarCitacao(frase, melhor.fonte.texto);
    if (trecho.length < 20 || !normalizarCitacao(melhor.fonte.texto).includes(normalizarCitacao(trecho))) return null;
    if (!usadas.has(melhor.fonte.indice)) usadas.set(melhor.fonte.indice, trecho);
    const semIndices = frase.replace(/\s*\[\d+\]/g, "").trim();
    const pontuacao = semIndices.match(/[.!?]+$/)?.[0] ?? "";
    return `${semIndices.slice(0, semIndices.length - pontuacao.length).trim()} [${melhor.fonte.indice}]${pontuacao}`;
  });
  if (frases.some((f) => f === null) || usadas.size > 6) return null;
  const final = frases.join(" ");
  // 28/10: o tutor citou [n] com trecho conferido, mas a frase não tinha palavra "legal" da lista: a resposta saía
  // com [1] e sem a fonte (8.112, CF art. 1º, 6.404). Fica a citação do próprio tutor, já conferida.
  for (const f of fontesDoTutor) {
    if (usadas.has(f.indice) || usadas.size >= 6 || !new RegExp(`\\[${f.indice}\\]`).test(final)) continue;
    if (f.citacao.length >= 20 && normalizarCitacao(f.texto).includes(normalizarCitacao(f.citacao))) usadas.set(f.indice, f.citacao);
  }
  return {
    resposta: final,
    fontes: [...usadas].map(([indice, trecho]) => ({ indice, trecho })),
  };
}

export function validarCitacoesNaResposta(
  resposta: string,
  fontesResp: { indice: number; trecho: string }[],
  trechos: { indice: number; titulo: string; texto: string }[],
  exigirTodas = false
): { ok: true } | { ok: false; motivo: string } {
  const citacoes = conferirCitacoes(fontesResp, trechos);
  if (citacoes.invalida) return { ok: false, motivo: "citação sem correspondência literal no trecho indicado" };
  const indices = new Set(fontesResp.map((f) => f.indice));
  const frases = separarFrases(resposta);
  for (const frase of frases) {
    if (ehFraseDeEnchimento(frase) || (!exigirTodas && !AFIRMACAO_LEGAL.test(normalizar(frase)))) continue;
    const referencias = [...frase.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]));
    if (!referencias.length) return { ok: false, motivo: "afirmação legal sem citação [n]" };
    if (referencias.some((n) => !indices.has(n) || !trechos.some((t) => t.indice === n))) {
      return { ok: false, motivo: "citação [n] não existe nos trechos enviados" };
    }
  }
  return { ok: true };
}

type TrechoBusca = { id: string; titulo: string; texto: string };
async function comTitulo(chunks: { _id: unknown; sourceId: unknown; texto: string }[]): Promise<TrechoBusca[]> {
  if (!chunks.length) return [];
  const validas = await Source.find({ _id: { $in: [...new Set(chunks.map((c) => String(c.sourceId)))] }, revogada: false }).select("titulo").lean();
  const titulos = new Map(validas.map((f) => [String(f._id), f.titulo]));
  return chunks.flatMap((c) => (titulos.has(String(c.sourceId)) ? [{ id: String(c._id), titulo: titulos.get(String(c.sourceId))!, texto: c.texto.slice(0, 1800) }] : []));
}

// Todos os trechos vigentes do tópico (28/10: era limit 300 e o CPP tem 377; o fim da lei nem entrava)
async function trechosDoTopico(topicId: Types.ObjectId) {
  return comTitulo(await Chunk.find({ topicIds: topicId, revogada: false }).sort({ ordem: 1, pagina: 1 }).limit(1500).select("_id sourceId texto").lean());
}

// Busca HÍBRIDA (decisão do dono, 28/10), sem filtro de concurso nem de tema que esconda a lei:
//  1) texto exato: o artigo citado na pergunta ("art. 316"), em qualquer fonte; com número de norma ("14.133",
//     "CMN 3.919"), só nas fontes dessa norma;
//  2) vetorial: os vizinhos da pergunta no índice do Atlas (sem topicIds no filtro);
//  3) o tópico inteiro. A escolha final (escolherTrechos) dá prioridade ao artigo e à norma citados.
export const K_TRECHOS = 8;
async function trechosParaPergunta(topicId: Types.ObjectId, pergunta: string): Promise<TrechoBusca[]> {
  const artigos = artigosDaPergunta(pergunta);
  const normas = numerosDeNorma(pergunta);
  const exatos: TrechoBusca[] = [];
  for (const n of artigos.slice(0, 3)) {
    const achados = await comTitulo(await Chunk.find({ revogada: false, texto: RE_ARTIGO(n) }).limit(60).select("_id sourceId texto").lean());
    exatos.push(...(normas.length ? achados.filter((t) => normas.some((num) => t.titulo.includes(num))) : achados.slice(0, 10)));
  }
  let vetoriais: TrechoBusca[] = [];
  try {
    const [vetor] = await embedLote([pergunta], "query");
    vetoriais = await comTitulo(await Chunk.aggregate([
      { $vectorSearch: { index: INDICE_VETORIAL(), path: "embedding", queryVector: vetor, numCandidates: 200, limit: K_TRECHOS, filter: { revogada: false } } },
      { $project: { _id: 1, sourceId: 1, texto: 1 } },
    ]));
  } catch { /* sem embedding/índice: segue com texto exato + tópico */ }
  const vistos = new Set<string>();
  const unicos = [...exatos, ...(await trechosDoTopico(topicId)), ...vetoriais].filter((t) => !vistos.has(t.id) && vistos.add(t.id));
  return escolherTrechos(pergunta, unicos, K_TRECHOS);
}

const diaEmSaoPaulo = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date());
const limiteDia = () => {
  const n = Number(process.env.CHAT_BINHO_MAX_DIA);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 15;
};
async function usados(userId: Types.ObjectId, dia: string) {
  return (await ChatUso.findOne({ userId, dia }).select("quantidade").lean())?.quantidade ?? 0;
}
async function reservar(userId: Types.ObjectId, dia: string, limite: number) {
  if (limite < 1) return false;
  const filtro = { userId, dia, quantidade: { $lt: limite } };
  if (await ChatUso.findOneAndUpdate(filtro, { $inc: { quantidade: 1 } }, { returnDocument: "after" })) return true;
  try {
    await ChatUso.create({ userId, dia, quantidade: 1 });
    return true;
  } catch (e) {
    if ((e as { code?: number }).code !== 11000) throw e;
    return !!(await ChatUso.findOneAndUpdate(filtro, { $inc: { quantidade: 1 } }, { returnDocument: "after" }));
  }
}

// v1.1 (item 5): contexto do tema. A ficha aprovada entra como trechos literais citáveis (com a origem no título);
// as questões que o aluno errou no tema entram com gabarito e explicação conferidos (regra 19: nunca contradizer).
export const MAX_ERROS_NO_CHAT = 5;
const MAX_TRECHOS_FICHA = 3;
export type ContextoTema = {
  subtopico: string;
  nome: string;
  ficha: { titulo: string; texto: string }[];
  erros: { id: string; enunciado: string; gabarito: string; explicacao: string }[];
};

// Gate (v1.1, item 5): o contexto do tema só vale para o aluno depois que `bb -- eval-chat gate` passar
// (golden 30: 0 invenções e ≥ 85% úteis; + os 5 casos do tema: 0 contradições e ≥ 4 de 5). Até lá: "em ajuste",
// e o chat responde pelo tópico, como antes. Guardado em config "chat_tema" (cache curto).
export const CHAVE_GATE_CHAT_TEMA = "chat_tema";
let cacheGate: { em: number; liberado: boolean } | null = null;
export async function chatDoTemaLiberado(): Promise<boolean> {
  if (cacheGate && Date.now() - cacheGate.em < 60_000) return cacheGate.liberado;
  const c = await Config.findById(CHAVE_GATE_CHAT_TEMA).lean();
  const liberado = (c?.valor as { liberado?: boolean } | undefined)?.liberado === true;
  cacheGate = { em: Date.now(), liberado };
  return liberado;
}
// indefinida (infra) guarda a tentativa sem mexer na liberação anterior
export async function registrarGateChatTema(r: { decisao: "liberado" | "em_ajuste" | "indefinido"; golden: string; tema: string; falhas?: { id: string; estado: string; motivo: string }[] }) {
  const anterior = (await Config.findById(CHAVE_GATE_CHAT_TEMA).lean())?.valor as { liberado?: boolean } | undefined;
  const liberado = r.decisao === "indefinido" ? anterior?.liberado === true : r.decisao === "liberado";
  await Config.updateOne({ _id: CHAVE_GATE_CHAT_TEMA }, { $set: { valor: { ...r, liberado, dia: new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }) }, em: new Date() } }, { upsert: true });
  cacheGate = null;
}
export async function ultimaGateChatTema() {
  return (await Config.findById(CHAVE_GATE_CHAT_TEMA).lean())?.valor as { liberado?: boolean; decisao?: string; dia?: string } | undefined;
}

// errosIds: quais questões contam como erradas (o avaliador passa as dele; o aluno, as últimas respostas erradas)
export async function contextoDoTema(subtopico: string, alunoId: string, errosIds?: string[]): Promise<ContextoTema | null> {
  const s = SUBTOPICO_POR_ID.get(subtopico);
  if (!s || !Types.ObjectId.isValid(alunoId)) return null;
  const ficha = await Ficha.findOne({ subtopico, status: "aprovada" }).sort({ createdAt: -1 }).select("afirmacoes").lean();
  const trechosFicha = (ficha?.afirmacoes ?? [])
    .filter((a) => a.trecho && a.trecho.length >= 20)
    .map((a) => ({ titulo: `Ficha do tema ${s.nome} · ${basename(a.arquivo ?? "material")}${a.pagina ? `, p. ${a.pagina}` : ""}${a.camada ? ` (camada ${a.camada})` : ""}`, texto: a.trecho! }));
  let ids = errosIds;
  if (!ids) {
    const doTema = (await Question.find({ subtopico, status: "aprovada" }).select("_id").lean()).map((q) => q._id);
    const ts = await Attempt.find({ userId: new Types.ObjectId(alunoId), questionId: { $in: doTema } }).select("questionId acertou createdAt").lean();
    // as mais recentes primeiro (as que ainda estão erradas)
    ids = errosDoTema(ts.map((t) => ({ questaoId: String(t.questionId), acertou: !!t.acertou, data: new Date(t.createdAt as Date).toISOString() }))).reverse();
  }
  const validos = ids.filter((x) => Types.ObjectId.isValid(x)).slice(0, MAX_ERROS_NO_CHAT);
  const qs = await Question.find({ _id: { $in: validos }, status: "aprovada" }).select("enunciado gabarito explicacaoGeral alternativas").lean();
  const porId = new Map(qs.map((q) => [String(q._id), q]));
  const erros = validos.flatMap((id) => {
    const q = porId.get(id);
    if (!q) return [];
    const daCerta = q.alternativas?.find((a) => a.letra === q.gabarito)?.explicacao;
    return [{ id, enunciado: q.enunciado.slice(0, 600), gabarito: q.gabarito, explicacao: [q.explicacaoGeral, daCerta].filter(Boolean).join(" ").slice(0, 600) }];
  });
  return { subtopico, nome: s.nome, ficha: trechosFicha, erros };
}

export async function perguntarAoBinho(
  topicoId: string,
  alunoId: string,
  perguntaBruta: string,
  diagnostico?: (evento: DiagnosticoBinho) => void,
  tema?: ContextoTema | null
): Promise<RespostaBinhoDTO> {
  const pergunta = perguntaBruta.trim();
  if (!Types.ObjectId.isValid(topicoId) || !Types.ObjectId.isValid(alunoId)) throw new Error("Identificação inválida.");
  if (pergunta.length < 3 || pergunta.length > 500) throw new Error("A pergunta pode ter de 3 a 500 caracteres.");
  const tid = new Types.ObjectId(topicoId);
  const uid = new Types.ObjectId(alunoId);
  // dentro do tema, o cache também depende do tema e das questões erradas (regra 19: por aluno, questão e texto)
  const perguntaHash = hashPergunta(tema ? `${tema.subtopico} ${tema.erros.map((e) => e.id).sort().join(" ")} ${pergunta}` : pergunta);
  const comTema = (r: RespostaBinhoDTO): RespostaBinhoDTO =>
    tema && r.resposta ? { ...r, contextoTema: { nome: tema.nome, trechosDaFicha: (r.citacoes ?? []).filter((c) => c.titulo.startsWith("Ficha do tema")).length, erros: tema.erros.length } } : r;
  const doCache = async () => {
    const c = await RespostaBinho.findOne({ userId: uid, topicId: tid, perguntaHash }).lean();
    return c ? comTema({ resposta: c.resposta, citacoes: c.citacoes.map((x) => ({ titulo: x.titulo ?? "", trecho: x.trecho ?? "" })), origem: "cache" as const }) : null;
  };
  const cache = await doCache();
  if (cache) return cache;

  const topic = await Topic.findOne({ _id: tid, ativo: true }).lean();
  if (!topic) throw new Error("Tópico não encontrado.");

  let saida: RespostaBinhoDTO | undefined;
  const iniciou = await seFilaLivre(`chat do Binho no tópico ${topicoId}`, async () => {
    const outra = await doCache(); // outra aba pode ter perguntado o mesmo enquanto esperava a fila
    if (outra) return void (saida = outra);
    const limite = limiteDia();
    const dia = diaEmSaoPaulo();
    if (!(await reservar(uid, dia, limite))) {
      saida = { mensagem: `Você chegou ao limite de ${limite} perguntas novas hoje. As que você já fez continuam salvas.`, restantesHoje: 0 };
      return;
    }
    try {
      const aula = await Aula.findOne({ topicId: tid, status: "aprovada" }).select("conteudo pontosChave").lean();
      const daFicha = tema ? escolherTrechos(pergunta, tema.ficha, MAX_TRECHOS_FICHA) : [];
      const trechos = [...(await trechosParaPergunta(tid, pergunta)), ...daFicha].map((f, i) => ({ indice: i + 1, titulo: f.titulo, texto: f.texto }));
      const restantesHoje = Math.max(0, limite - (await usados(uid, dia)));
      const exigeTodaFrase = topic.disciplina === "conhecimentos_bancarios" || topic.disciplina === "atualidades_mercado_financeiro";
      const exigeFonte = exigeTodaFrase || /\b(?:art(?:igo)?|lei|decreto|resolucao|circular|norma|regulamento)\b/i.test(pergunta);
      if (exigeFonte && (!trechos.length || !trechosSustentamPergunta(pergunta, trechos))) {
        return void (saida = { resposta: SEM_BASE, citacoes: [], origem: "nova", restantesHoje });
      }
      const user = binhoChatUser({
        disciplina: topic.disciplina,
        assunto: topic.assunto,
        descricao: topic.descricao ?? undefined,
        aula: aula ? `${aula.conteudo}\n\nPontos-chave:\n- ${aula.pontosChave.join("\n- ")}` : undefined,
        fontes: trechos,
        pergunta,
        tema: tema ? { nome: tema.nome, erros: tema.erros } : undefined,
      });
      let t = await chatJSONFuncao("tutor", BINHO_CHAT_SYSTEM, user, 0.1, 900);
      let r = (await validarOuReparar(RespostaBinhoZ, t.json, { client: t.client, model: t.modelo, system: BINHO_CHAT_SYSTEM, user })) as ReturnType<typeof RespostaBinhoZ.parse>;
      // fora do edital ou sem base: resposta curta e fixa do código (não vai para o cache: pode ganhar fonte depois).
      // Onde a fonte é obrigatória, a pergunta é do tópico e não tem base: "não achei" (nunca um chute).
      if (r.foraDoEdital) return void (saida = { resposta: exigeFonte ? SEM_BASE : FORA_DO_EDITAL, citacoes: [], origem: "nova", restantesHoje });
      if (r.semBase && exigeFonte) return void (saida = { resposta: SEM_BASE, citacoes: [], origem: "nova", restantesHoje });
      let reescreveu = false;
      if (r.semBase) {
        // conceito estável (Informática, Matemática…) não precisa de fonte: pede o conceito uma vez (é a única reescrita)
        reescreveu = true;
        diagnostico?.({ tipo: "reescrita", motivo: "conceito estável marcado como sem base" });
        const pedido = `${user}\n\nEsta pergunta é de conceito estável e NÃO precisa de lei nem de fonte: responda o conceito com semBase=false e sem citar norma. Se for de lei, prazo ou regra de banco, mantenha semBase=true.`;
        t = await chatJSONFuncao("tutor", BINHO_CHAT_SYSTEM, pedido, 0.1, 900, { preferir: t.modelo });
        r = (await validarOuReparar(RespostaBinhoZ, t.json, { client: t.client, model: t.modelo, system: BINHO_CHAT_SYSTEM, user: pedido })) as ReturnType<typeof RespostaBinhoZ.parse>;
        if (r.foraDoEdital) return void (saida = { resposta: FORA_DO_EDITAL, citacoes: [], origem: "nova", restantesHoje });
        if (r.semBase) return void (saida = { resposta: SEM_BASE, citacoes: [], origem: "nova", restantesHoje });
      }
      const validarCandidato = async (escrita: typeof t, candidato: typeof r) => {
        const preparada = prepararCitacoesDaResposta(candidato.resposta, candidato.fontes, trechos, exigeTodaFrase);
        if (!preparada || (exigeTodaFrase && !preparada.fontes.length)) {
          return { ok: false as const, motivo: "afirmação sem trecho literal que a sustente", invencao: true };
        }
        const inline = validarCitacoesNaResposta(preparada.resposta, preparada.fontes, trechos, exigeTodaFrase);
        if (!inline.ok) {
          return { ok: false as const, motivo: inline.motivo, invencao: true };
        }
        // quem confere nunca é da família de quem escreveu
        const c = await chatJSONFuncao("auditor", CONFERE_BINHO_SYSTEM, `${user}\n\nRESPOSTA A CONFERIR:\n${preparada.resposta}`, 0, 900, { excluirFamilias: [escrita.familia] });
        const conf = ConferenciaBinhoZ.parse(c.json);
        if (!conf.ok) {
          const motivo = conf.problemas.join(" | ").slice(0, 400);
          const invencao = /lei|norma|prazo|percentual|regra|fonte|trecho|invent/i.test(motivo);
          return { ok: false as const, motivo: `auditor: ${motivo}`, invencao };
        }
        return { ok: true as const, resposta: preparada.resposta, citacoes: preparada.fontes.map((fonte) => ({ titulo: trechos.find((t) => t.indice === fonte.indice)!.titulo, trecho: fonte.trecho })), conferidaPor: c.modelo };
      };

      let validacao = await validarCandidato(t, r);
      if (!validacao.ok && reescreveu) {
        // já usou a única reescrita (conceito): não achei, sem nova chamada
        if (validacao.invencao) diagnostico?.({ tipo: "invencao_barrada", motivo: validacao.motivo });
        return void (saida = { resposta: SEM_BASE, citacoes: [], origem: "nova", restantesHoje });
      }
      if (!validacao.ok) {
        if (validacao.invencao) diagnostico?.({ tipo: "invencao_barrada", motivo: validacao.motivo });
        diagnostico?.({ tipo: "reescrita", motivo: validacao.motivo });
        console.warn(`[binho] resposta rejeitada, pedindo uma reescrita: ${validacao.motivo}; trechos: ${trechos.map((x) => x.titulo).join(" | ").slice(0, 200)}`);
        const pedido = `${user}\n\nA RESPOSTA ANTERIOR FOI REJEITADA: ${validacao.motivo}\nReescreva uma única vez usando SOMENTE os trechos acima. Cada afirmação legal deve trazer [N] no próprio texto e uma citação literal correspondente em "fontes". Se os trechos não sustentarem a resposta, use semBase=true e diga que não achou nas fontes.`;
        t = await chatJSONFuncao("tutor", BINHO_CHAT_SYSTEM, pedido, 0.1, 900, { preferir: t.modelo });
        r = (await validarOuReparar(RespostaBinhoZ, t.json, { client: t.client, model: t.modelo, system: BINHO_CHAT_SYSTEM, user: pedido })) as ReturnType<typeof RespostaBinhoZ.parse>;
        if (r.foraDoEdital) return void (saida = { resposta: FORA_DO_EDITAL, citacoes: [], origem: "nova", restantesHoje });
        if (r.semBase) return void (saida = { resposta: SEM_BASE, citacoes: [], origem: "nova", restantesHoje });
        validacao = await validarCandidato(t, r);
        if (!validacao.ok) {
          if (validacao.invencao) diagnostico?.({ tipo: "invencao_barrada", motivo: validacao.motivo });
          console.warn(`[binho] reescrita rejeitada: ${validacao.motivo}`);
          return void (saida = { resposta: SEM_BASE, citacoes: [], origem: "nova", restantesHoje });
        }
      }
      await RespostaBinho.updateOne(
        { userId: uid, topicId: tid, perguntaHash },
        { $setOnInsert: { pergunta, resposta: validacao.resposta.trim(), citacoes: validacao.citacoes, modelo: t.modelo, conferidaPor: validacao.conferidaPor } },
        { upsert: true }
      );
      saida = { resposta: validacao.resposta.trim(), citacoes: validacao.citacoes, origem: "nova", restantesHoje };
    } catch (e) {
      console.warn(`[binho] ${String(e instanceof Error ? e.message : e).slice(0, 200)}`);
      diagnostico?.({ tipo: "falha_infra" });
      saida = { mensagem: OCUPADO };
    }
  });
  if (!iniciou) return { mensagem: OCUPADO };
  return saida ? comTema(saida) : { mensagem: OCUPADO };
}
