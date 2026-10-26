// Teste de fumaça (fechamento v1.0) contra a URL publicada: /api/saude pelo rewrite → login (se o site pedir)
// → Painel de verdade (não o demo) → responde UMA questão com X-Smoke → desfaz só essa tentativa. Prints 360/1440.
// uso: SMOKE_URL=https://<site> [SMOKE_EMAIL=... SMOKE_SENHA=...] npm run smoke
//   (a senha vem do ambiente de quem roda; nunca fica no código nem no log)
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium, type Page } from "playwright-core";

const URL_SITE = (process.env.SMOKE_URL ?? "").replace(/\/$/, "");
if (!URL_SITE) {
  console.error("Defina SMOKE_URL (ex.: https://lobo-binho.vercel.app)");
  process.exit(2);
}
const PASTA = process.env.SMOKE_PRINTS ?? "docs/telas/smoke";
mkdirSync(PASTA, { recursive: true });
const t0 = Date.now();
const passo = (s: string) => console.log(`✔ ${s} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);

async function entrarSePreciso(p: Page) {
  const eu = (await (await p.request.get(`${URL_SITE}/api/auth/eu`)).json()) as { login: boolean; usuario: unknown };
  if (!eu.login || eu.usuario) return passo("login: não precisa (modo dono único ou já dentro)");
  const email = process.env.SMOKE_EMAIL;
  const senha = process.env.SMOKE_SENHA;
  if (!email || !senha) throw new Error("o site pede login: defina SMOKE_EMAIL e SMOKE_SENHA");
  const r = await p.request.post(`${URL_SITE}/api/auth/entrar`, { data: { email, senha, lembrar: false } });
  assert.equal(r.status(), 200, "login recusado");
  passo("login");
}

const navegador = await chromium.launch({ channel: "msedge", headless: true });
let falhou = false;
try {
  const ctx = await navegador.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "dark", locale: "pt-BR" });
  const p = await ctx.newPage();
  p.setDefaultTimeout(60_000);
  // 1) saúde pelo rewrite (Render pode estar dormindo: até ~1 min)
  const saude = (await (await p.request.get(`${URL_SITE}/api/saude`, { timeout: 90_000 })).json()) as { ok: boolean; versao?: string; ultimoNoturnoOk?: string | null };
  assert.equal(saude.ok, true, "/api/saude não respondeu ok");
  passo(`/api/saude ok (versão ${saude.versao ?? "?"}, último noturno ${saude.ultimoNoturnoOk ?? "nunca"})`);
  // 2) login (o cookie fica no domínio do site)
  await entrarSePreciso(p);
  // 3) Painel de verdade: sem o selo do modo demo
  await p.goto(`${URL_SITE}/#painel`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await p.locator("main h1, main h2").first().waitFor();
  assert.equal(await p.locator(".selo-demo").count(), 0, "caiu no modo demo (ver docs/RETOMAR.md: cookie entre domínios)");
  passo("Painel do servidor (não é o demo)");
  for (const t of [{ nome: "1440", w: 1440, h: 900 }, { nome: "360", w: 360, h: 780 }]) {
    await p.setViewportSize({ width: t.w, height: t.h });
    await p.waitForTimeout(600);
    await p.screenshot({ path: `${PASTA}/painel-${t.nome}.png`, fullPage: true });
  }
  // 4) responde uma questão marcada como fumaça e desfaz só ela
  const prox = (await (await p.request.get(`${URL_SITE}/api/proxima?misto=1`)).json()) as { questao: { id: string; alternativas: { letra: string }[] } | null };
  assert.ok(prox.questao, "não veio questão para responder");
  const resp = await p.request.post(`${URL_SITE}/api/responder`, { headers: { "X-Smoke": "1" }, data: { questaoId: prox.questao.id, resposta: prox.questao.alternativas[0].letra, confianca: 2, tempoSeg: 5, modo: "treino" } });
  assert.equal(resp.status(), 200, "responder falhou");
  passo("respondeu uma questão (marcada como fumaça)");
  const desf = (await (await p.request.post(`${URL_SITE}/api/smoke/desfazer`, { data: {} })).json()) as { desfeita: boolean };
  assert.equal(desf.desfeita, true, "não desfez a tentativa");
  passo("desfez só essa tentativa");
  assert.ok(Date.now() - t0 < 120_000, "passou de 2 min");
  console.log(`Fumaça OK em ${((Date.now() - t0) / 1000).toFixed(1)} s · prints em ${PASTA}`);
} catch (e) {
  falhou = true;
  console.error("✖", (e as Error).message);
} finally {
  await navegador.close();
}
process.exit(falhou ? 1 : 0);
