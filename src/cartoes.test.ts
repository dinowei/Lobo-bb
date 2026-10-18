// Cartões: checagem por código antes do auditor (sem rede e sem banco)
import { test } from "node:test";
import assert from "node:assert/strict";
import { chaveDe, validarCartao } from "./cartoes.js";

const norma = [{ indice: 1, titulo: "Lei 9.613/1998", texto: "As pessoas referidas no art. 9º deverão comunicar ao Coaf, no prazo de 24 (vinte e quatro) horas, a proposta ou realização de operações." }];
const texto = [{ indice: 1, titulo: "Texto da prova", texto: "However, data can only be shared with the customer's explicit consent, which may be withdrawn at any time." }];

test("norma: trecho literal e números do verso dentro do trecho", () => {
  const ok = { frente: "Prazo para comunicar ao Coaf?", verso: "24 horas.", indice: 1, trecho: "no prazo de 24 (vinte e quatro) horas" };
  assert.equal(validarCartao(ok, "norma", norma), undefined);
  assert.match(validarCartao({ ...ok, verso: "48 horas." }, "norma", norma) ?? "", /número fora do trecho \(48\)/);
  assert.match(validarCartao({ ...ok, trecho: "no prazo de um dia útil" }, "norma", norma) ?? "", /não é literal/);
  assert.match(validarCartao({ ...ok, indice: 2 }, "norma", norma) ?? "", /fonte inexistente/);
});

test("vocabulário: a palavra da frente aparece no trecho literal", () => {
  const ok = { frente: "withdrawn", verso: "retirado, revogado", indice: 1, trecho: "which may be withdrawn at any time" };
  assert.equal(validarCartao(ok, "vocabulario", texto), undefined);
  assert.match(validarCartao({ ...ok, frente: "revoked" }, "vocabulario", texto) ?? "", /não aparece no trecho/);
  assert.match(validarCartao({ ...ok, verso: "Withdrawn" }, "vocabulario", texto) ?? "", /verso igual/);
});

test("chave normaliza acento, caixa e pontuação (não repete no tópico)", () => {
  assert.equal(chaveDe("Prazo para comunicar ao COAF?"), chaveDe("prazo  para comunicar ao Coaf"));
  assert.notEqual(chaveDe("withdrawn"), chaveDe("withdraw"));
});
