import assert from "node:assert/strict";
import test from "node:test";
import { etapa, sobraTempo, type EtapaNoite } from "./noiteCompleta.js";

test("etapas da noite: falha não derruba a noite, 'nada a fazer' vira pulada, tudo vai para o relatório", async () => {
  const lista: EtapaNoite[] = [];
  await etapa(lista, "backup", async () => "10 coleções");
  await etapa(lista, "ingestão", async () => null);
  await etapa(lista, "fichas", async () => { throw new Error("provedor fora"); });
  await etapa(lista, "relatório", async () => "ok");
  assert.deepEqual(lista.map((e) => [e.etapa, e.status]), [["backup", "ok"], ["ingestão", "pulada"], ["fichas", "falhou"], ["relatório", "ok"]]);
  assert.match(lista[2].detalhe, /provedor fora/);
});

test("sobra de tempo: sem hora de fim sempre sobra; com fim, conta os minutos", () => {
  assert.equal(sobraTempo(undefined, 30), true);
  assert.equal(sobraTempo(new Date(Date.now() + 60 * 60_000), 30), true);
  assert.equal(sobraTempo(new Date(Date.now() + 10 * 60_000), 30), false);
});
