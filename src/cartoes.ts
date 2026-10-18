// ============================================================
// BB Estudos — cartões de memorização (Etapa 8.6)
// Normas: só de fonte ingerida, com trecho literal. Inglês: vocabulário dos textos das provas
// oficiais. Checagem por código (trecho literal, números do verso no trecho) e auditor de outra
// família. Revisão espaçada própria (SM-2 do shared/motor.ts).
// ============================================================
import { Types } from "mongoose";
import { Cartao, CartaoRevisao, Chunk, DISCIPLINAS_COM_FONTE_OBRIGATORIA, Question, Source, Tarefa, Topic } from "./models.js";
import { correnteAtiva, chatJSONFuncao } from "./corrente.js";
import { SemModeloDisponivel, ehFalhaDeInfra } from "./llm.js";
import { CartoesZ, CARTOES_NORMA_SYSTEM, CARTOES_VOCAB_SYSTEM, cartoesUser, ConfereCartoesZ, CONFERE_CARTOES_SYSTEM, confereCartoesUser } from "./prompts.js";
import { pregeracoes, rodarFila } from "./noturno.js";
import { ancorarCitacao, fontesDoTopico } from "./aulas.js";
import { usuarioAtualId } from "./auth.js";
import { ESTADO_INICIAL, agendar } from "../shared/motor.js";
import type { CartaoDTO, Disciplina, FilaCartoesDTO, NotaCartao } from "../shared/tipos.js";

export const CARTOES_POR_TOPICO = 12; // meta de aprovados por tópico
export const NOVOS_POR_DIA = Number(process.env.CARTOES_NOVOS_DIA) || 20;
const POR_RODADA = 6;

type Fonte = { indice: number; titulo: string; texto: string; sourceId?: string; questionId?: string };
type Gerado = { frente: string; verso: string; indice: number; trecho: string };

const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
export const chaveDe = (frente: string) => normalizar(frente).replace(/[^a-z0-9 ]/g, "").trim();
const numeros = (s: string) => (s.match(/\d+(?:[.,]\d+)*/g) ?? []).map((n) => n.replace(/[.,]/g, ""));

// Checagem por código: trecho literal na fonte; todo número do verso está no trecho; no vocabulário,
// a palavra da frente aparece no trecho. Devolve o motivo da recusa ou undefined.
export function validarCartao(c: Gerado, tipo: "norma" | "vocabulario", fontes: Fonte[]): string | undefined {
  const fonte = fontes.find((f) => f.indice === c.indice);
  if (!fonte) return "fonte inexistente";
  if (!normalizar(fonte.texto).includes(normalizar(c.trecho))) return "trecho não é literal";
  if (tipo === "norma") {
    const doTrecho = new Set(numeros(c.trecho));
    const soltos = numeros(c.verso).filter((n) => !doTrecho.has(n));
    if (soltos.length) return `número fora do trecho (${soltos.join(", ")})`;
  } else if (!normalizar(c.trecho).includes(normalizar(c.frente))) return "a palavra não aparece no trecho";
  if (normalizar(c.verso) === normalizar(c.frente)) return "verso igual à frente";
  return undefined;
}

async function fontesVocabulario(topicId: Types.ObjectId): Promise<Fonte[]> {
  // textos de apoio das oficiais de Inglês (do tópico; se não houver, de toda a disciplina)
  const textos = (ids: Types.ObjectId[]) =>
    Question.find({ topicId: { $in: ids }, origem: "oficial", status: "aprovada", textoBase: { $nin: [null, ""] } }).select("textoBase prova").lean();
  const doTopico = await textos([topicId]);
  const qs = doTopico.length ? doTopico : await textos((await Topic.distinct("_id", { disciplina: "lingua_inglesa" })) as Types.ObjectId[]);
  const vistos = new Set<string>();
  return qs
    .filter((q) => !vistos.has(q.textoBase!) && vistos.add(q.textoBase!))
    .slice(0, 4)
    .map((q, i) => ({ indice: i + 1, titulo: `Texto da prova ${q.prova ?? "oficial"}`, texto: q.textoBase!.slice(0, 3000), questionId: String(q._id) }));
}

