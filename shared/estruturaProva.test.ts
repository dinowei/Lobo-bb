import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ESTRUTURA_PROVA, COTAS_PROVA, cotasDaProva, dividirProporcional, cotasPorFaixa, misturaDasOficiais, resumoPorBloco, notaPonderada, pesoDoTopico,
} from "./estruturaProva.js";
import type { Disciplina } from "./tipos.js";

test("prova completa: 70 questões, exatamente nas cotas do edital", () => {
  const c = cotasDaProva(ESTRUTURA_PROVA.totalQuestoes);
  assert.equal([...c.values()].reduce((s, x) => s + x, 0), 70);
  for (const [d, k] of Object.entries(COTAS_PROVA)) assert.equal(c.get(d as Disciplina), k, d);
  assert.equal(c.has("probabilidade_estatistica"), false);
});

test("simulado menor soma exatamente n e respeita a proporção", () => {
  for (const n of [1, 10, 20, 40, 69, 120]) {
    const c = cotasDaProva(n);
    assert.equal([...c.values()].reduce((s, x) => s + x, 0), n, `n=${n}`);
  }
  const c20 = cotasDaProva(20);
  assert.ok((c20.get("informatica") ?? 0) >= (c20.get("lingua_inglesa") ?? 0));
});

test("só disciplinas disponíveis entram, e a soma continua n", () => {
  const disp = new Set<Disciplina>(["lingua_portuguesa", "informatica"]);
  const c = cotasDaProva(10, disp);
  assert.deepEqual([...c.keys()].sort(), ["informatica", "lingua_portuguesa"]);
  assert.equal([...c.values()].reduce((s, x) => s + x, 0), 10);
  assert.equal(c.get("informatica"), 6); // 15:10
});

test("maiores restos não perde nem sobra questão", () => {
  const r = dividirProporcional(7, new Map([["a", 1], ["b", 1], ["c", 1]]));
  assert.equal([...r.values()].reduce((s, x) => s + x, 0), 7);
});

test("mistura: estimativa com poucas oficiais, faixas somam k", () => {
  const m = misturaDasOficiais([3, 3]);
  assert.equal(m.estimativa, true);
  for (const k of [0, 1, 5, 15]) {
    const f = cotasPorFaixa(k, m);
    assert.equal([...f.values()].reduce((s, x) => s + x, 0), k, `k=${k}`);
  }
  const real = misturaDasOficiais(Array.from({ length: 40 }, (_, i) => (i < 10 ? 1 : i < 30 ? 3 : 5)));
  assert.equal(real.estimativa, false);
  assert.equal(real.facil, 0.25);
});

test("resultado por bloco e nota ponderada sem pesos confirmados", () => {
  const b = resumoPorBloco([
    { disciplina: "lingua_portuguesa", total: 10, acertos: 8 },
    { disciplina: "informatica", total: 15, acertos: 9 },
  ]);
  assert.deepEqual(b.map((x) => [x.bloco, x.acertos, x.total]), [["Conhecimentos Básicos", 8, 10], ["Conhecimentos Específicos", 9, 15]]);
  assert.equal(notaPonderada(b), null);
});

test("fora do edital tem peso baixo", () => {
  assert.ok(pesoDoTopico("probabilidade_estatistica", 1) < pesoDoTopico("matematica", 1));
});
