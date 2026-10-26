import assert from "node:assert/strict";
import test from "node:test";
import { registroDoErro, sanitizarErro } from "./errosServidor.js";

test("erro no log: sem URI do banco, e-mail, token, chave ou query string", () => {
  const sujo = [
    "falhou mongodb+srv://usuario:SENHA@cluster0.x.mongodb.net/lobo?retryWrites=true",
    "aluno fulano@exemplo.com", "Authorization: Bearer abc.def.ghi", "chave nvapi-AbC123_xyz",
    'senha: "Girassol-Azul"', "token=TOKEN123", "https://api.exemplo.com/v1?key=SEGREDO",
    "hash " + "a".repeat(64),
  ].join(" | ");
  const limpo = sanitizarErro(sujo);
  for (const segredo of ["SENHA@cluster0", "fulano@exemplo.com", "abc.def.ghi", "AbC123_xyz", "Girassol-Azul", "TOKEN123", "SEGREDO", "a".repeat(64)])
    assert.ok(!limpo.includes(segredo), `vazou: ${segredo}`);
  assert.match(limpo, /mongodb:\/\/\[oculto\]/);
  assert.match(limpo, /\[e-mail\]/);
});

test("registro estruturado: rota sem query, status, mensagem limpa e a linha de origem no código", () => {
  const err = new Error("Cast to ObjectId failed for value fulano@exemplo.com");
  err.stack = "Error: x\n    at node:internal/x\n    at rota (C:\\projetos\\Lobo-bb\\src\\estudo.ts:10:5)";
  const r = registroDoErro(err, { method: "GET", path: "/api/tema" });
  assert.equal(r.rota, "/api/tema");
  assert.equal(r.status, 500);
  assert.doesNotMatch(r.mensagem, /fulano/);
  assert.match(r.origem, /src\\estudo\.ts:10:5/);
});
