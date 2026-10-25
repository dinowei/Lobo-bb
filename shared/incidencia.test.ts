import assert from "node:assert/strict";
import test from "node:test";
import { anoDaProva, contarIncidencia, pesoIncidencia } from "./incidencia.js";

const itens = [
  { chave: "crase", banca: "cesgranrio", prova: "BB 2023 — Escriturário" },
  { chave: "crase", banca: "cesgranrio", prova: "BB 2021 — Escriturário" },
  { chave: "crase", banca: "cebraspe", prova: "BACEN 2024 — Analista" },
  { chave: "crase", banca: "cesgranrio", prova: "BB 2023 — Escriturário", anulada: true },
  { chave: "pix", banca: "cesgranrio", prova: "BB 2023 — Escriturário" },
  { chave: "pix", banca: "cesgranrio", prova: "BB 2023 — Escriturário" },
  { chave: "lgpd", banca: "cebraspe", prova: "BACEN 2024 — Analista" },
];

test("incidência: conta por banca e ano, anulada fora, ordena por total e depois por nº de provas", () => {
  const l = contarIncidencia(itens);
  assert.deepEqual(l.map((x) => [x.chave, x.total, x.provas]), [["crase", 3, 3], ["pix", 2, 1], ["lgpd", 1, 1]]);
  assert.deepEqual(l[0].porBanca, { cesgranrio: 2, cebraspe: 1 });
  assert.deepEqual(l[0].porAno, { "2023": 1, "2021": 1, "2024": 1 });
});

test("incidência na banca: só a banca pedida; peso 0..1 pelo que mais caiu", () => {
  const ces = contarIncidencia(itens, "cesgranrio");
  assert.deepEqual(ces.map((x) => [x.chave, x.total]), [["crase", 2], ["pix", 2]]);
  const p = pesoIncidencia(contarIncidencia(itens));
  assert.equal(p.get("crase"), 1);
  assert.equal(p.get("lgpd"), 1 / 3);
  assert.equal(p.has("nunca-caiu"), false);
  assert.equal(pesoIncidencia([]).size, 0);
  assert.equal(anoDaProva("sem ano"), "s/ano");
});
