// Desempenho por TEMA (subtópico): % de acerto nas questões NOVAS (a 1ª vez que o aluno responde cada uma)
// hoje / 7 dias / total, respondidas, domínio, última vez, selo e o acerto dentro dos simulados.
// Também separa a origem (oficial, gerada, derivada, cursinho) e dá os dias da trilha. Puro: servidor e demo.
import { dominioDe } from "./motor.js";
import { SUBTOPICO_POR_ID } from "./subtopicos.js";
import type { DiaTema } from "./trilha.js";
import type { Disciplina } from "./tipos.js";

export type OrigemTema = "oficial" | "gerada" | "derivada" | "cursinho";
export type Selo = "concluido" | "reforco" | "retomar" | "sem_dados";

export interface TentativaTema {
  questaoId: string;
  subtopico: string;
  acertou: boolean;
  data: string; // ISO
  simulado: boolean;
  origem: OrigemTema;
}
export interface Placar { n: number; a: number }

export interface DesempenhoTemaDTO {
  subtopico: string;
  nome: string;
  disciplina: Disciplina | null;
  concursos: string[];
  aprovadas: number; // questões aprovadas do tema no banco
  novasHoje: Placar;
  novas7d: Placar;
  novasTotal: Placar;
  respondidas: number; // questões distintas já respondidas (fora simulado)
  dominio: number; // 0..1
  ultima: string | null;
  selo: Selo;
  simulado: Placar;
  porOrigem: Record<OrigemTema, Placar>;
}

export const seloDe = (p: Placar): Selo => (!p.n ? "sem_dados" : p.a / p.n >= 0.7 ? "concluido" : p.a / p.n >= 0.5 ? "reforco" : "retomar");
export const NOME_SELO: Record<Selo, string> = { concluido: "concluído", reforco: "reforço", retomar: "retomar", sem_dados: "sem dados" };

const somar = (p: Placar, acertou: boolean) => { p.n++; if (acertou) p.a++; };
const vazio = (): Placar => ({ n: 0, a: 0 });
// dia local AAAA-MM-DD (o fuso do aluno: Brasília)
export const diaLocal = (iso: string | Date) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

// 1ª tentativa de cada questão fora de simulado = "nova"
function primeiras(ts: TentativaTema[]) {
  const vistas = new Map<string, TentativaTema>();
  for (const t of [...ts].sort((a, b) => a.data.localeCompare(b.data))) if (!t.simulado && !vistas.has(t.questaoId)) vistas.set(t.questaoId, t);
  return [...vistas.values()];
}

export function desempenhoPorTema(
  ts: TentativaTema[],
  aprovadas: Map<string, number>, // subtópico → nº aprovadas
  disciplinaDe: (subtopico: string) => Disciplina | null,
  agora = new Date()
): DesempenhoTemaDTO[] {
  const hoje = diaLocal(agora);
  const seteDias = agora.getTime() - 7 * 86_400_000;
  const subs = new Set([...aprovadas.keys(), ...ts.map((t) => t.subtopico)]);
  const novas = primeiras(ts);
  return [...subs].map((sub) => {
    const doTema = ts.filter((t) => t.subtopico === sub);
    const nv = novas.filter((t) => t.subtopico === sub);
    const novasHoje = vazio(), novas7d = vazio(), novasTotal = vazio(), simulado = vazio();
    const porOrigem = { oficial: vazio(), gerada: vazio(), derivada: vazio(), cursinho: vazio() };
    for (const t of nv) {
      somar(novasTotal, t.acertou);
      somar(porOrigem[t.origem], t.acertou);
      if (new Date(t.data).getTime() >= seteDias) somar(novas7d, t.acertou);
      if (diaLocal(t.data) === hoje) somar(novasHoje, t.acertou);
    }
    for (const t of doTema) if (t.simulado) somar(simulado, t.acertou);
    const treino = doTema.filter((t) => !t.simulado);
    const s = SUBTOPICO_POR_ID.get(sub);
    return {
      subtopico: sub,
      nome: s?.nome ?? sub,
      disciplina: disciplinaDe(sub),
      concursos: s?.concursos ?? [],
      aprovadas: aprovadas.get(sub) ?? 0,
      novasHoje, novas7d, novasTotal,
      respondidas: new Set(treino.map((t) => t.questaoId)).size,
      dominio: treino.length ? dominioDe(treino.length, treino.filter((t) => t.acertou).length) : 0,
      ultima: doTema.length ? doTema.map((t) => t.data).sort().at(-1)! : null,
      selo: seloDe(novasTotal),
      simulado,
      porOrigem,
    };
  });
}

// dias da trilha: questões NOVAS por tema e por dia (base da regra de avanço)
export function diasDaTrilha(ts: TentativaTema[]): DiaTema[] {
  const m = new Map<string, DiaTema>();
  for (const t of primeiras(ts)) {
    const data = diaLocal(t.data);
    const k = `${data}|${t.subtopico}`;
    const d = m.get(k) ?? { data, subtopico: t.subtopico, novas: 0, acertos: 0 };
    d.novas++;
    if (t.acertou) d.acertos++;
    m.set(k, d);
  }
  return [...m.values()];
}

export function csvDesempenho(linhas: DesempenhoTemaDTO[]): string {
  const pct = (p: Placar) => (p.n ? String(Math.round((p.a / p.n) * 100)) : "");
  const cab = ["tema", "disciplina", "concursos", "aprovadas", "novas_hoje_%", "novas_7d_%", "novas_total_%", "novas_total_n", "respondidas", "dominio_%", "ultima", "selo", "simulado_%", "simulado_n"];
  const esc = (s: string) => (/[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  return [cab.join(";"), ...linhas.map((l) => [l.nome, l.disciplina ?? "", l.concursos.join(","), l.aprovadas, pct(l.novasHoje), pct(l.novas7d), pct(l.novasTotal), l.novasTotal.n, l.respondidas, Math.round(l.dominio * 100), l.ultima?.slice(0, 10) ?? "", NOME_SELO[l.selo], pct(l.simulado), l.simulado.n].map((v) => esc(String(v))).join(";"))].join("\n");
}
