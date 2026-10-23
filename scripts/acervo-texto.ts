// Lê o texto de um PDF do acervo (SÓ LEITURA): páginas inteiras ou só as linhas com um termo.
// uso: npx tsx scripts/acervo-texto.ts "<caminho relativo a ACERVO_DIR ou absoluto>" [--paginas 3-5] [--termo "conhecimentos básicos"]
import "../src/env.js";
import { readFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { extractText, getDocumentProxy } from "unpdf";

const [alvo, ...resto] = process.argv.slice(2);
if (!alvo) throw new Error('uso: npx tsx scripts/acervo-texto.ts "<arquivo.pdf>" [--paginas 3-5] [--termo "x"]');
const opc = (nome: string) => { const i = resto.indexOf(nome); return i >= 0 ? resto[i + 1] : undefined; };
const caminho = isAbsolute(alvo) ? alvo : join(process.env.ACERVO_DIR ?? "", alvo);
const pdf = await getDocumentProxy(new Uint8Array(await readFile(caminho)));
const { totalPages, text } = await extractText(pdf, { mergePages: false });
const [de, ate] = (opc("--paginas") ?? `1-${totalPages}`).split("-").map(Number);
const termo = opc("--termo")?.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
console.log(`${totalPages} página(s)`);
for (let p = de; p <= Math.min(ate || de, totalPages); p++) {
  const t = String(text[p - 1]).replace(/[ \t]+/g, " ");
  if (!termo) { console.log(`\n--- página ${p} ---\n${t}`); continue; }
  const sem = t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  let i = sem.indexOf(termo);
  while (i >= 0) {
    console.log(`p.${p}: …${t.slice(Math.max(0, i - 200), i + 400).replace(/\s+/g, " ")}…`);
    i = sem.indexOf(termo, i + termo.length + 400);
  }
}