async function gerarCartoes(topicId: string, preferir?: string) {
  if (!Types.ObjectId.isValid(topicId)) return { ok: false, motivo: "topico_inexistente" };
  const topic = await Topic.findOne({ _id: new Types.ObjectId(topicId), ativo: true }).lean();
  if (!topic) return { ok: false, motivo: "topico_inexistente" };
  const tipo = topic.disciplina === "lingua_inglesa" ? "vocabulario" : "norma";
  const fontes: Fonte[] = tipo === "vocabulario" ? await fontesVocabulario(topic._id) : await fontesDoTopico(topic._id);
  if (!fontes.length) return { ok: false, motivo: "sem_fontes" };
  const existentes = await Cartao.find({ topicId: topic._id }).select("frente chave").lean();
  const chaves = new Set(existentes.map((c) => c.chave));
  try {
    const escritor = await chatJSONFuncao("tutor", tipo === "vocabulario" ? CARTOES_VOCAB_SYSTEM : CARTOES_NORMA_SYSTEM, cartoesUser(topic.assunto, fontes, existentes.map((c) => c.frente).slice(0, 60), POR_RODADA), 0.3, 2400, { preferir });
    // trecho parafraseado ou longo: vira a frase literal da fonte (mesma regra das aulas); a checagem de
    // números do verso e da palavra do vocabulário roda depois, sobre o trecho já literal
    const gerados = CartoesZ.parse(escritor.json).cartoes.map((c) => {
      const fonte = fontes.find((f) => f.indice === c.indice);
      return fonte ? { ...c, trecho: ancorarCitacao(c.trecho, fonte.texto) } : c;
    });
    const candidatos: (Gerado & { chave: string })[] = [];
    const recusas: string[] = [];
    for (const c of gerados) {
      const chave = chaveDe(c.frente);
      const erro = chaves.has(chave) ? "repetido" : validarCartao(c, tipo, fontes);
      if (erro) recusas.push(`${c.frente.slice(0, 40)}: ${erro}`);
      else {
        chaves.add(chave);
        candidatos.push({ ...c, chave });
      }
    }
    if (!candidatos.length) return { ok: false, motivo: "cartoes_invalidos", detalhes: recusas.join(" | ").slice(0, 500) };
    const auditor = await chatJSONFuncao("auditor", CONFERE_CARTOES_SYSTEM, confereCartoesUser(candidatos), 0, 1600, { excluirFamilias: [escritor.familia] });
    const veredictos = new Map(ConfereCartoesZ.parse(auditor.json).veredictos.map((v) => [v.i, v]));
    let aprovados = 0;
    for (const [i, c] of candidatos.entries()) {
      const v = veredictos.get(i + 1);
      const fonte = fontes.find((f) => f.indice === c.indice)!;
      const ok = v?.ok === true;
      if (ok) aprovados++;
      await Cartao.updateOne(
        { topicId: topic._id, chave: c.chave },
        {
          $setOnInsert: {
            topicId: topic._id,
            tipo,
            frente: c.frente.trim(),
            verso: c.verso.trim(),
            chave: c.chave,
            trecho: c.trecho.trim(),
            titulo: fonte.titulo,
            ...(fonte.sourceId ? { sourceId: new Types.ObjectId(fonte.sourceId) } : {}),
            ...(fonte.questionId ? { questionId: new Types.ObjectId(fonte.questionId) } : {}),
            status: ok ? "aprovado" : "reprovado",
            geradoPor: escritor.modelo,
            auditoria: { modelo: auditor.modelo, problema: ok ? undefined : v?.problema ?? "sem veredito", em: new Date() },
          },
        },
        { upsert: true }
      );
    }
    console.log(`  cartões de "${topic.assunto}": ${aprovados}/${candidatos.length} aprovados${recusas.length ? ` · ${recusas.length} barrados por código` : ""}`);
    return aprovados ? { ok: true } : { ok: false, motivo: "cartoes_reprovados", detalhes: recusas.join(" | ").slice(0, 500) };
  } catch (e) {
    const motivo = e instanceof SemModeloDisponivel ? "aguardando_modelo" : ehFalhaDeInfra(e) ? "provedor_falhou" : "cartoes_invalidos";
    return { ok: false, motivo, detalhes: String(e instanceof Error ? e.message : e).slice(0, 500) };
  }
}

pregeracoes["cartoes"] = (params, preferir) => gerarCartoes((params as { topicId: string }).topicId, preferir);

