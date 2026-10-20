// F6: menu da conta, Admin → Convites e Contas, de ponta a ponta no Edge, com prints em 360 e 1440 px.
// O app de verdade (src/server.ts + web/dist) num MongoDB EM MEMÓRIA; produção só é LIDA para semear tópicos
// e questões. Contas de teste (nenhuma conta real). Antes: npm --prefix web run build
// uso: npx tsx scripts/e2e-conta.ts
import "../src/env.js";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import type { AddressInfo } from "node:net";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { chromium, type Page } from "playwright-core";

const PASTA = "docs/telas/conta";
const SENHA = "Girassol-Azul-de-Marco-9";
mkdirSync(PASTA, { recursive: true });

const memoria = await MongoMemoryServer.create();
await mongoose.connect(memoria.getUri(), { dbName: "bb-estudos-e2e" });
const leitura = await mongoose.createConnection(process.env.MONGODB_URI!).asPromise();
const M = await import("../src/models.js");
const { hashSenha } = await import("../src/auth.js");
let falhou = false;
try {
  // semente (só leitura de produção): tópicos e algumas questões aprovadas, para o painel ter conteúdo
  const prod = leitura.db!;
  await M.Topic.collection.insertMany(await prod.collection(M.Topic.collection.collectionName).find({ ativo: true }).toArray());
  await M.Question.collection.insertMany(await prod.collection(M.Question.collection.collectionName).find({ status: "aprovada" }).limit(60).toArray());
  await M.User.create({ nome: "Dono Teste", email: "dono@teste.local", senhaHash: await hashSenha(SENHA), papel: "admin" });
  await M.User.create({ nome: "Bia Teste", email: "bia@teste.local", senhaHash: await hashSenha(SENHA), papel: "aluno", ultimoLogin: new Date() });

  const { app } = await import("../src/server.js");
  const srv = app.listen(0);
  await new Promise((ok) => srv.once("listening", ok));
  const base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
  const navegador = await chromium.launch({ channel: "msedge", headless: true });
  const entrar = async (p: Page, email: string) => {
    await p.goto(`${base}/#painel`, { waitUntil: "domcontentloaded" });
    await p.fill("#campo-email", email);
    await p.fill("#campo-senha", SENHA);
    await p.press("#campo-senha", "Enter");
    await p.waitForSelector(".avatar", { timeout: 60_000 });
  };
  let codigo = "";
  try {
    for (const t of [{ nome: "desktop", width: 1440, height: 900 }, { nome: "celular", width: 360, height: 780 }]) {
      const ctx = await navegador.newContext({ viewport: { width: t.width, height: t.height }, deviceScaleFactor: t.width < 768 ? 2 : 1, colorScheme: "dark", locale: "pt-BR" });
      const p = await ctx.newPage();
      await entrar(p, "dono@teste.local");
      // menu pelo teclado: abre, foco no 1º item, Esc fecha e devolve o foco
      await p.focus(".avatar");
      await p.keyboard.press("Enter");
      await p.waitForSelector('[role="menu"]');
      assert.match(await p.locator(".menu-conta-email").innerText(), /dono@teste\.local/);
      assert.equal(await p.locator('[role="menuitem"]').count(), 3, "Minha conta, Convidar amigo, Sair");
      await p.screenshot({ path: `${PASTA}/menu-${t.nome}.png` });
      await p.keyboard.press("Escape");
      assert.equal(await p.locator('[role="menu"]').count(), 0, "Esc fecha");
      // Convidar amigo → Admin → Convites → Gerar convite (7 dias)
      await p.click(".avatar");
      await p.click('[role="menuitem"]:has-text("Convidar amigo")');
      await p.waitForSelector('button:has-text("Gerar convite (7 dias)")', { timeout: 60_000 });
      await p.click('button:has-text("Gerar convite (7 dias)")');
      const link = await p.locator("#link-convite").inputValue();
      assert.match(link, /\/\?convite=[A-Z0-9]{4}-[A-Z0-9]{4}$/);
      if (!codigo) codigo = link.split("convite=")[1];
      await p.screenshot({ path: `${PASTA}/convites-${t.nome}.png`, fullPage: true });
      // Contas
      await p.click('[role="tab"]:has-text("Contas")');
      await p.waitForSelector("text=bia@teste.local");
      await p.screenshot({ path: `${PASTA}/contas-${t.nome}.png`, fullPage: true });
      await ctx.close();
    }
    // o convite gerado pela tela é aceito no cadastro (link do convite abre direto em "Criar conta")
    const ctx = await navegador.newContext({ viewport: { width: 360, height: 780 }, colorScheme: "dark", locale: "pt-BR" });
    const p = await ctx.newPage();
    await p.goto(`${base}/?convite=${codigo}`, { waitUntil: "domcontentloaded" });
    await p.fill("#campo-nome", "Caio Teste");
    await p.fill("#campo-email", "caio@teste.local");
    await p.fill("#campo-senha", SENHA);
    assert.equal(await p.locator("#campo-convite").inputValue(), codigo);
    await p.click("button[type=submit]");
    await p.waitForSelector(".avatar", { timeout: 60_000 });
    await p.click(".avatar");
    assert.match(await p.locator(".menu-conta-email").innerText(), /caio@teste\.local/);
    assert.equal(await p.locator('[role="menuitem"]:has-text("Convidar amigo")').count(), 0, "aluno não vê Convidar amigo");
    await ctx.close();
    console.log(`✔ e2e da conta: menu (teclado e Esc), convite pela tela aceito no cadastro, Contas; prints em ${PASTA}/`);
  } finally {
    await navegador.close();
    srv.close();
  }
} catch (e) {
  falhou = true;
  console.error("✖", e);
} finally {
  await mongoose.disconnect();
  await leitura.close();
  await memoria.stop();
}
process.exit(falhou ? 1 : 0);
