// ============================================================
// API do MODO DEMO — roda 100% no navegador, guarda o progresso no localStorage.
// Usa o mesmo motor (shared/motor.ts) que o servidor.
// ============================================================
import topicosJson from "../../../data/topicos.json";
import {
  DISCIPLINAS,
  type Api,
  type CorrecaoDTO,
  type Disciplina,
  type Letra,
  type MotivoContestacao,
  type QuestaoDTO,
  type TentativaBruta,
  type TopicoDTO,
} from "../../../shared/tipos";
import {
  ESTADO_INICIAL,
  agendar,
  calcularPainel,
  calcularBanco,
  cotasPorDisciplina,
  notaSM2,
  prioridade,
  sortearPonderado,
  xpDaTentativa,
  type EstadoRevisao,
} from "../../../shared/motor";
import { QUESTOES_DEMO, type QuestaoDemo } from "../demo/questoes";

const CHAVE = "lobo-demo-v1";
const slug = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const TOPICOS: TopicoDTO[] = Object.entries(
  (topicosJson as { disciplinas: Record<string, { assunto: string; subtopicos?: string[]; questoesNaProva?: number | null }[]> }).disciplinas
)
  .filter(([d]) => (DISCIPLINAS as readonly string[]).includes(d))
  .flatMap(([d, lista]) =>
    lista.map((t) => ({
      id: `${d}:${slug(t.assunto)}`,
      disciplina: d as Disciplina,
      assunto: t.assunto,
      subtopicos: t.subtopicos ?? [],
      peso: t.questoesNaProva ?? null,
    }))
  );
const topicoDe = (q: QuestaoDemo) => `${q.disciplina}:${slug(q.assunto)}`;
const porId = new Map(QUESTOES_DEMO.map((q) => [q.id, q]));

interface Estado {
  tentativas: TentativaBruta[];
  revisoes: Record<string, EstadoRevisao & { proxima: string }>;
  contestadas: string[];
}
const vazio = (): Estado => ({ tentativas: [], revisoes: {}, contestadas: [] });

function ler(): Estado {
  try {
    const bruto = localStorage.getItem(CHAVE);
    return bruto ? { ...vazio(), ...JSON.parse(bruto) } : vazio();
  } catch {
    return memoria;
  }
}
let memoria: Estado = vazio(); // fallback quando o navegador bloqueia o localStorage
function gravar(e: Estado) {
  memoria = e;
  try {
    localStorage.setItem(CHAVE, JSON.stringify(e));
  } catch {
    /* segue só em memória */
  }
}
export function zerarDemo() {
  gravar(vazio());
}

function paraDTO(q: QuestaoDemo): QuestaoDTO {
  return {
    id: q.id,
    topicoId: topicoDe(q),
    disciplina: q.disciplina,
    assunto: q.assunto,
    origem: "gerada",
    textoBase: q.textoBase,
    enunciado: q.enunciado,
    alternativas: q.alternativas.map(({ letra, texto }) => ({ letra, texto })),
    dificuldade: q.dificuldade,
  };
}

function correcao(q: QuestaoDemo, resposta: Letra | null, xpGanho: number, dias: number): CorrecaoDTO {
  return {
    acertou: resposta === q.gabarito,
    gabarito: q.gabarito,
    alternativas: q.alternativas.map((a) => ({ ...a, correta: a.letra === q.gabarito })),
    explicacaoGeral: q.explicacaoGeral,
    dicaDeProva: q.dicaDeProva,
    fontes: q.fontes,
    traicoeira: !!q.traicoeira,
    xpGanho,
    proximaRevisaoDias: dias,
  };
}

function registrar(e: Estado, q: QuestaoDemo, acertou: boolean, nota: number, xp: number, modo: TentativaBruta["modo"], simuladoId?: string) {
  const agora = new Date();
  e.tentativas.push({ questaoId: q.id, topicoId: topicoDe(q), acertou, xp, modo, simuladoId, data: agora.toISOString() });
  const novo = agendar(e.revisoes[q.id] ?? ESTADO_INICIAL, nota);
  e.revisoes[q.id] = { ...novo, proxima: new Date(agora.getTime() + novo.intervaloDias * 86_400_000).toISOString() };
  return novo.intervaloDias;
}

const espera = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 120));

