// Trilha ÚNICA (decisão do dono, 25/10/2026): um catálogo de temas com a união de todos os concursos,
// sem duplicar tema. Ordem por código: matérias comuns primeiro (nº de concursos que cobram o tema), depois
// peso nos editais × (1 + incidência nas provas), respeitando os pré-requisitos (data/trilha-regras.json);
// empate = ordem antiga do plano do dono. Os pesos também alimentam a "Prontidão para X" (shared/prontidao.ts).
// Puro: servidor, demo e o comando que grava data/trilha.json.
import topicosBB from "../data/topicos.json" with { type: "json" };
import topicosBacen from "../data/topicos-bacen.json" with { type: "json" };
import topicosTjsp from "../data/topicos-tjsp.json" with { type: "json" };
import topicosCvm from "../data/topicos-cvm.json" with { type: "json" };
import regras from "../data/trilha-regras.json" with { type: "json" };
import { SUBTOPICOS, type Subtopico } from "./subtopicos.js";
import { CONCURSOS, IDS_CONCURSO, type IdConcurso } from "./concursos.js";
import type { Disciplina } from "./tipos.js";

type ArquivoTopicos = { disciplinas: Record<string, { assunto: string }[]> };
const DISC_DO_ASSUNTO = new Map<string, Disciplina>(
  [topicosBB, topicosBacen, topicosTjsp, topicosCvm].flatMap((a) =>
    Object.entries((a as ArquivoTopicos).disciplinas).flatMap(([d, lista]) => lista.map((t) => [t.assunto, d as Disciplina] as const))
  )
);
// matéria do tema = a do primeiro tópico dele
export const disciplinaDoTema = (s: Pick<Subtopico, "topicos">): Disciplina | null => DISC_DO_ASSUNTO.get(s.topicos[0]) ?? null;

// fração da prova de cada matéria, por concurso (edital; sem edital, a referência; TJ-SP sem cotas: igual)
export interface PesosConcurso { fracoes: Partial<Record<Disciplina, number>>; aConfirmar: boolean }
export function pesosDoEdital(c: IdConcurso): PesosConcurso {
  const j = CONCURSOS[c] as {
    conferido?: boolean; blocos?: { cotas: Record<string, number> }[];
    referenciaBasicos?: { itens?: Record<string, number>; questoes?: Record<string, number> }; disciplinas?: string[];
  };
  const cotas: Record<string, number> = j.blocos
    ? Object.assign({}, ...j.blocos.map((b) => b.cotas))
    : j.referenciaBasicos?.itens ?? j.referenciaBasicos?.questoes ?? Object.fromEntries((j.disciplinas ?? []).map((d) => [d, 1]));
  const total = Object.values(cotas).reduce((s, n) => s + n, 0) || 1;
  return { fracoes: Object.fromEntries(Object.entries(cotas).map(([d, n]) => [d, n / total])), aConfirmar: !j.conferido };
}

// peso do tema no concurso: fração da matéria ÷ temas dessa matéria no concurso. Matérias cobradas sem cota
// na referência (ex.: Informática no BACEN) dividem, juntas, metade da menor cota conhecida (marcado "a confirmar").
export function pesoDoTemaNoConcurso(tema: Subtopico, c: IdConcurso, temas: Subtopico[] = SUBTOPICOS): number {
  if (!tema.concursos.includes(c)) return 0;
  const d = disciplinaDoTema(tema);
  const { fracoes } = pesosDoEdital(c);
  const doConcurso = temas.filter((t) => t.concursos.includes(c));
  if (d && fracoes[d]) return fracoes[d]! / (doConcurso.filter((t) => disciplinaDoTema(t) === d).length || 1);
  const conhecidas = Object.values(fracoes).filter((x): x is number => !!x);
  const semCota = doConcurso.filter((t) => { const x = disciplinaDoTema(t); return !x || !fracoes[x]; }).length || 1;
  return conhecidas.length ? Math.min(...conhecidas) / 2 / semCota : 0;
}

export interface TemaOrdenado { n: number; subtopico: string; nome: string; concursos: IdConcurso[]; prioridade: number }

export function ordenarTrilha(opcoes: {
  temas?: Subtopico[];
  incidencia?: Map<string, number>; // subtópico → 0..1
  ordemAntiga?: Map<string, number>; // subtópico → n antigo (desempate)
  preRequisitos?: [string, string][];
} = {}): TemaOrdenado[] {
  const temas = opcoes.temas ?? SUBTOPICOS;
  const pre = (opcoes.preRequisitos ?? (regras.preRequisitos as [string, string][])).filter(([a, b]) => temas.some((t) => t.id === a) && temas.some((t) => t.id === b));
  const prioridade = new Map(temas.map((t) => {
    const cs = IDS_CONCURSO.filter((c) => t.concursos.includes(c));
    const pesoMedio = cs.length ? cs.reduce((s, c) => s + pesoDoTemaNoConcurso(t, c, temas), 0) / cs.length : 0;
    return [t.id, { n: cs.length, valor: pesoMedio * (1 + (opcoes.incidencia?.get(t.id) ?? 0)), concursos: cs }];
  }));
  const antes = (a: Subtopico, b: Subtopico) => {
    const pa = prioridade.get(a.id)!, pb = prioridade.get(b.id)!;
    return pb.n - pa.n || pb.valor - pa.valor || (opcoes.ordemAntiga?.get(a.id) ?? 999) - (opcoes.ordemAntiga?.get(b.id) ?? 999) || a.id.localeCompare(b.id);
  };
  // Kahn com prioridade: só entra o tema cujos pré-requisitos já entraram; entre os livres, o de maior prioridade
  const faltam = new Map(temas.map((t) => [t.id, new Set(pre.filter(([, b]) => b === t.id).map(([a]) => a))]));
  const saida: TemaOrdenado[] = [];
  const restantes = [...temas];
  while (restantes.length) {
    const livres = restantes.filter((t) => !faltam.get(t.id)!.size).sort(antes);
    const t = livres[0] ?? [...restantes].sort(antes)[0]; // ciclo nos pré-requisitos: não trava, segue a prioridade
    restantes.splice(restantes.indexOf(t), 1);
    for (const f of faltam.values()) f.delete(t.id);
    const p = prioridade.get(t.id)!;
    saida.push({ n: saida.length + 1, subtopico: t.id, nome: t.nome, concursos: p.concursos, prioridade: Math.round(p.n * p.valor * 10000) / 10000 });
  }
  return saida;
}
