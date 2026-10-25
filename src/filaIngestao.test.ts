// Fila de ingestão do noturno num MongoDB EM MEMÓRIA (nada de produção). Roda com ISOLAMENTO=1.
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

const ligado = process.env.ISOLAMENTO === "1";
let memoria: MongoMemoryServer | null = null;

before(async () => {
  if (!ligado) return;
  memoria = await MongoMemoryServer.create();
  await mongoose.connect(memoria.getUri(), { dbName: "fila-teste" });
});
after(async () => {
  if (!ligado) return;
  await mongoose.disconnect();
  await memoria?.stop();
});

test("prova que falha sai da frente da fila e vai para as falhas (não trava as noites seguintes)", { skip: !ligado }, async () => {
  const { enfileirarIngestao, etapaIngestao, filaIngestao } = await import("./noiteCompleta.js");
  const { Config } = await import("./models.js");
  await enfileirarIngestao([
    { comando: "prova", prova: "nao-existe/prova.pdf", gabarito: "nao-existe/gab.pdf", nome: "Prova quebrada", banca: "cesgranrio" },
    { comando: "prova", prova: "nao-existe/outra.pdf", gabarito: "nao-existe/gab2.pdf", nome: "Próxima", banca: "cesgranrio" },
  ]);
  await assert.rejects(etapaIngestao());
  assert.deepEqual((await filaIngestao()).map((i) => i.nome), ["Próxima"]);
  const falhas = ((await Config.findById("fila_ingestao_falhas").lean())?.valor ?? []) as { nome: string; erro: string }[];
  assert.deepEqual(falhas.map((f) => f.nome), ["Prova quebrada"]);
  assert.ok(falhas[0].erro.length > 0);
});
