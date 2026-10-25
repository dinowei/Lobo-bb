// E2E do Espaço da Lo no Edge.
// 1) Modo demo (bb-demo :5180), quarta-feira 28/10 com a Crase como tema do dia: Seu dia → toca o 1º áudio da
//    playlist (transcrição acompanha) → pausa → velocidade 1,5× → recarrega → "Continuar de onde parei" volta uma
//    frase antes de onde parou → Repetir começa do início → ouve até o fim → "ouvido" na biblioteca e no filtro.
// 2) Modo servidor com a API simulada (bb-web :5182): Seu dia com "a Janela B recuperou", Recados (selo, ficha,
//    conflito com a lei) e a posição indo para POST /api/espaco-lo/posicao.
// A voz do navegador é simulada (o headless não fala): cada frase "dura" alguns milissegundos.
// Prints 1440 e 360 em docs/telas/espaco-lo/.
// uso: npx tsx scripts/e2e-espaco-lo.ts   (com "bb-demo" :5180 e "bb-web" :5182 de pé)
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium, type BrowserContext, type Page } from "playwright-core";
import { calcularPainel } from "../shared/motor.js";
import { itensDoTema, registrarPosicao, type EspacoLoDTO } from "../shared/espacoLo.js";

const DEMO = process.env.E2E_DEMO ?? "http://localhost:5180";
const WEB = process.env.E2E_WEB ?? "http://localhost:5182";
const PASTA = "docs/telas/espaco-lo";
mkdirSync(PASTA, { recursive: true });
const QUARTA = new Date("2026-10-28T12:30:00-03:00");

// voz do navegador falsa: fala a fila em sequência, com onstart/onend; pausa e retoma; guarda o que "falou".
// Vai como TEXTO de script: função do tsx leva helpers do esbuild (__name) que não existem no navegador.
const vozFalsa = `(() => {
  window.__falas = []; window.__msFrase = 150;
  const fila = []; let atual = null; let timer; let pausado = false;
  function terminar() { const u = atual; atual = null; if (u && u.onend) u.onend(); proximo(); }
  function proximo() {
    if (pausado || atual) return;
    atual = fila.shift() || null;
    if (!atual) return;
    window.__falas.push(atual.text);
    if (atual.onstart) atual.onstart();
    timer = setTimeout(terminar, window.__msFrase);
  }
  const falsa = {
    speak(u) { fila.push(u); proximo(); },
    cancel() { fila.length = 0; clearTimeout(timer); atual = null; },
    pause() { pausado = true; clearTimeout(timer); },
    resume() { pausado = false; if (atual) timer = setTimeout(terminar, window.__msFrase); else proximo(); },
    getVoices() { return []; },
  };
  Object.defineProperty(window, "speechSynthesis", { value: falsa, configurable: true });
  window.SpeechSynthesisUtterance = function (t) { this.text = t; };
})();`;

async function novoContexto(nav: Awaited<ReturnType<typeof chromium.launch>>, w: number, h: number) {
  const ctx = await nav.newContext({ viewport: { width: w, height: h }, colorScheme: "dark", locale: "pt-BR" });
  await ctx.addInitScript({ content: vozFalsa });
  return ctx;
}
const semRolagemLateral = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
const posicoesDemo = (p: Page) => p.evaluate(() => (JSON.parse(localStorage.getItem("lobo-demo-espaco-lo") ?? "{}").audios ?? {}) as Record<string, { fracao: number; frase: number; ouvido: boolean }>);

