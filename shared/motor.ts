// ============================================================
// Motor de progressão — funções puras usadas pelo servidor E pelo modo demo.
// Mudou uma regra aqui, muda nos dois lados.
// ============================================================
import {
  DISCIPLINAS,
  NOME_DISCIPLINA,
  type BancoDTO,
  type Confianca,
  type Conquista,
  type Disciplina,
  type DisciplinaProgresso,
  type Modo,
  type Nivel,
  type PainelDTO,
  type TentativaBruta,
  type TopicoDTO,
  type TopicoProgresso,
} from "./tipos.js";

export const FUSO = "America/Sao_Paulo";
const DIA_MS = 86_400_000;
export const PESO_PADRAO = 5;

// ------------------------------------------------------------
// Datas no fuso de Brasília ("2026-10-14")
// ------------------------------------------------------------
const fmtDia = new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" });
export const diaDe = (d: Date | string) => fmtDia.format(typeof d === "string" ? new Date(d) : d);
const somarDias = (dia: string, n: number) => {
  const d = new Date(`${dia}T12:00:00Z`);
  return new Date(d.getTime() + n * DIA_MS).toISOString().slice(0, 10);
};

// ------------------------------------------------------------
// Revisão espaçada (SM-2)
// ------------------------------------------------------------
export interface EstadoRevisao {
  facilidade: number;
  intervaloDias: number;
  repeticoes: number;
}
export const ESTADO_INICIAL: EstadoRevisao = { facilidade: 2.5, intervaloDias: 0, repeticoes: 0 };

// Acerto chutado conta quase como erro: sorte não é domínio
export const notaSM2 = (acertou: boolean, confianca: Confianca) =>
  !acertou ? 1 : confianca === 1 ? 2 : confianca === 2 ? 4 : 5;

export function agendar(estado: EstadoRevisao, nota: number): EstadoRevisao {
  const s = { ...estado };
  if (nota < 3) {
    s.repeticoes = 0;
    s.intervaloDias = 1; // errou → volta amanhã
  } else {
    s.repeticoes += 1;
    s.intervaloDias = s.repeticoes === 1 ? 1 : s.repeticoes === 2 ? 3 : Math.round(s.intervaloDias * s.facilidade);
  }
  s.facilidade = Math.max(1.3, s.facilidade + (0.1 - (5 - nota) * (0.08 + (5 - nota) * 0.02)));
  return s;
}

// ------------------------------------------------------------
// XP e níveis
// ------------------------------------------------------------
export function xpDaTentativa(p: { acertou: boolean; dificuldade: number; confianca: Confianca; modo: Modo }): number {
  if (!p.acertou) return 2; // tentar também conta
  let xp = 6 + 2 * Math.min(5, Math.max(1, p.dificuldade)); // 8 a 16
  if (p.confianca === 1) xp = Math.round(xp / 2); // chute certo vale metade
  if (p.modo === "revisao") xp += 3; // revisão em dia
  return xp;
}

const TITULOS: [number, string][] = [
  [1, "Candidato"],
  [3, "Concurseiro"],
  [6, "Escriturário"],
  [10, "Agente Comercial"],
  [15, "Assistente de Negócios"],
  [20, "Gerente de Relacionamento"],
  [27, "Gerente Geral"],
  [35, "Superintendente"],
];
const xpParaSubir = (n: number) => 100 + 50 * (n - 1); // nível n → n+1

export function nivelDe(xp: number): Nivel {
  let n = 1;
  let resto = xp;
  while (resto >= xpParaSubir(n)) {
    resto -= xpParaSubir(n);
    n++;
  }
  const titulo = [...TITULOS].reverse().find(([min]) => n >= min)?.[1] ?? "Candidato";
  return { numero: n, titulo, xpNoNivel: resto, xpParaProximo: xpParaSubir(n) };
}

// ------------------------------------------------------------
// Domínio de tópico (últimas 20 tentativas, suavizado)
// ------------------------------------------------------------
export const JANELA_DOMINIO = 20;
export const dominioDe = (tentativas: number, acertos: number) => (acertos + 1) / (tentativas + 2);
export function statusDe(tentativas: number, dominio: number): TopicoProgresso["status"] {
  if (tentativas === 0) return "novo";
  return tentativas >= 8 && dominio >= 0.8 ? "dominado" : "andamento";
}

// Prioridade de estudo = peso no edital × fraqueza. Tópico novo parte de 50%.
export const prioridade = (peso: number | null, tentativas: number, acertos: number) =>
  (peso ?? PESO_PADRAO) * (1 - (tentativas ? dominioDe(tentativas, acertos) : 0.5));

