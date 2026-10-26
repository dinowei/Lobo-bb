// Noturno resiliente (fechamento v1.0): rodar a etapa duas vezes não duplica nada.
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
  await mongoose.connect(memoria.getUri(), { dbName: "idempotencia-teste" });
});
after(async () => {
  if (!ligado) return;
  await mongoose.disconnect();
  await memoria?.stop();
});

test("Atlas: alerta no relatório diário acima de 70%", async () => {
  const { atlasEmAlerta } = await import("./esteiraConteudo.js");
  assert.equal(atlasEmAlerta(0.7), false);
  assert.equal(atlasEmAlerta(0.71), true);
});

const alt = (letra: string, correta: boolean) => ({ letra, texto: `alt ${letra}`, correta, explicacao: `porque ${letra}` });

test("classificação: a 2ª rodada não regrava nada (só mexe em questão sem subtópico)", { skip: !ligado }, async () => {
  const { Question, Topic } = await import("./models.js");
  const { classificarBanco } = await import("./subtopicos.js");
  const t = await Topic.create({ disciplina: "lingua_portuguesa", assunto: "Pontuação", ativo: true });
  await Question.create({ topicId: t._id, origem: "gerada", dificuldade: 3, enunciado: "Vírgula?", alternativas: ["A", "B", "C", "D", "E"].map((l) => alt(l, l === "A")), gabarito: "A", explicacaoGeral: "g", status: "aprovada" });
  const r1 = await classificarBanco({ ia: false, gravar: true });
  assert.equal(r1.total, 1);
  const r2 = await classificarBanco({ ia: false, gravar: true });
  assert.equal(r2.total, 0, "nada a fazer na 2ª vez");
  assert.equal(await Question.countDocuments({}), 1);
});

test("derivação C/E: questão já derivada não é derivada de novo (e nem chama a IA)", { skip: !ligado }, async () => {
  const { ItemCE, Question, Topic } = await import("./models.js");
  const { derivarCE } = await import("./certoErrado.js");
  const t = await Topic.create({ disciplina: "conhecimentos_bancarios", assunto: "Pix", ativo: true });
  const q = await Question.create({ topicId: t._id, origem: "gerada", dificuldade: 3, enunciado: "Sobre o Pix", alternativas: ["A", "B", "C", "D", "E"].map((l) => alt(l, l === "C")), gabarito: "C", explicacaoGeral: "g", status: "aprovada", subtopico: "pix" });
  await ItemCE.create({ topicId: t._id, origem: "derivada", derivadaDe: q._id, afirmacao: "O Pix funciona 24 h.", gabarito: "C", explicacao: "e", subtopico: "pix", status: "aprovada" });
  const antes = await ItemCE.countDocuments({});
  const r = await derivarCE({ questoes: 5, subtopico: "pix" });
  assert.equal(r.questoes, 0, "nada novo para derivar");
  assert.equal(await ItemCE.countDocuments({}), antes);
});
