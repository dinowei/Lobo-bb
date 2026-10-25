// E2E da F10 (Certo ou Errado) no modo demo, sem servidor: no BB (Cesgranrio) errar não tira ponto;
// no BACEN (Cebraspe) cada erro vale −1 e, depois de 5 respostas no mesmo assunto, o Binho recomenda
// responder ou deixar em branco com os números do aluno. Prints 1440 e 360 em docs/telas/certo-errado/.
// uso: npx tsx scripts/e2e-ce.ts   (com o servidor "bb-demo" :5180 de pé)
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium, type Page } from "playwright-core";

const DEMO = process.env.E2E_DEMO ?? "http://localhost:5180";
const PASTA = "docs/telas/certo-errado";
mkdirSync(PASTA, { recursive: true });

const responder = async (p: Page, tecla: "c" | "e" | "b") => {
  await p.locator("[data-testid=item-ce] .ce-botoes").waitFor();
  await p.keyboard.press(tecla);
  await p.locator("[data-testid=correcao-ce]").waitFor();
  return p.locator("[data-testid=correcao-ce]").innerText();
};
const proximo = async (p: Page) => {
  await p.keyboard.press("Enter");
  await p.locator("[data-testid=item-ce] .ce-botoes").waitFor();
};

const navegador = await chromium.launch({ channel: "msedge", headless: true });
let falhou = false;
try {
  for (const tela of [{ nome: "desktop", w: 1440, h: 900 }, { nome: "celular", w: 360, h: 780 }]) {
    const ctx = await navegador.newContext({ viewport: { width: tela.w, height: tela.h }, colorScheme: "dark", locale: "pt-BR" });
    const p = await ctx.newPage();
    p.setDefaultTimeout(30_000);
    await p.goto(`${DEMO}/#certo-errado`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await p.evaluate(() => { localStorage.clear(); localStorage.setItem("lobo-concurso", "bb"); });
    await p.reload({ waitUntil: "domcontentloaded" });

    // BB: Cesgranrio não desconta erro; o Binho diz para responder sempre
    await p.locator("[data-testid=item-ce]").waitFor();
    assert.match(await p.locator(".pagina-cabeca").innerText(), /Cesgranrio[\s\S]*errar não tira ponto/);
    assert.match(await p.locator("[data-testid=recomendacao-ce]").innerText(), /responda sempre/);
    const bb = await responder(p, "e");
    assert.match(bb, /(\+1|0) ponto/);
    assert.doesNotMatch(bb, /-1/);

    // BACEN: Cebraspe, erro vale −1; em branco vale 0
    await p.locator("[data-testid=aba-bacen]").click();
    await p.locator("[data-testid=item-ce]").waitFor();
    assert.match(await p.locator(".pagina-cabeca").innerText(), /Cebraspe[\s\S]*cada erro anula um acerto/);
    const branco = await responder(p, "b");
    assert.match(branco, /Em branco[\s\S]*0 pontos/);
    // só este tema (link da página do tema): o histórico do assunto cresce e a recomendação aparece
    const sub = await p.locator("[data-testid=item-ce]").getAttribute("data-subtopico");
    assert.ok(sub, "item com subtópico");
    await p.goto(`${DEMO}/#certo-errado?tema=${sub}`);
    await p.locator(".ce-filtro").waitFor();
    let viuMenosUm = false;
    let viuRecomendacao = false;
    for (let i = 0; i < 12 && !(viuMenosUm && viuRecomendacao); i++) {
      if (i > 0) await proximo(p);
      else await p.locator("[data-testid=item-ce] .ce-botoes").waitFor();
      assert.equal(await p.locator("[data-testid=item-ce]").getAttribute("data-subtopico"), sub, "o filtro do tema vale");
      if (await p.locator("[data-testid=recomendacao-ce]").count()) {
        assert.match(await p.locator("[data-testid=recomendacao-ce]").innerText(), /acerta ~\d+% dos itens deste assunto \(\d+ de \d+\)[\s\S]*50%/);
        viuRecomendacao = true;
        if (i > 3) await p.screenshot({ path: `${PASTA}/recomendacao-${tela.nome}.png`, fullPage: tela.nome === "celular" });
      }
      const r = await responder(p, "c");
      if (/-1 ponto/.test(r)) viuMenosUm = true;
    }
    assert.ok(viuMenosUm, "no BACEN um erro vale −1");
    assert.ok(viuRecomendacao, "depois de 5 respostas no assunto aparece a recomendação com os números");
    await p.screenshot({ path: `${PASTA}/correcao-${tela.nome}.png`, fullPage: tela.nome === "celular" });
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "sem rolagem lateral");
    console.log(`✔ ${tela.nome}: BB sem desconto → BACEN com −1, em branco 0 e recomendação com os números`);
    await ctx.close();
  }
} catch (e) {
  falhou = true;
  console.error("✖", (e as Error).message);
} finally {
  await navegador.close();
}
process.exit(falhou ? 1 : 0);
