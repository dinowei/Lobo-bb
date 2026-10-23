// Evolução dos simulados (F4): o resumo de cada simulado (concurso, banca, tamanho, tempo, acertos por
// matéria e por subtópico, nota no critério da prova) e a série para o gráfico, com a comparação com o
// anterior e a melhor e a pior matéria. Completo = tamanho da prova; parcial não se mistura sem aviso. Puro.
import { BANCAS, CONCURSOS, notaPelaBanca, type IdBanca, type IdConcurso } from "./concursos.js";
import { pontuacaoProva } from "./estruturaProva.js";
import type { Disciplina } from "./tipos.js";

export interface ItemSimulado {
  disciplina: Disciplina;
  subtopico?: string | null;
  acertou: boolean;
  branco: boolean;
  tempoSeg?: number | null;
}
export interface Placar { total: number; acertos: number }
export interface ResumoSimulado {
  id: string;
  data: string; // ISO
  concurso: IdConcurso;
  banca: IdBanca;
  diagnostico: boolean;
  tamanho: number;
  total: number;
  acertos: number;
  erros: number;
  brancos: number;
  tempoSeg: number;
  completo: boolean;
  porDisciplina: (Placar & { disciplina: Disciplina })[];
  porSubtopico: (Placar & { subtopico: string })[];
  nota: { valor: number; maximo: number; criterio: "pontos" | "liquida" };
}

function agrupar<K extends string>(itens: ItemSimulado[], chave: (i: ItemSimulado) => K | null | undefined) {
  const m = new Map<K, Placar>();
  for (const i of itens) {
    const k = chave(i);
    if (!k) continue;
    const p = m.get(k) ?? { total: 0, acertos: 0 };
    p.total++;
    if (i.acertou) p.acertos++;
    m.set(k, p);
  }
  return m;
}

export function resumirSimulado(
  base: { id: string; data: string; concurso: IdConcurso; banca: IdBanca; diagnostico: boolean; tamanho?: number },
  itens: ItemSimulado[]
): ResumoSimulado {
  const acertos = itens.filter((i) => i.acertou).length;
  const brancos = itens.filter((i) => i.branco).length;
  const erros = itens.length - acertos - brancos;
  const porDisciplina = [...agrupar(itens, (i) => i.disciplina)].map(([disciplina, p]) => ({ disciplina, ...p }));
  const porSubtopico = [...agrupar(itens, (i) => i.subtopico ?? null)].map(([subtopico, p]) => ({ subtopico, ...p }));
  // C/E (Cebraspe): nota líquida, um erro anula um acerto; múltipla escolha: pontos do edital (BB)
  const ce = BANCAS[base.banca]?.formato === "certo_errado";
  const nota = ce
    ? { valor: notaPelaBanca(base.banca, { acertos, erros, brancos }), maximo: itens.length, criterio: "liquida" as const }
    : (() => { const p = pontuacaoProva(porDisciplina); return { valor: p.pontos, maximo: p.maximo, criterio: "pontos" as const }; })();
  const tamanhoProva = (CONCURSOS[base.concurso] as { totalQuestoes?: number }).totalQuestoes ?? 0;
  return {
    ...base,
    tamanho: base.tamanho ?? itens.length,
    total: itens.length,
    acertos, erros, brancos,
    tempoSeg: itens.reduce((s, i) => s + (i.tempoSeg ?? 0), 0),
    completo: !!tamanhoProva && itens.length >= tamanhoProva,
    porDisciplina, porSubtopico, nota,
  };
}

export interface PontoEvolucao {
  id: string;
  data: string;
  completo: boolean;
  pct: number; // % de acerto total
  nota: number; // nota no critério / máximo (0..1), comparável entre tamanhos
  porDisciplina: Partial<Record<Disciplina, number>>; // % por matéria
  delta: Partial<Record<Disciplina, number>>; // pontos percentuais vs. o simulado anterior do MESMO tipo
  melhor: Disciplina | null;
  pior: Disciplina | null;
}

// série em ordem de data; diagnósticos (Raio-X) ficam de fora; o "anterior" é o do mesmo tipo (completo/parcial)
export function evolucao(sims: ResumoSimulado[], filtro: { concurso?: IdConcurso; banca?: IdBanca } = {}): PontoEvolucao[] {
  const lista = sims
    .filter((s) => !s.diagnostico && s.total && (!filtro.concurso || s.concurso === filtro.concurso) && (!filtro.banca || s.banca === filtro.banca))
    .sort((a, b) => a.data.localeCompare(b.data));
  const ultimo: Record<"c" | "p", PontoEvolucao | undefined> = { c: undefined, p: undefined };
  return lista.map((s) => {
    const porDisciplina = Object.fromEntries(s.porDisciplina.map((d) => [d.disciplina, Math.round((d.acertos / d.total) * 100)])) as Partial<Record<Disciplina, number>>;
    const ant = ultimo[s.completo ? "c" : "p"];
    const delta: Partial<Record<Disciplina, number>> = {};
    if (ant) for (const [d, v] of Object.entries(porDisciplina) as [Disciplina, number][]) if (ant.porDisciplina[d] !== undefined) delta[d] = v - ant.porDisciplina[d]!;
    const ordem = (Object.entries(porDisciplina) as [Disciplina, number][]).sort((a, b) => b[1] - a[1]);
    const p: PontoEvolucao = {
      id: s.id, data: s.data, completo: s.completo,
      pct: Math.round((s.acertos / s.total) * 100),
      nota: s.nota.maximo ? s.nota.valor / s.nota.maximo : 0,
      porDisciplina, delta,
      melhor: ordem[0]?.[0] ?? null,
      pior: ordem.length > 1 ? ordem[ordem.length - 1][0] : null,
    };
    ultimo[s.completo ? "c" : "p"] = p;
    return p;
  });
}

export function csvSimulados(sims: ResumoSimulado[], disciplinas: Disciplina[]): string {
  const cab = ["data", "concurso", "banca", "tipo", "questoes", "acertos", "erros", "brancos", "pct", "nota", "nota_max", "criterio", "tempo_min", ...disciplinas];
  const linhas = [...sims].sort((a, b) => a.data.localeCompare(b.data)).map((s) => {
    const pd = new Map(s.porDisciplina.map((d) => [d.disciplina, d]));
    return [
      s.data.slice(0, 10), s.concurso, s.banca, s.diagnostico ? "raio-x" : s.completo ? "completo" : "parcial",
      s.total, s.acertos, s.erros, s.brancos, Math.round((s.acertos / Math.max(1, s.total)) * 100),
      String(s.nota.valor).replace(".", ","), String(s.nota.maximo).replace(".", ","), s.nota.criterio, Math.round(s.tempoSeg / 60),
      ...disciplinas.map((d) => { const x = pd.get(d); return x ? `${x.acertos}/${x.total}` : ""; }),
    ].join(";");
  });
  return [cab.join(";"), ...linhas].join("\n");
}
