import test from "node:test";
import assert from "node:assert/strict";
import { filtroCacheFala } from "./vozCache.js";

test("a chave de cache inclui a voz pedida e não reutiliza o áudio de Diego para Louise", () => {
  const texto = "A explicação de teste.";
  const diego = filtroCacheFala(texto, "Magpie-Multilingual.PT-BR.Diego");
  const louise = filtroCacheFala(texto, "Magpie-Multilingual.PT-BR.Louise");
  assert.equal(diego.voz, "Magpie-Multilingual.PT-BR.Diego");
  assert.equal(louise.voz, "Magpie-Multilingual.PT-BR.Louise");
  assert.notEqual(diego.hash, louise.hash);
  assert.notDeepEqual(diego, louise);
});
