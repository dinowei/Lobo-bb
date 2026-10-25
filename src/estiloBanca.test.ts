import assert from "node:assert/strict";
import test from "node:test";
import { bancasDeEstilo } from "./pipeline.js";
import { BANCAS, bancaEmUso } from "../shared/concursos.js";

const padrao = (c: Parameters<typeof bancaEmUso>[0]) => bancaEmUso(c, null);

test("estilo por banca: bancas de múltipla escolha dos concursos que cobram o tópico; Cebraspe fica para o C/E", () => {
  // Crase é dos quatro: BB (Cesgranrio), TJ-SP (Vunesp), CVM (FGV, referência); BACEN (Cebraspe) é C/E
  assert.deepEqual(bancasDeEstilo(["bb", "tjsp", "bacen", "cvm"], padrao).sort(), ["cesgranrio", "fgv", "vunesp"]);
  // só o BACEN cobra: a Cebraspe é C/E, então o estilo cai na Cesgranrio
  assert.deepEqual(bancasDeEstilo(["bacen"], padrao), ["cesgranrio"]);
  assert.deepEqual(bancasDeEstilo([], padrao), ["cesgranrio"]);
  for (const b of ["cesgranrio", "fgv", "vunesp"] as const) assert.ok(BANCAS[b].estilo.length >= 2, `${b} tem estilo descrito`);
});
