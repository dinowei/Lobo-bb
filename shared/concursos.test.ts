import assert from "node:assert/strict";
import test from "node:test";
import { BANCAS, CONCURSOS, bancaEmUso, notaPelaBanca } from "./concursos.js";
import { COTAS_PROVA, ESTRUTURA_PROVA } from "./estruturaProva.js";

test("BB como dado: mesma estrutura de antes da migração (edital 2022/001)", () => {
  assert.equal(ESTRUTURA_PROVA.totalQuestoes, 70);
  assert.deepEqual(COTAS_PROVA, {
    lingua_portuguesa: 10, lingua_inglesa: 5, matematica: 5, atualidades_mercado_financeiro: 5,
    matematica_financeira: 5, conhecimentos_bancarios: 10, informatica: 15, vendas_negociacao: 15,
  });
  const pontos = Object.entries(COTAS_PROVA).reduce((s, [d, n]) => s + (n ?? 0) * (ESTRUTURA_PROVA.valorQuestao[d as keyof typeof COTAS_PROVA] ?? 0), 0);
  assert.equal(pontos, 100);
  assert.equal(ESTRUTURA_PROVA.corteObjetivas, 0.5);
  assert.equal(ESTRUTURA_PROVA.duracaoMin, 300);
  assert.deepEqual(ESTRUTURA_PROVA.redacao, { tipo: "dissertativo-argumentativo", pontos: 100, minimo: 70 });
  assert.deepEqual(ESTRUTURA_PROVA.foraDoEdital, ["probabilidade_estatistica"]);
  assert.equal(CONCURSOS.bb.bancaPadrao, "cesgranrio");
});

test("bancas: formato e regra de nota; BACEN 'a definir' estuda no estilo Cebraspe", () => {
  assert.equal(BANCAS.cesgranrio.formato, "multipla");
  assert.equal(BANCAS.cebraspe.formato, "certo_errado");
  assert.equal(bancaEmUso("bb"), "cesgranrio");
  assert.equal(bancaEmUso("bacen"), "cebraspe");
  assert.equal(bancaEmUso("bacen", "fgv"), "fgv");
  assert.equal(bancaEmUso("bacen", "inexistente"), "cebraspe");
  // Cebraspe: um erro anula um acerto; branco não conta
  assert.equal(notaPelaBanca("cebraspe", { acertos: 30, erros: 10, brancos: 10 }), 20);
  assert.equal(notaPelaBanca("cesgranrio", { acertos: 30, erros: 10, brancos: 0 }), 30);
});
