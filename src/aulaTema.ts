// ============================================================
// BB Estudos — aula COMPLETA por tema, desenho de 28/10/2026 (regras 10, 12 e 14, decisão do dono)
// Uma seção por subtema. O MATERIAL vem do código, nunca da cabeça da IA:
//   - Português: banco de regras em data/aulas/<tema>.json — regra = trecho literal do acervo (conferido em
//     acervo-indice); exemplo = alternativa oficial (certo/errado pelo gabarito do banco) ou frase literal do
//     acervo; exemplo certo passa pelo LanguageTool local.
//   - Matemática: números, exemplos, contraexemplos e resultados construídos e conferidos com mathjs
//     (src/aulaMatematica.ts). Moeda sempre R$.
// A IA (corrente "tutor") só redige a explicação e o resumo em volta. Checagens por código ANTES do auditor
// reprovam na hora: moeda diferente de R$, LaTeX cru, frase/exemplo ou número fora do material, [N] inexistente.
// Depois, auditor de outra família com checklist explícito. Até 2 tentativas por seção; depois "em preparo".
// Esteira só depois do OK do dono (a prova roda de dia, à mão: `bb -- aula-tema <tema> refazer`).
// ============================================================
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Types } from "mongoose";
import { AulaTema, Question, Topic } from "./models.js";
import { chatJSONFuncao } from "./corrente.js";
import { SemModeloDisponivel, ehFalhaDeInfra, validarOuReparar } from "./llm.js";
import { CHECKLIST_SECAO_SYSTEM, ChecklistSecaoZ, REDACAO_SECAO_SYSTEM, RedacaoSecaoZ, redacaoSecaoUser } from "./prompts.js";
import { contarPalavrasMarkdown } from "./aulas.js";
import { PASTA_INDICE } from "./acervo.js";
import { checarLoteLT, garantirLT } from "./languagetool.js";
import { numerosDoTexto } from "./verificacao.js";
import { materialMatematica, subtemasComConstrucao } from "./aulaMatematica.js";
import { SUBTOPICO_POR_ID } from "../shared/subtopicos.js";
import { subtemasDoTema } from "../shared/estudoTema.js";
import { TRILHA } from "../shared/trilha.js";
import type { AulaTemaDTO } from "../shared/tipos.js";

// os 2 temas da prova (decisão do dono): Concordância e Porcentagem; esteira só depois do OK
export const PROVA_AULA_TEMA = ["concordancia", "porcentagem"] as const;
export const TENTATIVAS_POR_SECAO = 2;

type Camada = "A" | "B" | "C";
export type RegraMaterial = { indice: number; texto: string; titulo: string; camada: Camada | "conceito" };
export type MaterialSecao = {
  tipo: "portugues" | "matematica";
  regras: RegraMaterial[];
  exemplos: string[]; // certos, com a origem
  contraexemplos: string[];
  pegadinhas: string[];
  formula?: string;
  descartados: string[]; // o que o código tirou (ex.: exemplo certo que o LanguageTool apontou)
};

const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[“”"']/g, "\"").replace(/\s+/g, " ").trim().toLowerCase();

// tipo da fonte → camada: oficial (lei, norma, edital, prova) A; material próprio B; cursinho C
export const camadaDoTipo = (tipo?: string | null): Camada =>
  tipo === "material_cursinho" || tipo === "cursinho" ? "C" : tipo === "material_proprio" ? "B" : "A";

// origem mostrada ao aluno: a melhor camada das regras (A > B > C); regra construída por código = "conceito"
export function origemDaSecao(regras: { camada: string }[]): "A" | "B" | "C" | "conceito" {
  for (const c of ["A", "B", "C"] as const) if (regras.some((x) => x.camada === c)) return c;
  return "conceito";
}

