// ADENDO-FONTES-ATUAIS: partes puras (sem rede e sem banco)
import { test } from "node:test";
import assert from "node:assert/strict";
import { fontesDaQuestao, origemDe, situacaoInicial, statusDepoisDeAprovar, validarConferencia } from "./fontesAtuais.js";

const fontes = [
  { indice: 1, sourceId: "a".repeat(24), titulo: "Lei nº 9.613/1998", texto: "As pessoas referidas no art. 9º deverão comunicar ao Coaf, no prazo de 24 (vinte e quatro) horas, a proposta ou realização." },
  { indice: 2, sourceId: "b".repeat(24), titulo: "Norma revogada", texto: "Texto antigo de uma norma que já foi revogada pelo regulador.", revogada: true },
];

test("Português, Matemática, MF, Probabilidade e Inglês não recebem fonte atual; gerada com trecho já nasce confirmada", () => {
  for (const d of ["lingua_portuguesa", "matematica", "matematica_financeira", "probabilidade_estatistica", "lingua_inglesa"] as const) assert.equal(situacaoInicial(d, true), "nao_se_aplica");
  assert.equal(situacaoInicial("conhecimentos_bancarios", true), "confirmada");
  assert.equal(situacaoInicial("conhecimentos_bancarios", false), "pendente");
});

test("origem: prova e número da questão só nas oficiais", () => {
  assert.deepEqual(origemDe({ origem: "oficial", prova: "BB 2021 — Escriturário Agente Comercial", numeroOriginal: 19 }), { papel: "origem", tipo: "prova", ref: "BB 2021 — Escriturário Agente Comercial", questao: "Q19" });
  assert.equal(origemDe({ origem: "gerada", prova: null }), null);
});

test("trecho não literal é recusado; fonte revogada não é usada; mudou exige antes e hoje", () => {
  const ok = { situacao: "confirmada" as const, indice: 1, trecho: "no prazo de 24 (vinte e quatro) horas" };
  assert.equal(validarConferencia(ok, fontes).situacao, "confirmada");
  assert.equal(validarConferencia({ ...ok, trecho: "no prazo de um dia útil, comunicar" }, fontes).motivo, "trecho não é literal");
  assert.equal(validarConferencia({ situacao: "confirmada", indice: 2, trecho: "Texto antigo de uma norma que já foi revogada" }, fontes).motivo, "fonte revogada");
  assert.equal(validarConferencia({ situacao: "mudou", indice: 1, trecho: "no prazo de 24 (vinte e quatro) horas" }, fontes).situacao, "pendente");
  assert.equal(validarConferencia({ situacao: "mudou", indice: 1, trecho: "no prazo de 24 (vinte e quatro) horas", antes: "48 horas", hoje: "24 horas" }, fontes).situacao, "mudou");
  assert.equal(validarConferencia({ situacao: "pendente" }, fontes).situacao, "pendente");
});

test("mudou com resposta diferente vira desatualizada (só depois do OK); detalhe segue em circulação", () => {
  assert.equal(statusDepoisDeAprovar(true, "aprovada"), "desatualizada");
  assert.equal(statusDepoisDeAprovar(false, "aprovada"), "aprovada");
  assert.equal(statusDepoisDeAprovar(true, "contestada"), "contestada");
});

test("bloco Fontes: mudou não aprovado aparece como 'em conferência'; sem camada, nada", () => {
  assert.equal(fontesDaQuestao({}), undefined);
  const pendenteDono = fontesDaQuestao({ situacaoFonte: "mudou", referencias: [{ papel: "origem", ref: "BB 2021" }], oQueMudou: { antes: "a", hoje: "b" } })!;
  assert.equal(pendenteDono.mudou, undefined);
  assert.equal(pendenteDono.emConferencia, true);
  const aprovado = fontesDaQuestao({ situacaoFonte: "mudou", oQueMudou: { antes: "48 h", hoje: "24 h", trechoHoje: "x", fonteHoje: "Lei", aprovadoEm: new Date() } })!;
  assert.equal(aprovado.mudou?.hoje, "24 h");
  const conf = fontesDaQuestao({ situacaoFonte: "confirmada", referencias: [{ papel: "atual", ref: "Lei 9.613", trecho: "no prazo de 24 horas" }] })!;
  assert.equal(conf.atual?.ref, "Lei 9.613");
  assert.equal(conf.emConferencia, false);
});