export const apiDemo: Api = {
  modo: "demo",

  topicos: () => espera(TOPICOS),

  painel: () => {
    const e = ler();
    const painel = calcularPainel({ topicos: TOPICOS, tentativas: e.tentativas, revisoes: Object.values(e.revisoes).map((r) => r.proxima) });
    // cartão "Banco de questões" com a mesma regra do servidor (no demo nada entra de noite)
    const banco = calcularBanco(
      QUESTOES_DEMO.filter((q) => !e.contestadas.includes(q.id)).map((q) => ({ id: q.id, disciplina: q.disciplina, gerada: false, criadaEm: "2026-01-01T00:00:00Z" })),
      new Set(e.tentativas.map((t) => t.questaoId))
    );
    return espera({ ...painel, banco });
  },

  async proxima(f) {
    const e = ler();
    const ativas = QUESTOES_DEMO.filter((q) => !e.contestadas.includes(q.id));

    if (f.questaoId) {
      const q = porId.get(f.questaoId);
      return espera({ questao: q ? paraDTO(q) : null, modo: "treino" as const });
    }

    // 1. revisões vencidas (no modo geral ou quando pedidas)
    const semFiltro = !f.topicoId && !f.disciplina;
    if (f.revisao || semFiltro) {
      const agora = Date.now();
      const vencidas = ativas
        .filter((q) => e.revisoes[q.id] && new Date(e.revisoes[q.id].proxima).getTime() <= agora)
        .sort((a, b) => e.revisoes[a.id].proxima.localeCompare(e.revisoes[b.id].proxima));
      if (vencidas.length) return espera({ questao: paraDTO(vencidas[0]), modo: "revisao" as const });
      if (f.revisao) return espera({ questao: null, modo: "revisao" as const, aviso: "Nenhuma revisão vencida agora. Volte amanhã ou pratique um tópico novo." });
    }

    // 2. tópico ponderado (peso × fraqueza) entre os que têm questões
    const candidatas = ativas.filter(
      (q) => (!f.topicoId || topicoDe(q) === f.topicoId) && (!f.disciplina || q.disciplina === f.disciplina)
    );
    if (!candidatas.length)
      return espera({
        questao: null,
        modo: "treino" as const,
        aviso: "O modo demo ainda não tem questões de exemplo deste tópico. Com o servidor ligado, o banco ganha questões dele toda noite.",
      });

    const respondidas = new Set(e.tentativas.map((t) => t.questaoId));
    const naoVistas = candidatas.filter((q) => !respondidas.has(q.id));
    const pool = naoVistas.length ? naoVistas : candidatas;
    const stats = (tid: string) => {
      const ts = e.tentativas.filter((t) => t.topicoId === tid);
      return [ts.length, ts.filter((t) => t.acertou).length] as const;
    };
    const topicosPool = [...new Set(pool.map(topicoDe))];
    const tid = sortearPonderado(topicosPool, (id) => {
      const tp = TOPICOS.find((t) => t.id === id);
      const [n, a] = stats(id);
      return prioridade(tp?.peso ?? null, n, a);
    })!;
    const daqui = pool.filter((q) => topicoDe(q) === tid);
    const q = daqui[Math.floor(Math.random() * daqui.length)];
    return espera({
      questao: paraDTO(q),
      modo: "treino" as const,
      aviso: naoVistas.length ? undefined : "Você já viu todas as questões de exemplo deste filtro; repetindo as que valem mais. No modo servidor, sempre há questão nova.",
    });
  },

  async responder(r) {
    const e = ler();
    const q = porId.get(r.questaoId);
    if (!q) throw new Error("Questão não encontrada");
    const acertou = r.resposta === q.gabarito;
    const xp = xpDaTentativa({ acertou, dificuldade: q.dificuldade, confianca: r.confianca, modo: r.modo });
    const dias = registrar(e, q, acertou, notaSM2(acertou, r.confianca), xp, r.modo);
    gravar(e);
    return espera(correcao(q, r.resposta, xp, dias));
  },

  async simulado(n) {
    const e = ler();
    const ativas = QUESTOES_DEMO.filter((q) => !e.contestadas.includes(q.id));
    const comQuestao = TOPICOS.filter((t) => ativas.some((q) => topicoDe(q) === t.id));
    const cotas = cotasPorDisciplina(Math.min(n, ativas.length), comQuestao);
    const escolhidas: QuestaoDemo[] = [];
    for (const [d, k] of cotas) {
      const daDisc = ativas.filter((q) => q.disciplina === d).sort(() => Math.random() - 0.5);
      escolhidas.push(...daDisc.slice(0, k));
    }
    const resto = ativas.filter((q) => !escolhidas.includes(q)).sort(() => Math.random() - 0.5);
    while (escolhidas.length < Math.min(n, ativas.length) && resto.length) escolhidas.push(resto.pop()!);
    return espera(escolhidas.map(paraDTO));
  },

  async corrigirSimulado(respostas) {
    const e = ler();
    const simuladoId = `sim-${Date.now()}`;
    let acertos = 0;
    let xpTotal = 0;
    const porDisc = new Map<Disciplina, { total: number; acertos: number }>();
    const correcoes = respostas.map((r) => {
      const q = porId.get(r.questaoId)!;
      const acertou = r.resposta === q.gabarito;
      const xp = xpDaTentativa({ acertou, dificuldade: q.dificuldade, confianca: 2, modo: "simulado" });
      const dias = registrar(e, q, acertou, notaSM2(acertou, 2), xp, "simulado", simuladoId);
      if (acertou) acertos++;
      xpTotal += xp;
      const d = porDisc.get(q.disciplina) ?? { total: 0, acertos: 0 };
      d.total++;
      if (acertou) d.acertos++;
      porDisc.set(q.disciplina, d);
      return { ...correcao(q, r.resposta, xp, dias), questaoId: q.id, enunciado: q.enunciado, resposta: r.resposta };
    });
    gravar(e);
    return espera({
      simuladoId,
      total: respostas.length,
      acertos,
      xpGanho: xpTotal,
      porDisciplina: [...porDisc].map(([disciplina, v]) => ({ disciplina, ...v })),
      correcoes,
    });
  },

  async erros() {
    const e = ler();
    const porQ = new Map<string, TentativaBruta[]>();
    for (const t of e.tentativas) porQ.set(t.questaoId, [...(porQ.get(t.questaoId) ?? []), t]);
    const lista = [...porQ]
      .filter(([, ts]) => !ts[ts.length - 1].acertou)
      .map(([id, ts]) => {
        const q = porId.get(id)!;
        return {
          questaoId: id,
          disciplina: q.disciplina,
          assunto: q.assunto,
          enunciado: q.enunciado,
          vezesErrada: ts.filter((t) => !t.acertou).length,
          ultimaData: ts[ts.length - 1].data,
        };
      })
      .sort((a, b) => b.ultimaData.localeCompare(a.ultimaData));
    return espera(lista);
  },

  async contestar(questaoId: string, _motivo: MotivoContestacao) {
    const e = ler();
    if (!e.contestadas.includes(questaoId)) e.contestadas.push(questaoId);
    gravar(e);
    return espera(undefined);
  },
};
