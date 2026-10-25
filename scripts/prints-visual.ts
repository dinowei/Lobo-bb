// Prints do visual final (E13) no Edge: claro e escuro, 360 e 1440, das telas do modo demo e da tela Entrar
// (esta com a API simulada pedindo conta). uso: npx tsx scripts/prints-visual.ts <pasta>
//   com "bb-demo" (:5180) e "bb-web" (:5182) de pé. Variáveis: PRINTS_DEMO, PRINTS_WEB, PRINTS_TELAS (lista)
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "playwright-core";

const pasta = process.argv[2];
if (!pasta) {
  console.error("uso: npx tsx scripts/prints-visual.ts <pasta>");
  process.exit(1);
}
const DEMO = process.env.PRINTS_DEMO ?? "http://localhost:5180";
const WEB = process.env.PRINTS_WEB ?? "http://localhost:5182";
const TODAS = ["plano", "cartoes", "diagnostico", "conquistas", "tema", "player", "entrar"];
const telas = process.env.PRINTS_TELAS ? process.env.PRINTS_TELAS.split(",") : TODAS;
mkdirSync(pasta, { recursive: true });

async function abrir(p: Page, tela: string) {
  if (tela === "entrar") {
    await p.route((u) => u.pathname.startsWith("/api/"), (r) => {
      const u = new URL(r.request().url());
      if (u.pathname === "/api/saude") return r.fulfill({ json: { ok: true } });
      if (u.pathname === "/api/auth/eu") return r.fulfill({ json: { login: true, usuario: null } });
      return r.fulfill({ status: 401, json: { erro: "entre primeiro" } });
    });
    await p.goto(`${WEB}/`, { waitUntil: "networkidle", timeout: 120_000 });
    await p.locator("form").first().waitFor();
    return;
  }
  // "tema" abre a Crase; "player" é o mesmo tema com o player da Lo no rodapé ("Estudar ouvindo")
  const hash = tela === "tema" || tela === "player" ? "tema?tema=crase" : tela;
  await p.goto(`${DEMO}/#${hash}`, { waitUntil: "networkidle", timeout: 120_000 });
  // a tela carrega sob demanda: espera o título da tela e o fim de qualquer "carregando"
  await p.locator("main h1, main h2").first().waitFor({ timeout: 60_000 }).catch(() => {});
  await p.waitForFunction(() => !document.querySelector(".esqueleto, [aria-busy=true]") && !/Embaralhando/.test(document.body.innerText), null, { timeout: 60_000 }).catch(() => console.warn(`  ⚠ ${tela}: ainda carregando`));
}

const navegador = await chromium.launch({ channel: "msedge", headless: true });
try {
  for (const tema of ["escuro", "claro"] as const) {
    for (const t of [{ w: 1440, h: 900, mobile: false }, { w: 360, h: 780, mobile: true }]) {
      const ctx = await navegador.newContext({
        viewport: { width: t.w, height: t.h }, deviceScaleFactor: t.mobile ? 2 : 1, isMobile: t.mobile, hasTouch: t.mobile,
        colorScheme: tema === "escuro" ? "dark" : "light", locale: "pt-BR",
      });
      await ctx.addInitScript((tm) => {
        const a = JSON.parse(localStorage.getItem("lobo-ajustes") ?? "{}");
        localStorage.setItem("lobo-ajustes", JSON.stringify({ ...a, tema: tm }));
      }, tema);
      for (const tela of telas) {
        const p = await ctx.newPage();
        await abrir(p, tela);
        if (tela === "player") {
          await p.locator("button", { hasText: /Estudar ouvindo/ }).first().click().catch(() => {});
          await p.locator(".mini-lo").waitFor({ timeout: 10_000 }).catch(() => console.warn("  ⚠ player da Lo não apareceu"));
        }
        await p.waitForTimeout(900); // animações e fontes
        const arquivo = join(pasta, `${tela}-${tema}-${t.w}.png`);
        await p.screenshot({ path: arquivo, fullPage: true });
        console.log(`✔ ${arquivo}`);
        await p.close();
      }
      await ctx.close();
    }
  }
} finally {
  await navegador.close();
}
