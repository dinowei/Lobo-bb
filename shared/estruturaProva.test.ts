import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ESTRUTURA_PROVA, COTAS_PROVA, cotasDaProva, sortearDisciplinaMista, dividirProporcional, cotasPorFaixa, misturaDasOficiais, resumoPorBloco, pontuacaoProva, pesoDoTopico,
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
});

test("pontuação do edital: 100 pontos na prova cheia e cortes do 7.2.4", () => {
  const cheia = Object.entries(COTAS_PROVA).map(([d, c]) => ({ disciplina: d as Disciplina, total: c!, acertos: c! }));
  const r = pontuacaoProva(cheia);
  assert.equal(r.maximo, 100);
  assert.deepEqual(r.blocos.map((b) => b.maximo), [32.5, 67.5]);
  assert.deepEqual(r.eliminado, []);
  // inglês e atualidades valem 1,0; o resto 1,5
  const parcial = pontuacaoProva([
    { disciplina: "lingua_portuguesa", total: 10, acertos: 3 },
    { disciplina: "lingua_inglesa", total: 5, acertos: 0 },
    { disciplina: "informatica", total: 15, acertos: 12 },
  ]);
  assert.equal(parcial.pontos, 3 * 1.5 + 12 * 1.5);
  assert.ok(parcial.eliminado.includes("menos de 50% em Conhecimentos Básicos"));
  assert.ok(parcial.eliminado.includes("zero em uma disciplina"));
  assert.ok(!parcial.eliminado.some((m) => m.includes("Específicos")));
});

test("treino misturado: nunca repete a anterior, segue o peso da prova e ignora fora do edital", () => {
  const disp: Disciplina[] = ["lingua_portuguesa", "informatica", "lingua_inglesa", "probabilidade_estatistica"];
  const contagem = new Map<string, number>();
  let anterior: Disciplina | undefined;
  let seq = 0;
  const rnd = () => ((seq = (seq * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 3000; i++) {
    const d = sortearDisciplinaMista(disp, anterior, rnd)!;
    assert.notEqual(d, anterior);
    assert.notEqual(d, "probabilidade_estatistica");
    contagem.set(d, (contagem.get(d) ?? 0) + 1);
    anterior = d;
  }
  assert.ok((contagem.get("informatica") ?? 0) > (contagem.get("lingua_inglesa") ?? 0)); // 15 × 5
  assert.equal(sortearDisciplinaMista(["informatica"], "informatica"), "informatica"); // só uma: repete
  assert.equal(sortearDisciplinaMista(["probabilidade_estatistica"]), undefined);
});

test("fora do edital tem peso baixo", () => {
  assert.ok(pesoDoTopico("probabilidade_estatistica", 1) < pesoDoTopico("matematica", 1));
});
