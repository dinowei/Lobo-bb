// Estrutura da prova de Escriturário (Agente Comercial) — usada pelo simulado, pelo treino e pelo
// noturno, no servidor E no modo demo. Conferida no EDITAL Nº 01 – 2022/001 (Cesgranrio, prova de
// 23/04/2023), itens 7.2.2 a 7.2.4, 7.3 e 8.1; bate com as capas das provas BB 2021 e 2023.
import type { Disciplina } from "./tipos.js";
import { CONCURSOS } from "./concursos.js";

// O dado mora em data/concursos/bb.json (concurso como dado). Mesma forma de antes:
// - valorQuestao (7.2.2.1 e 7.2.2.2): 32,5 pontos em Básicos + 67,5 em Específicos = 100
// - corteObjetivas (7.2.4): elimina abaixo de 50% no total, em Básicos ou em Específicos, ou com zero numa disciplina
// - redacao (7.3): 100 pontos, elimina abaixo de 70; zero só no 7.3.5 (e abaixo de 25 linhas, decisão do dono)
// - duracaoMin (8.1): objetivas + redação em 5 horas; foraDoEdital: praticável, fora dos simulados
const bb = CONCURSOS.bb;
export const ESTRUTURA_PROVA = {
  fonte: bb.fonte,
  conferido: bb.conferido,
  totalQuestoes: bb.totalQuestoes,
  blocos: bb.blocos as { nome: string; cotas: Partial<Record<Disciplina, number>> }[],
  valorQuestao: bb.valorQuestao as Partial<Record<Disciplina, number>>,
  corteObjetivas: bb.corteObjetivas,
  redacao: bb.redacao,
  duracaoMin: bb.duracaoMin,
  foraDoEdital: bb.foraDoEdital as Disciplina[],
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

// Treino misturado: a cada questão uma disciplina sorteada no peso da prova, nunca a mesma da anterior
// (intercalar é o que fixa). Fora do edital não entra; se só sobrar uma disciplina, repete.
export function sortearDisciplinaMista(disponiveis: Disciplina[], anterior?: Disciplina, aleatorio = Math.random): Disciplina | undefined {
  const daProva = disponiveis.filter((d) => (COTAS_PROVA[d] ?? 0) > 0);
  const opcoes = daProva.filter((d) => d !== anterior);
  const pool = opcoes.length ? opcoes : daProva;
  const soma = pool.reduce((s, d) => s + (COTAS_PROVA[d] ?? 0), 0);
  let r = aleatorio() * soma;
  return pool.find((d) => (r -= COTAS_PROVA[d] ?? 0) < 0) ?? pool[pool.length - 1];
}

// ---------- mistura de dificuldade ----------
export interface Mistura { facil: number; media: number; dificil: number; estimativa: boolean; base: number }
export const MISTURA_PADRAO = { facil: 0.2, media: 0.5, dificil: 0.3 };
// simulado fiel: 20% fácil, 50% média, 30% difícil (decisão do dono, 18/10/2026); o treino segue o rating
export const MISTURA_SIMULADO: Mistura = { ...MISTURA_PADRAO, estimativa: false, base: 0 };
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

// Pontuação como a banca conta (valor de cada questão do edital) e os cortes do 7.2.4. Em simulado
// menor que 70 questões, os cortes valem sobre o que caiu (aproveitamento proporcional).
export function pontuacaoProva(porDisciplina: { disciplina: Disciplina; total: number; acertos: number }[]) {
  const valor = (d: Disciplina) => ESTRUTURA_PROVA.valorQuestao[d] ?? 0;
  const soma = (ds: typeof porDisciplina, campo: "total" | "acertos") => ds.reduce((s, d) => s + valor(d.disciplina) * d[campo], 0);
  const blocos = ESTRUTURA_PROVA.blocos.map((b) => {
    const ds = porDisciplina.filter((d) => d.disciplina in b.cotas);
    return { bloco: b.nome, pontos: soma(ds, "acertos"), maximo: soma(ds, "total") };
  });
  const pontos = blocos.reduce((s, b) => s + b.pontos, 0);
  const maximo = blocos.reduce((s, b) => s + b.maximo, 0);
  const corte = ESTRUTURA_PROVA.corteObjetivas;
  const motivos: string[] = [];
  if (maximo && pontos / maximo < corte) motivos.push(`menos de ${corte * 100}% no total`);
  for (const b of blocos) if (b.maximo && b.pontos / b.maximo < corte) motivos.push(`menos de ${corte * 100}% em ${b.bloco}`);
  for (const d of porDisciplina) if (valor(d.disciplina) && d.total && !d.acertos) motivos.push(`zero em uma disciplina`);
  return { pontos, maximo, aproveitamento: maximo ? pontos / maximo : 0, blocos, eliminado: [...new Set(motivos)] };
}
