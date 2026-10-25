import assert from "node:assert/strict";
import test from "node:test";
import { trechoNoTexto } from "./fichas.js";

test("trecho literal: tolera quebra de linha e hifenização do PDF; qualquer outra diferença reprova", () => {
  const pagina = "O limite atual é de R$500,00 por transa-\nção, sem limite diário. O cliente pode definir controles adi-\ncionais.";
  assert.equal(trechoNoTexto("O limite atual é de R$500,00 por transação, sem limite diário.", pagina), true);
  assert.equal(trechoNoTexto("controles adicionais", pagina), true);
  assert.equal(trechoNoTexto("O limite atual é de R$ 1.000,00 por transação", pagina), false); // número trocado
  assert.equal(trechoNoTexto("limite atual de R$500,00", pagina), false); // palavra a menos
  // hífen de palavra composta no meio da linha continua hífen
  assert.equal(trechoNoTexto("pós-venda", "o pós-venda importa"), true);
  assert.equal(trechoNoTexto("pósvenda", "o pós-venda importa"), false);
});
