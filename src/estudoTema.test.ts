// v1.1, item 3, no servidor, num MongoDB EM MEMÓRIA (nada de produção). Roda com ISOLAMENTO=1.
// Sessão do tema: novas por subtema (fácil → difícil), revisão dos erros do tema; mistura só de temas abertos.
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

const ligado = process.env.ISOLAMENTO === "1";
let memoria: MongoMemoryServer | null = null;

before(async () => {
  if (!ligado) return;
  process.env.ALUNO_ID = "0000000000000000000000aa";
  memoria = await MongoMemoryServer.create();
  await mongoose.connect(memoria.getUri(), { dbName: "estudo-tema-teste" });
});
after(async () => {
  if (!ligado) return;
  await mongoose.disconnect();
  await memoria?.stop();
});

test("sessão do tema: subtema do edital → fácil a difícil; erros do tema; revisão e simulado só de temas abertos", { skip: !ligado }, async () => {
  const db = mongoose.connection.db!;
  const { apiServidor } = await import("./estudo.js");
  const aluno = new Types.ObjectId(process.env.ALUNO_ID);
  const conc = new Types.ObjectId(), mat = new Types.ObjectId();
  await db.collection("topics").insertMany([
    { _id: conc, disciplina: "lingua_portuguesa", assunto: "Concordância verbal e nominal", subtopicos: ["Concordância verbal", "Concordância nominal"], ativo: true },
    { _id: mat, disciplina: "matematica", assunto: "Porcentagem", subtopicos: [], ativo: true },
  ]);
  const alt = (t: string) => ["A", "B", "C", "D", "E"].map((l) => ({ letra: l, texto: `${t} ${l}`, correta: l === "A", explicacao: "x" }));
  const q = (subtopico: string, topicId: Types.ObjectId, enunciado: string, dificuldade: number) =>
    ({ _id: new Types.ObjectId(), topicId, subtopico, origem: "gerada", status: "aprovada", enunciado, dificuldade, gabarito: "A", alternativas: alt("opção"), explicacaoGeral: "x" });
  const nominalFacil = q("concordancia", conc, "Concordância nominal: bastante ou bastantes?", 1);
  const verbalDificil = q("concordancia", conc, "Concordância verbal com sujeito posposto", 4);
  const verbalFacil = q("concordancia", conc, "Concordância verbal do verbo haver", 2);
  const porcento = q("porcentagem", mat, "Quanto é 10% de 50?", 1);
  await db.collection("questions").insertMany([nominalFacil, verbalDificil, verbalFacil, porcento]);

  // 1) novas do tema: subtema "Concordância verbal" (1º do edital) antes do nominal, e a fácil antes da difícil
  const ordem: string[] = [];
  for (let i = 0; i < 3; i++) {
    const r = await apiServidor.proxima({ subtopico: "concordancia", excluir: ordem });
    ordem.push(r.questao!.id);
    if (i === 0) assert.equal(r.questao!.subtema, "Concordância verbal");
  }
  assert.deepEqual(ordem, [verbalFacil._id, verbalDificil._id, nominalFacil._id].map(String));

  // 2) erros do tema: a última resposta errada volta; corrigida sai; nada de outra matéria
  const t = (questionId: Types.ObjectId, topicId: Types.ObjectId, acertou: boolean, dia: number) =>
    ({ userId: aluno, questionId, topicId, resposta: acertou ? "A" : "B", acertou, modo: "treino", tempoSeg: 30, createdAt: new Date(Date.UTC(2026, 9, dia)) });
  await db.collection("attempts").insertMany([
    t(verbalFacil._id, conc, false, 1), t(verbalFacil._id, conc, true, 2), // corrigida
    t(verbalDificil._id, conc, false, 3),
    t(nominalFacil._id, conc, true, 3),
    t(porcento._id, mat, false, 3),
  ]);
  const e1 = await apiServidor.proxima({ subtopico: "concordancia", erros: true });
  assert.equal(e1.questao?.id, String(verbalDificil._id));
  const e2 = await apiServidor.proxima({ subtopico: "concordancia", erros: true, excluir: [String(verbalDificil._id)] });
  assert.equal(e2.questao, null);
  assert.match(e2.aviso ?? "", /Nenhum erro/);

  // 3) mistura: Concordância em andamento (nenhum concluído) entra; Porcentagem também foi respondida,
  // então as duas estão em andamento; um tema nunca respondido não entra
  const nunca = q("crase", conc, "Crase antes de palavra feminina", 1);
  await db.collection("questions").insertOne(nunca);
  const vencida = new Date(Date.UTC(2026, 0, 1));
  await db.collection("reviewstates").insertMany([
    { userId: aluno, questionId: nunca._id, proximaRevisao: vencida, intervalo: 1, facilidade: 2.5, repeticoes: 0 },
    { userId: aluno, questionId: verbalDificil._id, proximaRevisao: vencida, intervalo: 1, facilidade: 2.5, repeticoes: 0 },
  ]);
  const rev = await apiServidor.proxima({ revisao: true });
  assert.equal(rev.questao?.id, String(verbalDificil._id), "revisão de tema não iniciado não entra na mistura");
  // Simulado "Só o que estudei": sem tema não iniciado
  const estudado = await apiServidor.simulado(10, { modo: "estudado" });
  assert.ok(estudado.length > 0);
  assert.ok(estudado.every((x) => x.id !== String(nunca._id)), "só o que estudei: sem tema não iniciado");
  // "Prova completa" (padrão): todas as matérias, sem restrição de tema (o não iniciado entra)
  for (const completa of [await apiServidor.simulado(10), await apiServidor.simulado(10, { modo: "completa" })]) {
    assert.ok(completa.some((x) => x.id === String(nunca._id)), "prova completa: sem restrição de tema");
    assert.equal(completa.length, 5, "as 5 questões do banco");
  }
});

