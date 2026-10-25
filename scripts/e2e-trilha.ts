// E2E da F4 (trilha e praticar por tema) no Edge, com a API simulada no próprio teste (nada toca no
// progresso real): Painel → "Estudar o tema do dia" → revisões → 20 de Crase ("crase só traz crase")
// → +5 de Português → resultado com o que acontece amanhã → página do tema → Desempenho por tema.
// Prints 1440 e 360 em docs/telas/trilha/.
// uso: npx tsx scripts/e2e-trilha.ts   (com o servidor "bb-web" :5182 de pé)
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium, type Page } from "playwright-core";
import { calcularPainel } from "../shared/motor.js";
import { desempenhoPorTema } from "../shared/desempenhoTema.js";
import type { CorrecaoDTO, QuestaoDTO, TemaDTO, TopicoDTO, TrilhaDTO } from "../shared/tipos.js";

const WEB = process.env.E2E_WEB ?? "http://localhost:5182";
const PASTA = "docs/telas/trilha";
mkdirSync(PASTA, { recursive: true });

const topicos: TopicoDTO[] = [
  { id: "t-crase", disciplina: "lingua_portuguesa", assunto: "Regência verbal e nominal e crase", subtopicos: [], peso: 5 },
  { id: "t-pont", disciplina: "lingua_portuguesa", assunto: "Pontuação", subtopicos: [], peso: 5 },
];
const questao = (id: string, topicoId: string, assunto: string, enunciado: string): QuestaoDTO => ({
  id, topicoId, disciplina: "lingua_portuguesa", assunto, origem: "gerada", dificuldade: 3, enunciado,
  alternativas: ["A", "B", "C", "D", "E"].map((l) => ({ letra: l as "A", texto: `Frase ${l} da questão ${id}` })),
});

type Tipo = "revisao" | "crase" | "lp";
interface Estado { pedidos: { tipo: Tipo; url: string }[]; respondidas: { id: string; tipo: Tipo; acertou: boolean }[]; revisoes: number }

function servidorFalso(p: Page, e: Estado) {
  const tipoDe = new Map<string, Tipo>();
  let seq = 0;
  return p.route((u) => u.pathname.startsWith("/api/"), (r) => {
    const u = new URL(r.request().url());
    const j = (json: unknown) => r.fulfill({ json });
    const crase = e.respondidas.filter((x) => x.tipo === "crase");
    switch (u.pathname) {
      case "/api/saude": return j({ ok: true });
      case "/api/auth/eu": return j({ login: false, usuario: null });
      case "/api/painel": return j(calcularPainel({ topicos, tentativas: [], revisoes: [] }));
      case "/api/topicos": return j(topicos);
      case "/api/trilha": {
        const t: TrilhaDTO = {
          rodada: 1, modo: "tema", concluidos: 21, total: 51, filaRetomada: [], revisoesVencidas: e.revisoes,
          hoje: { n: 22, subtopico: "crase", nome: "Crase", disciplina: "lingua_portuguesa", estado: "novo", refazer: false, diaNoTema: 1, aprovadas: 24,
            novasFeitasHoje: crase.length, acertosHoje: crase.filter((x) => x.acertou).length, tamanho: 20, mistas: 5 },
          temas: [{ n: 22, subtopico: "crase", nome: "Crase", estado: "novo", acerto: null, aprovadas: 24 }],
        };
        return j(t);
      }
      case "/api/proxima": {
        const q = u.searchParams;
        let tipo: Tipo;
        if (q.get("revisao") === "1") {
          if (e.revisoes <= 0) return j({ questao: null, modo: "revisao", aviso: "Nenhuma revisão vencida agora." });
          tipo = "revisao";
        } else if (q.get("subtopico")) {
          assert.equal(q.get("subtopico"), "crase", "o tema pedido é crase");
          tipo = "crase";
        } else {
          assert.equal(q.get("disciplina"), "lingua_portuguesa", "as mistas são da matéria do tema");
          tipo = "lp";
        }
        e.pedidos.push({ tipo, url: u.search });
        const id = `q${String(++seq).padStart(3, "0")}`;
        tipoDe.set(id, tipo);
        const dto = tipo === "lp" ? questao(id, "t-pont", "Pontuação", "Assinale a frase com a pontuação correta.")
          : questao(id, "t-crase", "Regência verbal e nominal e crase", tipo === "revisao" ? "Revisão: em qual frase o acento grave está correto?" : "Em qual frase o acento indicativo de crase está empregado corretamente?");
        return j({ questao: dto, modo: tipo === "revisao" ? "revisao" : "treino" });
      }
      case "/api/responder": {
        const corpo = r.request().postDataJSON() as { questaoId: string; resposta: string };
        const tipo = tipoDe.get(corpo.questaoId)!;
        if (tipo === "revisao") e.revisoes--;
        // 16 de 20 de crase certas (80%: concluído)
        const acertou = tipo !== "crase" || crase.length % 5 !== 4;
        e.respondidas.push({ id: corpo.questaoId, tipo, acertou });
        const c: CorrecaoDTO = {
          acertou, gabarito: acertou ? (corpo.resposta as "B") : "C", explicacaoGeral: "Explicação.", fontes: [], traicoeira: false, xpGanho: 10, proximaRevisaoDias: 1,
          alternativas: ["A", "B", "C", "D", "E"].map((l) => ({ letra: l as "A", texto: `Frase ${l}`, correta: l === (acertou ? corpo.resposta : "C"), explicacao: "Porque sim." })),
        };
        return j(c);
      }
      case "/api/tema/crase": {
        const t: TemaDTO = {
          subtopico: "crase", nome: "Crase", n: 22, disciplina: "lingua_portuguesa", topicoIds: ["t-crase"], concursos: ["bb", "bacen"], aprovadas: 24, poucas: false,
          estudo: {
            tempoMin: 45, objetivo: "Saber quando o a leva acento grave: preposição + artigo, e os casos proibidos.",
            pontos: ["Crase = preposição a + artigo a.", "Troque por masculino: se virar ao, tem crase.", "Nunca antes de verbo nem de palavra masculina."],
            lei: null, ficha: { texto: "Crase é a fusão de duas vogais idênticas.", citacao: "trecho conferido do material", fonte: "Material de teste, p. 1" },
            materiais: [{ arquivo: "teste.pdf", paginas: "10–14", pagina: 10, camada: "C", titulo: "Português: crase", disponivel: true }],
            youtube: "https://www.youtube.com/results?search_query=Crase%20concurso%20BB%20aula", oficiaisNoAcervo: ["BB 2023 Q7"],
            fichaAcervo: { afirmacoes: [{ texto: "Crase é a contração de preposição ‘a’ com artigo ‘a’.", classe: "conceito", trecho: "A crase é a contração de preposição ‘a’ com artigo ‘a’.", titulo: "Estrategia - Portugues para o CNU", pagina: 54, camada: "C" }], conflitos: [], em: new Date().toISOString() },
          },
          pratica: { novas: 4, revisoes: 0, erradas: 4, oficiais: 3, geradas: 21, derivadas: 0, cursinho: 0 },
        };
        return j(t);
      }
      case "/api/temas/desempenho": {
        const ts = e.respondidas.filter((x) => x.tipo === "crase").map((x) => ({ questaoId: x.id, subtopico: "crase", acertou: x.acertou, data: new Date().toISOString(), simulado: false, origem: "gerada" as const }));
        return j(desempenhoPorTema(ts, new Map([["crase", 24], ["pontuacao", 12]]), () => "lingua_portuguesa"));
      }
      default:
        if (u.pathname.startsWith("/api/aula/")) return j(null);
        return j({});
    }
  });
}