// Tópicos com fonte (normas) ou de Inglês, abaixo da meta de cartões e sem tarefa aberta
async function topicosElegiveis(opcoes: { assunto?: string; max: number }) {
  const disciplinas = [...DISCIPLINAS_COM_FONTE_OBRIGATORIA, "lingua_inglesa"] as Disciplina[];
  const assunto = opcoes.assunto ? new RegExp(opcoes.assunto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") : /./;
  const topicos = await Topic.find({ ativo: true, disciplina: { $in: disciplinas }, assunto }).sort({ disciplina: 1, assunto: 1 }).select("_id disciplina assunto").lean();
  if (!topicos.length) return [];
  const ids = topicos.map((t) => t._id);
  const contagem = new Map((await Cartao.aggregate<{ _id: Types.ObjectId; n: number }>([{ $match: { topicId: { $in: ids }, status: "aprovado" } }, { $group: { _id: "$topicId", n: { $sum: 1 } } }])).map((c) => [String(c._id), c.n]));
  const abertas = new Set((await Tarefa.distinct("params.topicId", { tipo: "cartoes", status: { $in: ["pendente", "rodando", "aguardando"] } })).map(String));
  const chunks = await Chunk.find({ topicIds: { $in: ids }, revogada: false }).select("topicIds sourceId").lean();
  const validas = new Set((await Source.distinct("_id", { _id: { $in: chunks.map((c) => c.sourceId) }, revogada: false })).map(String));
  const comFonte = new Set(chunks.filter((c) => validas.has(String(c.sourceId))).flatMap((c) => c.topicIds.map(String)));
  return topicos
    .filter((t) => (contagem.get(String(t._id)) ?? 0) < CARTOES_POR_TOPICO && !abertas.has(String(t._id)))
    .filter((t) => t.disciplina === "lingua_inglesa" || comFonte.has(String(t._id)))
    .slice(0, Math.max(0, Math.floor(opcoes.max)));
}

export async function planejarCartoes(lote: string, max = Number(process.env.CARTOES_NOITE) || 6) {
  const elegiveis = await topicosElegiveis({ max });
  if (elegiveis.length) await Tarefa.insertMany(elegiveis.map((t) => ({ tipo: "cartoes", params: { topicId: String(t._id) }, lote })));
  return elegiveis.length;
}

export async function gerarCartoesAgora(opcoes: { assunto?: string; n?: number } = {}) {
  const limite = Math.max(1, Math.min(20, Math.floor(opcoes.n ?? 3)));
  const topicos = await topicosElegiveis({ assunto: opcoes.assunto, max: limite });
  const lote = `cartões ${new Date().toISOString().slice(0, 10)}`;
  const tarefas = topicos.length ? await Tarefa.insertMany(topicos.map((t) => ({ tipo: "cartoes", params: { topicId: String(t._id) }, lote }))) : [];
  const atual = await correnteAtiva();
  return rodarFila({ max: tarefas.length, trabalhadores: 1, tarefaIds: tarefas.map((t) => String(t._id)), geradores: atual.correntes.tutor });
}

// ---------- estudo ----------
const inicioDoDia = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export async function filaCartoes(): Promise<FilaCartoesDTO> {
  const userId = usuarioAtualId();
  const agora = new Date();
  const [vencidas, vistos, novosHoje, total] = await Promise.all([
    CartaoRevisao.find({ userId, proximaRevisao: { $lte: agora } }).sort({ proximaRevisao: 1 }).limit(60).lean(),
    CartaoRevisao.distinct("cartaoId", { userId }),
    CartaoRevisao.countDocuments({ userId, createdAt: { $gte: inicioDoDia() } }),
    Cartao.countDocuments({ status: "aprovado" }),
  ]);
  const novosRestantesHoje = Math.max(0, NOVOS_POR_DIA - novosHoje);
  const [devidos, novos] = await Promise.all([
    Cartao.find({ _id: { $in: vencidas.map((v) => v.cartaoId) }, status: "aprovado" }).lean(),
    novosRestantesHoje ? Cartao.find({ status: "aprovado", _id: { $nin: vistos } }).sort({ createdAt: 1 }).limit(novosRestantesHoje).lean() : Promise.resolve([]),
  ]);
  const topicos = new Map((await Topic.find({ _id: { $in: [...devidos, ...novos].map((c) => c.topicId) } }).select("assunto disciplina").lean()).map((t) => [String(t._id), t]));
  const dto = (c: (typeof devidos)[number], novo: boolean): CartaoDTO => {
    const t = topicos.get(String(c.topicId));
    return {
      id: String(c._id),
      disciplina: (t?.disciplina ?? "conhecimentos_bancarios") as Disciplina,
      assunto: t?.assunto ?? "",
      tipo: c.tipo as CartaoDTO["tipo"],
      frente: c.frente,
      verso: c.verso,
      fonte: { titulo: c.titulo ?? "Fonte", trecho: c.trecho },
      novo,
    };
  };
  const ordemDevidos = new Map(vencidas.map((v, i) => [String(v.cartaoId), i]));
  return {
    cartoes: [...devidos.sort((a, b) => ordemDevidos.get(String(a._id))! - ordemDevidos.get(String(b._id))!).map((c) => dto(c, false)), ...novos.map((c) => dto(c, true))],
    vencidos: devidos.length,
    novosRestantesHoje,
    total,
  };
}

export async function avaliarCartao(cartaoId: string, nota: NotaCartao) {
  if (!Types.ObjectId.isValid(cartaoId)) throw new Error("Cartão inválido.");
  const userId = usuarioAtualId();
  const id = new Types.ObjectId(cartaoId);
  if (!(await Cartao.exists({ _id: id, status: "aprovado" }))) throw new Error("Cartão não encontrado.");
  const atual = await CartaoRevisao.findOne({ userId, cartaoId: id }).lean();
  const novo = agendar(atual ?? ESTADO_INICIAL, nota);
  // errou: volta em 10 minutos, ainda nesta sessão (cartão é rápido); o resto segue o SM-2
  const proxima = nota === 1 ? new Date(Date.now() + 10 * 60_000) : new Date(Date.now() + novo.intervaloDias * 86_400_000);
  await CartaoRevisao.updateOne({ userId, cartaoId: id }, { $set: { facilidade: novo.facilidade, intervaloDias: novo.intervaloDias, repeticoes: novo.repeticoes, proximaRevisao: proxima } }, { upsert: true });
  return { proximaRevisaoDias: nota === 1 ? 0 : novo.intervaloDias };
}
