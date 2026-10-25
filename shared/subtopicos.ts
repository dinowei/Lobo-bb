// Árvore matéria → tópico → SUBTÓPICO (data/subtopicos.json) e classificação POR CÓDIGO (sem IA):
// tópico com um subtópico só → ele; construção sabe o tema (tipo sorteado); senão, palavras-chave.
// O que sobra ambíguo vai para o modelo rápido (src/subtopicos.ts). Puro: servidor e demo.
import arvore from "../data/subtopicos.json" with { type: "json" };
import type { IdConcurso } from "./concursos.js";

export interface Subtopico {
  id: string;
  nome: string;
  topicos: string[];
  concursos: IdConcurso[];
  palavras?: string[];
  tipos?: string[];
  extra?: boolean;
  leis?: string[]; // trecho do nome do arquivo da lei no acervo ("13.709", "LC 105") — a lei vai primeiro no mapa
}
export const SUBTOPICOS = arvore.subtopicos as Subtopico[];
export const SUBTOPICO_POR_ID = new Map(SUBTOPICOS.map((s) => [s.id, s]));

const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export const subtopicosDoTopico = (assunto: string) => SUBTOPICOS.filter((s) => s.topicos.includes(assunto));

// concursos de um tópico = união dos concursos dos subtópicos dele
export function concursosDoTopico(assunto: string): IdConcurso[] {
  return [...new Set(subtopicosDoTopico(assunto).flatMap((s) => s.concursos))].sort() as IdConcurso[];
}

export type Classificacao =
  | { subtopico: string; metodo: "topico_unico" | "construcao" | "palavras" }
  | { subtopico: null; candidatos: string[] };

export function classificarPorCodigo(q: { assunto: string; texto: string; tipo?: string | null }): Classificacao {
  const cands = subtopicosDoTopico(q.assunto);
  if (!cands.length) return { subtopico: null, candidatos: [] };
  if (cands.length === 1) return { subtopico: cands[0].id, metodo: "topico_unico" };
  if (q.tipo) {
    const tipo = normalizar(q.tipo);
    const porTipo = cands.filter((s) => (s.tipos ?? []).some((t) => tipo.includes(normalizar(t))));
    if (porTipo.length === 1) return { subtopico: porTipo[0].id, metodo: "construcao" };
  }
  const texto = normalizar(q.texto);
  const pontos = cands.map((s) => ({ id: s.id, n: (s.palavras ?? []).filter((p) => texto.includes(normalizar(p))).length }));
  pontos.sort((a, b) => b.n - a.n);
  if (pontos[0].n > 0 && pontos[0].n > (pontos[1]?.n ?? 0)) return { subtopico: pontos[0].id, metodo: "palavras" };
  return { subtopico: null, candidatos: cands.map((s) => s.id) };
}

// tópicos do banco sem subtópico na árvore (meta: nenhum)
export const topicosSemSubtopico = (assuntos: string[]) => assuntos.filter((a) => !subtopicosDoTopico(a).length);
