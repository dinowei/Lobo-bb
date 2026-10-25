import assert from "node:assert/strict";
import test from "node:test";
import { JANELAS_PADRAO, validarJanelas } from "./janelaB.js";

const jb = (inicio: string, fim: string, tetoChamadas = 80) => ({ janelaB: { inicio, fim, tetoChamadas } });

test("Janela B: padrão 18:00–19:00 vale; horário fora do formato, invertido ou na madrugada da noite não vale", () => {
  assert.equal(validarJanelas(JANELAS_PADRAO), null);
  assert.match(validarJanelas(jb("18h", "19:00"))!, /HH:MM/);
  assert.match(validarJanelas(jb("19:00", "18:00"))!, /depois do início/);
  assert.match(validarJanelas(jb("02:00", "03:00"))!, /madrugada/);
  assert.match(validarJanelas(jb("18:00", "19:00", 5))!, /Teto/);
  assert.equal(validarJanelas(jb("12:30", "13:15", 40)), null);
});
