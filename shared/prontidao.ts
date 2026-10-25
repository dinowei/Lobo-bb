// "Prontidão para X" (decisão do dono, 25/10/2026): o domínio é UM número por tema (global); a aba do
// concurso é uma lente: média do domínio dos temas que X cobra, pesada pelo peso de cada tema no edital
// de X (shared/trilhaUnica.ts). Concurso sem edital usa os pesos de referência, marcados "a confirmar".
// Puro: servidor e demo.
import { IDS_CONCURSO, CONCURSOS, SIGLA_CONCURSO, type IdConcurso } from "./concursos.js";
import { SUBTOPICOS, type Subtopico } from "./subtopicos.js";
import { disciplinaDoTema, pesoDoTemaNoConcurso, pesosDoEdital } from "./trilhaUnica.js";
import type { Disciplina } from "./tipos.js";

export interface TemaFraco { subtopico: string; nome: string; dominio: number; peso: number }
export interface ProntidaoDTO {
  concurso: IdConcurso;
  sigla: string;
  nome: string; // "Banco do Brasil · Escriturário — Agente Comercial"
  prontidao: number; // 0..1
  aConfirmar: boolean; // pesos de referência (edital pendente)
  temas: number;
  comDominio: number; // temas com alguma resposta
  fracos: TemaFraco[]; // os de maior peso × falta de domínio
  materias: { disciplina: Disciplina; dominio: number }[];
}

export function prontidaoDo(c: IdConcurso, dominio: Map<string, number>, temas: Subtopico[] = SUBTOPICOS): ProntidaoDTO {
  const doConcurso = temas.filter((t) => t.concursos.includes(c));
  const pesos = new Map(doConcurso.map((t) => [t.id, pesoDoTemaNoConcurso(t, c, temas)]));
  const soma = [...pesos.values()].reduce((s, p) => s + p, 0) || 1;
  const prontidao = doConcurso.reduce((s, t) => s + pesos.get(t.id)! * (dominio.get(t.id) ?? 0), 0) / soma;
  const porMateria = new Map<Disciplina, { p: number; d: number }>();
  for (const t of doConcurso) {
    const d = disciplinaDoTema(t);
    if (!d) continue;
    const m = porMateria.get(d) ?? { p: 0, d: 0 };
    m.p += pesos.get(t.id)!;
    m.d += pesos.get(t.id)! * (dominio.get(t.id) ?? 0);
    porMateria.set(d, m);
  }
  const j = CONCURSOS[c] as { nome: string; cargo?: string };
  return {
    concurso: c,
    sigla: SIGLA_CONCURSO[c],
    nome: `${j.nome}${j.cargo ? ` · ${j.cargo}` : ""}`,
    prontidao: Math.round(prontidao * 1000) / 1000,
    aConfirmar: pesosDoEdital(c).aConfirmar,
    temas: doConcurso.length,
    comDominio: doConcurso.filter((t) => dominio.has(t.id)).length,
    fracos: doConcurso
      .map((t) => ({ subtopico: t.id, nome: t.nome, dominio: dominio.get(t.id) ?? 0, peso: pesos.get(t.id)! / soma }))
      .sort((a, b) => b.peso * (1 - b.dominio) - a.peso * (1 - a.dominio) || a.nome.localeCompare(b.nome))
      .slice(0, 5),
    materias: [...porMateria.entries()].map(([disciplina, m]) => ({ disciplina, dominio: m.p ? Math.round((m.d / m.p) * 1000) / 1000 : 0 })),
  };
}

export const prontidaoDeTodos = (dominio: Map<string, number>, temas: Subtopico[] = SUBTOPICOS): ProntidaoDTO[] =>
  IDS_CONCURSO.map((c) => prontidaoDo(c, dominio, temas));
