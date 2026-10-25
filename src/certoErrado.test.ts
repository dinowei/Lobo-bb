import assert from "node:assert/strict";
import test from "node:test";
import { checarAfirmacao } from "./certoErrado.js";

test("reescrita C/E: recusa cópia que cita alternativa, perde o conteúdo ou foge do tamanho", () => {
  const alt = "funciona apenas em dias úteis, das 8h às 18h.";
  assert.equal(checarAfirmacao("O Pix funciona apenas em dias úteis, das 8h às 18h.", alt), null);
  assert.match(checarAfirmacao("A alternativa correta diz que o Pix funciona apenas em dias úteis, das 8h às 18h.", alt)!, /cita/);
  assert.match(checarAfirmacao("O Pix é um meio de pagamento instantâneo criado pelo Banco Central.", alt)!, /perdeu o conteúdo/);
  assert.match(checarAfirmacao("Pix ok.", alt)!, /tamanho/);
});