const responder = async (p: Page) => {
  await p.waitForSelector(".enunciado, [data-testid=resultado-sessao]");
  if (await p.locator("[data-testid=resultado-sessao]").count()) return false;
  const jaSei = p.locator("button", { hasText: /Já sei|Ir para as questões/ });
  if (await jaSei.count()) await jaSei.first().click();
  await p.keyboard.press("B");
  await p.keyboard.press("2");
  await p.keyboard.press("Enter");
  await p.waitForSelector(".resultado-faixa");
  return true;
};

const navegador = await chromium.launch({ channel: "msedge", headless: true });
let falhou = false;
try {
  for (const tela of [{ nome: "desktop", w: 1440, h: 900 }, { nome: "celular", w: 360, h: 780 }]) {
    const ctx = await navegador.newContext({ viewport: { width: tela.w, height: tela.h }, colorScheme: "dark", locale: "pt-BR" });
    const p = await ctx.newPage();
    p.setDefaultTimeout(30_000);
    const e: Estado = { pedidos: [], respondidas: [], revisoes: 2 };
    await servidorFalso(p, e);
    await p.goto(`${WEB}/#painel`, { waitUntil: "domcontentloaded", timeout: 120_000 });

    // Painel: o botão principal é o tema do dia
    const botao = p.locator("[data-testid=tema-do-dia]");
    await botao.waitFor();
    assert.match(await p.locator(".acao-trilha").innerText(), /Tema 22: Crase/);
    await p.screenshot({ path: `${PASTA}/painel-${tela.nome}.png`, fullPage: tela.nome === "celular" });
    await botao.click();

    // sessão: responde até o resultado
    let n = 0;
    while (await responder(p)) {
      if (n === 3) await p.screenshot({ path: `${PASTA}/sessao-${tela.nome}.png`, fullPage: tela.nome === "celular" });
      await p.keyboard.press("Enter");
      if (++n > 40) throw new Error("a sessão não terminou");
    }
    // conta o que foi RESPONDIDO (no dev o StrictMode dispara a 1ª busca duas vezes)
    const ordem = e.respondidas.map((x) => x.tipo);
    const lp = ordem.indexOf("lp");
    assert.deepEqual(ordem.slice(0, 2), ["revisao", "revisao"], "revisões vencidas primeiro");
    assert.equal(ordem.filter((t) => t === "crase").length, 20, "20 de crase");
    assert.equal(ordem.filter((t) => t === "lp").length, 5, "+5 de Português");
    assert.ok(ordem.slice(2, lp).every((t) => t === "crase"), `crase só traz crase, antes das mistas: ${ordem.join(",")}`);
    assert.ok(e.pedidos.filter((x) => x.tipo === "crase").every((x) => /subtopico=crase/.test(x.url)));
    const res = await p.locator("[data-testid=resultado-sessao]").innerText();
    assert.match(res, /Crase \(novas\)\s*16\/20/);
    assert.match(await p.locator("[data-testid=amanha]").innerText(), /Crase concluído! Amanhã: tema 23, Taxas\./);
    await p.screenshot({ path: `${PASTA}/resultado-${tela.nome}.png`, fullPage: true });

    // página do tema
    await p.locator("[data-testid=resultado-sessao] button", { hasText: "Página do tema" }).click();
    await p.locator("[data-testid=objetivo]").waitFor();
    assert.equal(await p.locator("[data-testid=pontos] li").count(), 3);
    assert.match(await p.locator("[data-testid=youtube]").getAttribute("href") ?? "", /youtube\.com\/results\?search_query=Crase/);
    assert.match(await p.locator("a", { hasText: "Abrir material" }).getAttribute("href") ?? "", /\/api\/material\?arquivo=teste\.pdf#page=10/);
    assert.ok(await p.locator("button", { hasText: "Estudar ouvindo" }).count());
    // ficha da rede: frase + fonte (arquivo, página, camada) com o trecho literal
    assert.match(await p.locator("[data-testid=ficha-acervo]").innerText(), /contração de preposição[\s\S]*fonte: Estrategia - Portugues para o CNU, p\. 54 \(C\)/);
    await p.screenshot({ path: `${PASTA}/tema-${tela.nome}.png`, fullPage: true });

    // Desempenho por tema (aba do Painel)
    await p.evaluate(() => { location.hash = "#painel"; });
    await p.locator("button[role=tab]", { hasText: "Desempenho por tema" }).click();
    const linha = p.locator("tr", { hasText: "Crase" });
    await linha.waitFor();
    assert.match(await linha.innerText(), /80%/);
    assert.match(await linha.innerText(), /concluído/);
    await p.screenshot({ path: `${PASTA}/desempenho-${tela.nome}.png`, fullPage: true });
    console.log(`✔ ${tela.nome}: painel → tema do dia → revisões → 20 de crase → +5 de Português → resultado → página do tema → desempenho`);
    await ctx.close();
  }

  // busca "crase" → Praticar só de crase; e "Fazer deste o tema do dia" chama a API da trilha
  {
    const ctx = await navegador.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "dark", locale: "pt-BR" });
    const p = await ctx.newPage();
    p.setDefaultTimeout(30_000);
    const e: Estado = { pedidos: [], respondidas: [], revisoes: 0 };
    await servidorFalso(p, e);
    let inicio: unknown = null;
    await p.route((u) => u.pathname === "/api/trilha/inicio", (r) => { inicio = r.request().postDataJSON(); return r.fulfill({ json: { ok: true } }); });
    await p.goto(`${WEB}/#painel`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await p.locator("#busca").fill("crase");
    await p.locator("[data-testid=busca-tema-crase]").click();
    await responder(p);
    assert.equal(e.pedidos[0]?.tipo, "crase");
    assert.match(e.pedidos[0].url, /subtopico=crase/);
    await p.evaluate(() => { location.hash = "#tema?tema=pontuacao"; });
    await p.route((u) => u.pathname === "/api/tema/pontuacao", (r) => r.fulfill({ json: { subtopico: "pontuacao", nome: "Pontuação", n: 6, disciplina: "lingua_portuguesa", topicoIds: ["t-pont"], concursos: ["bb", "bacen"], aprovadas: 12, poucas: true, estudo: { tempoMin: 45, objetivo: null, pontos: [], lei: null, ficha: null, materiais: [], youtube: "https://www.youtube.com/results?search_query=x", oficiaisNoAcervo: [] }, pratica: { novas: 12, revisoes: 0, erradas: 0, oficiais: 0, geradas: 12, derivadas: 0, cursinho: 0 } } }));
    await p.reload();
    await p.locator("[data-testid=fazer-do-dia]").click();
    await p.waitForTimeout(500);
    assert.deepEqual(inicio, { subtopico: "pontuacao" });
    assert.match(await p.locator(".faixa-aviso").innerText(), /Só 12 questões aprovadas/);
    console.log("✔ busca \"crase\" → Praticar só de crase; \"Fazer deste o tema do dia\" e aviso de < 15 aprovadas");
    await ctx.close();
  }
} catch (e) {
  falhou = true;
  console.log(`✖ ${(e as Error).message.split("\n")[0]}`);
} finally {
  await navegador.close();
}
process.exit(falhou ? 1 : 0);
