// Tira do enunciado a cópia da figura em texto ("| A | B |…") nas questões geradas com figura.
// A figura já é desenhada pelo app; desde a fase 3 o pipeline limpa antes de salvar.
// Este script corrige as que foram salvas antes disso. Sem --gravar, só mostra o que mudaria.
// uso: npx tsx scripts/limpar-figura-no-texto.ts [--gravar]
import mongoose from "mongoose";
import { tirarTabelaCopiada } from "../src/construcaoFiguras.js";

process.loadEnvFile(".env");
const gravar = process.argv.includes("--gravar");
await mongoose.connect(process.env.MONGODB_URI!);
const col = mongoose.connection.db!.collection("questions");
let mudariam = 0;
for (const q of await col.find({ "figuras.origem": "construcao" }).toArray()) {
  const novo = tirarTabelaCopiada(q.enunciado);
  if (novo === q.enunciado) continue;
  mudariam++;
  console.log(`\n=== ${q._id} [${q.status}]\nantes: ${q.enunciado}\ndepois: ${novo}`);
  if (gravar) await col.updateOne({ _id: q._id }, { $set: { enunciado: novo } });
}
console.log(`\n${mudariam} questão(ões) ${gravar ? "corrigida(s)" : "seriam corrigidas (rode com --gravar)"}.`);
await mongoose.disconnect();
