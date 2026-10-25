// E2E da F5 (abas BB/BACEN) no Edge, com a API simulada no próprio teste (nada toca no progresso real):
// a aba Geral vem marcada (trilha única; prontidão de cada concurso) → clica BACEN (lente) → os pedidos seguintes vão com X-Concurso: bacen e a lista de tópicos
// muda → recarregar a página mantém o BACEN → Ajustes mostra o BACEN "Em estudo" com o aviso da banca
// de referência → "Estudar este" no BB volta para o BB. Prints 1440 e 360 em docs/telas/concurso/.
// uso: npx tsx scripts/e2e-concurso.ts   (com o servidor "bb-web" :5182 de pé)
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium, type Page } from "playwright-core";
import { calcularPainel } from "../shared/motor.js";
import type { ConcursoInfoDTO, TopicoDTO } from "../shared/tipos.js";
import { prontidaoDeTodos } from "../shared/prontidao.js";

const WEB = process.env.E2E_WEB ?? "http://localhost:5182";
const PASTA = "docs/telas/concurso";
mkdirSync(PASTA, { recursive: true });

const TOPICOS: Record<string, TopicoDTO[]> = {
  bb: [{ id: "t-vendas", disciplina: "vendas_negociacao", assunto: "Técnicas de vendas", subtopicos: [], peso: 5 }],
  bacen: [{ id: "t-sfn", disciplina: "conhecimentos_bancarios", assunto: "Sistema Financeiro Nacional", subtopicos: [], peso: 5 }],
};
const CONCURSOS: ConcursoInfoDTO[] = [
  { id: "bb", nome: "Banco do Brasil", cargo: "Escriturário", banca: "cesgranrio", aDefinir: false, bancaEmUso: "cesgranrio", nomeBanca: "Fundação Cesgranrio", areas: [], area: null },
  { id: "bacen", nome: "Banco Central do Brasil", cargo: "Técnico", banca: "a_definir", aDefinir: true, bancaEmUso: "cebraspe", nomeBanca: "Cebraspe",
    areas: [{ id: "suporte_tecnico_administrativo", nome: "Suporte Técnico-Administrativo" }], area: "suporte_tecnico_administrativo" },
];

// prontidão de verdade (shared/prontidao.ts), com Crase dominada: sobe todos os concursos que cobram Crase
const PRONTIDAO = prontidaoDeTodos(new Map([["crase", 1]]));

// guarda o X-Concurso de cada pedido e responde conforme ele
function servidorFalso(p: Page, cabecalhos: { caminho: string; concurso: string }[]) {
  return p.route((u) => u.pathname.startsWith("/api/"), (r) => {
    const u = new URL(r.request().url());
    const concurso = r.request().headers()["x-concurso"] ?? "";
    cabecalhos.push({ caminho: u.pathname, concurso });
    const j = (json: unknown) => r.fulfill({ json });
    const topicos = TOPICOS[concurso] ?? TOPICOS.bb;
    switch (u.pathname) {
      case "/api/saude": return j({ ok: true });
      case "/api/auth/eu": return j({ login: false, usuario: null });
      case "/api/painel": return j(calcularPainel({ topicos, tentativas: [], revisoes: [] }));
      case "/api/topicos": return j(topicos);
      case "/api/concursos": return j(CONCURSOS);
      case "/api/prontidao": return j(PRONTIDAO);
      case "/api/trilha": return j(null);
      default: return j({});
    }
  });
}

