// Concursos e bancas como DADO (data/concursos/*.json e data/bancas/*.json): servidor E modo demo.
// O BB é o padrão de hoje e a estrutura dele é a mesma de antes (estruturaProva.ts lê o bb.json).
import bb from "../data/concursos/bb.json" with { type: "json" };
import bacen from "../data/concursos/bacen.json" with { type: "json" };
import tjsp from "../data/concursos/tjsp.json" with { type: "json" };
import cvm from "../data/concursos/cvm.json" with { type: "json" };
import cesgranrio from "../data/bancas/cesgranrio.json" with { type: "json" };
import cebraspe from "../data/bancas/cebraspe.json" with { type: "json" };
import fgv from "../data/bancas/fgv.json" with { type: "json" };
import fcc from "../data/bancas/fcc.json" with { type: "json" };
import vunesp from "../data/bancas/vunesp.json" with { type: "json" };

// lista única dos concursos (abas, schemas, cabeçalho X-Concurso): concurso novo = uma linha aqui + o json dele
export const IDS_CONCURSO = ["bb", "tjsp", "bacen", "cvm"] as const;
export type IdConcurso = (typeof IDS_CONCURSO)[number];
export type IdBanca = "cesgranrio" | "cebraspe" | "fgv" | "fcc" | "vunesp";
export type FormatoItem = "multipla" | "certo_errado";
// camada do material: A = prova oficial/gabarito definitivo/edital/lei vigente; B = material oficial; C = cursinho
export type Camada = "A" | "B" | "C";

export interface Banca {
  id: IdBanca;
  nome: string;
  formato: FormatoItem;
  nAlternativas: number;
  nota: { acerto: number; erro: number; branco: number };
  tempoPorItemSeg: number;
  estilo: string[];
  estrategia: string[];
  fonte: string;
}

export const BANCAS: Record<IdBanca, Banca> = {
  cesgranrio: cesgranrio as Banca,
  cebraspe: cebraspe as Banca,
  fgv: fgv as Banca,
  fcc: fcc as Banca,
  vunesp: vunesp as Banca,
};

export const CONCURSOS = { bb, tjsp, bacen, cvm } as const;
// nome curto da aba
export const SIGLA_CONCURSO: Record<IdConcurso, string> = { bb: "BB", tjsp: "TJ-SP", bacen: "BACEN", cvm: "CVM" };
export const CONCURSO_PADRAO: IdConcurso = "bb";

// banca em uso num concurso: a escolhida pelo aluno; "a_definir" estuda no estilo da banca de referência
export function bancaEmUso(concurso: IdConcurso, escolhida?: string | null): IdBanca {
  if (escolhida && escolhida in BANCAS) return escolhida as IdBanca;
  const c = CONCURSOS[concurso] as { bancaPadrao: string; bancaReferencia?: string };
  const padrao = c.bancaPadrao === "a_definir" ? c.bancaReferencia : c.bancaPadrao;
  return (padrao && padrao in BANCAS ? padrao : "cesgranrio") as IdBanca;
}

// nota no critério da banca: acertos, erros e brancos (Cebraspe: um erro anula um acerto)
export function notaPelaBanca(banca: IdBanca, r: { acertos: number; erros: number; brancos: number }) {
  const n = BANCAS[banca].nota;
  return r.acertos * n.acerto + r.erros * n.erro + r.brancos * n.branco;
}
