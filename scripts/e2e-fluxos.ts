// Bateria ponta a ponta (Etapa 9) no Edge, sem tocar no seu progresso real:
//  A) modo demo (progresso no localStorage do navegador de teste): responder, revisão, simulado
//     completo, contestar com e sem "Desfazer";
//  B) modo servidor com a API simulada no próprio teste: offline/online (fila de respostas) e redação.
// O login tem bateria própria: scripts/e2e-login.ts.
// uso: npx tsx scripts/e2e-fluxos.ts   (com os servidores "bb-demo" :5180 e "bb-web" :5182 de pé)
import assert from "node:assert/strict";
import { chromium, type Page } from "playwright-core";
import { calcularPainel } from "../shared/motor.js";
import type { CorrecaoDTO, QuestaoDTO, RedacaoDTO, TopicoDTO } from "../shared/tipos.js";

const DEMO = process.env.E2E_DEMO ?? "http://localhost:5180";
const WEB = process.env.E2E_WEB ?? "http://localhost:5182";

const falhas: string[] = [];
const caso = async (nome: string, fn: () => Promise<void>) => {
  const t0 = Date.now();
  try {
    await fn();
    console.log(`✔ ${nome} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  } catch (e) {
    falhas.push(nome);
    console.log(`✖ ${nome}: ${(e as Error).message.split("\n")[0]}`);
    const tela = await ultima?.locator("main").innerText().catch(() => "");
    if (tela) console.log(`   tela: ${tela.replace(/\s+/g, " ").slice(0, 300)}`);
  }
};
let ultima: Page | undefined;
const navegador = await chromium.launch({ channel: "msedge", headless: true });
const novaPagina = async (url: string, prep?: (p: Page) => Promise<void>) => {
  const ctx = await navegador.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "dark", locale: "pt-BR" });
  const p = await ctx.newPage();
  p.setDefaultTimeout(30_000);
  ultima = p;
  await prep?.(p);
  await p.goto(url, { waitUntil: "domcontentloaded", timeout: 120_000 });
  return p;
};
// aula do tópico aparece antes das questões: pula
const irParaQuestao = async (p: Page) => {
  await p.waitForSelector(".enunciado, .vazio, .pratica-abas");
  const jaSei = p.locator("button", { hasText: /Já sei|Ir para as questões/ });
  if (await jaSei.count()) await jaSei.first().click();
  await p.waitForSelector(".enunciado");
};
const responder = async (p: Page, letra = "B") => {
  await p.keyboard.press(letra);
  await p.keyboard.press("2");
  await p.keyboard.press("Enter");
  await p.waitForSelector(".resultado-faixa");
};

try {
  // ---------------- A) demo ----------------
  await caso("responder: marca, confirma, corrige e anuncia o resultado", async () => {
    const p = await novaPagina(`${DEMO}/#praticar`);
    await irParaQuestao(p);
    await responder(p);
    const faixa = await p.locator(".resultado-faixa").innerText();
    assert.match(faixa, /Acertou|Não foi dessa vez/);
    assert.equal(await p.locator(".pratica-principal[aria-live]").count(), 1);
    await p.keyboard.press("n"); // atalho: próxima
    await p.waitForSelector(".resultado-faixa", { state: "detached" });
    await p.context().close();
  });

  await caso("revisão: questão vencida volta marcada como revisão", async () => {
    const p = await novaPagina(`${DEMO}/#praticar`);
    await irParaQuestao(p);
    await responder(p);
    // vence a revisão (o agendamento real é para amanhã)
    await p.evaluate(() => {
      const e = JSON.parse(localStorage.getItem("lobo-demo-v1")!);
      for (const r of Object.values(e.revisoes) as { proxima: string }[]) r.proxima = new Date(Date.now() - 60_000).toISOString();
      localStorage.setItem("lobo-demo-v1", JSON.stringify(e));
    });
    await p.goto(`${DEMO}/#painel`);
    // o cartão cujo TÍTULO é "Revisão espaçada" (o "Plano de hoje" também cita "Revisão espaçada (24 min)")
    await p.locator(".evento", { has: p.locator("strong", { hasText: /^Revisão espaçada$/ }) }).first().click();
    await irParaQuestao(p);
    await p.locator(".selo", { hasText: "Revisão espaçada" }).first().waitFor();
    await p.context().close();
  });

  await caso("simulado completo: 10 questões, entrega e resultado por bloco", async () => {
    const p = await novaPagina(`${DEMO}/#simulados`);
    // trilha única: na aba Geral o simulado pede o concurso (formato e cotas da banca dele)
    await p.locator("[data-testid=simulado-escolha-concurso] button", { hasText: "BB" }).click();
    await p.locator(".opcao", { hasText: "Relâmpago" }).click();
    await p.waitForSelector(".grade-nav");
    const total = await p.locator(".grade-nav button").count();
    for (let i = 0; i < total; i++) {
      await p.locator(".pratica-principal .alternativa, .pratica-principal [class*=alternativa] button").first().click().catch(() => undefined);
      const prox = p.locator(".pratica-principal button", { hasText: "Próxima" });
      if (await prox.count()) await prox.click();
    }
    await p.locator(".pratica-lateral button", { hasText: "Entregar simulado" }).click();
    await p.locator(".pratica-lateral button", { hasText: /^Entregar$/ }).click();
    await p.locator("h1", { hasText: "Resultado do simulado" }).waitFor();
    await p.locator("h2", { hasText: "Por bloco" }).waitFor();
    await p.context().close();
  });

  await caso("contestar: 'Desfazer' cancela; sem desfazer, sai de circulação em 5 s", async () => {
    const p = await novaPagina(`${DEMO}/#praticar`);
    await irParaQuestao(p);
    await responder(p);
    const contestadas = () => p.evaluate(() => JSON.parse(localStorage.getItem("lobo-demo-v1")!).contestadas.length as number);
    await p.locator("button", { hasText: "Contestar questão" }).click();
    await p.locator(".contestar button[type=submit]").click();
    await p.locator(".toast .desfazer").click();
    await p.waitForTimeout(5500);
    assert.equal(await contestadas(), 0);
    await p.locator("button", { hasText: "Contestar questão" }).click();
    await p.locator(".contestar button[type=submit]").click();
    await p.waitForTimeout(5800);
    assert.equal(await contestadas(), 1);
    await p.context().close();
  });

  // ---------------- B) servidor simulado ----------------
  const topicos: TopicoDTO[] = [{ id: "t1", disciplina: "informatica", assunto: "Segurança da informação", subtopicos: [], peso: 5 }];
  const questao: QuestaoDTO = {
    id: "q1", topicoId: "t1", disciplina: "informatica", assunto: "Segurança da informação", origem: "gerada", dificuldade: 3,
    enunciado: "Qual prática reduz o risco de phishing?", alternativas: ["A", "B", "C", "D", "E"].map((l) => ({ letra: l as "A", texto: `Alternativa ${l}` })),
  };
  const correcao: CorrecaoDTO = {
    acertou: true, gabarito: "B", explicacaoGeral: "Explicação.", fontes: [], traicoeira: false, xpGanho: 12, proximaRevisaoDias: 1,
    alternativas: questao.alternativas.map((a) => ({ ...a, correta: a.letra === "B", explicacao: "Porque sim." })),
  };
  const painel = calcularPainel({ topicos, tentativas: [], revisoes: [] });
  let recebidas = 0;
  let semRede = false;
  const servidorFalso = async (p: Page) => {
    // só /api/... (o padrão "**/api/**" pegaria também os módulos do Vite em /src/api/)
    await p.route((u) => u.pathname.startsWith("/api/"), (r) => {
      // rota simulada não passa pela emulação offline: sem rede, falha como fetch sem internet
      if (semRede) return r.abort("internetdisconnected");
      const u = new URL(r.request().url());
      const j = (json: unknown) => r.fulfill({ json });
      switch (u.pathname) {
        case "/api/saude": return j({ ok: true });
        case "/api/auth/eu": return j({ login: false, usuario: null });
        case "/api/painel": return j(painel);
        case "/api/topicos": return j(topicos);
        case "/api/proxima": return j({ questao, modo: "treino" });
        case "/api/aula/t1": return j(null);
        case "/api/responder": recebidas++; return j(correcao);
        case "/api/redacao/temas": return j([{ id: "tema1", tema: "Fraudes digitais", proposta: "Discuta…", textosMotivadores: ["Texto 1"] }]);
        case "/api/redacoes": return j([]);
        case "/api/redacoes/corrigir": {
          const corpo = r.request().postDataJSON() as { texto: string; linhas: number };
          const dto: RedacaoDTO = { id: "r1", temaId: "tema1", tema: "Fraudes digitais", proposta: "Discuta…", texto: corpo.texto, linhas: corpo.linhas, tempoSeg: 60, status: "aguardando", criadoEm: new Date().toISOString() };
          return j(dto);
        }
        default: return j({});
      }
    });
  };

  await caso("offline: resposta vai para a fila e é enviada sozinha quando a rede volta", async () => {
    const p = await novaPagina(`${WEB}/#praticar`, servidorFalso);
    await p.waitForSelector(".enunciado");
    semRede = true;
    await p.context().setOffline(true);
    await p.locator(".faixa-offline").waitFor();
    await p.keyboard.press("B");
    await p.keyboard.press("2");
    await p.keyboard.press("Enter");
    await p.locator(".toast", { hasText: "resposta guardada" }).waitFor();
    assert.equal(await p.evaluate(() => JSON.parse(localStorage.getItem("lobo-fila-offline") ?? "[]").length), 1);
    const antes = recebidas;
    semRede = false;
    await p.context().setOffline(false);
    await p.waitForFunction(() => JSON.parse(localStorage.getItem("lobo-fila-offline") ?? "[]").length === 0, null, { timeout: 15_000 });
    assert.equal(recebidas, antes + 1);
    await p.locator(".faixa-offline").waitFor({ state: "detached" });
    await p.context().close();
  });

  await caso("redação: escreve, confirma ao sair, envia para correção", async () => {
    const p = await novaPagina(`${WEB}/#redacao`, servidorFalso);
    await p.locator("textarea.redacao-area").waitFor();
    // ~26 linhas da folha (5 parágrafos de ~5 linhas): dentro do limite de 25 a 30
    const paragrafo = "A segurança digital depende de educação do cliente, de tecnologia de autenticação e de resposta rápida das instituições. ".repeat(3);
    await p.locator("textarea.redacao-area").fill(Array.from({ length: 5 }, () => paragrafo.trim()).join("\n\n"));
    // sair no meio pede confirmação: recusa e continua na tela
    p.once("dialog", (d) => void d.dismiss());
    await p.locator(".nav button", { hasText: "Painel" }).click();
    assert.match(p.url(), /#redacao/);
    await p.locator("button", { hasText: "Enviar para correção" }).click();
    await p.locator(".toast", { hasText: "fila de correção" }).waitFor();
    await p.context().close();
  });
} finally {
  await navegador.close();
}

console.log(falhas.length ? `\n${falhas.length} falha(s): ${falhas.join(" · ")}` : "\nTodos os fluxos passaram.");
process.exit(falhas.length ? 1 : 0);
