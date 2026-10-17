// Prints automáticos das telas (desktop 1440 e celular 390), com o Edge instalado no Windows.
// uso: npx tsx scripts/prints.ts <pasta> <nome=hash> [<nome=hash> ...]
//   ex.: npx tsx scripts/prints.ts docs/telas painel=painel praticar=praticar "q1=praticar?q=6ad1..."
// Variáveis: PRINTS_URL (padrão http://localhost:5173), PRINTS_ESPERAR (seletor que precisa aparecer)
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";

const [pasta, ...alvos] = process.argv.slice(2);
if (!pasta || !alvos.length) {
  console.error("uso: npx tsx scripts/prints.ts <pasta> <nome=hash> ...");
  process.exit(1);
}
const URL_BASE = process.env.PRINTS_URL ?? "http://localhost:5173";
const ESPERAR = process.env.PRINTS_ESPERAR;
const TAMANHOS = [
  { nome: "desktop", width: 1440, height: 900, mobile: false },
  { nome: "celular", width: 390, height: 844, mobile: true },
] as const;

mkdirSync(pasta, { recursive: true });
const navegador = await chromium.launch({ channel: "msedge", headless: true });
try {
  for (const t of TAMANHOS) {
    const ctx = await navegador.newContext({
      viewport: { width: t.width, height: t.height },
      deviceScaleFactor: t.mobile ? 2 : 1,
      isMobile: t.mobile,
      hasTouch: t.mobile,
      colorScheme: "dark",
      locale: "pt-BR",
    });
    const pagina = await ctx.newPage();
    for (const alvo of alvos) {
      const [nome, hash] = alvo.includes("=") ? [alvo.slice(0, alvo.indexOf("=")), alvo.slice(alvo.indexOf("=") + 1)] : [alvo, alvo];
      await pagina.goto("about:blank"); // só trocar o hash não recarrega a tela
      await pagina.goto(`${URL_BASE}/#${hash}`, { waitUntil: "networkidle", timeout: 120_000 });
      if (ESPERAR) await pagina.waitForSelector(ESPERAR, { timeout: 60_000 }).catch(() => console.warn(`  ⚠ ${nome}: "${ESPERAR}" não apareceu`));
      await pagina.waitForTimeout(800); // animações e fontes
      const arquivo = join(pasta, `${nome}-${t.nome}.png`);
      await pagina.screenshot({ path: arquivo, fullPage: true });
      console.log(`✔ ${arquivo}`);
    }
    await ctx.close();
  }
} finally {
  await navegador.close();
}
