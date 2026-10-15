// ============================================================
// BB Estudos — Variedade decidida pelo CÓDIGO, não pela IA
// Antes de gerar, sorteia o tipo da questão e o contexto (data/variacoes.json).
// Em cálculo, pelo menos 40% das questões são de duas etapas (dificuldade 3+).
// ============================================================
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Question } from "./models.js";
import { ehDisciplinaDeCalculo } from "./verificacao.js";
import type { Types } from "mongoose";

type Config = { contextos: string[]; tipos: Record<string, string[]> };
let config: Config | undefined;
function carregar(): Config {
  config ??= JSON.parse(
    readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "data", "variacoes.json"), "utf8")
  ) as Config;
  return config;
}

export const META_DUAS_ETAPAS = 0.4;
const sortear = <T>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)];

export type Variacao = { tipo: string; contexto: string; duasEtapas: boolean };

// Sorteia tipo e contexto. Em cálculo, força duas etapas sempre que as aprovadas
// do tópico estiverem abaixo de 40%; fora isso, duas etapas com chance de 40%.
export async function sortearVariacao(topic: {
  _id: Types.ObjectId;
  disciplina: string;
  assunto: string;
  subtopicos: string[];
}): Promise<Variacao> {
  const { contextos, tipos } = carregar();
  const lista = tipos[topic.assunto]?.length ? tipos[topic.assunto] : topic.subtopicos;
  const tipo = lista.length ? sortear(lista) : topic.assunto;
  const contexto = sortear(contextos);

  let duasEtapas = false;
  if (ehDisciplinaDeCalculo(topic.disciplina)) {
    const [total, comDuas] = await Promise.all([
      Question.countDocuments({ topicId: topic._id, origem: "gerada", status: "aprovada" }),
      Question.countDocuments({ topicId: topic._id, origem: "gerada", status: "aprovada", "variacao.duasEtapas": true }),
    ]);
    duasEtapas = comDuas < META_DUAS_ETAPAS * (total + 1) || Math.random() < META_DUAS_ETAPAS;
  }
  return { tipo, contexto, duasEtapas };
}
