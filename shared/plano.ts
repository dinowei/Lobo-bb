// Plano até a prova (PROMPTS-MELHORIAS §6) — puro, igual no servidor e no demo.
// Sem data: ciclo contínuo (rodízio por peso × fraqueza). Com data: fases Base → Aprofundamento →
// Reta final (3 últimas semanas: revisão, caderno de erros, redação e 2 simulados por semana).
// O plano é recalculado do estado atual a cada vez: atrasou, ele redistribui sozinho, sem culpa.
import { COTAS_PROVA } from "./estruturaProva.js";
import type { Disciplina } from "./tipos.js";

export type Fase = "ciclo" | "base" | "aprofundamento" | "reta_final";
export const NOME_FASE: Record<Fase, string> = { ciclo: "Ciclo de estudos", base: "Base", aprofundamento: "Aprofundamento", reta_final: "Reta final" };
export const SEMANAS_RETA_FINAL = 3;
export const MINUTOS_POR_QUESTAO = 3;
export const TOPICOS_POR_SEMANA_BASE = 6; // ritmo para cobrir tópicos novos na fase Base

export type ItemPlano =
  | { tipo: "questoes"; disciplina: Disciplina; minutos: number; questoes: number }
  | { tipo: "revisao" | "erros"; minutos: number }
  | { tipo: "redacao"; minutos: number }
  | { tipo: "simulado"; minutos: number; questoes: number };
export interface DiaPlano { data: string; itens: ItemPlano[] }
export interface SemanaPlano { numero: number; inicio: string; fase: Fase; dias: DiaPlano[] }
export interface Plano { fase: Fase; semanaAtual: number; totalSemanas: number | null; semanas: SemanaPlano[] }

export interface EntradaPlano {
  hoje: string; // AAAA-MM-DD
  dataProva?: string; // AAAA-MM-DD ou vazio
  inicio?: string; // quando o plano começou (para "Semana X de Y"); padrão: hoje
  horasPorDia: number;
  diasSemana: number[]; // 0 = domingo … 6 = sábado
  disciplinas: { disciplina: Disciplina; dominio: number; rating?: number; topicos: number; topicosVistos: number }[];
  semanasAMostrar?: number; // padrão 4
}

