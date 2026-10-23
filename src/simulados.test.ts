// Migração dos simulados num MongoDB EM MEMÓRIA (nada de produção). Roda com ISOLAMENTO=1.
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

const ligado = process.env.ISOLAMENTO === "1";
let memoria: MongoMemoryServer | null = null;

before(async () => {
  if (!ligado) return;
  memoria = await MongoMemoryServer.create();
  await mongoose.connect(memoria.getUri(), { dbName: "simulados-teste" });
});
after(async () => {
  if (!ligado) return;
  await mongoose.disconnect();
  await memoria?.stop();
});

test("simulados antigos ganham o resumo das tentativas; tentativas intactas; idempotente", { skip: !ligado }, async () => {
  const db = mongoose.connection.db!;
  const { migrarSimulados, simularMigracaoSimulados, listarSimulados } = await import("./simulados.js");
  const aluno = new Types.ObjectId();
  const lp = new Types.ObjectId(), inf = new Types.ObjectId();
  await db.collection("topics").insertMany([
    { _id: lp, disciplina: "lingua_portuguesa", assunto: "Pontuação", ativo: true },
    { _id: inf, disciplina: "informatica", assunto: "Planilhas", ativo: true },
  ]);
  const q = [new Types.ObjectId(), new Types.ObjectId(), new Types.ObjectId()];
  await db.collection("questions").insertMany([
    { _id: q[0], topicId: lp, subtopico: "pontuacao", origem: "gerada", status: "aprovada", enunciado: "Q1", gabarito: "A" },
    { _id: q[1], topicId: lp, subtopico: "pontuacao", origem: "gerada", status: "aprovada", enunciado: "Q2", gabarito: "A" },
    { _id: q[2], topicId: inf, subtopico: "planilhas", origem: "gerada", status: "aprovada", enunciado: "Q3", gabarito: "A" },
  ]);
  const quando = new Date("2026-10-10T20:00:00Z");
  await db.collection("attempts").insertMany([
    { userId: aluno, questionId: q[0], topicId: lp, resposta: "A", acertou: true, modo: "simulado", simuladoId: "s1", tempoSeg: 60, createdAt: quando },
    { userId: aluno, questionId: q[1], topicId: lp, acertou: false, modo: "simulado", simuladoId: "s1", tempoSeg: 30, createdAt: quando }, // em branco
    { userId: aluno, questionId: q[2], topicId: inf, resposta: "B", acertou: false, modo: "simulado", simuladoId: "s1", tempoSeg: 90, createdAt: quando },
    { userId: aluno, questionId: q[0], topicId: lp, resposta: "A", acertou: true, modo: "treino", createdAt: quando },
  ]);

  const sim = await simularMigracaoSimulados();
  assert.deepEqual({ t: sim.tentativas, s: sim.simulados, f: sim.faltam }, { t: 4, s: 1, f: 1 });
  const r = await migrarSimulados();
  assert.equal(r.ok, true);
  assert.equal(r.criados, 1);
  assert.equal(r.depois.tentativas, r.antes.tentativas);
  const [s] = await listarSimulados(aluno);
  assert.deepEqual({ total: s.total, acertos: s.acertos, erros: s.erros, brancos: s.brancos, tempoSeg: s.tempoSeg }, { total: 3, acertos: 1, erros: 1, brancos: 1, tempoSeg: 180 });
  assert.equal(s.nota.criterio, "pontos");
  assert.equal(s.nota.valor, 1.5);
  assert.deepEqual(s.porSubtopico.find((x) => x.subtopico === "pontuacao"), { subtopico: "pontuacao", total: 2, acertos: 1 });
  const de_novo = await migrarSimulados();
  assert.equal(de_novo.criados, 0);
  assert.equal(de_novo.ok, true);
});
