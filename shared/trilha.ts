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
// o tema do dia sai desse ponto da ordem. O progresso de cada tema nunca se perde.
// guarda o SUBTÓPICO (a ordem da trilha única pode mudar); "n" só nos registros antigos, antes da migração
export interface InicioTrilha { subtopico?: string; n?: number; desde: string }

// Trilha única (25/10/2026): o avanço é POR TEMA, uma vez só, e não depende da ordem. Cada tema só olha os
// próprios dias: um dia ≥70% conclui; 1 dia abaixo = reforço (refaz se <50%); 2 dias abaixo = fila de retomada.
// Mudar a ordem da trilha (tema novo de outro concurso, incidência) não apaga nada do que já foi feito.
function estadosDaRodada(dias: DiaTema[], temas: TemaTrilha[]) {
  const estados: Record<string, EstadoTema> = Object.fromEntries(temas.map((t) => [t.subtopico, "novo" as EstadoTema]));
  const acerto: Record<string, number> = {};
  const contagem: Record<string, number> = {};
  const ultimo: Record<string, { data: string; v: string }> = {};
  const fila: string[] = [];
  for (const d of dias) {
    if (!(d.subtopico in estados)) continue;
    const v = veredito(d.novas, d.acertos);
    if (v === "incompleto") continue;
    acerto[d.subtopico] = Math.round((d.acertos / d.novas) * 100);
    ultimo[d.subtopico] = { data: d.data, v };
    if (estados[d.subtopico] === "concluido") continue;
    if (v === "concluido") {
      estados[d.subtopico] = "concluido";
      if (fila.includes(d.subtopico)) fila.splice(fila.indexOf(d.subtopico), 1);
      continue;
    }
    if (estados[d.subtopico] === "retomada") continue; // na fila: só sai concluindo
    contagem[d.subtopico] = (contagem[d.subtopico] ?? 0) + 1;
    if (contagem[d.subtopico] >= DIAS_MAX_NO_TEMA) { estados[d.subtopico] = "retomada"; fila.push(d.subtopico); }
    else estados[d.subtopico] = "reforco";
  }
  return { estados, acerto, contagem, ultimo, fila };
}

export function situacaoTrilha(dias: DiaTema[], hoje: string, temas: TemaTrilha[] = TRILHA, inicio?: InicioTrilha | null): SituacaoTrilha {
  const validos = porDia(dias).filter((d) => d.data < hoje); // o dia de hoje ainda está em andamento
  // rodadas: a Rodada 1 acaba no dia em que nenhum tema fica "novo" nem em reforço; a Rodada 2 recomeça
  // com os mesmos temas, menor acerto primeiro, contando só os dias depois disso; depois, treino de prova
  let rodada = 1;
  let desdeRodada = "";
  let ordem = [...temas];
  let r = estadosDaRodada(validos, temas);
  for (;;) {
    const fim = fimDaRodada(validos.filter((d) => d.data > desdeRodada), temas);
    if (!fim || rodada > 2) break;
    rodada++;
    const acertoAnterior = r.acerto;
    desdeRodada = fim;
    ordem = [...temas].sort((a, b) => (acertoAnterior[a.subtopico] ?? 0) - (acertoAnterior[b.subtopico] ?? 0) || a.n - b.n);
    r = estadosDaRodada(validos.filter((d) => d.data > desdeRodada), temas);
  }

  const { estados, acerto, contagem, ultimo, fila } = r;
  const ds = diaSemana(hoje);
  const modo: ModoDia = rodada > 2 ? "prova" : ds === 0 ? "domingo" : ds === 6 ? "sabado" : "tema";
  const porSub = new Map(temas.map((t) => [t.subtopico, t]));
  // tema do dia: o que está em reforço (o mais recente); senão o 1º "novo" a partir do início escolhido
  const emReforco = ordem.filter((t) => estados[t.subtopico] === "reforco").sort((a, b) => (ultimo[b.subtopico]?.data ?? "").localeCompare(ultimo[a.subtopico]?.data ?? ""));
  const comeco = rodada === 1 && inicio
    ? Math.max(0, inicio.subtopico ? ordem.findIndex((t) => t.subtopico === inicio.subtopico) : ordem.findIndex((t) => t.n >= (inicio.n ?? 0)))
    : 0;
  const giro = [...ordem.slice(comeco), ...ordem.slice(0, comeco)];
  const proximo = emReforco[0] ?? giro.find((t) => estados[t.subtopico] === "novo") ?? null;
  const tema = modo === "domingo" || modo === "prova" ? null
    : modo === "sabado" ? (fila.length ? porSub.get(fila[0])! : null)
    : proximo;
  const doDia = modo === "tema" && tema ? tema.subtopico : null;
  return {
    rodada, modo, tema, estados, acerto, filaRetomada: fila,
    diasNoTema: doDia ? contagem[doDia] ?? 0 : 0,
    refazer: !!doDia && estados[doDia] === "reforco" && ultimo[doDia]?.v === "refazer",
    concluidos: Object.values(estados).filter((e) => e === "concluido").length,
  };
}

// dia em que a rodada acabou (nenhum tema "novo" nem em reforço); null se ainda não acabou
function fimDaRodada(dias: DiaTema[], temas: TemaTrilha[]): string | null {
  for (let k = 0; k < dias.length; k++) {
    const { estados } = estadosDaRodada(dias.slice(0, k + 1), temas);
    if (Object.values(estados).every((e) => e === "concluido" || e === "retomada")) return dias[k].data;
  }
  return null;
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
