// Cobertura da trilha (esteira de conteúdo, decisão do dono 26/10/2026): META DE PRONTO por tema =
// ≥ 15 questões novas aprovadas para o dono + ficha aprovada + áudio da ficha. A esteira trabalha sempre
// no tema mais próximo do dia do dono que ainda não bateu a meta; com todos prontos, só mantém.
// Funções puras: servidor (Admin → Cobertura e noturno) e testes.
import { IDS_CONCURSO } from "./concursos.js";

export const META_NOVAS = 15;

export type SituacaoCobertura = "pronto" | "faltando" | "bloqueado";
export interface TemaCobertura {
  n: number;
  subtopico: string;
  nome: string;
  concursos: string[];
  aprovadas: number;
  novas: number; // aprovadas que o dono ainda não respondeu
  ficha: boolean;
  audioFicha: boolean;
  bloqueios: string[]; // o que impede de chegar à meta sem ação do dono (ex.: sem material para a ficha)
}
export interface LinhaCobertura extends TemaCobertura { situacao: SituacaoCobertura; faltas: string[] }

export function situacaoTema(t: TemaCobertura): { situacao: SituacaoCobertura; faltas: string[] } {
  const faltas = [
    ...(t.novas < META_NOVAS ? [`${META_NOVAS - t.novas} questões novas`] : []),
    ...(!t.ficha ? ["ficha"] : []),
    ...(!t.audioFicha ? ["áudio da ficha"] : []),
  ];
  if (!faltas.length) return { situacao: "pronto", faltas };
  return { situacao: t.bloqueios.length ? "bloqueado" : "faltando", faltas };
}

export function linhasCobertura(temas: TemaCobertura[]): LinhaCobertura[] {
  return [...temas].sort((a, b) => a.n - b.n).map((t) => ({ ...t, ...situacaoTema(t) }));
}

export type ResumoCobertura = { concurso: string; total: number; prontos: number; faltando: number; bloqueados: number };
export function coberturaPorConcurso(linhas: LinhaCobertura[]): ResumoCobertura[] {
  const resumo = (concurso: string, ls: LinhaCobertura[]): ResumoCobertura => ({
    concurso, total: ls.length,
    prontos: ls.filter((l) => l.situacao === "pronto").length,
    faltando: ls.filter((l) => l.situacao === "faltando").length,
    bloqueados: ls.filter((l) => l.situacao === "bloqueado").length,
  });
  return [resumo("geral", linhas), ...IDS_CONCURSO.map((c) => resumo(c, linhas.filter((l) => l.concursos.includes(c))))];
}

// o tema em que a esteira trabalha: do tema do dia em diante, o primeiro que ainda falta (não bloqueado);
// se depois dele estão todos prontos, volta ao começo da trilha. null = todos prontos ou bloqueados (só manter).
export function proximoTemaDaEsteira(linhas: LinhaCobertura[], nHoje: number | null): LinhaCobertura | null {
  const faltando = linhas.filter((l) => l.situacao === "faltando").sort((a, b) => a.n - b.n);
  if (!faltando.length) return null;
  return faltando.find((l) => l.n >= (nHoje ?? 1)) ?? faltando[0];
}
