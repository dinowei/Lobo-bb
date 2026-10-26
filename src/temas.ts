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
import { ALUNO, chaveConcurso, lenteAtiva } from "./estudo.js";
import { disciplinaDoTema } from "../shared/trilhaUnica.js";
import { BANCAS } from "../shared/concursos.js";
import { prontidaoDeTodos } from "../shared/prontidao.js";
import type { ProntidaoDTO } from "../shared/prontidao.js";
import { fichaAprovada } from "./fichas.js";
import { SUBTOPICO_POR_ID } from "../shared/subtopicos.js";
import { concursosDoTema, linkYoutube, MINIMO_NOVAS, MISTAS_FIM, situacaoTrilha, tamanhoSessao, TRILHA, type InicioTrilha } from "../shared/trilha.js";
import { desempenhoPorTema, diaLocal, diasDaTrilha, type OrigemTema, type TentativaTema } from "../shared/desempenhoTema.js";
import type { Disciplina, TemaDTO, TrilhaDTO } from "../shared/tipos.js";
import conteudo from "../data/temas.json" with { type: "json" };

type ConteudoTema = {
  auto?: boolean; // veio do mapa automático do acervo (palavra-chave), ainda não conferido
  tempoMin?: number;
  objetivo?: string;
  pontos?: string[];
  lei?: { nome: string; url: string };
  materiais?: { arquivo: string; paginas: string; pagina: number; camada: "A" | "B" | "C"; titulo: string }[];
  ficha?: { texto: string; citacao: string; fonte: string };
  oficiais?: string[]; // "BB 2023 Q7" — questões oficiais do tema no acervo
};
const CONTEUDO = conteudo.temas as unknown as Record<string, ConteudoTema>; // JSON: camada vem como string

// trilha única: o domínio por tema é UM número, com as tentativas de todos os tópicos (a lente filtra depois)
async function topicosAtivos() {
  return Topic.find({ ativo: true }).select("_id disciplina assunto").lean();
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
  const lente = lenteAtiva();
  return desempenhoPorTema(ts, aprovadas, (s) => discDoSub.get(s) ?? null)
    .filter((d) => !lente || d.concursos.includes(lente))
    .sort((a, b) => (a.disciplina ?? "").localeCompare(b.disciplina ?? "") || a.nome.localeCompare(b.nome));
}

// "Prontidão para X" de todos os concursos, do MESMO domínio por tema (a aba escolhe qual mostrar)
export async function prontidao(): Promise<ProntidaoDTO[]> {
  const { ts, aprovadas, discDoSub } = await tentativasPorTema();
  const dominio = new Map(desempenhoPorTema(ts, aprovadas, (s) => discDoSub.get(s) ?? null).filter((d) => d.respondidas > 0).map((d) => [d.subtopico, d.dominio]));
  return prontidaoDeTodos(dominio);
}

// noturno: tema com < 15 aprovadas ganha prioridade (o noturno lê Config "prioridade_temas")
export async function pedirPrioridade(subtopico: string) {
  if (!SUBTOPICO_POR_ID.has(subtopico)) throw new Error("Tema desconhecido.");
  await Config.updateOne({ _id: "prioridade_temas" }, { $set: { [`valor.${subtopico}`]: new Date().toISOString(), em: new Date() } }, { upsert: true });
}

// onde a trilha começa (por aluno; a trilha é única): "Fazer deste o tema do dia" na página do tema.
// Grava o SUBTÓPICO, que não muda quando a ordem da trilha muda.
const chaveInicio = (userId: unknown = ALUNO()) => `trilha_inicio:${String(userId)}`;
export async function definirTemaDoDia(subtopico: string) {
  if (!TRILHA.some((x) => x.subtopico === subtopico)) throw new Error("Esse tema não está na trilha.");
  const valor: InicioTrilha = { subtopico, desde: diaLocal(new Date()) };
  await Config.updateOne({ _id: chaveInicio() }, { $set: { valor, em: new Date() } }, { upsert: true });
}

