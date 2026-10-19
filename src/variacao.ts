// ============================================================
// BB Estudos — Variedade decidida pelo CÓDIGO, não pela IA
// Antes de gerar, sorteia o tipo da questão e um contexto COMPATÍVEL com ele
// (data/variacoes.json). Em cálculo, pelo menos 40% das questões são de duas
// etapas (dificuldade 3+).
// ============================================================
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Question } from "./models.js";
import { ehDisciplinaDeCalculo } from "./verificacao.js";
import { tiposConstruidos } from "./construcao.js";
import type { Types } from "mongoose";

export type ConfigVariacao = {
  contextos: string[];
  tipos: Record<string, Record<string, string[] | "todos">>;
  duasEtapas: Record<string, string[]>;
};

let config: ConfigVariacao | undefined;
export function carregarVariacoes(): ConfigVariacao {
  if (config) return config;
  const c = JSON.parse(
    readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "data", "variacoes.json"), "utf8")
  ) as ConfigVariacao;
  // erro de digitação no JSON vira erro na hora, não um par inválido em silêncio
  for (const [assunto, tipos] of Object.entries(c.tipos))
    for (const [tipo, ctx] of Object.entries(tipos)) {
      if (ctx === "todos") continue;
      if (!ctx.length) throw new Error(`variacoes.json: "${assunto}" › "${tipo}" sem contexto permitido`);
      for (const x of ctx)
        if (!c.contextos.includes(x)) throw new Error(`variacoes.json: contexto desconhecido "${x}" em "${assunto}" › "${tipo}"`);
    }
  for (const [assunto, lista] of Object.entries(c.duasEtapas))
    for (const tipo of lista)
      if (!c.tipos[assunto]?.[tipo]) throw new Error(`variacoes.json: duasEtapas cita tipo inexistente "${assunto}" › "${tipo}"`);
  return (config = c);
}

export const META_DUAS_ETAPAS = 0.4;
export const META_VARIACAO_CONSTRUIDA = 0.8;
const sortear = <T>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)];

const ASSUNTOS_COM_META_CONSTRUCAO = new Set([
  "Juros compostos",
  "Descontos",
  "Sistemas de amortização",
  "Taxas de juros",
  "Análise combinatória",
  "Probabilidade",
]);

export type Variacao = { tipo: string; contexto: string; duasEtapas: boolean };

// contextos que um tipo aceita ("todos" ou tipo fora da tabela = qualquer um)
export function contextosPermitidos(c: ConfigVariacao, assunto: string, tipo: string): string[] {
  const ctx = c.tipos[assunto]?.[tipo];
  return !ctx || ctx === "todos" ? c.contextos : ctx;
}

// Parte pura do sorteio (testável sem banco): escolhe o tipo e depois um contexto compatível
export const ehTipoComFigura = (tipo: string) => tipo.endsWith("(com figura)");

export function sortearPar(
  c: ConfigVariacao,
  topic: { assunto: string; subtopicos: string[] },
  querDuasEtapas: boolean,
  forcarTipo?: string,
  proporcaoFigura = 0 // chance de sortear um tipo "com figura" (data/figuras-meta.json)
): Variacao {
  const tabela = c.tipos[topic.assunto];
  const deDuas = c.duasEtapas[topic.assunto] ?? [];
  let tipo: string;
  if (forcarTipo) {
    tipo = forcarTipo;
  } else if (tabela) {
    const todos = Object.keys(tabela);
    // com figura só na proporção que as provas oficiais têm (inventário de figuras)
    const comFigura = todos.filter(ehTipoComFigura);
    const querFigura = comFigura.length > 0 && Math.random() < proporcaoFigura;
    const base = comFigura.length ? todos.filter((t) => ehTipoComFigura(t) === querFigura) : todos;
    const pool = base.length ? base : todos;
    let candidatos = deDuas.length ? pool.filter((t) => deDuas.includes(t) === querDuasEtapas) : pool;
    if (!candidatos.length) candidatos = pool;
    // Nos seis tópicos matemáticos, ao menos 80% das escolhas são por construção
    // sempre que o pool elegível também tiver variantes livres. Se todos os tipos
    // atuais têm template, a proporção é 100%; tipo forçado mantém o comportamento explícito.
    if (!forcarTipo && ASSUNTOS_COM_META_CONSTRUCAO.has(topic.assunto)) {
      const construidos = tiposConstruidos(topic.assunto);
      const poolConstruido = candidatos.filter((t) => construidos.includes(t));
      const poolLivre = candidatos.filter((t) => !construidos.includes(t));
      if (poolConstruido.length && poolLivre.length)
        candidatos = Math.random() < META_VARIACAO_CONSTRUIDA ? poolConstruido : poolLivre;
      else if (poolConstruido.length) candidatos = poolConstruido;
    }
    tipo = sortear(candidatos);
  } else {
    tipo = topic.subtopicos.length ? sortear(topic.subtopicos) : topic.assunto;
  }
  const duasEtapas = deDuas.length ? deDuas.includes(tipo) : querDuasEtapas;
  return { tipo, contexto: sortear(contextosPermitidos(c, topic.assunto, tipo)), duasEtapas };
}

// Em cálculo, força duas etapas sempre que as aprovadas do tópico estiverem abaixo
// de 40%; fora isso, duas etapas com chance de 40%.
export async function sortearVariacao(
  topic: { _id: Types.ObjectId; disciplina: string; assunto: string; subtopicos: string[] },
  forcarTipo?: string
): Promise<Variacao> {
  let querDuas = false;
  if (ehDisciplinaDeCalculo(topic.disciplina)) {
    const [total, comDuas] = await Promise.all([
      Question.countDocuments({ topicId: topic._id, origem: "gerada", status: "aprovada" }),
      Question.countDocuments({ topicId: topic._id, origem: "gerada", status: "aprovada", "variacao.duasEtapas": true }),
    ]);
    querDuas = comDuas < META_DUAS_ETAPAS * (total + 1) || Math.random() < META_DUAS_ETAPAS;
  }
  return sortearPar(carregarVariacoes(), topic, querDuas, forcarTipo, carregarMetaFiguras()[topic.disciplina]?.proporcao ?? 0);
}

// Proporção de figuras por disciplina, vinda do inventário das provas oficiais
type MetaFiguras = Record<string, { proporcao: number; tipos: string[] }>;
let metaFiguras: MetaFiguras | undefined;
export function carregarMetaFiguras(): MetaFiguras {
  if (metaFiguras) return metaFiguras;
  const bruto = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "data", "figuras-meta.json"), "utf8")) as Record<string, unknown>;
  return (metaFiguras = Object.fromEntries(Object.entries(bruto).filter(([k]) => !k.startsWith("_"))) as MetaFiguras);
}
