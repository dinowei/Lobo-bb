// ============================================================
// BB Estudos — "Pergunte ao Binho" por tópico (ADENDO-BINHO-VOZ, Parte 2)
// Contexto: a aula conferida do tópico + os trechos de fonte mais ligados à pergunta (RAG simples por
// palavras). O tutor responde (corrente "tutor"); um auditor de OUTRA família confere; em Conhecimentos
// Bancários, Atualidades e Vendas, resposta sobre norma só sai com citação literal conferida por código.
// Cache por aluno/tópico/pergunta normalizada; cota diária CHAT_BINHO_MAX_DIA; uma IA por vez (fila).
// O aluno nunca vê menção a IA: falhou, "O Binho está ocupado".
// ============================================================
import { Types } from "mongoose";
import { createHash } from "node:crypto";
import { Aula, ChatUso, Chunk, RespostaBinho, Source, Topic } from "./models.js";
import { chatJSONFuncao } from "./corrente.js";
import { validarOuReparar } from "./llm.js";
import { BINHO_CHAT_SYSTEM, binhoChatUser, CONFERE_BINHO_SYSTEM, ConferenciaBinhoZ, RespostaBinhoZ } from "./prompts.js";
import { ancorarCitacao } from "./aulas.js";
import { seFilaLivre } from "./fila.js";
import type { RespostaBinhoDTO } from "../shared/tipos.js";

export const OCUPADO = "O Binho está ocupado, tenta de novo em instantes.";
export const SEM_BASE = "Não achei isso nas fontes que tenho deste tópico, então prefiro não chutar. Tenta perguntar de outro jeito ou veja a aula.";
const MAX_TRECHOS = 5;

export type DiagnosticoBinho = { tipo: "invencao_barrada" | "reescrita" | "falha_infra"; motivo?: string };

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const normalizar = (s: string) => semAcento(s).toLowerCase().replace(/\s+/g, " ").trim();
export const hashPergunta = (p: string) => createHash("sha256").update(normalizar(p).replace(/[?!.]+$/, "")).digest("hex");
const PARADAS = new Set("que para com uma uns umas por como qual quais quando onde porque sobre isso essa esse esta este pode ser sao nao mais mas tem ter dos das nos nas pela pelo entre".split(" "));
const termos = (s: string) => new Set((normalizar(s).match(/[\p{L}\p{N}]{3,}/gu) ?? []).filter((w) => !PARADAS.has(w)));

