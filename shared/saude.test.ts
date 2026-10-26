import assert from "node:assert/strict";
import test from "node:test";
import { noturnoAtrasado } from "./saude.js";

test("noturno atrasado: mais de 36 h desde o último noturno OK (ou nunca rodou)", () => {
  const agora = new Date("2026-10-27T12:00:00Z");
  assert.equal(noturnoAtrasado("2026-10-26T08:00:00Z", agora), false, "28 h");
  assert.equal(noturnoAtrasado("2026-10-25T23:00:00Z", agora), true, "37 h");
  assert.equal(noturnoAtrasado(null, agora), true);
});
