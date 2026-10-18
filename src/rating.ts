// ============================================================
// BB Estudos — rating Elo no servidor (8.7): migração do histórico e relatório de calibragem
// ============================================================
import { Types } from "mongoose";
import { Attempt, Question, RatingAluno, Topic } from "./models.js";
import { dificuldadeDoRating, ratingInicialQuestao, reprocessar, RESPOSTAS_PARA_CALIBRAR } from "../shared/rating.js";
import type { Confianca, Disciplina } from "../shared/tipos.js";

// Recalcula tudo a partir das tentativas (idempotente: grava valores absolutos, não soma)
export async function migrarRatings() {
  const disciplinaDo = new Map((await Topic.find().select("disciplina").lean()).map((t) => [String(t._id), t.disciplina]));
  const tents = await Attempt.find().sort({ createdAt: 1 }).select("userId questionId topicId acertou confianca").lean();
  const difs = new Map((await Question.find({ _id: { $in: [...new Set(tents.map((t) => String(t.questionId)))] } }).select("dificuldade").lean()).map((q) => [String(q._id), q.dificuldade ?? 3]));
  // questões: um replay global (todas as pessoas, na ordem); alunos: um replay por pessoa, com o rating da questão daquele momento
  const global = reprocessar(
    tents.map((t) => ({ questaoId: String(t.questionId), disciplina: `${t.userId}|${disciplinaDo.get(String(t.topicId)) ?? "?"}`, acertou: t.acertou, confianca: (t.confianca ?? undefined) as Confianca | undefined })),
    (id) => difs.get(id) ?? 3
  );
  for (const [id, q] of global.questoes) await Question.updateOne({ _id: new Types.ObjectId(id) }, { $set: { rating: q.rating, ratingN: q.n } });
  let alunos = 0;
  for (const [chave, a] of global.alunos) {
    const [userId, d] = chave.split("|");
    if (d === "?") continue;
    const disciplina = d as Disciplina;
    await RatingAluno.updateOne({ userId: new Types.ObjectId(userId), disciplina }, { $set: { rating: a.rating, n: a.n } }, { upsert: true });
    alunos++;
  }
  return { tentativas: tents.length, questoes: global.questoes.size, alunos };
}

// Onde o rótulo da IA mais erra: geradas com 5+ respostas, rótulo × dificuldade pelo rating
export async function relatorioCalibragem() {
  const qs = await Question.find({ ratingN: { $gte: RESPOSTAS_PARA_CALIBRAR }, rating: { $exists: true } }).select("origem topicId dificuldade rating ratingN variacao.tipo").lean();
  const disciplinaDo = new Map((await Topic.find().select("disciplina").lean()).map((t) => [String(t._id), t.disciplina]));
  const grupos = new Map<string, { n: number; erroMedio: number; superestima: number; subestima: number }>();
  for (const q of qs) {
    const rotulo = q.dificuldade ?? 3;
    const real = dificuldadeDoRating(q.rating!);
    const chave = `${q.origem} · ${disciplinaDo.get(String(q.topicId)) ?? "?"}${q.variacao?.tipo ? ` · ${q.variacao.tipo}` : ""}`;
    const g = grupos.get(chave) ?? { n: 0, erroMedio: 0, superestima: 0, subestima: 0 };
    g.n++;
    g.erroMedio += rotulo - real;
    if (rotulo > real) g.superestima++;
    if (rotulo < real) g.subestima++;
    grupos.set(chave, g);
  }
  return [...grupos].map(([grupo, g]) => ({ grupo, ...g, erroMedio: g.erroMedio / g.n })).sort((a, b) => Math.abs(b.erroMedio) - Math.abs(a.erroMedio));
}

export { ratingInicialQuestao };
