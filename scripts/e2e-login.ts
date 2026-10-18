// Fluxo de login de ponta a ponta no Edge, sem criar conta de verdade: as rotas /api/auth/* são
// simuladas (o resto do site fala com o servidor real, no modo dono único). Tira os prints.
// uso: npx tsx scripts/e2e-login.ts   (com "npm run dev" rodando)
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium, type Page } from "playwright-core";

const URL_BASE = process.env.PRINTS_URL ?? "http://localhost:5173";
const PASTA = "docs/telas/login";
mkdirSync(PASTA, { recursive: true });

async function simular(pagina: Page) {
  let logado = false;
  await pagina.route("**/api/auth/eu", (r) => r.fulfill({ json: { login: true, usuario: logado ? { nome: "Teste", email: "teste@exemplo.com", papel: "aluno" } : null } }));
  await pagina.route("**/api/auth/convite/*", (r) => {
    const ok = r.request().url().endsWith("ABCD-EFGH");
    r.fulfill({ json: ok ? { valido: true } : { valido: false, motivo: "Esse código não existe. Confira com quem te convidou." } });
  });
  await pagina.route("**/api/auth/entrar", async (r) => {
    const corpo = r.request().postDataJSON() as { senha: string };
    if (corpo.senha !== "Girassol-Azul") return r.fulfill({ status: 401, json: { erro: "E-mail ou senha não conferem.", campo: "senha" } });
    logado = true;
    r.fulfill({ json: { nome: "Teste", email: "teste@exemplo.com", papel: "aluno" } });
  });
}

const navegador = await chromium.launch({ channel: "msedge", headless: true });
const falhas: string[] = [];
const caso = async (nome: string, fn: () => Promise<void>) => {
  try {
    await fn();
    console.log(`✔ ${nome}`);
  } catch (e) {
    falhas.push(nome);
    console.log(`✖ ${nome}: ${(e as Error).message.split("\n")[0]}`);
  }
};

try {
  for (const t of [{ nome: "desktop", width: 1440, height: 900, mobile: false }, { nome: "celular", width: 390, height: 844, mobile: true }]) {
    const ctx = await navegador.newContext({ viewport: { width: t.width, height: t.height }, deviceScaleFactor: t.mobile ? 2 : 1, isMobile: t.mobile, hasTouch: t.mobile, colorScheme: "dark", locale: "pt-BR" });
    const p = await ctx.newPage();
    await simular(p);
    p.setDefaultTimeout(60_000); // servidor de desenvolvimento ocupado demora a compilar
    await p.goto(`${URL_BASE}/#revisoes`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await p.waitForSelector(".tela-entrar");
    await p.waitForTimeout(500);
    await p.screenshot({ path: `${PASTA}/entrar-${t.nome}.png`, fullPage: true });
    if (t.mobile) {
      await ctx.close();
      continue;
    }

    await caso("abre com o foco no e-mail", async () => assert.equal(await p.evaluate(() => document.activeElement?.id), "campo-email"));
    await caso("enviar vazio: erro no e-mail e foco nele", async () => {
      await p.click("button[type=submit]");
      assert.match(await p.locator("#campo-email-msg").innerText(), /Digite seu e-mail/);
      assert.equal(await p.getAttribute("#campo-email", "aria-invalid"), "true");
    });
    await caso("mostrar/ocultar senha", async () => {
      await p.fill("#campo-senha", "abc");
      await p.click("button.ver-senha");
      assert.equal(await p.getAttribute("#campo-senha", "type"), "text");
      await p.click("button.ver-senha");
      assert.equal(await p.getAttribute("#campo-senha", "type"), "password");
    });
    await caso("senha errada: mensagem no campo da senha", async () => {
      await p.fill("#campo-email", "teste@exemplo.com");
      await p.fill("#campo-senha", "errada123");
      await p.press("#campo-senha", "Enter"); // Enter envia
      await p.waitForSelector("#campo-senha-msg");
      assert.match(await p.locator("#campo-senha-msg").innerText(), /não conferem/);
    });
    await caso("criar conta: força da senha e convite conferido enquanto digita", async () => {
      await p.click("text=Criar conta");
      await p.fill("#campo-nome", "Teste");
      await p.fill("#campo-senha", "12345678");
      assert.match(await p.locator(".forca").innerText(), /Fraca/);
      await p.fill("#campo-senha", "Girassol Azul de Março 9");
      assert.match(await p.locator(".forca").innerText(), /Forte/);
      await p.fill("#campo-convite", "zzzz-zzzz");
      await p.waitForSelector("text=não existe");
      await p.fill("#campo-convite", "abcd-efgh");
      await p.waitForSelector("text=Convite válido");
      await p.screenshot({ path: "docs/telas/login/cadastro-desktop.png", fullPage: true });
    });
    await caso("entrar certo: abre o app na tela pedida", async () => {
      await p.click("text=Entrar >> nth=0");
      await p.fill("#campo-email", "teste@exemplo.com");
      await p.fill("#campo-senha", "Girassol-Azul");
      await p.click("button[type=submit]");
      await p.waitForSelector(".app");
      assert.ok(p.url().includes("#revisoes"));
      assert.equal(await p.locator(".nav button", { hasText: "Admin" }).count(), 0, "aluno não vê Admin");
    });
    await caso("sessão que acaba no meio: volta ao login e, depois, à mesma tela", async () => {
      await p.evaluate(() => window.dispatchEvent(new Event("lobo:sessao-expirada")));
      await p.waitForSelector(".tela-entrar");
      await p.fill("#campo-email", "teste@exemplo.com");
      await p.fill("#campo-senha", "Girassol-Azul");
      await p.click("button[type=submit]");
      await p.waitForSelector(".app");
      assert.ok(p.url().includes("#revisoes"));
    });
    await ctx.close();
  }
} finally {
  await navegador.close();
}
console.log(falhas.length ? `\n${falhas.length} falha(s)` : "\nTudo certo");
process.exit(falhas.length ? 1 : 0);
