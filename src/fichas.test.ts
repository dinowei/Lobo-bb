import assert from "node:assert/strict";
import test from "node:test";
import { temaNormativo, trechoNoTexto, vigencia } from "./fichas.js";

// fechamento v1.0, item 3: a ficha de Interpretação ficava "pendente" porque regra de gramática de cursinho
// era tratada como norma sem vigência confirmada
test("vigência: só tema normativo (lei, resolução, edital) exige camada A para regra; gramática de cursinho vale", () => {
  assert.equal(vigencia("regra_normativa", "C", false), true, "Português: regra de cursinho entra");
  assert.equal(vigencia("regra_normativa", "C", true), null, "Bancários: regra de cursinho fica pendente (a lei é a autoridade)");
  assert.equal(vigencia("regra_normativa", "A", true), true);
  assert.equal(vigencia("conceito", "C", true), true);
  assert.equal(temaNormativo(["lingua_portuguesa"]), false);
  assert.equal(temaNormativo(["conhecimentos_bancarios"]), true);
  assert.equal(temaNormativo(["direito_administrativo"]), true);
  assert.equal(temaNormativo(["mercado_valores_mobiliarios"]), true);
  assert.equal(temaNormativo(["matematica_financeira", "informatica"]), false);
});

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
