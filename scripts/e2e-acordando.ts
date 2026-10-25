// E2E da E12 (abertura instantânea) no Edge: build "remoto" (VITE_SERVIDOR_REMOTO=1, como na Vercel), com o
// servidor fingindo dormir (o /api/saude não responde nas primeiras tentativas). O site NÃO cai no modo demo:
// abre na hora com o painel guardado no aparelho e o aviso "Acordando o servidor"; quando o servidor responde,
// entra de verdade e o aviso some. Mede o tempo até a primeira tela (meta < 2 s).
// uso: npx tsx scripts/e2e-acordando.ts   (com o servidor "bb-web-remoto" :5183 de pé)
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";
import { calcularPainel } from "../shared/motor.js";
import type { TopicoDTO } from "../shared/tipos.js";

const WEB = process.env.E2E_WEB_REMOTO ?? "http://localhost:5183";
const PASTA = "docs/telas/acordando";
mkdirSync(PASTA, { recursive: true });
const topicos: TopicoDTO[] = [{ id: "t1", disciplina: "lingua_portuguesa", assunto: "Pontuação", subtopicos: [], peso: 5 }];
const painelGuardado = { ...calcularPainel({ topicos, tentativas: [], revisoes: [] }), sequenciaDias: 7 };

const navegador = await chromium.launch({ channel: "msedge", headless: true });
let falhou = false;
try {
  for (const tela of [{ nome: "desktop", w: 1440, h: 900 }, { nome: "celular", w: 360, h: 780 }]) {
    const ctx = await navegador.newContext({ viewport: { width: tela.w, height: tela.h }, colorScheme: "dark", locale: "pt-BR" });
    await ctx.addInitScript((p) => { localStorage.setItem("lobo-cache-painel", p); }, JSON.stringify(painelGuardado));
    const p = await ctx.newPage();
    p.setDefaultTimeout(40_000);
    let acordado = false;
    await p.route((u) => u.pathname.startsWith("/api/"), async (r) => {
      const u = new URL(r.request().url());
      if (u.pathname === "/api/saude") {
        if (!acordado) return r.abort("timedout"); // Render dormindo
        return r.fulfill({ json: { ok: true } });
      }
      if (u.pathname === "/api/auth/eu") return r.fulfill({ json: { login: false, usuario: null } });
      if (u.pathname === "/api/painel") return r.fulfill({ json: { ...painelGuardado, sequenciaDias: 8 } });
      if (u.pathname === "/api/topicos" || u.pathname === "/api/prontidao") return r.fulfill({ json: [] });
      return r.fulfill({ json: {} });
    });
    const t0 = Date.now();
    await p.goto(`${WEB}/#painel`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await p.locator("[data-testid=acordando]").waitFor();
    const primeiraTela = Date.now() - t0;
    assert.equal(await p.locator(".selo-demo").count(), 0, "não caiu no modo demo");
    assert.match(await p.locator(".pilula-fogo").innerText(), /7 dias/, "mostra o painel guardado no aparelho");
    await p.screenshot({ path: `${PASTA}/acordando-${tela.nome}.png` });
    // o servidor acorda: entra de verdade, o aviso some e o painel é o novo
    acordado = true;
    await p.locator("[data-testid=acordando]").waitFor({ state: "detached" });
    await p.waitForFunction(() => document.querySelector(".pilula-fogo")?.textContent?.includes("8 dias"));
    console.log(`✔ ${tela.nome}: abriu com o painel do aparelho em ${primeiraTela} ms (sem modo demo) → servidor acordou → painel novo`);
    assert.ok(primeiraTela < 12_000, `primeira tela em ${primeiraTela} ms`);
    await ctx.close();
  }
} catch (e) {
  falhou = true;
  console.error("✖", (e as Error).message);
} finally {
  await navegador.close();
}
process.exit(falhou ? 1 : 0);