export function sortearPonderado<T>(itens: T[], peso: (t: T) => number): T | undefined {
  const soma = itens.reduce((s, x) => s + Math.max(0, peso(x)), 0);
  if (soma <= 0) return itens[Math.floor(Math.random() * itens.length)];
  let r = Math.random() * soma;
  return itens.find((x) => (r -= Math.max(0, peso(x))) <= 0) ?? itens[itens.length - 1];
}

// Quantas questões de cada disciplina num simulado de n questões (proporcional ao edital)
export function cotasPorDisciplina(n: number, topicos: TopicoDTO[]): Map<Disciplina, number> {
  const pesos = new Map<Disciplina, number>();
  for (const t of topicos) pesos.set(t.disciplina, (pesos.get(t.disciplina) ?? 0) + (t.peso ?? PESO_PADRAO));
  const soma = [...pesos.values()].reduce((a, b) => a + b, 0) || 1;
  const brutas = [...pesos].map(([d, p]) => ({ d, v: (n * p) / soma }));
  const cotas = new Map(brutas.map((b) => [b.d, Math.floor(b.v)]));
  let faltam = n - [...cotas.values()].reduce((a, b) => a + b, 0);
  for (const b of [...brutas].sort((x, y) => (y.v % 1) - (x.v % 1))) {
    if (faltam-- <= 0) break;
    cotas.set(b.d, (cotas.get(b.d) ?? 0) + 1);
  }
  return cotas;
}

// ------------------------------------------------------------
// Painel completo a partir dos dados crus
// ------------------------------------------------------------
export function calcularPainel(input: {
  topicos: TopicoDTO[];
  tentativas: TentativaBruta[];
  revisoes: string[]; // datas ISO de próxima revisão
  agora?: Date;
}): PainelDTO {
  const agora = input.agora ?? new Date();
  const hoje = diaDe(agora);
  const tents = [...input.tentativas].sort((a, b) => a.data.localeCompare(b.data));

  // XP e sequência de dias
  const xp = tents.reduce((s, t) => s + t.xp, 0);
  const dias = new Set(tents.map((t) => diaDe(t.data)));
  let sequenciaDias = 0;
  let cursor = dias.has(hoje) ? hoje : somarDias(hoje, -1);
  while (dias.has(cursor)) {
    sequenciaDias++;
    cursor = somarDias(cursor, -1);
  }

  const seteDiasAtras = somarDias(hoje, -6);
  const daSemana = tents.filter((t) => diaDe(t.data) >= seteDiasAtras);

  // progresso por tópico (janela recente)
  const porTopico = new Map<string, TentativaBruta[]>();
  for (const t of tents) porTopico.set(t.topicoId, [...(porTopico.get(t.topicoId) ?? []), t]);
  const topicos: TopicoProgresso[] = input.topicos.map((tp) => {
    const lista = porTopico.get(tp.id) ?? [];
    const recentes = lista.slice(-JANELA_DOMINIO);
    const acertosRec = recentes.filter((t) => t.acertou).length;
    const dominio = recentes.length ? dominioDe(recentes.length, acertosRec) : 0;
    return {
      ...tp,
      tentativas: lista.length,
      acertos: lista.filter((t) => t.acertou).length,
      dominio,
      status: statusDe(recentes.length, dominio),
    };
  });

  const disciplinas: DisciplinaProgresso[] = DISCIPLINAS.map((d) => {
    const ts = topicos.filter((t) => t.disciplina === d);
    const dominados = ts.filter((t) => t.status === "dominado").length;
    return {
      disciplina: d,
      nome: NOME_DISCIPLINA[d],
      topicos: ts.length,
      dominados,
      tentativas: ts.reduce((s, t) => s + t.tentativas, 0),
      acertos: ts.reduce((s, t) => s + t.acertos, 0),
      progresso: ts.length ? dominados / ts.length : 0,
    };
  }).filter((d) => d.topicos > 0);

  // revisões: vencidas entram em "hoje"
  const revisoesPorDia = Array.from({ length: 7 }, (_, i) => ({ dia: somarDias(hoje, i), total: 0 }));
  for (const r of input.revisoes) {
    const d = diaDe(r);
    const alvo = d <= hoje ? revisoesPorDia[0] : revisoesPorDia.find((x) => x.dia === d);
    if (alvo) alvo.total++;
  }

  // simulados
  const sims = new Map<string, { data: string; total: number; acertos: number }>();
  for (const t of tents) {
    if (t.modo !== "simulado" || !t.simuladoId) continue;
    const s = sims.get(t.simuladoId) ?? { data: t.data, total: 0, acertos: 0 };
    s.total++;
    if (t.acertou) s.acertos++;
    sims.set(t.simuladoId, s);
  }
  const simulados = [...sims].map(([id, s]) => ({ id, ...s })).sort((a, b) => b.data.localeCompare(a.data));

  // conquistas
  let seqAcertos = 0;
  let maxSeqAcertos = 0;
  for (const t of tents) {
    seqAcertos = t.acertou ? seqAcertos + 1 : 0;
    maxSeqAcertos = Math.max(maxSeqAcertos, seqAcertos);
  }
  const totalDominados = topicos.filter((t) => t.status === "dominado").length;
  const melhorDisciplina = Math.max(0, ...disciplinas.map((d) => d.progresso));
  const melhorSimulado = Math.max(0, ...simulados.filter((s) => s.total >= 10).map((s) => s.acertos / s.total));
  const revisoesFeitas = tents.filter((t) => t.modo === "revisao").length;

  const meta = (id: string, titulo: string, descricao: string, valor: number, alvo: number): Conquista => ({
    id,
    titulo,
    descricao,
    obtida: valor >= alvo,
    progresso: Math.min(1, valor / alvo),
  });
  const conquistas: Conquista[] = [
    meta("primeira", "Primeiro passo", "Responda sua primeira questão", tents.length, 1),
    meta("q50", "Aquecimento", "Responda 50 questões", tents.length, 50),
    meta("q100", "Centena", "Responda 100 questões", tents.length, 100),
    meta("q500", "Maratonista", "Responda 500 questões", tents.length, 500),
    meta("q1000", "Mil na conta", "Responda 1.000 questões", tents.length, 1000),
    meta("seq3", "Constância", "Estude 3 dias seguidos", sequenciaDias, 3),
    meta("seq7", "Semana cheia", "Estude 7 dias seguidos", sequenciaDias, 7),
    meta("seq30", "Mês de ferro", "Estude 30 dias seguidos", sequenciaDias, 30),
    meta("acertos10", "Mão quente", "Acerte 10 questões em sequência", maxSeqAcertos, 10),
    meta("dom1", "Primeiro domínio", "Domine um tópico (80% nas últimas questões)", totalDominados, 1),
    meta("dom10", "Dez tópicos", "Domine 10 tópicos", totalDominados, 10),
    meta("disciplina", "Disciplina fechada", "Domine todos os tópicos de uma disciplina", melhorDisciplina, 1),
    meta("rev50", "Faro de lobo", "Faça 50 revisões em dia", revisoesFeitas, 50),
    meta("sim1", "Primeiro simulado", "Termine um simulado", simulados.length, 1),
    meta("sim70", "Nota de corte", "Tire 70% num simulado de 10+ questões", melhorSimulado, 0.7),
  ];

  return {
    xp,
    nivel: nivelDe(xp),
    sequenciaDias,
    respondeuHoje: tents.filter((t) => diaDe(t.data) === hoje).length,
    semana: { respondidas: daSemana.length, acertos: daSemana.filter((t) => t.acertou).length },
    revisoesHoje: revisoesPorDia[0].total,
    revisoesPorDia,
    disciplinas,
    topicos,
    conquistas,
    simulados,
    totalRespondidas: tents.length,
  };
}

