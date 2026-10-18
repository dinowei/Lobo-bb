// Gera as amostras de voz do Binho (Diego e Isabela, 3 frases) para o dono escolher a voz padrão.
// uso: npx tsx scripts/voz-amostras.ts   → docs/voz/<voz>-<n>.mp3 (e grava no cache do Mongo)
import "../src/env.js";
import mongoose from "mongoose";
import { mkdirSync, writeFileSync } from "node:fs";
import { audioDe } from "../src/voz.js";

const FRASES = [
  "Boa! Você acertou. O montante foi de R$ 5.306,04, com juros compostos de 2% a.m. durante 12 meses.",
  "Pelo art. 9º da Lei nº 9.613/1998, a comunicação ao Coaf deve ocorrer em até 24 horas.",
  "Quase lá. A crase aparece antes de palavra feminina: fui à agência; mas vou a pé, sem crase.",
];
await mongoose.connect(process.env.MONGODB_URI!);
mkdirSync("docs/voz", { recursive: true });
for (const voz of ["Magpie-Multilingual.PT-BR.Diego", "Magpie-Multilingual.PT-BR.Isabela"]) {
  for (const [i, f] of FRASES.entries()) {
    const t0 = Date.now();
    const a = await audioDe(f, voz);
    const nome = `docs/voz/${voz.split(".").pop()!.toLowerCase()}-${i + 1}.mp3`;
    if (a) writeFileSync(nome, a.mp3);
    console.log(a ? `✔ ${nome} (${Math.round(a.mp3.length / 1024)} kB, ${((Date.now() - t0) / 1000).toFixed(1)}s)` : `✖ ${voz} frase ${i + 1}: sem áudio`);
  }
}
await mongoose.disconnect();
