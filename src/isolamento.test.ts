// F7: uma conta não vê nem altera o dado de outra. Teste HTTP de verdade (o app do server.ts), com 2 alunos,
// num MongoDB EM MEMÓRIA (mongodb-memory-server): o usuário do Atlas só tem direito no banco do app, e criar
// conta lá ligaria o login do site. Produção só é LIDA, por outra conexão (copia 1 tópico, 2 questões,
// 1 cartão e 1 tema). Nenhuma IA é chamada: as cotas diárias do tutor e do chat ficam em 0.
// Roda só com ISOLAMENTO=1:  ISOLAMENTO=1 npx tsx --test --test-force-exit src/isolamento.test.ts
import "./env.js";
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

const BANCO_TESTE = "bb-estudos-isolamento";
const ligado = process.env.ISOLAMENTO === "1" && !!process.env.MONGODB_URI;
let memoria: MongoMemoryServer | null = null;
let leitura: mongoose.Connection | null = null;
process.env.EXPLICACOES_MAIS_MAX_DIA = "0";
process.env.CHAT_BINHO_MAX_DIA = "0";
process.env.VOZ_NA_HORA_MAX_DIA = "0";

type Sessao = { cookie: string };
let base = "";
let fechar: () => void = () => undefined;
let A: Sessao, B: Sessao;
let ids: { a: Types.ObjectId; b: Types.ObjectId };
let q1: { _id: Types.ObjectId; gabarito: string; topicId: Types.ObjectId }, q2: { _id: Types.ObjectId; gabarito: string };
let cartaoId = "", temaId = "";
let M: typeof import("./models.js");

