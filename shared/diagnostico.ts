// Diagnóstico inicial (PROMPTS-MELHORIAS §5) — puro, servidor e demo.
// 30 questões na proporção da prova, dificuldade média, sem correção até o fim e sem tempo.
// Guardado como tentativas de simulado com simuladoId "diag:<id>" (fora do histórico de simulados).
import { COTAS_PROVA } from "./estruturaProva.js";
import type { DiagnosticoResumo, Disciplina, ResultadoDisciplina, TentativaBruta } from "./tipos.js";

export const QUESTOES_DIAGNOSTICO = 30;
export const DIAS_PARA_REFAZER = 30;
export const PREFIXO_DIAGNOSTICO = "diag:";
export const ehDiagnostico = (simuladoId?: string) => !!simuladoId?.startsWith(PREFIXO_DIAGNOSTICO);
export const MISTURA_DIAGNOSTICO = { facil: 0, media: 1, dificil: 0, estimativa: false, base: 0 };

// Rating inicial da disciplina: o nível em que você acertaria a taxa observada em questões médias
// (1300), com suavização (a+1)/(n+2) para amostra pequena, entre 900 e 1700
export function ratingDoDiagnostico(acertos: number, total: number, ratingDasQuestoes = 1300) {
  const p = (acertos + 1) / (total + 2);
  return Math.round(Math.min(1700, Math.max(900, ratingDasQuestoes + 400 * Math.log10(p / (1 - p)))));
}


// 3 pontos fortes (maior taxa) e 3 focos (fraqueza × peso na prova), sem repetir
export function fortesEFocos(porDisciplina: ResultadoDisciplina[]) {
  const taxa = (d: ResultadoDisciplina) => (d.acertos + 1) / (d.total + 2);
  const comDados = porDisciplina.filter((d) => d.total);
  const fortes = [...comDados].sort((a, b) => taxa(b) - taxa(a) || b.total - a.total).slice(0, 3);
  // com até 3 disciplinas não dá para separar: a mesma pode ser forte e foco
  const focos = comDados
    .filter((d) => comDados.length <= 3 || !fortes.includes(d))
    .sort((a, b) => (1 - taxa(b)) * (COTAS_PROVA[b.disciplina] ?? 1) - (1 - taxa(a)) * (COTAS_PROVA[a.disciplina] ?? 1))
    .slice(0, 3);
  return { fortes: fortes.map((d) => d.disciplina), focos: focos.map((d) => d.disciplina) };
}


// Histórico de diagnósticos a partir das tentativas (mais antigo primeiro)
export function diagnosticosDe(tents: TentativaBruta[], disciplinaDo: Map<string, Disciplina>): DiagnosticoResumo[] {
  const grupos = new Map<string, DiagnosticoResumo & { disc: Map<Disciplina, ResultadoDisciplina> }>();
  for (const t of tents) {
    if (!ehDiagnostico(t.simuladoId)) continue;
    const g = grupos.get(t.simuladoId!) ?? { id: t.simuladoId!, data: t.data, total: 0, acertos: 0, porDisciplina: [], disc: new Map() };
    g.total++;
    if (t.acertou) g.acertos++;
    const d = disciplinaDo.get(t.topicoId);
    if (d) {
      const r = g.disc.get(d) ?? { disciplina: d, total: 0, acertos: 0 };
      r.total++;
      if (t.acertou) r.acertos++;
      g.disc.set(d, r);
    }
    if (t.data < g.data) g.data = t.data;
    grupos.set(t.simuladoId!, g);
  }
  return [...grupos.values()]
    .map(({ disc, ...g }) => ({ ...g, porDisciplina: [...disc.values()] }))
    .sort((a, b) => a.data.localeCompare(b.data));
}

// Convida (ou reconvida) para o diagnóstico: nunca feito ou o último tem 30+ dias
export function diagnosticoPendente(ultimo: string | undefined, agora = new Date()) {
  return !ultimo || agora.getTime() - new Date(ultimo).getTime() >= DIAS_PARA_REFAZER * 86_400_000;
}
