import test from "node:test";
import assert from "node:assert/strict";
import { comandoBloqueadoNaJanelaNoturna } from "./fila.js";

const instanteBrt = (hora: number, minuto: number) =>
  new Date(Date.UTC(2026, 9, 20, hora + 3, minuto));

test("a janela noturna protege os outros comandos entre 01:00 e 05:30 BRT", () => {
  assert.equal(comandoBloqueadoNaJanelaNoturna("bb gerar --assunto matemática", instanteBrt(1, 0)), true);
  assert.equal(comandoBloqueadoNaJanelaNoturna("api explicação alternativa", instanteBrt(3, 15)), true);
  assert.equal(comandoBloqueadoNaJanelaNoturna("bb status", instanteBrt(5, 29)), true);
});

test("o noturno passa durante a janela protegida", () => {
  assert.equal(comandoBloqueadoNaJanelaNoturna("bb noturno --ate 05:30", instanteBrt(2, 0)), false);
  assert.equal(comandoBloqueadoNaJanelaNoturna("noturno", instanteBrt(5, 29)), false);
});

test("a janela não bloqueia antes de 01:00 nem a partir de 05:30 BRT", () => {
  assert.equal(comandoBloqueadoNaJanelaNoturna("bb gerar", instanteBrt(0, 59)), false);
  assert.equal(comandoBloqueadoNaJanelaNoturna("bb gerar", instanteBrt(5, 30)), false);
  assert.equal(comandoBloqueadoNaJanelaNoturna("bb gerar", instanteBrt(8, 0)), false);
});