const navegador = await chromium.launch({ channel: "msedge", headless: true });
let falhou = false;
try {
  for (const tela of [{ nome: "desktop", w: 1440, h: 900 }, { nome: "celular", w: 360, h: 780 }]) {
    const ctx = await navegador.newContext({ viewport: { width: tela.w, height: tela.h }, colorScheme: "dark", locale: "pt-BR" });
    const p = await ctx.newPage();
    p.setDefaultTimeout(30_000);
    const cabecalhos: { caminho: string; concurso: string }[] = [];
    await servidorFalso(p, cabecalhos);
    await p.goto(`${WEB}/#painel`, { waitUntil: "domcontentloaded", timeout: 120_000 });

    // começa na aba Geral (trilha única): prontidão de cada concurso, do mesmo domínio
    const geral = p.locator("[data-testid=aba-geral]");
    const bacen = p.locator("[data-testid=aba-bacen]");
    await geral.waitFor();
    assert.equal(await geral.getAttribute("aria-selected"), "true", "Geral marcada de início");
    assert.deepEqual(await p.locator(".seletor-concurso [role=tab]").allInnerTexts(), ["Geral", "BB", "TJ-SP", "BACEN", "CVM"], "Geral + as quatro lentes");
    await p.waitForFunction(() => document.body.innerText.includes("Vendas"));
    assert.ok(cabecalhos.some((c) => c.caminho === "/api/painel" && c.concurso === "geral"), "painel pedido sem lente (X-Concurso: geral)");
    const lista = await p.locator("[data-testid=prontidao-geral]").innerText();
    for (const s of ["BB", "TJ-SP", "BACEN", "CVM"]) assert.match(lista, new RegExp(`${s}\\s+[1-9]\\d?%`), `Crase dominada sobe ${s}`);

    // troca para o BACEN: pedidos novos com bacen e a matéria muda (espera a carga inicial acabar, senão um
    // pedido do BB que começou antes do clique aparece depois dele)
    await p.waitForLoadState("networkidle");
    const antes = cabecalhos.length;
    await bacen.click();
    await p.waitForFunction(() => document.querySelector("[data-testid=aba-bacen]")?.getAttribute("aria-selected") === "true");
    await p.waitForFunction(() => document.body.innerText.includes("Conhecimentos Bancários"));
    // lente: prontidão só do BACEN, com os pesos "a confirmar" (edital do Técnico pendente)
    await p.locator("[data-testid=prontidao-lente]").waitFor();
    assert.match(await p.locator("[data-testid=prontidao-lente]").innerText(), /Prontidão para BACEN[\s\S]*pesos a confirmar/);
    const depois = cabecalhos.slice(antes).filter((c) => c.caminho !== "/api/saude");
    assert.ok(depois.length > 0, "a troca recarrega os dados");
    assert.ok(depois.every((c) => c.concurso === "bacen"), `depois da troca tudo vai com bacen: ${JSON.stringify(depois)}`);
    assert.equal(await p.evaluate(() => localStorage.getItem("lobo-concurso")), "bacen");
    await p.screenshot({ path: `${PASTA}/painel-bacen-${tela.nome}.png` });

    // recarregar mantém o BACEN
    await p.reload({ waitUntil: "domcontentloaded" });
    await bacen.waitFor();
    assert.equal(await bacen.getAttribute("aria-selected"), "true", "BACEN continua depois de recarregar");

    // Ajustes: BACEN em estudo, banca a definir com o aviso; "Estudar este" no BB volta
    await p.goto(`${WEB}/#ajustes`);
    const secao = p.locator("[data-testid=ajustes-concurso]");
    await secao.locator(".concurso-item.ativo").waitFor();
    assert.match(await secao.locator(".concurso-item.ativo").innerText(), /Banco Central do Brasil[\s\S]*Em estudo/);
    assert.match(await secao.innerText(), /Estudando no estilo Cebraspe \(referência\)\. Quando o edital sair, a banca muda\./);
    await secao.scrollIntoViewIfNeeded();
    await secao.screenshot({ path: `${PASTA}/ajustes-${tela.nome}.png` });
    await secao.locator(".concurso-item", { hasText: "Banco do Brasil" }).getByRole("button", { name: "Estudar este" }).click();
    await p.waitForFunction(() => document.querySelector("[data-testid=aba-bb]")?.getAttribute("aria-selected") === "true");
    assert.equal(await p.evaluate(() => localStorage.getItem("lobo-concurso")), "bb");

    console.log(`✔ ${tela.nome}: Geral (prontidão dos 4) → lente BACEN (cabeçalho, matérias, prontidão) → recarrega e mantém → Ajustes vai para o BB`);
    await ctx.close();
  }
} catch (e) {
  falhou = true;
  console.error("✖", (e as Error).message);
} finally {
  await navegador.close();
}
process.exit(falhou ? 1 : 0);
