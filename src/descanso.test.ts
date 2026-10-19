import assert from "node:assert/strict";
import test from "node:test";
import { avaliarTaxas, DESCANSO_TAXA_MS } from "./corrente.js";
import { CORRENTE_DEFINITIVA, validarCorrentes, violacoesDeFamilia } from "./catalogo.js";

test("corrente definitiva: válida, sem ferir a regra de família e sem preview nem DeepSeek", () => {
  const v = validarCorrentes(CORRENTE_DEFINITIVA);
  assert.deepEqual(v.erros, []);
  assert.deepEqual(violacoesDeFamilia(CORRENTE_DEFINITIVA), []);
  const todos = Object.values(CORRENTE_DEFINITIVA).flat();
  assert.equal(todos.some((m) => m.includes("step-5") || m.includes("deepseek")), false);
  assert.equal(CORRENTE_DEFINITIVA.gerador.at(-1), "nvidia/nemotron-3.5-lightning-30b-a3b"); // Lightning por último
});

const agora = 1_000_000_000_000;
const chamadas = (modelo: string, ok: number, falha: number, em = agora - 3_600_000) => [
  ...Array.from({ length: ok }, () => ({ modelo, em, ok: true })),
  ...Array.from({ length: falha }, () => ({ modelo, em, ok: false })),
];

test("descanso: < 20% de sucesso em 24 h com 5+ chamadas → 1 h fora", () => {
  const r = avaliarTaxas([...chamadas("lento", 1, 9), ...chamadas("bom", 8, 2)], new Map(), agora);
  assert.equal(r.get("lento"), agora + DESCANSO_TAXA_MS);
  assert.equal(r.has("bom"), false);
});

test("descanso: amostra pequena não julga; 20% exatos não descansa", () => {
  assert.equal(avaliarTaxas(chamadas("x", 0, 4), new Map(), agora).has("x"), false);
  assert.equal(avaliarTaxas(chamadas("x", 1, 4), new Map(), agora).has("x"), false);
});

test("descanso: depois da hora só contam as chamadas novas", () => {
  const fim = agora - 1000; // o descanso acabou há 1 s
  const velhas = chamadas("m", 0, 20, fim - 3_600_000);
  // sem chamadas novas: continua elegível (guarda o fim para julgar o que vier)
  assert.equal(avaliarTaxas(velhas, new Map([["m", fim]]), agora).get("m"), fim);
  // 2 novas que falharam: volta para mais 1 h
  assert.equal(avaliarTaxas([...velhas, ...chamadas("m", 0, 2, fim + 10)], new Map([["m", fim]]), agora).get("m"), agora + DESCANSO_TAXA_MS);
  // 1 sucesso em 2 novas: elegível
  assert.equal(avaliarTaxas([...velhas, ...chamadas("m", 1, 1, fim + 10)], new Map([["m", fim]]), agora).get("m"), fim);
  // ainda dentro da hora: mantém
  assert.equal(avaliarTaxas(velhas, new Map([["m", agora + 5000]]), agora).get("m"), agora + 5000);
});