test("tema escolhido à mão (\"estudando\"): guardado no servidor por aluno, vale em qualquer aparelho", { skip: !ligado }, async () => {
  const { apiServidor } = await import("./estudo.js");
  const { comUsuario } = await import("./auth.js");
  const a = { id: new Types.ObjectId(), nome: "A", email: "a@teste", papel: "aluno" as const };
  const b = { id: new Types.ObjectId(), nome: "B", email: "b@teste", papel: "aluno" as const };
  assert.equal(await comUsuario(a, () => apiServidor.estudando()), "", "sem escolha: segue a Grade");
  await comUsuario(a, () => apiServidor.definirEstudando("crase"));
  // "outro aparelho" = outra requisição do mesmo aluno: lê o mesmo valor
  assert.equal(await comUsuario(a, () => apiServidor.estudando()), "crase");
  assert.equal(await comUsuario(b, () => apiServidor.estudando()), "", "por aluno: B não vê a escolha de A");
  await assert.rejects(comUsuario(a, () => apiServidor.definirEstudando("tema-inventado")), /não está na trilha/);
  await comUsuario(a, () => apiServidor.definirEstudando(""));
  assert.equal(await comUsuario(a, () => apiServidor.estudando()), "", "voltar à sequência");
});

test("chat do tema: contexto = ficha aprovada (trecho literal + origem) e questões erradas com gabarito; trava da gate", { skip: !ligado }, async () => {
  const db = mongoose.connection.db!;
  const { contextoDoTema, chatDoTemaLiberado, registrarGateChatTema } = await import("./chatBinho.js");
  const aluno = new Types.ObjectId();
  const top = new Types.ObjectId();
  const alt = ["A", "B", "C", "D", "E"].map((l) => ({ letra: l, texto: `op ${l}`, correta: l === "C", explicacao: l === "C" ? "Porque há artigo." : "x" }));
  const errada = { _id: new Types.ObjectId(), topicId: top, subtopico: "crase", origem: "gerada", status: "aprovada", enunciado: "Em qual frase a crase está certa?", gabarito: "C", alternativas: alt, explicacaoGeral: "Crase = a + a." };
  const certa = { ...errada, _id: new Types.ObjectId(), enunciado: "Outra de crase" };
  await db.collection("questions").insertMany([errada, certa]);
  await db.collection("attempts").insertMany([
    { userId: aluno, questionId: errada._id, topicId: top, resposta: "A", acertou: false, modo: "treino", createdAt: new Date() },
    { userId: aluno, questionId: certa._id, topicId: top, resposta: "C", acertou: true, modo: "treino", createdAt: new Date() },
  ]);
  await db.collection("fichas").insertOne({ subtopico: "crase", status: "aprovada", createdAt: new Date(), afirmacoes: [
    { texto: "Crase é a + a.", trecho: "A crase é a contração de preposição ‘a’ com artigo ‘a’.", arquivo: "acervo/pt/crase.pdf", pagina: 54, camada: "C" },
    { texto: "curto", trecho: "curto demais", camada: "C" },
  ] });
  const ctx = (await contextoDoTema("crase", String(aluno)))!;
  assert.equal(ctx.nome, "Crase");
  assert.deepEqual(ctx.ficha, [{ titulo: "Ficha do tema Crase · crase.pdf, p. 54 (camada C)", texto: "A crase é a contração de preposição ‘a’ com artigo ‘a’." }]);
  assert.deepEqual(ctx.erros.map((e) => [e.id, e.gabarito]), [[String(errada._id), "C"]], "só a que ainda está errada");
  assert.match(ctx.erros[0].explicacao, /Crase = a \+ a\. Porque há artigo\./);
  assert.equal(await contextoDoTema("tema-que-nao-existe", String(aluno)), null);
  // trava: começa em ajuste; só a gate libera
  assert.equal(await chatDoTemaLiberado(), false);
  await registrarGateChatTema({ decisao: "liberado", golden: "30/30", tema: "5/5" });
  assert.equal(await chatDoTemaLiberado(), true);
});
