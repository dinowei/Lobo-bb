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
import { Aula, ChatUso, Chunk, DISCIPLINAS_COM_FONTE_OBRIGATORIA, RespostaBinho, Source, Topic } from "./models.js";
import { chatJSONFuncao } from "./corrente.js";
import { validarOuReparar } from "./llm.js";
import { BINHO_CHAT_SYSTEM, binhoChatUser, CONFERE_BINHO_SYSTEM, ConferenciaBinhoZ, RespostaBinhoZ } from "./prompts.js";
import { ancorarCitacao } from "./aulas.js";
import { seFilaLivre } from "./fila.js";
import type { RespostaBinhoDTO } from "../shared/tipos.js";

export const OCUPADO = "O Binho está ocupado, tenta de novo em instantes.";
const SEM_BASE = "Não achei isso nas fontes que tenho deste tópico, então prefiro não chutar. Tenta perguntar de outro jeito ou veja a aula.";
const MAX_TRECHOS = 5;

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

// Citações: âncora na frase da fonte e confere literal. O modelo às vezes erra o número do trecho (vários
// trechos da mesma lei): tenta o indicado e depois os outros; o título mostrado é o de onde a frase está.
// Devolve as que valem; "invalida" se alguma não existe em trecho nenhum.
export function conferirCitacoes(fontesResp: { indice: number; trecho: string }[], trechos: { indice: number; titulo: string; texto: string }[]) {
  const validas: { titulo: string; trecho: string }[] = [];
  for (const c of fontesResp) {
    const ordem = [...trechos].sort((a, b) => Number(b.indice === c.indice) - Number(a.indice === c.indice));
    let achou: { titulo: string; trecho: string } | null = null;
    for (const t of ordem) {
      const trecho = ancorarCitacao(c.trecho, t.texto);
      if (normalizar(t.texto).includes(normalizar(trecho))) {
        achou = { titulo: t.titulo, trecho };
        break;
      }
    }
    if (!achou) return { invalida: true as const };
    if (!validas.some((v) => v.trecho === achou.trecho)) validas.push(achou);
  }
  return { invalida: false as const, citacoes: validas };
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

export async function perguntarAoBinho(topicoId: string, alunoId: string, perguntaBruta: string): Promise<RespostaBinhoDTO> {
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
      const user = binhoChatUser({
        disciplina: topic.disciplina,
        assunto: topic.assunto,
        descricao: topic.descricao ?? undefined,
        aula: aula ? `${aula.conteudo}\n\nPontos-chave:\n- ${aula.pontosChave.join("\n- ")}` : undefined,
        fontes: trechos,
        pergunta,
      });
      const t = await chatJSONFuncao("tutor", BINHO_CHAT_SYSTEM, user, 0.4, 900);
      const r = (await validarOuReparar(RespostaBinhoZ, t.json, { client: t.client, model: t.modelo, system: BINHO_CHAT_SYSTEM, user })) as ReturnType<typeof RespostaBinhoZ.parse>;
      const restantesHoje = Math.max(0, limite - (await usados(uid, dia)));
      // fora do edital ou sem base: resposta curta e fixa do código (não vai para o cache: pode ganhar fonte depois)
      if (r.foraDoEdital) return void (saida = { resposta: "Aqui eu só te ajudo com o conteúdo da prova do BB. Manda uma dúvida sobre este tópico!", citacoes: [], origem: "nova", restantesHoje });
      const exigeFonte = (DISCIPLINAS_COM_FONTE_OBRIGATORIA as readonly string[]).includes(topic.disciplina);
      const cit = conferirCitacoes(r.fontes, trechos);
      // "sem base" só vale onde a fonte é obrigatória (nas demais, conceito estável dispensa fonte)
      if (cit.invalida || (exigeFonte && (r.semBase || !cit.citacoes.length))) {
        const motivo = r.semBase ? "o tutor disse que não tem base" : cit.invalida ? `citação que não bate com o trecho (${JSON.stringify(r.fontes).slice(0, 300)})` : "sem citação numa disciplina que exige fonte";
        console.warn(`[binho] sem base: ${motivo}; trechos: ${trechos.map((t) => t.titulo).join(" | ").slice(0, 200)}`);
        return void (saida = { resposta: SEM_BASE, citacoes: [], origem: "nova", restantesHoje });
      }
      // quem confere nunca é da família de quem escreveu
      const c = await chatJSONFuncao("auditor", CONFERE_BINHO_SYSTEM, `${user}\n\nRESPOSTA A CONFERIR:\n${r.resposta}`, 0, 900, { excluirFamilias: [t.familia] });
      const conf = ConferenciaBinhoZ.parse(c.json);
      if (!conf.ok) {
        console.warn(`[binho] reprovada pelo auditor: ${conf.problemas.join(" | ").slice(0, 400)}`);
        return void (saida = { resposta: SEM_BASE, citacoes: [], origem: "nova", restantesHoje });
      }
      await RespostaBinho.updateOne(
        { userId: uid, topicId: tid, perguntaHash },
        { $setOnInsert: { pergunta, resposta: r.resposta.trim(), citacoes: cit.citacoes, modelo: t.modelo, conferidaPor: c.modelo } },
        { upsert: true }
      );
      saida = { resposta: r.resposta.trim(), citacoes: cit.citacoes, origem: "nova", restantesHoje };
    } catch (e) {
      console.warn(`[binho] ${String(e instanceof Error ? e.message : e).slice(0, 200)}`);
      saida = { mensagem: OCUPADO };
    }
  });
  if (!iniciou) return { mensagem: OCUPADO };
  return saida ?? { mensagem: OCUPADO };
}
