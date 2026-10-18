// Estrutura da prova de Escriturário (Agente Comercial) — usada pelo simulado, pelo treino e pelo
// noturno, no servidor E no modo demo. Lida das provas oficiais BB 2021 e BB 2023 (disciplina de
// cada questão tirada da capa por código). Pesos por bloco e duração: não confirmados (null).
import type { Disciplina } from "./tipos.js";

export const ESTRUTURA_PROVA = {
  fonte: "distribuição das provas oficiais BB 2021 e BB 2023 (capa); conferir no próximo edital",
  conferido: false,
  totalQuestoes: 70,
  blocos: [
    { nome: "Conhecimentos Básicos", cotas: { lingua_portuguesa: 10, lingua_inglesa: 5, matematica: 5, atualidades_mercado_financeiro: 5 } },
    { nome: "Conhecimentos Específicos", cotas: { matematica_financeira: 5, conhecimentos_bancarios: 10, informatica: 15, vendas_negociacao: 15 } },
  ] as { nome: string; cotas: Partial<Record<Disciplina, number>> }[],
  redacao: { tipo: "dissertativo-argumentativo", pontos: 100, minimo: 70 },
  pesos: null as Record<string, number> | null, // por bloco, quando o edital confirmar
  duracaoMin: null as number | null,
  // praticável no treino, mas fora dos simulados e com prioridade baixa
  foraDoEdital: ["probabilidade_estatistica"] as Disciplina[],
};

export const COTAS_PROVA: Partial<Record<Disciplina, number>> = Object.assign({}, ...ESTRUTURA_PROVA.blocos.map((b) => b.cotas));
export const blocoDa = (d: Disciplina) => ESTRUTURA_PROVA.blocos.find((b) => d in b.cotas)?.nome ?? null;

// divisão proporcional por maiores restos (soma exatamente n)
export function dividirProporcional<K>(n: number, pesos: Map<K, number>): Map<K, number> {
  const soma = [...pesos.values()].reduce((a, b) => a + b, 0);
  if (!soma) return new Map([...pesos.keys()].map((k) => [k, 0]));
  const brutas = [...pesos].map(([k, p]) => ({ k, v: (n * p) / soma }));
  const saida = new Map(brutas.map((b) => [b.k, Math.floor(b.v)]));
  let faltam = n - [...saida.values()].reduce((a, b) => a + b, 0);
  for (const b of [...brutas].sort((x, y) => (y.v % 1) - (x.v % 1))) {
    if (faltam-- <= 0) break;
    saida.set(b.k, (saida.get(b.k) ?? 0) + 1);
  }
  return saida;
}

// Cotas do simulado de n questões: na proporção da prova, entre as disciplinas disponíveis
export function cotasDaProva(n: number, disponiveis?: Set<Disciplina>): Map<Disciplina, number> {
  const pesos = new Map(
    (Object.entries(COTAS_PROVA) as [Disciplina, number][]).filter(([d, c]) => c > 0 && (!disponiveis || disponiveis.has(d)))
  );
  return dividirProporcional(n, pesos);
}

// Peso de um tópico no treino quando o edital não diz (questoesNaProva vazio): cota da disciplina
// dividida pelos tópicos dela; fora do edital, peso baixo
export function pesoDoTopico(disciplina: Disciplina, topicosNaDisciplina: number, questoesNaProva?: number | null): number {
  if (questoesNaProva != null) return questoesNaProva;
  if (ESTRUTURA_PROVA.foraDoEdital.includes(disciplina)) return 0.2;
  return (COTAS_PROVA[disciplina] ?? 0) / Math.max(1, topicosNaDisciplina);
}

// ---------- mistura de dificuldade ----------
export interface Mistura { facil: number; media: number; dificil: number; estimativa: boolean; base: number }
export const MISTURA_PADRAO = { facil: 0.2, media: 0.5, dificil: 0.3 };
export const faixaDe = (dificuldade: number): "facil" | "media" | "dificil" => (dificuldade <= 2 ? "facil" : dificuldade === 3 ? "media" : "dificil");

// distribuição das oficiais quando houver ao menos 30 com dificuldade; senão, a estimativa padrão
export function misturaDasOficiais(dificuldades: number[]): Mistura {
  if (dificuldades.length < 30) return { ...MISTURA_PADRAO, estimativa: true, base: dificuldades.length };
  const c = { facil: 0, media: 0, dificil: 0 };
  for (const d of dificuldades) c[faixaDe(d)]++;
  const n = dificuldades.length;
  return { facil: c.facil / n, media: c.media / n, dificil: c.dificil / n, estimativa: false, base: n };
}

export function cotasPorFaixa(k: number, m: Mistura) {
  return dividirProporcional(k, new Map([["facil", m.facil], ["media", m.media], ["dificil", m.dificil]] as const));
}

// ---------- resultado por bloco ----------
export function resumoPorBloco(porDisciplina: { disciplina: Disciplina; total: number; acertos: number }[]) {
  const linhas = ESTRUTURA_PROVA.blocos.map((b) => {
    const ds = porDisciplina.filter((d) => d.disciplina in b.cotas);
    return { bloco: b.nome, total: ds.reduce((s, d) => s + d.total, 0), acertos: ds.reduce((s, d) => s + d.acertos, 0), cota: Object.values(b.cotas).reduce((s, c) => s + (c ?? 0), 0) };
  });
  const fora = porDisciplina.filter((d) => !blocoDa(d.disciplina));
  if (fora.length) linhas.push({ bloco: "Fora do edital", total: fora.reduce((s, d) => s + d.total, 0), acertos: fora.reduce((s, d) => s + d.acertos, 0), cota: 0 });
  return linhas.filter((l) => l.total);
}

// nota ponderada pelos pesos dos blocos (só quando o edital confirmar os pesos)
export function notaPonderada(blocos: { bloco: string; total: number; acertos: number }[]): number | null {
  const pesos = ESTRUTURA_PROVA.pesos;
  if (!pesos) return null;
  const soma = blocos.reduce((s, b) => s + (pesos[b.bloco] ?? 0) * b.total, 0);
  return soma ? blocos.reduce((s, b) => s + (pesos[b.bloco] ?? 0) * b.acertos, 0) / soma : null;
}
