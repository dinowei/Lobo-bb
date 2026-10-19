import assert from "node:assert/strict";
import test from "node:test";
import { alertaDoBanco } from "./usoBanco.js";

const uso = (usadoMB: number) => ({ usadoMB, limiteMB: 512, fracao: usadoMB / 512, alerta: usadoMB / 512 >= 0.8, dadosMB: usadoMB, indicesMB: 0, discoMB: usadoMB });

test("banco: alerta só a partir de 80% do limite", () => {
  assert.equal(alertaDoBanco(uso(60)), null);
  assert.equal(alertaDoBanco(uso(409)), null); // 79,9%
  assert.match(alertaDoBanco(uso(410))!, /80% do limite/);
});