// Migração da trilha única: "trilha_inicio:<aluno>:<concurso>" com o NÚMERO do tema (ordem antiga) vira
// "trilha_inicio:<aluno>" com o SUBTÓPICO. Precisa rodar com a trilha antiga em data/trilha.json (antes do
// trilha-ordenar --confirmar). Os registros antigos ficam (nada é apagado). Vale o do BB; senão, o mais recente.
export async function migrarInicioTrilha(gravar: boolean) {
  if (TRILHA.some((t) => "concursos" in t)) throw new Error("data/trilha.json já está no formato novo: a migração precisa da ordem antiga.");
  const antigos = await Config.find({ _id: /^trilha_inicio:[^:]+:[a-z]+$/ }).lean();
  const porAluno = new Map<string, { concurso: string; valor: InicioTrilha; em?: Date }[]>();
  for (const c of antigos) {
    const [, aluno, concurso] = String(c._id).split(":");
    porAluno.set(aluno, [...(porAluno.get(aluno) ?? []), { concurso, valor: c.valor as InicioTrilha, em: c.em as Date | undefined }]);
  }
  const plano: { aluno: string; de: string; para: InicioTrilha }[] = [];
  for (const [aluno, lista] of porAluno) {
    const escolhido = lista.find((x) => x.concurso === "bb") ?? lista.sort((a, b) => +(b.em ?? 0) - +(a.em ?? 0))[0];
    const sub = escolhido.valor.subtopico ?? TRILHA.find((t) => t.n === escolhido.valor.n)?.subtopico;
    if (!sub) throw new Error(`aluno ${aluno}: tema nº ${escolhido.valor.n} não existe na trilha antiga`);
    plano.push({ aluno, de: `${escolhido.concurso} nº ${escolhido.valor.n ?? "-"}`, para: { subtopico: sub, desde: escolhido.valor.desde } });
  }
  const jaNovos = await Config.countDocuments({ _id: /^trilha_inicio:[^:]+$/ });
  if (gravar) for (const p of plano) await Config.updateOne({ _id: chaveInicio(p.aluno) }, { $set: { valor: p.para, em: new Date() } }, { upsert: true });
  const depois = await Config.countDocuments({ _id: /^trilha_inicio:[^:]+$/ });
  return { antigos: antigos.length, alunos: porAluno.size, jaNovos, depois, plano };
}

export async function trilha(): Promise<TrilhaDTO> {
  const { ts, aprovadas, discDoSub } = await tentativasPorTema();
  const temas = TRILHA; // trilha ÚNICA: a mesma em qualquer aba
  const hoje = diaLocal(new Date());
  const inicio = ((await Config.findById(chaveInicio()).lean())?.valor ?? null) as InicioTrilha | null;
  const s = situacaoTrilha(diasDaTrilha(ts), hoje, temas, inicio);
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
          disciplina: discDoSub.get(s.tema.subtopico) ?? disciplinaDoTema(SUBTOPICO_POR_ID.get(s.tema.subtopico)!) ?? null,
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
  const ficha = await fichaAprovada(subtopico);
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
      materialAutomatico: !!c.auto,
      fichaAcervo: ficha
        ? {
            afirmacoes: (ficha.afirmacoes ?? []).map((a) => ({
              texto: a.texto ?? "", classe: a.classe ?? "conceito", trecho: a.trecho ?? "",
              titulo: (a.arquivo ?? "").split("/").pop()!.replace(/\.pdf$/i, ""), pagina: a.pagina ?? 0, camada: (a.camada ?? "C") as "A" | "B" | "C",
            })),
            conflitos: ficha.conflitos ?? [],
            em: (ficha.createdAt as Date).toISOString(),
          }
        : null,
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

export const ORDEM_FONTE_TEMA: Record<string, unknown>[] = [{ origem: "oficial" }, { origem: "cursinho" }, { origem: { $nin: ["oficial", "cursinho"] } }];

// próxima questão de um TEMA: só daquele subtópico, NOVAS primeiro (as não respondidas), oficiais antes
// das de cursinho e estas antes das geradas; se acabaram as novas, repete com aviso.
// trilha única: questões do tema de QUALQUER banca; o aluno pode ficar numa banca só (oficial: banca da prova;
// gerada: estilo da banca; as antigas, sem banca gravada, são Cesgranrio)
export async function proximaDoTema(subtopico: string, excluir: string[] = [], banca?: string) {
  const userId = ALUNO();
  const topicos = await topicosAtivos();
  const daBanca: Record<string, unknown> = banca && banca in BANCAS
    ? { $or: [{ banca }, { banca: { $exists: false }, estiloBanca: banca }, ...(banca === "cesgranrio" ? [{ banca: { $exists: false }, estiloBanca: { $exists: false } }] : [])] }
    : {};
  const base: Record<string, unknown> = { subtopico, status: "aprovada", topicId: { $in: topicos.map((t) => t._id) }, ...daBanca };
  const doTema = (await Question.find(base).select("_id").lean()).map((q) => q._id);
  const respondidas = await Attempt.distinct("questionId", { userId, questionId: { $in: doTema } });
  const fora = [...respondidas, ...excluir.filter((x) => Types.ObjectId.isValid(x)).map((x) => new Types.ObjectId(x))];
  // ordem de fonte (decisão do dono, 26/10/2026): oficiais primeiro, depois cursinho, e as geradas só completam;
  // dentro de cada faixa, sorteio
  for (const faixa of ORDEM_FONTE_TEMA) {
    const [nova] = await Question.aggregate([{ $match: { ...base, ...faixa, _id: { $nin: fora } } }, { $sample: { size: 1 } }, { $project: { _id: 1 } }]);
    if (nova) return { id: String(nova._id), nova: true };
  }
  const [repetida] = await Question.aggregate([{ $match: { ...base, _id: { $nin: excluir.filter((x) => Types.ObjectId.isValid(x)).map((x) => new Types.ObjectId(x)) } } }, { $sample: { size: 1 } }, { $project: { _id: 1 } }]);
  return repetida ? { id: String(repetida._id), nova: false } : null;
}