// ---------- checagens por código, antes do auditor (decisão do dono, 28/10) ----------
const RE_MOEDA = /€|US\$|U\$|\bd[oó]lar(es)?\b|\beuros?\b/i;
const RE_LATEX = /\\(frac|times|cdot|text|left|right|sqrt|div|le|ge|neq|approx)\b|\\\(|\\\[|\$\$/;
const RE_ENTRE_ASPAS = /[“"]([^“”"]{12,})[”"]/g;
export function checarTextoAula(texto: string, m: MaterialSecao): string[] {
  const problemas: string[] = [];
  if (RE_MOEDA.test(texto)) problemas.push("moeda diferente de R$");
  if (RE_LATEX.test(texto)) problemas.push("LaTeX cru no texto (fórmula precisa sair em texto legível)");
  const indices = new Set(m.regras.map((r) => r.indice));
  for (const [, n] of texto.matchAll(/\[(\d+)\]/g)) if (!indices.has(Number(n))) { problemas.push(`cita a regra [${n}], que não existe no material`); break; }
  // frase de exemplo entre aspas: tem de estar no material (senão é exemplo fora do material/tema)
  const doMaterial = normalizar([...m.regras.map((r) => r.texto), ...m.exemplos, ...m.contraexemplos, ...m.pegadinhas, m.formula ?? ""].join(" \u0000 "));
  for (const [, frase] of texto.matchAll(RE_ENTRE_ASPAS)) {
    if (frase.trim().split(/\s+/).length < 3) continue;
    if (!doMaterial.includes(normalizar(frase))) { problemas.push(`frase ou exemplo fora do material: “${frase.slice(0, 80)}”`); break; }
  }
  // Matemática: todo número da explicação tem de estar no material (a IA não cria conta nem valor)
  if (m.tipo === "matematica") {
    const permitidos = new Set([0, 1, 2, 3, 4, 5, 10, 100, ...numerosDoTexto([...m.exemplos, ...m.contraexemplos, ...m.pegadinhas, m.formula ?? ""].join(" "))].map((x) => Math.round(x * 1e6)));
    const fora = numerosDoTexto(texto.replace(/\[\d+\]/g, " ").replace(/^\s*\d+[.)]\s/gm, " ")).find((x) => !permitidos.has(Math.round(x * 1e6)));
    if (fora !== undefined) problemas.push(`número fora do material: ${fora}`);
  }
  return problemas;
}

// ---------- material de Português: banco de regras + questões oficiais + LanguageTool ----------
type BancoPT = {
  subtopico: string;
  secoes: Record<string, {
    regras: { rotulo: string; texto: string; arquivo: string; pagina: number }[];
    exemplos: ({ acervo: { texto: string; arquivo: string; pagina: number }; regra: number } | { oficial: { questao: string; letra: string }; regra: number })[];
  }>;
  semMaterial?: Record<string, string>;
};
export const arquivoBancoPT = (subtopico: string) => join(process.cwd(), "data", "aulas", `${subtopico}.json`);

let paginasPorArquivo: Map<string, { camada: Camada; paginas: string[] }> | null = null;
function paginaDoAcervo(arquivo: string, pagina: number): { texto: string; camada: Camada } | null {
  if (!paginasPorArquivo) {
    paginasPorArquivo = new Map();
    if (existsSync(PASTA_INDICE))
      for (const f of readdirSync(PASTA_INDICE).filter((x) => x.endsWith(".json"))) {
        const j = JSON.parse(readFileSync(join(PASTA_INDICE, f), "utf8")) as { arquivo?: string; camada?: Camada; paginas?: string[] };
        if (j.arquivo && j.paginas) paginasPorArquivo.set(j.arquivo.split(/[\\/]/).pop()!, { camada: j.camada ?? "C", paginas: j.paginas });
      }
  }
  const a = paginasPorArquivo.get(arquivo);
  const texto = a?.paginas[pagina - 1];
  return texto ? { texto, camada: a!.camada } : null;
}
const literalNaPagina = (trecho: string, pagina: string) => normalizar(pagina).includes(normalizar(trecho));

// conferência pura do banco (sem banco de dados nem LanguageTool): cada regra e cada exemplo do acervo existe
// literalmente na página indicada. Devolve o que NÃO confere.
export function conferirBancoNoAcervo(subtopico: string): string[] {
  const banco = JSON.parse(readFileSync(arquivoBancoPT(subtopico), "utf8")) as BancoPT;
  const falhas: string[] = [];
  for (const [sub, sec] of Object.entries(banco.secoes)) {
    for (const r of sec.regras) {
      const p = paginaDoAcervo(r.arquivo, r.pagina);
      if (!p || !literalNaPagina(r.texto, p.texto)) falhas.push(`${sub}: regra "${r.rotulo}" (${r.arquivo} p. ${r.pagina})`);
    }
    for (const e of sec.exemplos) {
      if (!("acervo" in e)) continue;
      const p = paginaDoAcervo(e.acervo.arquivo, e.acervo.pagina);
      if (!p || !literalNaPagina(e.acervo.texto, p.texto)) falhas.push(`${sub}: exemplo "${e.acervo.texto.slice(0, 40)}"`);
    }
  }
  return falhas;
}

export async function materialPortugues(subtopico: string, subtema: string): Promise<MaterialSecao | { semMaterial: string }> {
  const banco = JSON.parse(readFileSync(arquivoBancoPT(subtopico), "utf8")) as BancoPT;
  const sec = banco.secoes[subtema];
  if (!sec) return { semMaterial: banco.semMaterial?.[subtema] ?? "subtema sem regra literal no banco" };
  const descartados: string[] = [];
  const regras: RegraMaterial[] = [];
  sec.regras.forEach((r) => {
    const p = paginaDoAcervo(r.arquivo, r.pagina);
    if (!p || !literalNaPagina(r.texto, p.texto)) { descartados.push(`regra "${r.rotulo}" não confere literalmente em ${r.arquivo} p. ${r.pagina}`); return; }
    regras.push({ indice: regras.length + 1, texto: r.texto, titulo: `${r.arquivo.replace(/\.pdf$/i, "")}, p. ${r.pagina}`, camada: p.camada });
  });
  if (!regras.length) return { semMaterial: "nenhuma regra confere literalmente no acervo" };
  const rotulo = (i: number) => sec.regras[i]?.rotulo ?? "a regra";
  const certos: { texto: string; origem: string }[] = [];
  const errados: { texto: string; origem: string; regra: number; prova?: string; letra?: string }[] = [];
  for (const e of sec.exemplos) {
    if ("acervo" in e) {
      const p = paginaDoAcervo(e.acervo.arquivo, e.acervo.pagina);
      if (!p || !literalNaPagina(e.acervo.texto, p.texto)) { descartados.push(`exemplo "${e.acervo.texto.slice(0, 40)}" não confere no acervo`); continue; }
      certos.push({ texto: e.acervo.texto, origem: `${e.acervo.arquivo.replace(/\.pdf$/i, "")}, p. ${e.acervo.pagina}` });
      continue;
    }
    // questão oficial: texto da alternativa e certo/errado pelo GABARITO do banco (lido por código, regra 1)
    if (!Types.ObjectId.isValid(e.oficial.questao)) continue;
    const q = await Question.findOne({ _id: new Types.ObjectId(e.oficial.questao), origem: "oficial", status: "aprovada" }).select("prova numeroOriginal gabarito alternativas.letra alternativas.texto").lean();
    const alt = q?.alternativas.find((a) => a.letra === e.oficial.letra);
    if (!q || !alt) { descartados.push(`questão oficial ${e.oficial.questao} letra ${e.oficial.letra} não encontrada`); continue; }
    const prova = `${q.prova}${q.numeroOriginal ? `, questão ${q.numeroOriginal}` : ""}`;
    if (alt.letra === q.gabarito) certos.push({ texto: alt.texto, origem: `${prova}, alternativa ${alt.letra} (gabarito)` });
    else errados.push({ texto: alt.texto, origem: `${prova}, alternativa ${alt.letra}; o gabarito é ${q.gabarito}`, regra: e.regra, prova, letra: alt.letra });
  }
  // exemplo certo tem de sair limpo no LanguageTool local (regra 13)
  if (certos.length) {
    if (!(await garantirLT())) throw new Error("LanguageTool local fora do ar");
    const lt = await checarLoteLT(certos.map((c) => c.texto));
    for (let i = certos.length - 1; i >= 0; i--) if (lt[i]?.length) { descartados.push(`exemplo certo apontado pelo LanguageTool: "${certos[i].texto.slice(0, 50)}" (${lt[i][0].regra})`); certos.splice(i, 1); }
  }
  return {
    tipo: "portugues", regras, descartados,
    exemplos: certos.map((c) => `“${c.texto}” (${c.origem})`),
    contraexemplos: errados.map((e) => `“${e.texto}” está errado (${e.origem}). Fere: ${rotulo(e.regra)}.`),
    // pegadinha verdadeira por construção: a banca usou a frase como alternativa errada
    pegadinhas: errados.slice(0, 3).map((e) => `Na prova ${e.prova}, a alternativa ${e.letra} parecia aceitável e estava errada: ${rotulo(e.regra).toLowerCase()}.`),
  };
}

function materialDaMatematica(subtema: string): MaterialSecao | null {
  const m = materialMatematica(subtema);
  if (!m) return null;
  return {
    tipo: "matematica",
    regras: [{ indice: 1, texto: m.formula, titulo: "Construção do Lobo (números conferidos com mathjs)", camada: "conceito" }],
    formula: m.formula,
    exemplos: m.exemplos.map((e) => `${e.enunciado} Passos: ${e.passos.join(" ")} Resposta: ${e.resposta}.`),
    contraexemplos: m.contraexemplos.map((c) => c.texto),
    pegadinhas: m.pegadinhas,
    descartados: [],
  };
}

// ---------- uma seção: redação da IA (até 2 tentativas) → checagens de código → auditor com checklist ----------
async function redigirSecao(tema: string, subtema: string, m: MaterialSecao) {
  const entrada = redacaoSecaoUser({ tema, subtema, regras: m.regras, exemplos: m.exemplos, contraexemplos: m.contraexemplos, pegadinhas: m.pegadinhas, formula: m.formula });
  let motivos: string[] = [];
  let ultima: { explicacao: string; resumo: string; geradaPor: string; auditadaPor?: string } | null = null;
  for (let tentativa = 1; tentativa <= TENTATIVAS_POR_SECAO; tentativa++) {
    const pedido = motivos.length ? `${entrada}\n\nA VERSÃO ANTERIOR FOI REPROVADA: ${motivos.join(" | ")}\nReescreva corrigindo isso, sem sair do material.` : entrada;
    const t = await chatJSONFuncao("tutor", REDACAO_SECAO_SYSTEM, pedido, 0.2, 2500);
    let r: ReturnType<typeof RedacaoSecaoZ.parse>;
    try {
      r = (await validarOuReparar(RedacaoSecaoZ, t.json, { client: t.client, model: t.modelo, system: REDACAO_SECAO_SYSTEM, user: pedido })) as ReturnType<typeof RedacaoSecaoZ.parse>;
    } catch (e) {
      // JSON fora do formato conta como tentativa reprovada (não derruba a seção sem a 2ª chance)
      motivos = [`formato: ${String((e as Error).message).slice(0, 160)}`];
      continue;
    }
    ultima = { explicacao: r.explicacao, resumo: r.resumo, geradaPor: t.modelo };
    motivos = checarTextoAula(`${r.explicacao}\n${r.resumo}`, m).map((p) => `código: ${p}`);
    if (motivos.length) continue; // reprova na hora, sem gastar o auditor
    const a = await chatJSONFuncao("auditor", CHECKLIST_SECAO_SYSTEM, `${entrada}\n\nEXPLICAÇÃO A CONFERIR:\n${r.explicacao}\n\nRESUMO:\n${r.resumo}`, 0, 1500, { excluirFamilias: [t.familia] });
    const c = ChecklistSecaoZ.parse(a.json);
    ultima.auditadaPor = a.modelo;
    const itens = { regraCerta: "regra errada", exemploDoTema: "exemplo fora do tema", pegadinhaVerdadeira: "pegadinha falsa", naoContradizGabarito: "contradiz o gabarito" } as const;
    const falhos = (Object.keys(itens) as (keyof typeof itens)[]).filter((k) => !c[k]).map((k) => `auditor: ${itens[k]}`);
    if (!falhos.length) return { ...ultima, aprovada: true as const, motivos: [], tentativas: tentativa };
    motivos = [...falhos, ...c.problemas.map((p) => `auditor: ${p}`)];
  }
  return { explicacao: ultima?.explicacao ?? "", resumo: ultima?.resumo ?? "", geradaPor: ultima?.geradaPor ?? "", auditadaPor: ultima?.auditadaPor, aprovada: false as const, motivos, tentativas: TENTATIVAS_POR_SECAO };
}

async function materialDaSecao(subtopico: string, subtema: string): Promise<MaterialSecao | { semMaterial: string }> {
  if (existsSync(arquivoBancoPT(subtopico))) return materialPortugues(subtopico, subtema);
  if (subtemasComConstrucao().includes(subtema)) return materialDaMatematica(subtema)!;
  return { semMaterial: "tema ainda sem material por código (banco de regras ou construção)" };
}

// gera a aula do tema. refazer = ignora as seções aprovadas antes (a prova do desenho novo começa do zero)
export async function gerarAulaTema(subtopico: string, opcoes: { refazer?: boolean } = {}): Promise<{ ok: boolean; resumo: string }> {
  const s = SUBTOPICO_POR_ID.get(subtopico);
  if (!s) throw new Error(`Tema desconhecido: ${subtopico}`);
  const topicos = await Topic.find({ assunto: { $in: s.topicos }, ativo: true }).select("_id assunto subtopicos").lean();
  const subtemas = subtemasDoTema(subtopico, topicos.map((t) => ({ assunto: t.assunto, subtopicos: t.subtopicos ?? [] })), TRILHA.map((t) => t.subtopico));
  if (!subtemas.length) return { ok: false, resumo: `${s.nome}: tema sem subtemas no edital` };
  const anterior = opcoes.refazer ? null : await AulaTema.findOne({ subtopico }).lean();
  const secoes: Record<string, unknown>[] = [];
  for (const [ordem, subtema] of subtemas.entries()) {
    const ja = anterior?.secoes.find((x) => x.subtema === subtema && x.status === "aprovada");
    if (ja) { secoes.push({ ...ja, ordem }); continue; }
    try {
      const m = await materialDaSecao(subtopico, subtema);
      if ("semMaterial" in m) { secoes.push({ ordem, subtema, status: "em_preparo", motivos: [`sem material: ${m.semMaterial}`] }); continue; }
      if (!m.exemplos.length && !m.contraexemplos.length) { secoes.push({ ordem, subtema, status: "em_preparo", motivos: ["sem exemplo conferido", ...m.descartados] }); continue; }
      const r = await redigirSecao(s.nome, subtema, m);
      secoes.push({
        ordem, subtema, status: r.aprovada ? "aprovada" : "em_preparo",
        conteudo: m.formula ? `${r.explicacao}\n\n**Fórmula:** ${m.formula}` : r.explicacao,
        exemplos: m.exemplos, contraexemplos: m.contraexemplos, pegadinhas: m.pegadinhas, resumo: r.resumo,
        fontes: m.regras.map((x) => ({ titulo: x.titulo, trecho: x.texto, camada: x.camada })),
        origem: origemDaSecao(m.regras),
        palavras: contarPalavrasMarkdown([r.explicacao, ...m.exemplos, ...m.contraexemplos, ...m.pegadinhas, r.resumo].join("\n")),
        geradaPor: r.geradaPor, auditadaPor: r.auditadaPor,
        motivos: [...r.motivos, ...m.descartados.map((d) => `descartado pelo código: ${d}`), `tentativas: ${r.tentativas}`],
      });
    } catch (e) {
      const motivo = e instanceof SemModeloDisponivel || ehFalhaDeInfra(e) ? `infraestrutura: ${String((e as Error).message).slice(0, 160)}` : `erro: ${String((e as Error).message).slice(0, 160)}`;
      secoes.push({ ordem, subtema, status: "em_preparo", motivos: [motivo] });
    }
  }
  await AulaTema.updateOne({ subtopico }, { $set: { subtopico, nome: s.nome, secoes } }, { upsert: true });
  const aprovadas = secoes.filter((x) => x.status === "aprovada").length;
  const palavras = secoes.reduce((t, x) => t + (Number(x.palavras) || 0), 0);
  const reprovadas = secoes.filter((x) => x.status !== "aprovada").map((x) => `${x.subtema}: ${((x.motivos as string[] | undefined) ?? []).join(" | ").slice(0, 300)}`);
  return { ok: aprovadas > 0, resumo: `${s.nome}: ${aprovadas}/${secoes.length} seções aprovadas, ${palavras} palavras${reprovadas.length ? `; em preparo: ${reprovadas.join(" · ")}` : ""}` };
}

export async function aulaDoTema(subtopico: string): Promise<AulaTemaDTO | null> {
  const a = await AulaTema.findOne({ subtopico }).lean();
  if (!a) return null;
  return {
    subtopico: a.subtopico, nome: a.nome ?? subtopico,
    secoes: [...a.secoes].sort((x, y) => x.ordem - y.ordem).map((x) =>
      x.status === "aprovada"
        ? { ordem: x.ordem, subtema: x.subtema, status: "aprovada" as const, conteudo: x.conteudo ?? "", exemplos: x.exemplos, contraexemplos: x.contraexemplos, pegadinhas: x.pegadinhas, resumo: x.resumo ?? "", fontes: (x.fontes ?? []).map((f) => ({ titulo: f.titulo ?? "", trecho: f.trecho ?? "", camada: f.camada ?? "" })), origem: x.origem ?? "conceito" }
        : { ordem: x.ordem, subtema: x.subtema, status: "em_preparo" as const }),
  };
}
