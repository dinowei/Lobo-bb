// E2E da Cobertura da trilha (Admin → Cobertura) no Edge, com a API simulada no próprio teste (os números vêm
// das regras puras de shared/cobertura.ts): resumo por concurso, o tema em que a esteira trabalha, filtro por
// concurso e por situação, bloqueio com o motivo. Prints 1440 e 360 em docs/telas/cobertura/.
// uso: npx tsx scripts/e2e-cobertura.ts   (com o servidor "bb-web" :5182 de pé)
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium, type Page } from "playwright-core";
import { calcularPainel } from "../shared/motor.js";
import { coberturaPorConcurso, linhasCobertura, proximoTemaDaEsteira, type TemaCobertura } from "../shared/cobertura.js";

const WEB = process.env.E2E_WEB ?? "http://localhost:5182";
const PASTA = "docs/telas/cobertura";
mkdirSync(PASTA, { recursive: true });

const t = (n: number, nome: string, concursos: string[], extra: Partial<TemaCobertura> = {}): TemaCobertura => ({
  n, subtopico: `t${n}`, nome, concursos, aprovadas: 20, novas: 15, ficha: true, audioFicha: true, bloqueios: [], ...extra,
});
const linhas = linhasCobertura([
  t(1, "Interpretação de textos", ["bb", "tjsp", "bacen", "cvm"], { novas: 17, ficha: false, audioFicha: false }),
  t(2, "Classes de palavras", ["bb", "tjsp", "bacen", "cvm"]),
  t(3, "Ortografia e acentuação", ["bb", "tjsp"], { novas: 3, ficha: false, audioFicha: false, bloqueios: ["ficha sem material: o acervo não tem página de teoria"] }),
  t(4, "Crase", ["bb", "tjsp", "bacen", "cvm"], { novas: 40, audioFicha: false }),
  t(5, "Mercado de capitais e CVM", ["cvm"], { novas: 5, ficha: false, audioFicha: false }),
]);
const dto = { nHoje: 2, resumo: coberturaPorConcurso(linhas), temas: linhas, proximo: (() => { const p = proximoTemaDaEsteira(linhas, 2)!; return { n: p.n, subtopico: p.subtopico, nome: p.nome, faltas: p.faltas }; })() };

function servidorFalso(p: Page) {
  return p.route((u) => u.pathname.startsWith("/api/"), (r) => {
    const u = new URL(r.request().url());
    const j = (json: unknown) => r.fulfill({ json });
    if (u.pathname === "/api/admin/cobertura") return j(dto);
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
    await servidorFalso(p);
    await p.goto(`${WEB}/#admin?aba=cobertura`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await p.locator("[data-testid=admin-cobertura]").waitFor();
    // resumo: só "Classes de palavras" está pronto (a Crase ainda não tem o áudio da ficha)
    assert.match(await p.locator(".cartao-cobertura").first().innerText(), /Geral[\s\S]*1\/5[\s\S]*3 faltando · 1 bloqueados/i);
    // esteira trabalha no tema mais próximo do dia (2) que falta: o 4 (Crase, falta o áudio)
    assert.match((await p.locator("[data-testid=esteira-agora]").innerText()).replace(/\s+/g, " "), /Tema 4: Crase · falta áudio da ficha/);
    assert.equal(await p.locator("[data-testid=lista-cobertura] li").count(), 5);
    assert.match(await p.locator(".cobertura-bloqueado").innerText(), /Bloqueio: ficha sem material/);
    // filtro por concurso (CVM) e por situação
    await p.locator(".cartao-cobertura", { hasText: "CVM" }).click();
    assert.equal(await p.locator("[data-testid=lista-cobertura] li").count(), 4);
    await p.getByRole("button", { name: "Faltando", exact: true }).click();
    assert.deepEqual(await p.locator("[data-testid=lista-cobertura] li b").allInnerTexts(), ["Interpretação de textos", "Crase", "Mercado de capitais e CVM"]);
    await p.getByRole("button", { name: "Todos", exact: true }).click();
    await p.locator(".cartao-cobertura", { hasText: "Geral" }).click();
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "sem rolagem lateral");
    await p.screenshot({ path: `${PASTA}/cobertura-${tela.nome}.png`, fullPage: true });
    console.log(`✔ ${tela.nome}: resumo por concurso → esteira no tema 4 → bloqueio com motivo → filtros CVM e Faltando`);
    await ctx.close();
  }
} catch (e) {
  falhou = true;
  console.error("✖", (e as Error).message);
} finally {
  await navegador.close();
}
process.exit(falhou ? 1 : 0);
