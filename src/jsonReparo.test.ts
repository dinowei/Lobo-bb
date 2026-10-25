import assert from "node:assert/strict";
import test from "node:test";
import { extrairJSON, parseTolerante } from "./llm.js";

test("JSON com barra invertida solta (cópia de PDF) é reparado; escape válido fica como está", () => {
  // "Bad escaped character": \$ e \p não são escapes de JSON
  const bruto = '{"enunciado":"Custa R\\$ 10 em C:\\pasta","ok":"linha\\nnova","aspas":"\\"x\\""}';
  assert.throws(() => JSON.parse(bruto));
  assert.deepEqual(parseTolerante(bruto), { enunciado: "Custa R\\$ 10 em C:\\pasta", ok: "linha\nnova", aspas: '"x"' });
  assert.deepEqual(extrairJSON(`Aqui está:\n\`\`\`json\n${bruto}\n\`\`\``), parseTolerante(bruto));
  // JSON quebrado de outro jeito continua dando erro (não inventa)
  assert.throws(() => parseTolerante('{"a": 1,,}'));
});
