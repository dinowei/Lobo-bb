// ============================================================
// BB Estudos — praticar por TEMA (subtópico), Desempenho por tema, Trilha e Página do tema (F4).
// As regras são puras (shared/trilha.ts, shared/desempenhoTema.ts); aqui só se busca no banco.
// Conteúdo de estudo do tema (material do acervo com páginas, lei, pontos, ficha) vem de data/temas.json,
// preenchido pelo mapa do acervo (F7); sem mapa, a página mostra o que já existe.
// ============================================================
import { existsSync } from "node:fs";
import { isAbsolute, join, normalize, relative } from "node:path";
import { Types } from "mongoose";
import { Attempt, Config, Question, ReviewState, Topic } from "./models.js";
import { ALUNO, chaveConcurso } from "./estudo.js";
import { SUBTOPICO_POR_ID } from "../shared/subtopicos.js";
import { concursosDoTema, linkYoutube, MINIMO_NOVAS, MISTAS_FIM, situacaoTrilha, tamanhoSessao, TRILHA } from "../shared/trilha.js";
import { desempenhoPorTema, diaLocal, diasDaTrilha, type OrigemTema, type TentativaTema } from "../shared/desempenhoTema.js";
import type { Disciplina, TemaDTO, TrilhaDTO } from "../shared/tipos.js";
import conteudo from "../data/temas.json" with { type: "json" };

type ConteudoTema = {
  tempoMin?: number;
  objetivo?: string;
  pontos?: string[];
  lei?: { nome: string; url: string };
  materiais?: { arquivo: string; paginas: string; pagina: number; camada: "A" | "B" | "C"; titulo: string }[];
  ficha?: { texto: string; citacao: string; fonte: string };
  oficiais?: string[]; // "BB 2023 Q7" — questões oficiais do tema no acervo
};
const CONTEUDO = conteudo.temas as Record<string, ConteudoTema>;

// tópicos do concurso ativo (matéria comum nos dois; tópico antigo sem concurso = BB)
async function topicosAtivos() {
  const { concurso } = chaveConcurso();
  return Topic.find({ ativo: true, $or: [{ concursos: concurso }, ...(concurso === "bb" ? [{ concursos: { $exists: false } }] : [])] })
    .select("_id disciplina assunto").lean();
}

const origemDe = (q: { origem?: string | null; derivadaDe?: unknown; camada?: string | null }): OrigemTema =>
  q.derivadaDe ? "derivada" : q.camada === "C" ? "cursinho" : q.origem === "oficial" ? "oficial" : "gerada";

async function tentativasPorTema() {
  const userId = ALUNO();
  const topicos = await topicosAtivos();
  const ids = topicos.map((t) => t._id);
  const qs = await Question.find({ topicId: { $in: ids }, subtopico: { $exists: true } }).select("_id status subtopico origem derivadaDe camada topicId").lean();
  const porQ = new Map(qs.map((q) => [String(q._id), q]));
  const aprovadas = new Map<string, number>();
  for (const q of qs) if (q.status === "aprovada") aprovadas.set(q.subtopico!, (aprovadas.get(q.subtopico!) ?? 0) + 1);
  const at = await Attempt.find({ userId, questionId: { $in: qs.map((q) => q._id) } }).select("questionId acertou modo createdAt").lean();
  const ts: TentativaTema[] = at.flatMap((a) => {
    const q = porQ.get(String(a.questionId));
    return q ? [{ questaoId: String(a.questionId), subtopico: q.subtopico!, acertou: a.acertou, data: (a.createdAt as Date).toISOString(), simulado: a.modo === "simulado", origem: origemDe(q) }] : [];
  });
  const discDoTopico = new Map(topicos.map((t) => [String(t._id), t.disciplina as Disciplina]));
  const discDoSub = new Map<string, Disciplina>();
  for (const q of qs) if (!discDoSub.has(q.subtopico!)) discDoSub.set(q.subtopico!, discDoTopico.get(String(q.topicId))!);
  return { ts, aprovadas, discDoSub, topicos };
}

export async function desempenhoTemas() {
  const { ts, aprovadas, discDoSub } = await tentativasPorTema();
  const { concurso } = chaveConcurso();
  return desempenhoPorTema(ts, aprovadas, (s) => discDoSub.get(s) ?? null)
    .filter((d) => d.concursos.includes(concurso))
    .sort((a, b) => (a.disciplina ?? "").localeCompare(b.disciplina ?? "") || a.nome.localeCompare(b.nome));
}

// noturno: tema com < 15 aprovadas ganha prioridade (o noturno lê Config "prioridade_temas")
export async function pedirPrioridade(subtopico: string) {
  if (!SUBTOPICO_POR_ID.has(subtopico)) throw new Error("Tema desconhecido.");
  await Config.updateOne({ _id: "prioridade_temas" }, { $set: { [`valor.${subtopico}`]: new Date().toISOString(), em: new Date() } }, { upsert: true });
}

