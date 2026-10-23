// Migração BB + BACEN num MongoDB EM MEMÓRIA (nada de produção). Roda com ISOLAMENTO=1, como o teste de isolamento.
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

const ligado = process.env.ISOLAMENTO === "1";
let memoria: MongoMemoryServer | null = null;

before(async () => {
  if (!ligado) return;
  memoria = await MongoMemoryServer.create();
  await mongoose.connect(memoria.getUri(), { dbName: "migracao-teste" });
});
after(async () => {
  if (!ligado) return;
  await mongoose.disconnect();
  await memoria?.stop();
});

test("migração BB + BACEN: preenche só o que falta, contagens iguais, idempotente e libera Elo por concurso", { skip: !ligado }, async () => {
  const db = mongoose.connection.db!;
  const { migrarConcursos, simularMigracaoConcursos } = await import("./migracaoConcursos.js");
  const { RatingAluno } = await import("./models.js");
  const topico = new Types.ObjectId();
  const aluno = new Types.ObjectId();
  // dados como estavam antes (sem os campos novos), inseridos crus
  await db.collection("topics").insertOne({ _id: topico, disciplina: "matematica", assunto: "Porcentagem", ativo: true });
  await db.collection("questions").insertMany([
    { topicId: topico, origem: "oficial", status: "aprovada", enunciado: "Q1", gabarito: "A" },
    { topicId: topico, origem: "gerada", status: "aprovada", enunciado: "Q2", gabarito: "B", fontes: [{ trecho: "art. 1º" }] },
    { topicId: topico, origem: "gerada", status: "aprovada", enunciado: "Q3", gabarito: "C" },
  ]);
  await db.collection("users").insertOne({ email: "dono@teste.local", nome: "Dono", senhaHash: "x", papel: "admin" });
  await db.collection("attempts").insertOne({ userId: aluno, questionId: new Types.ObjectId(), topicId: topico, acertou: true });
  await db.collection("ratings_aluno").createIndex({ userId: 1, disciplina: 1 }, { unique: true, name: "userId_1_disciplina_1" });
  await db.collection("ratings_aluno").insertOne({ userId: aluno, disciplina: "matematica", rating: 1100, n: 3 });

  const sim = await simularMigracaoConcursos();
  assert.equal(sim.indiceAntigoElo, true);
  assert.equal(sim.passos.find((p) => p.descricao.startsWith("camada A (gerada"))!.afetados, 1, "só a gerada com trecho de fonte");

  const r = await migrarConcursos();
  assert.equal(r.iguais, true);
  assert.deepEqual(r.antes, r.depois);
  const qs = await db.collection("questions").find().sort({ enunciado: 1 }).toArray();
  assert.deepEqual(qs.map((q) => [q.concursos, q.formato, q.banca ?? null, q.camada ?? null]), [
    [["bb"], "multipla", "cesgranrio", "A"],
    [["bb"], "multipla", null, "A"],
    [["bb"], "multipla", null, null],
  ]);
  assert.deepEqual((await db.collection("topics").findOne({ _id: topico }))!.concursos, ["bb"]);
  const u = await db.collection("users").findOne({});
  assert.equal(u!.preferencias.concursoAtivo, "bb");
  assert.deepEqual(u!.preferencias.bancas, { bb: "cesgranrio", bacen: "a_definir" });
  assert.equal((await db.collection("attempts").findOne({}))!.concurso, "bb");
  const elo = await db.collection("ratings_aluno").findOne({ userId: aluno });
  assert.deepEqual([elo!.concurso, elo!.banca, elo!.rating, elo!.n], ["bb", "cesgranrio", 1100, 3], "Elo antigo preservado");

  // de novo: nada muda
  const r2 = await migrarConcursos();
  assert.equal(r2.feitos.reduce((s, f) => s + f.alterados, 0), 0);
  // o mesmo aluno pode ter Elo no BACEN na mesma disciplina (o índice antigo saiu)
  await RatingAluno.create({ userId: aluno, concurso: "bacen", banca: "cebraspe", disciplina: "matematica", rating: 1000 });
  assert.equal(await RatingAluno.countDocuments({ userId: aluno }), 2);
});
