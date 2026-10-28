import assert from "node:assert/strict";
import test from "node:test";
import { noitesSeguidasOk, textoNoitesOk } from "./noites.js";

const ok = { janela: "A", etapas: [{ status: "ok" }, { status: "pulada" }] };
const falhou = { janela: "A", etapas: [{ status: "ok" }, { status: "falhou" }] };

test("noites seguidas OK: da mais recente para trás; falha ou relatório sem etapas para a contagem; Janela B não conta", () => {
  // o caso de 28/10: a noite de 28 sem falha, a de 27 com "fichas" falhou → 1/5
  assert.equal(noitesSeguidasOk([ok, falhou, ok]), 1);
  assert.equal(textoNoitesOk(1), "noites seguidas OK: 1/5");
  assert.equal(noitesSeguidasOk([falhou, ok]), 0);
  assert.equal(noitesSeguidasOk([ok, { janela: "B", etapas: [{ status: "falhou" }] }, ok, ok]), 3, "Janela B é pulada");
  assert.equal(noitesSeguidasOk([ok, { janela: "A", etapas: [] }, ok]), 1, "relatório antigo sem etapas interrompe");
  assert.equal(noitesSeguidasOk([]), 0);
  assert.equal(noitesSeguidasOk([ok, ok, ok, ok, ok, ok]), 6, "passa de 5 sem travar");
});