const somarDias = (dia: string, n: number) => {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const diaDaSemana = (dia: string) => new Date(`${dia}T12:00:00Z`).getUTCDay();
const semanasEntreExato = (a: string, b: string) => (new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime()) / (7 * 86_400_000);
const semanasEntre = (a: string, b: string) => Math.ceil((new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime()) / (7 * 86_400_000));

// Peso de cada disciplina no tempo: cota na prova × fraqueza × (rating baixo pesa mais)
export function pesosDoPlano(ds: EntradaPlano["disciplinas"]) {
  return new Map(
    ds
      .filter((d) => (COTAS_PROVA[d.disciplina] ?? 0) > 0)
      .map((d) => [d.disciplina, (COTAS_PROVA[d.disciplina] ?? 0) * Math.max(0.15, 1 - d.dominio) * (d.rating ? Math.min(1.6, Math.max(0.6, 1300 / d.rating)) : 1)])
  );
}

// semana: a partir de hoje (1 = esta); restantes: semanas até a prova; semanasDeBase: para cobrir o que falta
export function faseDa(semana: number, restantes: number | null, semanasDeBase: number): Fase {
  if (restantes === null) return "ciclo";
  if (semana > restantes - SEMANAS_RETA_FINAL) return "reta_final";
  return semana <= semanasDeBase ? "base" : "aprofundamento";
}

// Distribui os minutos de um dia de questões em rodízio: as disciplinas mais pesadas primeiro, sem
// repetir até passar por todas (o índice "giro" vem do dia, então dias seguidos variam)
function diaDeQuestoes(minutos: number, pesos: Map<Disciplina, number>, giro: number): ItemPlano[] {
  const ordem = [...pesos].sort((a, b) => b[1] - a[1]).map(([d]) => d);
  if (!ordem.length || minutos < MINUTOS_POR_QUESTAO * 5) return [];
  const blocos = Math.max(1, Math.min(3, Math.floor(minutos / 30))); // 1 a 3 disciplinas por dia
  const soma = [...pesos.values()].reduce((s, p) => s + p, 0);
  // sorteio determinístico ponderado: percorre a "roda" dos pesos a partir do giro
  const escolhidas: Disciplina[] = [];
  let pos = ((giro * 0.618) % 1) * soma;
  for (let i = 0; escolhidas.length < Math.min(blocos, ordem.length) && i < 50; i++) {
    let acc = 0;
    const d = ordem.find((x) => (acc += pesos.get(x)!) > pos % soma) ?? ordem[0];
    if (!escolhidas.includes(d)) escolhidas.push(d);
    pos += soma / blocos + 0.37 * soma;
  }
  const porBloco = Math.floor(minutos / escolhidas.length);
  return escolhidas.map((disciplina) => ({ tipo: "questoes", disciplina, minutos: porBloco, questoes: Math.max(5, Math.round(porBloco / MINUTOS_POR_QUESTAO)) }));
}

export function gerarPlano(e: EntradaPlano): Plano {
  const pesos = pesosDoPlano(e.disciplinas);
  const minutosDia = Math.max(15, Math.round(e.horasPorDia * 60));
  const dias = new Set(e.diasSemana.length ? e.diasSemana : [1, 2, 3, 4, 5]);
  const prova = e.dataProva && e.dataProva > e.hoje ? e.dataProva : undefined;
  const total = prova ? Math.max(1, semanasEntre(e.hoje, prova)) : null; // semanas restantes
  const inicio = e.inicio && e.inicio <= e.hoje ? e.inicio : e.hoje;
  const semanaAtual = Math.floor(semanasEntreExato(inicio, e.hoje)) + 1;
  const faltamTopicos = e.disciplinas.filter((d) => (COTAS_PROVA[d.disciplina] ?? 0) > 0).reduce((s, d) => s + Math.max(0, d.topicos - d.topicosVistos), 0);
  const semanasDeBase = Math.ceil(faltamTopicos / TOPICOS_POR_SEMANA_BASE);
  const mostrar = Math.min(e.semanasAMostrar ?? 4, total ?? Infinity);
  const semanas: SemanaPlano[] = [];
  for (let s = 1; s <= mostrar; s++) {
    const fase = faseDa(s, total, semanasDeBase);
    const inicio = somarDias(e.hoje, (s - 1) * 7);
    const diasDaSemana = Array.from({ length: 7 }, (_, i) => somarDias(inicio, i)).filter((d) => (!prova || d < prova) && dias.has(diaDaSemana(d)));
    // marcos da semana: redação no 2º dia disponível; simulado no último (2 na reta final: 1º e último)
    const simulados = fase === "reta_final" ? new Set([diasDaSemana[0], diasDaSemana[diasDaSemana.length - 1]]) : new Set([diasDaSemana[diasDaSemana.length - 1]]);
    const redacao = diasDaSemana[Math.min(1, diasDaSemana.length - 1)];
    const diasPlano: DiaPlano[] = diasDaSemana.map((data, i) => {
      const itens: ItemPlano[] = [];
      let livre = minutosDia;
      if (simulados.has(data) && diasDaSemana.length > 1) {
        const q = fase === "reta_final" ? 70 : Math.min(70, Math.max(20, Math.round((livre * 0.8) / MINUTOS_POR_QUESTAO / 10) * 10));
        itens.push({ tipo: "simulado", minutos: Math.min(livre, q * MINUTOS_POR_QUESTAO), questoes: q });
        livre -= Math.min(livre, q * MINUTOS_POR_QUESTAO);
      }
      if (data === redacao && livre >= 45) {
        itens.push({ tipo: "redacao", minutos: 60 > livre ? livre : 60 });
        livre -= Math.min(60, livre);
      }
      // revisão espaçada todo dia (15–20%); reta final: revisão + caderno de erros no lugar de matéria nova
      if (livre > 0) {
        if (fase === "reta_final") {
          const metade = Math.round(livre / 2);
          itens.push({ tipo: "revisao", minutos: metade }, { tipo: "erros", minutos: livre - metade });
          livre = 0;
        } else {
          const rev = Math.min(livre, Math.max(10, Math.round(minutosDia * 0.2)));
          itens.push({ tipo: "revisao", minutos: rev });
          livre -= rev;
        }
      }
      itens.push(...diaDeQuestoes(livre, pesos, s * 7 + i));
      return { data, itens };
    });
    semanas.push({ numero: s, inicio, fase, dias: diasPlano });
  }
  return {
    fase: semanas[0]?.fase ?? (total === null ? "ciclo" : "base"),
    semanaAtual,
    totalSemanas: total === null ? null : semanaAtual - 1 + total,
    semanas,
  };
}

export const planoDeHoje = (p: Plano, hoje: string) => p.semanas[0]?.dias.find((d) => d.data === hoje) ?? null;