// RAG simples: os trechos com mais termos da pergunta (empate: ordem da fonte); sem termo em comum, os primeiros
export function escolherTrechos<T extends { texto: string }>(pergunta: string, fontes: T[], n = MAX_TRECHOS): T[] {
  const alvo = termos(pergunta);
  const pontuados = fontes.map((f, i) => {
    const t = termos(f.texto);
    return { f, i, pontos: [...alvo].filter((w) => t.has(w)).length };
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
    if (!normalizar(t.texto).includes(normalizar(trecho))) return { invalida: true as const };
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
    if (trecho.length < 20 || !normalizar(melhor.fonte.texto).includes(normalizar(trecho))) return null;
    if (!usadas.has(melhor.fonte.indice)) usadas.set(melhor.fonte.indice, trecho);
    const semIndices = frase.replace(/\s*\[\d+\]/g, "").trim();
    const pontuacao = semIndices.match(/[.!?]+$/)?.[0] ?? "";
    return `${semIndices.slice(0, semIndices.length - pontuacao.length).trim()} [${melhor.fonte.indice}]${pontuacao}`;
  });
  if (frases.some((f) => f === null) || usadas.size > 6) return null;
  return {
    resposta: frases.join(" "),
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

// Todos os trechos vigentes do tópico (a aula usa só os 12 primeiros; para a pergunta, a busca precisa da lei inteira)
async function trechosDoTopico(topicId: Types.ObjectId) {
  const chunks = await Chunk.find({ topicIds: topicId, revogada: false }).sort({ ordem: 1, pagina: 1 }).limit(300).select("sourceId texto").lean();
  if (!chunks.length) return [];
  const validas = await Source.find({ _id: { $in: [...new Set(chunks.map((c) => String(c.sourceId)))] }, revogada: false }).select("titulo").lean();
  const titulos = new Map(validas.map((f) => [String(f._id), f.titulo]));
  return chunks.flatMap((c) => (titulos.has(String(c.sourceId)) ? [{ titulo: titulos.get(String(c.sourceId))!, texto: c.texto.slice(0, 1800) }] : []));
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

export async function perguntarAoBinho(
  topicoId: string,
  alunoId: string,
  perguntaBruta: string,
  diagnostico?: (evento: DiagnosticoBinho) => void
): Promise<RespostaBinhoDTO> {
  const pergunta = perguntaBruta.trim();
  if (!Types.ObjectId.isValid(topicoId) || !Types.ObjectId.isValid(alunoId)) throw new Error("Identificação inválida.");
  if (pergunta.length < 3 || pergunta.length > 500) throw new Error("A pergunta pode ter de 3 a 500 caracteres.");
  const tid = new Types.ObjectId(topicoId);
  const uid = new Types.ObjectId(alunoId);
  const perguntaHash = hashPergunta(pergunta);
  const doCache = async () => {
    const c = await RespostaBinho.findOne({ userId: uid, topicId: tid, perguntaHash }).lean();
    return c ? { resposta: c.resposta, citacoes: c.citacoes.map((x) => ({ titulo: x.titulo ?? "", trecho: x.trecho ?? "" })), origem: "cache" as const } : null;
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
      const trechos = escolherTrechos(pergunta, await trechosDoTopico(tid)).map((f, i) => ({ indice: i + 1, titulo: f.titulo, texto: f.texto }));
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
      });
      let t = await chatJSONFuncao("tutor", BINHO_CHAT_SYSTEM, user, 0.1, 900);
      let r = (await validarOuReparar(RespostaBinhoZ, t.json, { client: t.client, model: t.modelo, system: BINHO_CHAT_SYSTEM, user })) as ReturnType<typeof RespostaBinhoZ.parse>;
      // fora do edital ou sem base: resposta curta e fixa do código (não vai para o cache: pode ganhar fonte depois)
      if (r.foraDoEdital) return void (saida = { resposta: "Aqui eu só te ajudo com o conteúdo da prova do BB. Manda uma dúvida sobre este tópico!", citacoes: [], origem: "nova", restantesHoje });
      if (r.semBase) return void (saida = { resposta: SEM_BASE, citacoes: [], origem: "nova", restantesHoje });
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
      if (!validacao.ok) {
        if (validacao.invencao) diagnostico?.({ tipo: "invencao_barrada", motivo: validacao.motivo });
        diagnostico?.({ tipo: "reescrita", motivo: validacao.motivo });
        console.warn(`[binho] resposta rejeitada, pedindo uma reescrita: ${validacao.motivo}; trechos: ${trechos.map((x) => x.titulo).join(" | ").slice(0, 200)}`);
        const pedido = `${user}\n\nA RESPOSTA ANTERIOR FOI REJEITADA: ${validacao.motivo}\nReescreva uma única vez usando SOMENTE os trechos acima. Cada afirmação legal deve trazer [N] no próprio texto e uma citação literal correspondente em "fontes". Se os trechos não sustentarem a resposta, use semBase=true e diga que não achou nas fontes.`;
        t = await chatJSONFuncao("tutor", BINHO_CHAT_SYSTEM, pedido, 0.1, 900, { preferir: t.modelo });
        r = (await validarOuReparar(RespostaBinhoZ, t.json, { client: t.client, model: t.modelo, system: BINHO_CHAT_SYSTEM, user: pedido })) as ReturnType<typeof RespostaBinhoZ.parse>;
        if (r.foraDoEdital) return void (saida = { resposta: "Aqui eu só te ajudo com o conteúdo da prova do BB. Manda uma dúvida sobre este tópico!", citacoes: [], origem: "nova", restantesHoje });
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
  return saida ?? { mensagem: OCUPADO };
}
