import { test } from "node:test";
import assert from "node:assert/strict";
import { diagnosticoPendente, diagnosticosDe, fortesEFocos, ratingDoDiagnostico } from "./diagnostico.js";
import type { Disciplina, TentativaBruta } from "./tipos.js";

test("rating do diagnóstico: metade certa ≈ 1300, extremos limitados", () => {
  assert.equal(ratingDoDiagnostico(2, 4), 1300);
  assert.ok(ratingDoDiagnostico(4, 4) > 1500);
  assert.ok(ratingDoDiagnostico(0, 4) < 1100);
  assert.equal(ratingDoDiagnostico(100, 100), 1700);
  assert.equal(ratingDoDiagnostico(0, 100), 900);
});

test("3 fortes e 3 focos sem repetir; foco pesa a cota da prova", () => {
  const r = fortesEFocos([
    { disciplina: "lingua_portuguesa", total: 4, acertos: 4 },
    { disciplina: "matematica", total: 2, acertos: 2 },
    { disciplina: "lingua_inglesa", total: 2, acertos: 2 },
    { disciplina: "informatica", total: 6, acertos: 2 }, // cota 15
    { disciplina: "vendas_negociacao", total: 6, acertos: 3 }, // cota 15
    { disciplina: "matematica_financeira", total: 2, acertos: 0 }, // cota 5
    { disciplina: "conhecimentos_bancarios", total: 4, acertos: 2 }, // cota 10
  ]);
  assert.deepEqual(r.fortes, ["lingua_portuguesa", "matematica", "lingua_inglesa"]);
  assert.equal(r.focos[0], "informatica");
  assert.ok(r.focos.every((f) => !r.fortes.includes(f)));
  assert.equal(r.focos.length, 3);
});

test("histórico de diagnósticos sai das tentativas diag:", () => {
  const disc = new Map<string, Disciplina>([["t1", "informatica"]]);
  const t = (p: Partial<TentativaBruta>): TentativaBruta => ({ questaoId: "q", topicoId: "t1", acertou: true, xp: 0, modo: "simulado", data: "2026-10-01T10:00:00Z", ...p });
  const h = diagnosticosDe([t({ simuladoId: "diag:a" }), t({ simuladoId: "diag:a", acertou: false }), t({ simuladoId: "sim1" }), t({ simuladoId: "diag:b", data: "2026-11-02T10:00:00Z" })], disc);
  assert.deepEqual(h.map((d) => [d.id, d.total, d.acertos]), [["diag:a", 2, 1], ["diag:b", 1, 1]]);
  assert.deepEqual(h[0].porDisciplina, [{ disciplina: "informatica", total: 2, acertos: 1 }]);
});

test("convida de novo depois de 30 dias", () => {
  const agora = new Date("2026-11-01T00:00:00Z");
  assert.equal(diagnosticoPendente(undefined, agora), true);
  assert.equal(diagnosticoPendente("2026-10-20T00:00:00Z", agora), false);
  assert.equal(diagnosticoPendente("2026-10-01T00:00:00Z", agora), true);
});
