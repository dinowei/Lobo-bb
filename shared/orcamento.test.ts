import assert from "node:assert/strict";
import test from "node:test";
import { consumir, encher, estimarCapacidade, novoBalde, usoDaCapacidade } from "./orcamento.js";

test("balde: gasta uma ficha por chamada e enche no ritmo medido", () => {
  let b = novoBalde(30, 0); // 30/min = 1 a cada 2 s
  for (let i = 0; i < 30; i++) {
    const r = consumir(b, 0);
    assert.equal(r.ok, true);
    b = r.balde;
  }
  const vazio = consumir(b, 0);
  assert.equal(vazio.ok, false);
  assert.equal(vazio.esperaMs, 2000);
  assert.equal(consumir(b, 2000).ok, true, "2 s depois já tem uma ficha");
  assert.equal(encher(b, 10 * 60_000).fichas, 30, "não passa da capacidade");
});

test("capacidade: o menor minuto com 429 dá o limite (80% dele); sem 429, o pico é um piso", () => {
  const min = (m: number, ok: number, recusas = 0) => [
    ...Array.from({ length: ok }, (_, i) => ({ em: m * 60_000 + i, ok: true })),
    ...Array.from({ length: recusas }, (_, i) => ({ em: m * 60_000 + 500 + i, ok: false, falha: "429" })),
  ];
  assert.deepEqual(estimarCapacidade([...min(1, 40, 3), ...min(2, 35, 1), ...min(3, 12)]), { rpm: 28, base: "429", minutos: 3 });
  assert.deepEqual(estimarCapacidade([...min(1, 10), ...min(2, 18)]), { rpm: 18, base: "pico", minutos: 2 });
  assert.equal(estimarCapacidade([]).base, "sem_dados");
});

test("uso da capacidade no relatório: usadas × o que o ritmo permitiria nas horas trabalhadas", () => {
  assert.deepEqual(usoDaCapacidade(600, 20, 60), { usadas: 600, capacidade: 1200, fracao: 0.5 });
});
