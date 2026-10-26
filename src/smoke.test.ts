// Teste de fumaça: responder com X-Smoke e desfazer deixa o progresso exatamente como estava.
// MongoDB EM MEMÓRIA (nada de produção). Roda com ISOLAMENTO=1.
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

const ligado = process.env.ISOLAMENTO === "1";
let memoria: MongoMemoryServer | null = null;
before(async () => {
  if (!ligado) return;
  memoria = await MongoMemoryServer.create({ instance: { launchTimeout: 90_000 } });
  await mongoose.connect(memoria.getUri(), { dbName: "smoke-teste" });
});
after(async () => {
  if (!ligado) return;
  await mongoose.disconnect();
  await memoria?.stop();
});

test("smoke: responde e desfaz só essa tentativa (revisão, rating e estatística voltam)", { skip: !ligado }, async () => {
  const { Attempt, Question, RatingAluno, ReviewState, Topic } = await import("./models.js");
  const { desfazerSmoke, responderSmoke } = await import("./smoke.js");
  const { ALUNO } = await import("./estudo.js");
  const topico = await Topic.create({ disciplina: "lingua_portuguesa", assunto: "Crase", ativo: true });
  const alt = (letra: string, correta: boolean) => ({ letra, texto: `alt ${letra}`, correta, explicacao: `porque ${letra}` });
  const q = await Question.create({ topicId: topico._id, origem: "gerada", dificuldade: 3, enunciado: "Qual?", alternativas: ["A", "B", "C", "D", "E"].map((l) => alt(l, l === "B")), gabarito: "B", explicacaoGeral: "g", status: "aprovada" });
  // progresso que já existia e não pode mudar
  await Attempt.create({ userId: ALUNO(), questionId: q._id, topicId: topico._id, resposta: "A", acertou: false, xp: 2 });
  await ReviewState.create({ userId: ALUNO(), questionId: q._id, facilidade: 2.3, intervaloDias: 1, repeticoes: 0, proximaRevisao: new Date("2026-10-27T00:00:00Z") });
  const foto = async () => ({
    tentativas: await Attempt.countDocuments({ userId: ALUNO() }),
    revisao: await ReviewState.findOne({ userId: ALUNO(), questionId: q._id }).select("-_id facilidade intervaloDias repeticoes proximaRevisao").lean(),
    ratings: await RatingAluno.countDocuments({ userId: ALUNO() }),
    questao: await Question.findById(q._id).select("-_id rating ratingN stats").lean(),
  });
  const antes = await foto();
  const c = await responderSmoke({ questaoId: String(q._id), resposta: "B", confianca: 3, tempoSeg: 10, modo: "treino" });
  assert.equal(c.gabarito, "B");
  assert.notDeepEqual(await foto(), antes, "a resposta mudou o estado");
  assert.deepEqual(await desfazerSmoke(), { desfeita: true });
  assert.deepEqual(await foto(), antes, "tudo voltou como estava");
  assert.deepEqual(await desfazerSmoke(), { desfeita: false }, "não desfaz a tentativa antiga (que não é de fumaça)");
});
