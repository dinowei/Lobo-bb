// Confere que os cabeçalhos do web/vercel.json (CSP e cia.) não quebram o site: abre o build de produção
// (vite preview) com os mesmos cabeçalhos injetados e falha se houver violação de CSP ou se a tela não aparecer.
// uso: npm --prefix web run build && npx tsx scripts/checar-csp.ts   (com "bb-build" :5181 de pé)
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";

const URL_BUILD = process.env.CSP_URL ?? "http://localhost:5181";
const cfg = JSON.parse(readFileSync("web/vercel.json", "utf8")) as { headers: { source: string; headers: { key: string; value: string }[] }[] };
const globais = Object.fromEntries(cfg.headers.find((h) => h.source === "/(.*)")!.headers.map((h) => [h.key.toLowerCase(), h.value]));

const navegador = await chromium.launch({ channel: "msedge", headless: true });
let falhou = false;
try {
  const ctx = await navegador.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  const violacoes: string[] = [];
  p.on("console", (m) => { if (/Content Security Policy|Refused to/i.test(m.text())) violacoes.push(m.text().slice(0, 200)); });
  // documentos e scripts do próprio site recebem os cabeçalhos da Vercel
  await p.route((u) => u.origin === new URL(URL_BUILD).origin && !u.pathname.startsWith("/api/"), async (r) => {
    const resp = await r.fetch();
    await r.fulfill({ response: resp, headers: { ...resp.headers(), ...globais } });
  });
  await p.goto(`${URL_BUILD}/#painel`, { waitUntil: "networkidle", timeout: 120_000 });
  await p.locator("main").waitFor({ timeout: 60_000 });
  await p.waitForTimeout(1500);
  assert.ok(await p.locator(".nav, nav").count(), "a tela renderizou");
  assert.deepEqual(violacoes, [], "nenhuma violação de CSP");
  console.log(`✔ CSP e cabeçalhos do vercel.json: site renderiza, 0 violações (${Object.keys(globais).length} cabeçalhos)`);
} catch (e) {
  falhou = true;
  console.error("✖", (e as Error).message);
} finally {
  await navegador.close();
}
process.exit(falhou ? 1 : 0);
