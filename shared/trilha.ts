// Trilha de estudos (data/trilha.json): o cronograma do dono dentro do app. Regra de avanço POR CÓDIGO,
// contando só questões NOVAS do tema (mínimo 15 no dia): ≥70% conclui e avança; 50–69% reforço amanhã;
// <50% refaz amanhã; depois de 2 dias no mesmo tema avança sempre e o tema vai para a fila de retomada.
// Sábado = misto + 1 tema da retomada; domingo = revisões + erros, sem tema novo. Puro: servidor e demo.
import dados from "../data/trilha.json" with { type: "json" };
import { SUBTOPICO_POR_ID } from "./subtopicos.js";
import type { IdConcurso } from "./concursos.js";

export interface TemaTrilha {
  n: number;
  subtopico: string;
  nome: string;
}
export const TRILHA = dados.temas as TemaTrilha[];
export const concursosDoTema = (t: TemaTrilha): IdConcurso[] => SUBTOPICO_POR_ID.get(t.subtopico)?.concursos ?? [];

export const MINIMO_NOVAS = 15;
export const CONCLUI = 0.7;
export const REFORCO = 0.5;
export const DIAS_MAX_NO_TEMA = 2;

export type EstadoTema = "novo" | "reforco" | "concluido" | "retomada";
export type ModoDia = "tema" | "sabado" | "domingo" | "prova";

// um dia de estudo de um tema: só as questões NOVAS (primeira vez) daquele tema contam
export interface DiaTema {
  data: string; // AAAA-MM-DD (dia local)
  subtopico: string;
  novas: number;
  acertos: number;
}

export interface SituacaoTrilha {
  rodada: number;
  modo: ModoDia;
  tema: TemaTrilha | null; // tema do dia (no sábado, o da retomada; no domingo, null)
  estados: Record<string, EstadoTema>;
  acerto: Record<string, number>; // % das novas no último dia contado do tema
  filaRetomada: string[];
  diasNoTema: number;
  refazer: boolean; // último dia < 50%: refaz em vez de reforçar
  concluidos: number;
}

export function veredito(novas: number, acertos: number): "incompleto" | "concluido" | "reforco" | "refazer" {
  if (novas < MINIMO_NOVAS) return "incompleto";
  const p = acertos / novas;
  return p >= CONCLUI ? "concluido" : p >= REFORCO ? "reforco" : "refazer";
}

// junta várias sessões do mesmo tema no mesmo dia
function porDia(dias: DiaTema[]) {
  const m = new Map<string, DiaTema>();
  for (const d of dias) {
    const k = `${d.data}|${d.subtopico}`;
    const a = m.get(k);
    m.set(k, a ? { ...a, novas: a.novas + d.novas, acertos: a.acertos + d.acertos } : { ...d });
  }
  return [...m.values()].sort((a, b) => a.data.localeCompare(b.data));
}

const diaSemana = (data: string) => new Date(`${data}T12:00:00`).getDay();

// inicio: o aluno pode pôr a trilha num tema ("Fazer deste o tema do dia"): a partir de `desde`,
// o ponteiro começa nesse tema; o que veio antes não move a trilha.
export interface InicioTrilha { n: number; desde: string }

