// Login: senha, sessão por requisição, limite de tentativas, convite e migração (sem banco)
import { test } from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";
import { hashSenha, conferirSenha, comUsuario, usuarioAtualId, podeTentar, registrarTentativa, normalizarConvite, migrarProgresso, donoAntigoId, type Usuario } from "./auth.js";
import { forcaSenha, NOTA_MINIMA, emailValido } from "../shared/senha.js";

test("senha: hash com sal, confere a certa e recusa a errada", async () => {
  const h1 = await hashSenha("Lobo de Ouro 2026!");
  const h2 = await hashSenha("Lobo de Ouro 2026!");
  assert.notEqual(h1, h2, "sal diferente a cada hash");
  assert.ok(!h1.includes("Lobo"));
  assert.equal(await conferirSenha("Lobo de Ouro 2026!", h1), true);
  assert.equal(await conferirSenha("lobo de ouro 2026!", h1), false);
  assert.equal(await conferirSenha("x", "lixo"), false);
});

test("dois usuários não enxergam o progresso um do outro (cada requisição tem o seu userId)", async () => {
  const ana: Usuario = { id: new Types.ObjectId(), nome: "Ana", email: "a@x.com", papel: "aluno" };
  const beto: Usuario = { id: new Types.ObjectId(), nome: "Beto", email: "b@x.com", papel: "aluno" };
  // requisições simultâneas e intercaladas: cada uma continua com o seu usuário
  const ids = await Promise.all([
    comUsuario(ana, async () => { await new Promise((r) => setTimeout(r, 20)); return usuarioAtualId(); }),
    comUsuario(beto, async () => { await new Promise((r) => setTimeout(r, 5)); return usuarioAtualId(); }),
  ]);
  assert.equal(String(ids[0]), String(ana.id));
  assert.equal(String(ids[1]), String(beto.id));
  // fora de requisição (CLI) ou no modo dono único: o ALUNO_ID
  assert.equal(String(comUsuario(null, () => usuarioAtualId())), String(donoAntigoId()));
});

test("limite: 10 tentativas por IP a cada 15 min", () => {
  const ip = "10.0.0.9";
  const t0 = 1_000_000;
  for (let k = 0; k < 10; k++) {
    assert.equal(podeTentar(ip, t0).ok, true);
    registrarTentativa(ip, t0);
  }
  const bloqueado = podeTentar(ip, t0 + 60_000);
  assert.equal(bloqueado.ok, false);
  assert.equal(bloqueado.esperarMin, 14);
  assert.equal(podeTentar(ip, t0 + 16 * 60_000).ok, true, "janela passou");
});

test("convite: aceita minúsculas, espaço e sem hífen", () => {
  assert.equal(normalizarConvite(" abcd efgh "), "ABCD-EFGH");
  assert.equal(normalizarConvite("ABCD-EFGH"), "ABCD-EFGH");
});

test("força da senha: a mesma regra da tela e do servidor", () => {
  assert.equal(forcaSenha("abc").nota, 0);
  assert.equal(forcaSenha("12345678").nota, 1);
  assert.ok(forcaSenha("senha123").nota < NOTA_MINIMA, "palavra óbvia");
  assert.ok(forcaSenha("Girassol-Azul").nota >= NOTA_MINIMA);
  assert.equal(forcaSenha("Girassol Azul de Março 9").nota, 4);
  assert.ok(emailValido("dono@exemplo.com.br") && !emailValido("dono@exemplo"));
});

test("migração: todo o progresso do dono único vai para a conta do admin", async () => {
  const de = donoAntigoId();
  const para = new Types.ObjectId();
  const outro = new Types.ObjectId();
  const falsa = (docs: { userId: Types.ObjectId }[]) => ({
    docs,
    updateMany: async (f: { userId: Types.ObjectId }, m: { $set: { userId: Types.ObjectId } }) => {
      let n = 0;
      for (const d of docs) if (String(d.userId) === String(f.userId)) (d.userId = m.$set.userId), n++;
      return { modifiedCount: n };
    },
  });
  const tentativas = falsa([{ userId: de }, { userId: de }, { userId: outro }]);
  const revisoes = falsa([{ userId: de }]);
  const r = await migrarProgresso(de, para, { Attempt: tentativas, ReviewState: revisoes });
  assert.deepEqual(r, { Attempt: 2, ReviewState: 1 });
  assert.equal(tentativas.docs.filter((d) => String(d.userId) === String(para)).length, 2);
  assert.equal(String(tentativas.docs[2].userId), String(outro), "progresso de outra pessoa fica");
});
