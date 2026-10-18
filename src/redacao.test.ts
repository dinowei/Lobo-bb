// Redação abaixo do mínimo: zero decidido por código (sem rede e sem banco)
import { test } from "node:test";
import assert from "node:assert/strict";
import { correcaoZerada } from "./redacao.js";

test("abaixo do mínimo de linhas: nota zero com o motivo, sem passar pela IA", () => {
  const c = correcaoZerada(8);
  assert.equal(c.notaTotal, 0);
  assert.equal(c.criterios.length, 4);
  assert.ok(c.criterios.every((x) => x.nota === 0 && !x.trechos.length));
  assert.match(c.penalidade ?? "", /8 linhas/);
  assert.match(c.penalidade ?? "", /mínimo da prova é 25/);
});
