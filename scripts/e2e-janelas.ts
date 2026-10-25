// E2E da E8 (Admin → Janelas) no Edge, com a API simulada no próprio teste: mostra a Janela B (horário e
// teto), salva um horário novo e lista as últimas janelas A e B com cada etapa (ok / pulada / falhou).
// Prints 1440 e 360 em docs/telas/janelas/.
// uso: npx tsx scripts/e2e-janelas.ts   (com o servidor "bb-web" :5182 de pé)
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium, type Page } from "playwright-core";
import { calcularPainel } from "../shared/motor.js";

const WEB = process.env.E2E_WEB ?? "http://localhost:5182";
const PASTA = "docs/telas/janelas";
mkdirSync(PASTA, { recursive: true });

const relatorios = [
  { lote: "janela B 2026-10-25", inicio: "2026-10-25T21:00:00.000Z", fim: "2026-10-25T21:40:00.000Z", janela: "B", aprovadas: 470, etapas: [
    { etapa: "backup", status: "ok", detalhe: "10 coleções, 640 documentos (verificado)" },
    { etapa: "desempate", status: "pulada", detalhe: "nada a fazer" },
    { etapa: "pendentes da noite", status: "ok", detalhe: "6 de 6 tarefa(s): 6 concluída(s), 3 questão(ões) aprovada(s)" },
    { etapa: "teto de chamadas", status: "ok", detalhe: "52 de 80" },
  ] },
  { lote: "noite 2026-10-25", inicio: "2026-10-25T04:00:00.000Z", fim: "2026-10-25T08:25:00.000Z", janela: "A", aprovadas: 467, etapas: [
    { etapa: "backup", status: "ok", detalhe: "10 coleções, 623 documentos (verificado)" },
    { etapa: "acervo", status: "ok", detalhe: "0 PDF(s) novo(s) indexado(s) de 478" },
    { etapa: "fichas", status: "falhou", detalhe: "provedor fora do ar" },
  ] },
];

function servidorFalso(p: Page, salvos: unknown[]) {
  let config = { janelaB: { inicio: "18:00", fim: "19:00", tetoChamadas: 80 } };
  return p.route((u) => u.pathname.startsWith("/api/"), async (r) => {
    const u = new URL(r.request().url());
    const j = (json: unknown) => r.fulfill({ json });
    if (u.pathname === "/api/admin/janelas") {
      if (r.request().method() === "POST") {
        const b = r.request().postDataJSON();
        salvos.push(b);
        config = { janelaB: b };
      }
      return j({ config, relatorios });
    }
    if (u.pathname === "/api/saude") return j({ ok: true });
    if (u.pathname === "/api/auth/eu") return j({ login: false, usuario: null });
    if (u.pathname === "/api/topicos" || u.pathname === "/api/prontidao") return j([]);
    if (u.pathname === "/api/painel") return j(calcularPainel({ topicos: [], tentativas: [], revisoes: [] }));
    return j({});
  });
}

const navegador = await chromium.launch({ channel: "msedge", headless: true });
let falhou = false;
try {
  for (const tela of [{ nome: "desktop", w: 1440, h: 900 }, { nome: "celular", w: 360, h: 780 }]) {
    const ctx = await navegador.newContext({ viewport: { width: tela.w, height: tela.h }, colorScheme: "dark", locale: "pt-BR" });
    const p = await ctx.newPage();
    p.setDefaultTimeout(30_000);
    const salvos: unknown[] = [];
    await servidorFalso(p, salvos);
    await p.goto(`${WEB}/#admin?aba=janelas`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    const painel = p.locator("[data-testid=admin-janelas]");
    await painel.waitFor();
    assert.equal(await p.locator("#jb-inicio").inputValue(), "18:00");
    assert.equal(await p.locator("#jb-fim").inputValue(), "19:00");
    // relatórios com as etapas e o status de cada uma
    const lista = await p.locator(".lista-janelas").innerText();
    assert.match(lista, /Janela B[\s\S]*pendentes da noite[\s\S]*52 de 80/);
    assert.match(lista, /Janela A[\s\S]*fichas: provedor fora do ar/);
    assert.equal(await p.locator(".etapa-falhou").count(), 1);
    // salva horário novo
    await p.locator("#jb-inicio").fill("12:30");
    await p.locator("#jb-fim").fill("13:15");
    await p.locator("#jb-teto").fill("40");
    await p.locator("[data-testid=admin-janelas] button", { hasText: "Salvar" }).click();
    await p.waitForFunction(() => document.body.innerText.includes("Janela B salva"));
    assert.deepEqual(salvos.at(-1), { inicio: "12:30", fim: "13:15", tetoChamadas: 40 });
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "sem rolagem lateral");
    await p.screenshot({ path: `${PASTA}/janelas-${tela.nome}.png`, fullPage: true });
    console.log(`✔ ${tela.nome}: Janela B (horário e teto) → salva → relatórios A/B com etapas`);
    await ctx.close();
  }
} catch (e) {
  falhou = true;
  console.error("✖", (e as Error).message);
} finally {
  await navegador.close();
}
process.exit(falhou ? 1 : 0);
