// ============================================================
// Teste de fumaça (fechamento v1.0): `npm run smoke` responde UMA questão com o cabeçalho X-Smoke e depois
// desfaz SÓ essa tentativa, deixando o progresso exatamente como estava: revisão espaçada, rating do aluno
// e estatísticas da questão voltam ao estado de antes. O caminho normal de responder não muda.
// ============================================================
import { Types } from "mongoose";
import { Attempt, Question, RatingAluno, ReviewState } from "./models.js";
import { ALUNO, apiServidor } from "./estudo.js";
import type { CorrecaoDTO, Confianca, Letra, Modo } from "../shared/tipos.js";

const JANELA_DESFAZER_MS = 15 * 60_000;

export async function responderSmoke(r: { questaoId: string; resposta: Letra; confianca: Confianca; tempoSeg: number; modo: Modo }): Promise<CorrecaoDTO> {
  const userId = ALUNO();
  const questionId = new Types.ObjectId(r.questaoId);
  const antes = {
    revisao: await ReviewState.findOne({ userId, questionId }).lean(),
    ratings: await RatingAluno.find({ userId }).lean(),
    questao: await Question.findById(questionId).select("rating ratingN stats").lean(),
  };
  const inicio = new Date(Date.now() - 1000);
  const correcao = await apiServidor.responder(r);
  await Attempt.findOneAndUpdate({ userId, questionId, createdAt: { $gte: inicio } }, { $set: { smoke: { antes } } }, { sort: { createdAt: -1 } });
  return correcao;
}

// desfaz a tentativa de fumaça mais recente do usuário (até 15 min); nada de fora dela é tocado
export async function desfazerSmoke(): Promise<{ desfeita: boolean }> {
  const userId = ALUNO();
  const t = await Attempt.findOne({ userId, smoke: { $exists: true }, createdAt: { $gte: new Date(Date.now() - JANELA_DESFAZER_MS) } }).sort({ createdAt: -1 }).lean();
  if (!t) return { desfeita: false };
  const antes = (t.smoke as { antes: { revisao: Record<string, unknown> | null; ratings: Record<string, unknown>[]; questao: { rating?: number; ratingN?: number; stats?: unknown } | null } }).antes;
  // revisão espaçada: some se não existia; senão volta ao documento de antes
  if (antes.revisao) await ReviewState.replaceOne({ _id: antes.revisao._id }, antes.revisao);
  else await ReviewState.deleteOne({ userId, questionId: t.questionId });
  // rating do aluno: os que a resposta criou somem; os que existiam voltam
  const idsAntes = new Set(antes.ratings.map((x) => String(x._id)));
  await RatingAluno.deleteMany({ userId, _id: { $nin: [...idsAntes].map((x) => new Types.ObjectId(x)) } });
  for (const x of antes.ratings) await RatingAluno.replaceOne({ _id: x._id }, x);
  // estatísticas e rating da questão
  if (antes.questao) {
    const { rating, ratingN, stats } = antes.questao;
    await Question.updateOne({ _id: t.questionId }, { $set: { ...(rating !== undefined ? { rating } : {}), ...(ratingN !== undefined ? { ratingN } : {}), ...(stats !== undefined ? { stats } : {}) }, $unset: { ...(rating === undefined ? { rating: 1 } : {}), ...(ratingN === undefined ? { ratingN: 1 } : {}) } });
  }
  await Attempt.deleteOne({ _id: t._id });
  return { desfeita: true };
}