const errada = (g: string) => (["A", "B", "C", "D", "E"].find((l) => l !== g) as string);
async function chamar(s: Sessao | null, metodo: string, caminho: string, corpo?: unknown) {
  const r = await fetch(`${base}${caminho}`, {
    method: metodo,
    headers: { "Content-Type": "application/json", ...(s ? { Cookie: s.cookie } : {}) },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const texto = await r.text();
  let json: unknown = null;
  try { json = texto ? JSON.parse(texto) : null; } catch { json = texto; }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- formato de cada rota é conferido no próprio teste
  return { status: r.status, json: json as any };
}
async function entrar(email: string, senha: string): Promise<Sessao> {
  const r = await fetch(`${base}/api/auth/entrar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, senha }) });
  assert.equal(r.status, 200, `login de ${email}`);
  const cookie = (r.headers.get("set-cookie") ?? "").split(";")[0];
  assert.ok(cookie.includes("="), "cookie de sessão");
  return { cookie };
}

before(async () => {
  if (!ligado) return;
  // o app (mongoose padrão) fala só com o banco em memória; produção fica numa conexão à parte, só para ler
  memoria = await MongoMemoryServer.create();
  await mongoose.connect(memoria.getUri(), { dbName: BANCO_TESTE });
  assert.ok(memoria.getUri().startsWith("mongodb://127.0.0.1"), "o app de teste usa o banco local");
  leitura = await mongoose.createConnection(process.env.MONGODB_URI!).asPromise();
  M = await import("./models.js");
  const { hashSenha } = await import("./auth.js");
  // cópia SOMENTE LEITURA de produção: o mínimo para as telas funcionarem
  const prod = leitura.db!;
  const qs = await prod.collection(M.Question.collection.collectionName).find({ status: "aprovada", origem: "oficial" }).limit(40).toArray();
  const porTopico = new Map<string, typeof qs>();
  for (const q of qs) porTopico.set(String(q.topicId), [...(porTopico.get(String(q.topicId)) ?? []), q]);
  const [topicId, doTopico] = [...porTopico].sort((x, y) => y[1].length - x[1].length)[0];
  assert.ok(doTopico.length >= 2, "precisa de 2 questões oficiais no mesmo tópico");
  const topico = await prod.collection(M.Topic.collection.collectionName).findOne({ _id: new Types.ObjectId(topicId) });
  await M.Topic.collection.insertOne(topico!);
  await M.Question.collection.insertMany(doTopico.slice(0, 2));
  q1 = doTopico[0] as never;
  q2 = doTopico[1] as never;
  const cartao = await prod.collection(M.Cartao.collection.collectionName).findOne({ status: "aprovado" });
  if (cartao) { await M.Cartao.collection.insertOne(cartao); cartaoId = String(cartao._id); }
  const tema = await prod.collection(M.TemaRedacao.collection.collectionName).findOne({ ativo: true });
  if (tema) { await M.TemaRedacao.collection.insertOne(tema); temaId = String(tema._id); }
  // dois alunos de teste (nenhuma conta real)
  const senha = "Teste-Isolamento-2026!x";
  const ua = await M.User.create({ nome: "Aluno A", email: "aluno.a@teste.local", senhaHash: await hashSenha(senha), papel: "aluno" });
  const ub = await M.User.create({ nome: "Aluno B", email: "aluno.b@teste.local", senhaHash: await hashSenha(senha), papel: "aluno" });
  ids = { a: ua._id, b: ub._id };
  const { app } = await import("./server.js");
  const srv = app.listen(0);
  await new Promise((ok) => srv.once("listening", ok));
  base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
  fechar = () => srv.close();
  A = await entrar("aluno.a@teste.local", senha);
  B = await entrar("aluno.b@teste.local", senha);
});

after(async () => {
  if (!ligado) return;
  try {
    fechar();
  } finally {
    await mongoose.disconnect();
    await leitura?.close();
    await memoria?.stop(); // apaga o banco em memória inteiro
  }
});

test("isolamento: sem sessão, nenhuma rota de aluno responde (nem com /API em maiúsculas)", { skip: !ligado }, async () => {
  for (const caminho of ["/api/painel", "/API/painel", "/Api/erros", "/api/redacoes", "/api/cartoes", "/API/ADMIN/ia"]) {
    const r = await chamar(null, "GET", caminho);
    assert.equal(r.status, 401, `${caminho} sem sessão`);
  }
});

test("isolamento: aluno não entra no Admin, nem trocando maiúsculas", { skip: !ligado }, async () => {
  for (const caminho of ["/api/admin/ia", "/API/admin/fila", "/api/ADMIN/pendencias", "/Api/Admin/figuras"]) {
    assert.equal((await chamar(B, "GET", caminho)).status, 403, caminho);
  }
});

test("isolamento: o que A faz não aparece para B, e B não altera nada de A", { skip: !ligado }, async () => {
  // ---- A estuda: erra q1 (com motivo), acerta q2, simulado, cartão, contestação, redação, cache de tutor e chat
  const ra = await chamar(A, "POST", "/api/responder", { questaoId: String(q1._id), resposta: errada(q1.gabarito), confianca: 3, tempoSeg: 30, modo: "treino" });
  assert.equal(ra.status, 200);
  assert.equal((await chamar(A, "POST", "/api/motivo-erro", { questaoId: String(q1._id), motivo: "desatencao" })).status, 200);
  assert.equal((await chamar(A, "POST", "/api/responder", { questaoId: String(q2._id), resposta: q2.gabarito, confianca: 2, tempoSeg: 20, modo: "treino" })).status, 200);
  assert.equal((await chamar(A, "POST", "/api/simulado/corrigir", { respostas: [{ questaoId: String(q2._id), resposta: q2.gabarito, tempoSeg: 10 }] })).status, 200);
  if (cartaoId) assert.equal((await chamar(A, "POST", `/api/cartoes/${cartaoId}`, { nota: 3 })).status, 200);
  if (temaId) {
    const red = await chamar(A, "POST", "/api/redacoes/corrigir", { temaId, texto: "Texto curto de teste para o isolamento entre contas. ".repeat(4), linhas: 3, tempoSeg: 60 });
    assert.equal(red.status, 200, JSON.stringify(red.json).slice(0, 200));
  }
  await M.ExplicacaoTutor.create({ userId: ids.a, questionId: q1._id, duvidaHash: (await import("node:crypto")).createHash("sha256").update("nao entendi").digest("hex"), explicacao: "EXPLICACAO-SECRETA-DE-A" });
  const { hashPergunta } = await import("./chatBinho.js");
  await M.RespostaBinho.create({ userId: ids.a, topicId: q1.topicId, perguntaHash: hashPergunta("o que cai na prova?"), pergunta: "o que cai na prova?", resposta: "RESPOSTA-SECRETA-DE-A", citacoes: [] });

  const painelA = (await chamar(A, "GET", "/api/painel")).json as { xp: number; totalRespondidas: number };
  assert.ok(painelA.totalRespondidas >= 2 && painelA.xp > 0, "A tem progresso");
  const contagemA = {
    tentativas: await M.Attempt.countDocuments({ userId: ids.a }),
    revisoes: await M.ReviewState.countDocuments({ userId: ids.a }),
    redacoes: await M.Redacao.countDocuments({ userId: ids.a }),
    cartoes: await M.CartaoRevisao.countDocuments({ userId: ids.a }),
  };

  // ---- B lê tudo o que é dele: nada de A aparece
  const painelB = (await chamar(B, "GET", "/api/painel")).json as { xp: number; totalRespondidas: number; respondeuHoje: number; revisoesHoje: number };
  assert.equal(painelB.totalRespondidas, 0);
  assert.equal(painelB.xp, 0);
  assert.equal(painelB.revisoesHoje, 0);
  assert.deepEqual((await chamar(B, "GET", "/api/erros")).json, []);
  assert.deepEqual((await chamar(B, "GET", "/api/redacoes")).json, []);
  const revB = await chamar(B, "GET", "/api/proxima?revisao=1");
  assert.ok(revB.status === 200 && !(revB.json as { questao?: unknown }).questao, "B não recebe revisão de A");
  if (cartaoId) {
    const filaB = (await chamar(B, "GET", "/api/cartoes")).json as { cartoes: { id: string; novo: boolean }[] };
    const c = filaB.cartoes.find((x) => x.id === cartaoId);
    assert.ok(!c || c.novo, "para B o cartão é novo (a revisão é de A)");
  }
  // tutor e chat: o cache de A não vaza (sem cota, B recebe só o aviso de limite)
  const tutorB = (await chamar(B, "POST", "/api/explicar-mais", { questaoId: String(q1._id), duvida: "nao entendi" })).json as { explicacao?: string };
  assert.notEqual(tutorB.explicacao, "EXPLICACAO-SECRETA-DE-A");
  const chatB = (await chamar(B, "POST", "/api/binho/perguntar", { topicoId: String(q1.topicId), pergunta: "o que cai na prova?" })).json as { resposta?: string };
  assert.notEqual(chatB.resposta, "RESPOSTA-SECRETA-DE-A");
  const chatA = (await chamar(A, "POST", "/api/binho/perguntar", { topicoId: String(q1.topicId), pergunta: "o que cai na prova?" })).json as { resposta?: string };
  assert.equal(chatA.resposta, "RESPOSTA-SECRETA-DE-A", "o cache é de A");

  // ---- B tenta mexer no que é de A, passando ids e campos que o cliente não pode mandar
  await chamar(B, "POST", "/api/motivo-erro", { questaoId: String(q1._id), motivo: "nao_sabia", userId: String(ids.a) });
  await chamar(B, "POST", "/api/redacoes/vistas", { userId: String(ids.a) });
  const injetada = await chamar(B, "POST", "/api/responder", { questaoId: String(q1._id), resposta: q1.gabarito, confianca: 1, tempoSeg: 5, modo: "treino", userId: String(ids.a), acertou: true, xp: 99999, papel: "admin", gabarito: "Z", status: "contestada" });
  assert.equal(injetada.status, 200);
  if (cartaoId) await chamar(B, "POST", `/api/cartoes/${cartaoId}`, { nota: 0, userId: String(ids.a) });

  // nada de A mudou
  assert.deepEqual({
    tentativas: await M.Attempt.countDocuments({ userId: ids.a }),
    revisoes: await M.ReviewState.countDocuments({ userId: ids.a }),
    redacoes: await M.Redacao.countDocuments({ userId: ids.a }),
    cartoes: await M.CartaoRevisao.countDocuments({ userId: ids.a }),
  }, contagemA);
  const erroA = await M.Attempt.findOne({ userId: ids.a, questionId: q1._id, acertou: false }).lean();
  assert.equal(erroA?.motivoErro, "desatencao", "o motivo do erro de A continua o de A");
  if (temaId) assert.equal(await M.Redacao.countDocuments({ userId: ids.a, avisada: true }), 0, "B não marcou a redação de A como vista");
  // a resposta injetada ficou com B e com o que o servidor calcula
  const deB = await M.Attempt.findOne({ userId: ids.b, questionId: q1._id }).lean();
  assert.ok(deB, "a tentativa injetada é de B");
  assert.notEqual(deB!.xp, 99999);
  const q = await M.Question.findById(q1._id).select("gabarito status").lean();
  assert.equal(q!.gabarito, q1.gabarito, "gabarito intocado");
  assert.equal(q!.status, "aprovada", "status intocado");
  assert.equal((await M.User.findById(ids.b).select("papel").lean())!.papel, "aluno", "papel intocado");
});