export function situacaoTrilha(dias: DiaTema[], hoje: string, temas: TemaTrilha[] = TRILHA, inicio?: InicioTrilha | null): SituacaoTrilha {
  const estados: Record<string, EstadoTema> = Object.fromEntries(temas.map((t) => [t.subtopico, "novo" as EstadoTema]));
  const acerto: Record<string, number> = {};
  const fila: string[] = [];
  let ordem = [...temas];
  let rodada = 1, i = 0, diasNoTema = 0, refazer = false;
  if (inicio) i = Math.max(0, ordem.findIndex((t) => t.n >= inicio.n));

  for (const d of porDia(dias)) {
    if (d.data >= hoje) continue; // o dia de hoje ainda está em andamento
    if (inicio && d.data < inicio.desde) continue;
    const v = veredito(d.novas, d.acertos);
    if (v === "incompleto") continue;
    acerto[d.subtopico] = Math.round((d.acertos / d.novas) * 100);
    // sábado: o tema estudado é da retomada; ≥70% tira da fila
    if (fila.includes(d.subtopico) && (diaSemana(d.data) === 6 || ordem[i]?.subtopico !== d.subtopico)) {
      if (v === "concluido") { fila.splice(fila.indexOf(d.subtopico), 1); estados[d.subtopico] = "concluido"; }
      continue;
    }
    if (rodada > 2 || ordem[i]?.subtopico !== d.subtopico) continue; // fora da ordem: não mexe na trilha
    diasNoTema++;
    if (v === "concluido") {
      estados[d.subtopico] = "concluido";
      i++; diasNoTema = 0; refazer = false;
    } else if (diasNoTema >= DIAS_MAX_NO_TEMA) {
      estados[d.subtopico] = "retomada";
      if (!fila.includes(d.subtopico)) fila.push(d.subtopico);
      i++; diasNoTema = 0; refazer = false;
    } else {
      estados[d.subtopico] = "reforco";
      refazer = v === "refazer";
    }
    if (i >= ordem.length) {
      rodada++; i = 0;
      // Rodada 2: mesmos temas, menor acerto primeiro
      ordem = [...temas].sort((a, b) => (acerto[a.subtopico] ?? 0) - (acerto[b.subtopico] ?? 0) || a.n - b.n);
    }
  }

  const ds = diaSemana(hoje);
  const modo: ModoDia = rodada > 2 ? "prova" : ds === 0 ? "domingo" : ds === 6 ? "sabado" : "tema";
  const porSub = new Map(temas.map((t) => [t.subtopico, t]));
  const tema = modo === "domingo" || modo === "prova" ? null
    : modo === "sabado" ? (fila.length ? porSub.get(fila[0])! : null)
    : ordem[i] ?? null;
  return {
    rodada, modo, tema, estados, acerto, filaRetomada: fila, diasNoTema, refazer,
    concluidos: Object.values(estados).filter((e) => e === "concluido").length,
  };
}

// fim da sessão: o que acontece amanhã, pela mesma regra (novas do dia inteiro, não só desta sessão)
export function amanha(t: { n: number; nome: string; diaNoTema: number }, novasDia: number, acertosDia: number, temas: TemaTrilha[] = TRILHA): string {
  const v = veredito(novasDia, acertosDia);
  const seguinte = temas.find((x) => x.n > t.n) ?? null;
  const prox = seguinte ? `tema ${seguinte.n}, ${seguinte.nome}` : "a Rodada 2";
  if (v === "incompleto") return `Faltam ${MINIMO_NOVAS - novasDia} questões novas para o dia valer (mínimo ${MINIMO_NOVAS}).`;
  if (v === "concluido") return `${t.nome} concluído! Amanhã: ${prox}.`;
  if (t.diaNoTema >= DIAS_MAX_NO_TEMA) return `Segundo dia em ${t.nome}: amanhã segue para ${prox} e ${t.nome} vai para a fila de retomada (sábado).`;
  return v === "reforco" ? `Amanhã: reforço de ${t.nome} (${tamanhoSessao("reforco")} novas).` : `Abaixo de 50%: amanhã refaz ${t.nome} (${tamanhoSessao("reforco")} novas).`;
}

// tamanho da sessão do tema: 15–25 novas (25–30 em reforço) → +5 mistas da matéria
export const tamanhoSessao = (estado: EstadoTema) => (estado === "reforco" ? 28 : 20);
export const MISTAS_FIM = 5;

// link de busca no YouTube (não escolhe vídeo: só monta a busca)
export const linkYoutube = (tema: string, concurso: string) =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(`${tema} concurso ${concurso.toUpperCase()} aula`)}`;