async function fluxoDemo(ctx: BrowserContext, nome: string) {
  await ctx.addInitScript(() => {
    if (!localStorage.getItem("lobo-demo-trilha-inicio")) localStorage.setItem("lobo-demo-trilha-inicio", JSON.stringify({ subtopico: "crase", desde: "2026-10-28" }));
  });
  const p = await ctx.newPage();
  p.setDefaultTimeout(30_000);
  await p.clock.setFixedTime(QUARTA);
  await p.goto(`${DEMO}/#espaco-lo`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await p.locator("[data-testid=seu-dia]").waitFor();
  assert.match(await p.locator("[data-testid=seu-dia]").innerText(), /Tema do dia: Crase/);
  const faixas = p.locator("[data-testid=playlist] .faixa-lo");
  assert.ok((await faixas.count()) >= 1, "playlist do tema do dia");
  const aula = faixas.filter({ hasText: "Aula" }).first(); // a aula é longa: dá para parar no meio
  const primeira = await aula.getAttribute("aria-label");

  // toca: a transcrição acompanha e a posição vai sendo salva
  await aula.click();
  await p.locator("[data-testid=player-lo]").waitFor();
  await p.waitForFunction(() => Object.values(JSON.parse(localStorage.getItem("lobo-demo-espaco-lo") ?? "{}").audios ?? {}).some((a) => (a as { frase: number }).frase >= 3));
  const lendo = await p.locator(".transcricao p.lendo").innerText();
  assert.ok(lendo.length > 0, "frase atual destacada");

  // pausa e troca a velocidade
  await p.locator(".player-lo .play-lo").click();
  await p.waitForFunction(() => document.querySelector(".player-lo .play-lo")?.getAttribute("aria-label") === "Tocar");
  await p.locator(".player-lo .chip", { hasText: "1,5×" }).click();
  assert.equal(await p.locator(".player-lo .chip", { hasText: "1,5×" }).getAttribute("aria-pressed"), "true");
  assert.equal(await p.evaluate(() => JSON.parse(localStorage.getItem("lobo-ajustes") ?? "{}").velocidadeVoz), 1.5);
  const [idSalvo, salvo] = Object.entries(await posicoesDemo(p))[0];
  assert.ok(salvo.fracao > 0 && salvo.fracao < 1, "parou no meio");

  // recarrega: "Continuar de onde parei" retoma uma frase antes
  await p.reload({ waitUntil: "domcontentloaded" });
  await p.locator("[data-testid=continuar]").waitFor();
  assert.match(await p.locator("[data-testid=continuar]").innerText(), /Continuar de onde parei \(\d+%\)/);
  await p.evaluate(() => { (window as unknown as { __falas: string[] }).__falas = []; });
  await p.locator("[data-testid=continuar]").click();
  await p.waitForFunction(() => (window as unknown as { __falas: string[] }).__falas.length > 0);
  await p.locator(".transcricao p").first().waitFor();
  const frases = await p.locator(".transcricao p").allInnerTexts();
  const primeiraFalada = await p.evaluate(() => (window as unknown as { __falas: string[] }).__falas[0]);
  assert.equal(primeiraFalada, frases[Math.max(0, salvo.frase - 1)], "retoma uma frase antes de onde parou");

  // Repetir começa do início
  await p.evaluate(() => { (window as unknown as { __falas: string[] }).__falas = []; });
  await p.locator("[data-testid=repetir]").click();
  // a leitura anterior ainda pode registrar uma frase antes do clique; o que importa é a frase 0 voltar a ser lida
  await p.waitForFunction((f0) => (window as unknown as { __falas: string[] }).__falas.includes(f0), frases[0], { timeout: 10_000 });

  // ouve até o fim: vira "ouvido" (fica salvo) e aparece no filtro da biblioteca
  await p.evaluate(() => { (window as unknown as { __msFrase: number }).__msFrase = 15; });
  await p.waitForFunction((id) => JSON.parse(localStorage.getItem("lobo-demo-espaco-lo") ?? "{}").audios?.[id]?.ouvido === true, idSalvo, { timeout: 60_000 });
  await p.getByRole("button", { name: "Ouvidos", exact: true }).click();
  await p.locator("[data-testid=biblioteca] .selo-ouvido.sim").first().waitFor();
  assert.ok((await p.locator("[data-testid=biblioteca] .faixa-lo").allInnerTexts()).some((t) => primeira!.includes(t.split("\n").find((l) => l.startsWith("Aula") || l.startsWith("Ficha") || l.startsWith("Pontos")) ?? "§")), "o áudio ouvido está no filtro");
  await p.getByRole("button", { name: "Todos", exact: true }).click();
  await p.locator(".filtros-lo input").fill("JUROS");
  assert.ok((await p.locator("[data-testid=biblioteca] .faixa-lo").count()) >= 1, "busca sem acento e sem caixa");
  await p.locator(".filtros-lo input").fill("");

  assert.equal(await semRolagemLateral(p), true, "sem rolagem lateral");
  await p.screenshot({ path: `${PASTA}/demo-${nome}.png`, fullPage: true });
  console.log(`✔ ${nome} (demo): seu dia → toca com transcrição → pausa → 1,5× → recarrega → continua 1 frase antes → repetir → ouvido na biblioteca`);
}

function dtoServidor(): EspacoLoDTO {
  const itens = itensDoTema({
    subtopico: "crase", nome: "Crase", disciplina: "lingua_portuguesa",
    ficha: ["Antes de palavra masculina não há crase.", "Na indicação de horas determinadas, há crase."],
    aulas: [{ topicoId: "65ab0000000000000000a001", assunto: "Regência verbal e nominal e crase", texto: "Aula: Regência e crase.\nRegência mostra a preposição.\nCrase é a fusão de a com a." }],
    pontos: ["Teste do masculino", "Horas determinadas levam crase"],
  }).map((i, k) => ({ ...i, pronto: k === 0, posicao: k === 1 ? registrarPosicao(null, { fracao: 1, frase: 3, segundos: 0 }) : null }));
  return {
    seuDia: [
      { tipo: "tema", texto: "Tema do dia: Crase. 12 questões novas prontas para você." },
      { tipo: "material", texto: "Ficha e aula prontas, com áudio da Lo já gravado." },
      { tipo: "revisoes", texto: "3 revisões vencidas esperando por você." },
      { tipo: "janela", texto: "O noturno não rodou e a Janela B recuperou. 312 questões aprovadas no banco." },
    ],
    temaDoDia: { subtopico: "crase", nome: "Crase" },
    playlist: itens,
    biblioteca: itens,
    recados: [
      { tipo: "selo", subtopico: "regencia", texto: "Regência saiu do reforço: concluído!" },
      { tipo: "ficha", subtopico: "crase", texto: "Ficha nova de Crase, já aprovada.", em: "2026-10-28T05:00:00.000Z" },
      { tipo: "conflito", subtopico: "crase", texto: "Crase: a apostila diverge da lei (horas indeterminadas). Vale a lei." },
    ],
  };
}

async function fluxoServidor(ctx: BrowserContext, nome: string) {
  const p = await ctx.newPage();
  p.setDefaultTimeout(30_000);
  const posicoes: { id: string; fracao: number }[] = [];
  await p.route((u) => u.pathname.startsWith("/api/"), async (r) => {
    const u = new URL(r.request().url());
    const j = (json: unknown) => r.fulfill({ json });
    if (u.pathname === "/api/espaco-lo") return j(dtoServidor());
    if (u.pathname === "/api/espaco-lo/posicao") {
      const b = r.request().postDataJSON();
      posicoes.push(b);
      return j(registrarPosicao(null, b));
    }
    if (u.pathname === "/api/voz") return r.fulfill({ status: 204 }); // sem MP3: cai na voz do navegador
    if (u.pathname === "/api/saude") return j({ ok: true });
    if (u.pathname === "/api/auth/eu") return j({ login: false, usuario: null });
    if (u.pathname === "/api/topicos" || u.pathname === "/api/prontidao") return j([]);
    if (u.pathname === "/api/painel") return j(calcularPainel({ topicos: [], tentativas: [], revisoes: [] }));
    return j({});
  });
  await p.goto(`${WEB}/#espaco-lo`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await p.locator("[data-testid=seu-dia]").waitFor();
  assert.match(await p.locator("[data-testid=seu-dia]").innerText(), /O noturno não rodou e a Janela B recuperou/);
  const recados = await p.locator("[data-testid=recados] li").allInnerTexts();
  assert.equal(recados.length, 3);
  assert.match(recados[0], /saiu do reforço: concluído!/);
  assert.match(recados[2], /Vale a lei/);
  assert.equal(await p.locator("[data-testid=biblioteca] .selo-ouvido.sim").count(), 1, "a aula já ouvida aparece como ouvida");
  assert.match(await p.locator("[data-testid=playlist]").innerText(), /áudio gravado/);
  await p.locator("[data-testid=playlist] .faixa-lo").first().click();
  await p.waitForFunction(() => document.querySelectorAll(".transcricao p.lida").length >= 1);
  assert.ok(posicoes.some((x) => x.id === "ficha-crase" && x.fracao > 0), "posição foi para o servidor");
  assert.equal(await semRolagemLateral(p), true, "sem rolagem lateral");
  await p.screenshot({ path: `${PASTA}/servidor-${nome}.png`, fullPage: true });
  console.log(`✔ ${nome} (servidor): Janela B recuperou → 3 recados → ouvido na biblioteca → posição no POST`);
}

const navegador = await chromium.launch({ channel: "msedge", headless: true });
let falhou = false;
try {
  for (const tela of [{ nome: "desktop", w: 1440, h: 900 }, { nome: "celular", w: 360, h: 780 }]) {
    const ctxDemo = await novoContexto(navegador, tela.w, tela.h);
    await fluxoDemo(ctxDemo, tela.nome);
    await ctxDemo.close();
    const ctxServ = await novoContexto(navegador, tela.w, tela.h);
    await fluxoServidor(ctxServ, tela.nome);
    await ctxServ.close();
  }
} catch (e) {
  falhou = true;
  console.error("✖", (e as Error).message, (e as Error).stack?.split("\n").find((l) => l.includes("e2e-espaco-lo")) ?? "");
} finally {
  await navegador.close();
}
process.exit(falhou ? 1 : 0);
