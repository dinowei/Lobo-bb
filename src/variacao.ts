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
const sortear = <T>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)];

export type Variacao = { tipo: string; contexto: string; duasEtapas: boolean };

// contextos que um tipo aceita ("todos" ou tipo fora da tabela = qualquer um)
export function contextosPermitidos(c: ConfigVariacao, assunto: string, tipo: string): string[] {
  const ctx = c.tipos[assunto]?.[tipo];
  return !ctx || ctx === "todos" ? c.contextos : ctx;
}

// Parte pura do sorteio (testável sem banco): escolhe o tipo e depois um contexto compatível
export function sortearPar(
  c: ConfigVariacao,
  topic: { assunto: string; subtopicos: string[] },
  querDuasEtapas: boolean,
  forcarTipo?: string
): Variacao {
  const tabela = c.tipos[topic.assunto];
  const deDuas = c.duasEtapas[topic.assunto] ?? [];
  let tipo: string;
  if (forcarTipo) {
    tipo = forcarTipo;
  } else if (tabela) {
    const todos = Object.keys(tabela);
    const candidatos = deDuas.length ? todos.filter((t) => deDuas.includes(t) === querDuasEtapas) : todos;
    tipo = sortear(candidatos.length ? candidatos : todos);
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
  return sortearPar(carregarVariacoes(), topic, querDuas, forcarTipo);
}