// ------------------------------------------------------------
// Cartão "Banco de questões": aprovadas (oficiais contam), inéditas para o aluno e as geradas
// desde o começo da última noite (18 h de Brasília). Nada de IA no texto para o aluno.
// ------------------------------------------------------------
const fmtHora = new Intl.DateTimeFormat("en-US", { timeZone: FUSO, hour: "numeric", hourCycle: "h23" });
export function inicioDaNoite(agora: Date = new Date()): Date {
  const hoje = diaDe(agora);
  const dia = Number(fmtHora.format(agora)) >= 18 ? hoje : somarDias(hoje, -1);
  return new Date(`${dia}T18:00:00-03:00`); // Brasília não tem horário de verão desde 2019
}

export function calcularBanco(
  questoes: { id: string; disciplina: Disciplina; gerada: boolean; criadaEm: string }[],
  respondidas: Set<string>,
  agora: Date = new Date()
): BancoDTO {
  const desde = +inicioDaNoite(agora);
  const por = new Map<Disciplina, { total: number; ineditas: number }>();
  let estaNoite = 0;
  for (const q of questoes) {
    const d = por.get(q.disciplina) ?? { total: 0, ineditas: 0 };
    d.total++;
    if (!respondidas.has(q.id)) d.ineditas++;
    por.set(q.disciplina, d);
    if (q.gerada && Date.parse(q.criadaEm) >= desde) estaNoite++;
  }
  const porDisciplina = DISCIPLINAS.filter((d) => por.has(d)).map((d) => ({ disciplina: d, ...por.get(d)! }));
  return { total: questoes.length, ineditas: porDisciplina.reduce((s, d) => s + d.ineditas, 0), estaNoite, porDisciplina };
}
