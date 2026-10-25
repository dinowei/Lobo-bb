import assert from "node:assert/strict";
import test from "node:test";
import { construirCrase, FORA_DO_SORTEIO, REGRAS_CRASE } from "./portugues.js";

test("crase: regra fora do sorteio nunca entra, mesmo sendo a menos usada; continua no banco de regras", () => {
  assert.ok(REGRAS_CRASE.some((r) => r.id === "erro_tratamento"), "a regra continua no banco");
  // todas as outras já usadas muitas vezes: antes, a de tratamento (uso 0) entrava sempre
  const uso = new Map(REGRAS_CRASE.map((r) => [r.id, FORA_DO_SORTEIO.has(r.id) ? 0 : 50]));
  for (let i = 0; i < 200; i++) {
    const q = construirCrase("C", "abertura de conta", { uso, anterior: new Set() });
    assert.ok(q.frases.every((f) => !FORA_DO_SORTEIO.has(f.regra.id)));
    assert.equal(q.frases.filter((f) => f.regra.correta).length, 1);
    assert.equal(new Set(q.frases.map((f) => f.regra.id)).size, 5, "5 regras diferentes");
  }
});