export async function trilha(): Promise<TrilhaDTO> {
  const { ts, aprovadas, discDoSub } = await tentativasPorTema();
  const { concurso } = chaveConcurso();
  const temas = TRILHA.filter((t) => concursosDoTema(t).includes(concurso));
  const hoje = diaLocal(new Date());
  const s = situacaoTrilha(diasDaTrilha(ts), hoje, temas);
  const vencidas = await ReviewState.countDocuments({ userId: ALUNO(), proximaRevisao: { $lte: new Date() } });
  const estado = s.tema ? s.estados[s.tema.subtopico] : "novo";
  const feitasHoje = s.tema ? diasDaTrilha(ts).find((d) => d.data === hoje && d.subtopico === s.tema!.subtopico) : undefined;
  return {
    rodada: s.rodada,
    modo: s.modo,
    concluidos: s.concluidos,
    total: temas.length,
    filaRetomada: s.filaRetomada.map((x) => SUBTOPICO_POR_ID.get(x)?.nome ?? x),
    hoje: s.tema
      ? {
          n: s.tema.n,
          subtopico: s.tema.subtopico,
          nome: s.tema.nome,
          disciplina: discDoSub.get(s.tema.subtopico) ?? null,
          estado,
          refazer: s.refazer,
          diaNoTema: s.diasNoTema + 1,
          aprovadas: aprovadas.get(s.tema.subtopico) ?? 0,
          novasFeitasHoje: feitasHoje?.novas ?? 0,
          acertosHoje: feitasHoje?.acertos ?? 0,
          tamanho: tamanhoSessao(estado),
          mistas: MISTAS_FIM,
        }
      : null,
    revisoesVencidas: vencidas,
    temas: temas.map((t) => ({ n: t.n, subtopico: t.subtopico, nome: t.nome, estado: s.estados[t.subtopico], acerto: s.acerto[t.subtopico] ?? null, aprovadas: aprovadas.get(t.subtopico) ?? 0 })),
  };
}

// material do acervo: só arquivos listados em data/temas.json, dentro de ACERVO_DIR (somente leitura)
export function caminhoMaterial(arquivo: string): string | null {
  const base = process.env.ACERVO_DIR;
  if (!base) return null;
  const listado = Object.values(CONTEUDO).some((c) => (c.materiais ?? []).some((m) => m.arquivo === arquivo));
  if (!listado) return null;
  const abs = normalize(join(base, arquivo));
  const rel = relative(base, abs);
  if (!rel || rel.startsWith("..") || isAbsolute(rel) || !existsSync(abs)) return null;
  return abs;
}

export async function paginaTema(subtopico: string): Promise<TemaDTO | null> {
  const s = SUBTOPICO_POR_ID.get(subtopico);
  if (!s) return null;
  const userId = ALUNO();
  const topicos = await topicosAtivos();
  const doTema = topicos.filter((t) => s.topicos.includes(t.assunto));
  const qs = await Question.find({ subtopico, topicId: { $in: topicos.map((t) => t._id) }, status: "aprovada" }).select("_id origem derivadaDe camada").lean();
  const ids = qs.map((q) => q._id);
  const [respondidas, erradas, revisoes] = await Promise.all([
    Attempt.distinct("questionId", { userId, questionId: { $in: ids } }),
    Attempt.distinct("questionId", { userId, questionId: { $in: ids }, acertou: false }),
    ReviewState.countDocuments({ userId, questionId: { $in: ids }, proximaRevisao: { $lte: new Date() } }),
  ]);
  const c = CONTEUDO[subtopico] ?? {};
  const tema = TRILHA.find((t) => t.subtopico === subtopico);
  const contar = (o: OrigemTema) => qs.filter((q) => origemDe(q) === o).length;
  const temAcervo = !!process.env.ACERVO_DIR;
  return {
    subtopico,
    nome: s.nome,
    n: tema?.n ?? null,
    disciplina: (doTema[0]?.disciplina as Disciplina) ?? null,
    topicoIds: doTema.map((t) => String(t._id)),
    concursos: s.concursos,
    aprovadas: qs.length,
    poucas: qs.length < MINIMO_NOVAS,
    estudo: {
      tempoMin: c.tempoMin ?? 45,
      objetivo: c.objetivo ?? null,
      pontos: c.pontos ?? [],
      lei: c.lei ?? null,
      ficha: c.ficha ?? null,
      materiais: (c.materiais ?? []).map((m) => ({ ...m, disponivel: temAcervo && !!caminhoMaterial(m.arquivo) })),
      youtube: linkYoutube(s.nome, chaveConcurso().concurso),
      oficiaisNoAcervo: c.oficiais ?? [],
    },
    pratica: {
      novas: qs.length - respondidas.length,
      revisoes,
      erradas: erradas.length,
      oficiais: contar("oficial"),
      geradas: contar("gerada"),
      derivadas: contar("derivada"),
      cursinho: contar("cursinho"),
    },
  };
}

// próxima questão de um TEMA: só daquele subtópico, NOVAS primeiro (as não respondidas), mais antigas
// do banco primeiro para manter a ordem estável; se acabaram as novas, repete com aviso.
export async function proximaDoTema(subtopico: string, excluir: string[] = []) {
  const userId = ALUNO();
  const topicos = await topicosAtivos();
  const base = { subtopico, status: "aprovada" as const, topicId: { $in: topicos.map((t) => t._id) } };
  const doTema = (await Question.find(base).select("_id").lean()).map((q) => q._id);
  const respondidas = await Attempt.distinct("questionId", { userId, questionId: { $in: doTema } });
  const fora = [...respondidas, ...excluir.filter((x) => Types.ObjectId.isValid(x)).map((x) => new Types.ObjectId(x))];
  const [nova] = await Question.aggregate([{ $match: { ...base, _id: { $nin: fora } } }, { $sample: { size: 1 } }, { $project: { _id: 1 } }]);
  if (nova) return { id: String(nova._id), nova: true };
  const [repetida] = await Question.aggregate([{ $match: { ...base, _id: { $nin: excluir.filter((x) => Types.ObjectId.isValid(x)).map((x) => new Types.ObjectId(x)) } } }, { $sample: { size: 1 } }, { $project: { _id: 1 } }]);
  return repetida ? { id: String(repetida._id), nova: false } : null;
}
