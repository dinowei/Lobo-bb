// ============================================================
// BB Estudos — Noturno: fila persistida de tarefas (PROMPT-RETOMADA R2.2; PROMPT-VIAGEM etapa 6)
// Planeja (questões que faltam por tópico + verificação semanal dos modelos) e roda uma por vez.
// Falha de infraestrutura volta para a fila até 3 vezes, com espera crescente (NOTURNO_ESPERAS_MIN);
// descarte só por qualidade, com o motivo. Sobrevive a reinício: tarefa "rodando" de um processo
// que morreu volta para a fila.
// ============================================================
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Types } from "mongoose";
import { Tarefa, Topic, Question, Chunk, Source, Attempt, DISCIPLINAS_COM_FONTE_OBRIGATORIA, type Disciplina } from "./models.js";
import { statusDe, dominioDe } from "../shared/motor.js";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
import { gerarQuestao, MOTIVOS_INFRA, tetoDiario, geracoesHoje } from "./pipeline.js";
import { verificarModelos, verificacaoVencida } from "./sondagem.js";

export const MAX_FALHAS_INFRA = 3;
export const esperasMin = (env: NodeJS.ProcessEnv = process.env) =>
  (env.NOTURNO_ESPERAS_MIN ?? "10,30,90").split(",").map(Number).filter((n) => Number.isFinite(n) && n > 0);
const ORFA_MS = 60 * 60_000; // "rodando" há mais de 1 h: o processo morreu

export type Destino =
  | { status: "concluida" }
  | { status: "descartada"; motivo: string }
  | { status: "aguardando"; tentativas: number; proximaEm: Date; motivo?: string }
  | { status: "esgotada"; tentativas: number; motivo: string };

const amanhaCedo = (agora: Date) => {
  const d = new Date(agora);
  d.setDate(d.getDate() + 1);
  d.setHours(0, 5, 0, 0);
  return d;
};

// Para onde vai a tarefa depois de rodar (puro, testado)
export function destinoDaTarefa(r: { ok: boolean; motivo?: string }, tentativas: number, agora: Date, esperas = esperasMin(), persistente = false): Destino {
  if (r.ok) return { status: "concluida" };
  const motivo = r.motivo ?? "sem_motivo";
  // teto diário não é falha: fica para amanhã, sem gastar tentativa
  if (motivo === "teto_diario") return { status: "aguardando", tentativas, proximaEm: amanhaCedo(agora), motivo };
  if (!MOTIVOS_INFRA.includes(motivo)) return { status: "descartada", motivo };
  const n = tentativas + 1;
  // A correção de redação mantém a tarefa persistida até a IA voltar; os demais jobs têm limite de voltas.
  if (n > MAX_FALHAS_INFRA && !persistente) return { status: "esgotada", tentativas: n, motivo };
  const espera = esperas[Math.min(n - 1, esperas.length - 1)] ?? 10;
  return { status: "aguardando", tentativas: n, proximaEm: new Date(+agora + espera * 60_000), motivo };
}

// ---------- plano da noite (PLANO-MESTRE 5.1 + adendo do banco grande) ----------
export interface TopicoPlano { id: string; assunto: string; disciplina: string; elegivel: boolean }
export interface AlunoPlano {
  respondidas: Map<string, number>; // tópico → questões aprovadas já respondidas
  dominados: Set<string>; // tópicos dominados
  recentes: Set<string>; // tópicos estudados nos últimos 7 dias
}
export interface ItemPlano { topicId: string; assunto: string; motivo: "meta" | "poucas_ineditas" | "dominado"; dificuldade?: number }

// Meta do tópico: meta do banco × cota da disciplina na prova ÷ tópicos da disciplina
export function metaDoTopico(disciplina: string, topicosNaDisciplina: number, cotas: Record<string, number>, total: number, meta: number) {
  return Math.ceil(((meta * (cotas[disciplina] ?? 0)) / total) / Math.max(1, topicosNaDisciplina));
}

export function planoDaNoite(p: {
  topicos: TopicoPlano[];
  aprovadas: Map<string, number>;
  alunos: AlunoPlano[];
  cotas: Record<string, number>;
  totalQuestoes: number;
  metaBanco: number;
  max: number;
}): ItemPlano[] {
  const porDisciplina = new Map<string, number>();
  for (const t of p.topicos) porDisciplina.set(t.disciplina, (porDisciplina.get(t.disciplina) ?? 0) + 1);
  const alunos = p.alunos.length ? p.alunos : [{ respondidas: new Map(), dominados: new Set<string>(), recentes: new Set<string>() }];
  const necessidades: { item: ItemPlano; quantas: number; prioridade: number }[] = [];
  for (const t of p.topicos.filter((x) => x.elegivel)) {
    const meta = metaDoTopico(t.disciplina, porDisciplina.get(t.disciplina) ?? 1, p.cotas, p.totalQuestoes, p.metaBanco);
    if (!meta) continue;
    const aprovadas = p.aprovadas.get(t.id) ?? 0;
    const recente = alunos.some((a) => a.recentes.has(t.id));
    const peso = p.cotas[t.disciplina] ?? 0;
    let item: ItemPlano | null = null;
    let quantas = 0;
    if (aprovadas < meta) {
      item = { topicId: t.id, assunto: t.assunto, motivo: "meta" };
      quantas = meta - aprovadas;
    } else {
      const menosIneditas = Math.min(...alunos.map((a) => aprovadas - (a.respondidas.get(t.id) ?? 0)));
      const piso = Math.ceil(0.2 * meta);
      if (menosIneditas < piso) {
        item = { topicId: t.id, assunto: t.assunto, motivo: "poucas_ineditas" };
        quantas = piso - menosIneditas;
      } else if (alunos.some((a) => a.dominados.has(t.id))) {
        item = { topicId: t.id, assunto: t.assunto, motivo: "dominado", dificuldade: 4 };
        quantas = 2;
      }
    }
    if (!item) continue;
    if (item.motivo !== "meta" && alunos.some((a) => a.dominados.has(t.id))) item.dificuldade = 4;
    // estudado nos últimos 7 dias > peso na prova > tamanho da falta
    const prioridade = (recente ? 1000 : 0) + peso * 10 + Math.min(9, (quantas / meta) * 10);
    necessidades.push({ item, quantas, prioridade });
  }
  necessidades.sort((a, b) => b.prioridade - a.prioridade);
  // rodízio: uma por tópico por volta, na ordem de prioridade
  const saida: ItemPlano[] = [];
  for (let volta = 0; saida.length < p.max && necessidades.some((n) => n.quantas > volta); volta++)
    for (const n of necessidades) {
      if (saida.length >= p.max) break;
      if (n.quantas > volta) saida.push(n.item.motivo === "dominado" ? { ...n.item, dificuldade: 4 + (volta % 2) } : n.item);
    }
  return saida;
}

// Tarefas "rodando" de processo morto voltam para a fila
export async function recuperarOrfas(agora = new Date()) {
  const r = await Tarefa.updateMany({ status: "rodando", iniciadaEm: { $lt: new Date(+agora - ORFA_MS) } }, { status: "pendente", proximaEm: agora });
  return r.modifiedCount;
}

// Plano da noite: meta do banco por disciplina e tópico (data/estrutura-prova.json), até
// GERACAO_MAX_TENTATIVAS_NOITE tarefas. Tópico que exige fonte e não tem trecho, ou que espera
// a liberação de uma fonte pelo dono, fica fora da conta.
export async function planejarNoite(lote: string, opcoes: { max?: number } = {}) {
  const estrutura = JSON.parse(await readFile(join(RAIZ, "data", "estrutura-prova.json"), "utf8")) as {
    totalQuestoes: number; metaBanco: number; cotas: Record<string, number>; esperamLiberacao: Record<string, string[]>;
  };
  const max = opcoes.max ?? (Number(process.env.GERACAO_MAX_TENTATIVAS_NOITE) || Number(process.env.GERACAO_MAX_NOITE) || 200);
  const seteDias = new Date(Date.now() - 7 * 86_400_000);
  const [topicos, aprovadas, abertas, comTrecho, fontes, tentativas] = await Promise.all([
    Topic.find({ ativo: true }).select("assunto disciplina volatil").lean(),
    Question.aggregate<{ _id: Types.ObjectId; n: number }>([{ $match: { status: "aprovada" } }, { $group: { _id: "$topicId", n: { $sum: 1 } } }]),
    Tarefa.aggregate<{ _id: string; n: number }>([
      { $match: { tipo: "gerar", status: { $in: ["pendente", "rodando", "aguardando"] } } },
      { $group: { _id: "$params.topicId", n: { $sum: 1 } } },
    ]),
    Chunk.distinct("topicIds", { revogada: false }),
    Source.find({ revogada: false }).select("titulo").lean(),
    Attempt.aggregate<{ _id: { u: Types.ObjectId; t: Types.ObjectId }; questoes: Types.ObjectId[]; n: number; acertos: number; ultima: Date }>([
      { $group: { _id: { u: "$userId", t: "$topicId" }, questoes: { $addToSet: "$questionId" }, n: { $sum: 1 }, acertos: { $sum: { $cond: ["$acertou", 1, 0] } }, ultima: { $max: "$createdAt" } } },
    ]),
  ]);
  const temTrecho = new Set(comTrecho.map(String));
  const liberadas = (titulo: string) => fontes.some((f) => f.titulo.startsWith(titulo));
  const bloqueados = new Set(Object.entries(estrutura.esperamLiberacao).filter(([fonte]) => !liberadas(fonte)).flatMap(([, ts]) => ts));
  const abertasPor = new Map(abertas.map((a) => [String(a._id), a.n]));
  // tarefas já abertas contam como se fossem aprovar: não pede duas vezes a mesma falta
  const aprovadasPor = new Map(aprovadas.map((a) => [String(a._id), a.n]));
  for (const [t, n] of abertasPor) aprovadasPor.set(t, (aprovadasPor.get(t) ?? 0) + n);
  const alunos = new Map<string, AlunoPlano>();
  for (const x of tentativas) {
    const u = String(x._id.u);
    const a = alunos.get(u) ?? { respondidas: new Map(), dominados: new Set<string>(), recentes: new Set<string>() };
    const t = String(x._id.t);
    a.respondidas.set(t, x.questoes.length);
    if (statusDe(x.n, dominioDe(x.n, x.acertos)) === "dominado") a.dominados.add(t);
    if (+x.ultima >= +seteDias) a.recentes.add(t);
    alunos.set(u, a);
  }
  const itens = planoDaNoite({
    topicos: topicos.map((t) => ({
      id: String(t._id),
      assunto: t.assunto,
      disciplina: t.disciplina,
      elegivel:
        !bloqueados.has(t.assunto) &&
        (!(t.volatil || DISCIPLINAS_COM_FONTE_OBRIGATORIA.includes(t.disciplina as Disciplina)) || temTrecho.has(String(t._id))),
    })),
    aprovadas: aprovadasPor,
    alunos: [...alunos.values()],
    cotas: estrutura.cotas,
    totalQuestoes: estrutura.totalQuestoes,
    metaBanco: Number(process.env.META_BANCO) || estrutura.metaBanco,
    max,
  });
  const novas = itens.map((i) => ({ tipo: "gerar" as const, params: i, lote }));
  if (await verificacaoVencida()) await Tarefa.create({ tipo: "verificar_modelos", lote });
  if (novas.length) await Tarefa.insertMany(novas);
  return novas.length;
}

type Resultado = { ok: boolean; motivo?: string; detalhes?: string; resultadoId?: Types.ObjectId };
// tarefas de "depois das questões" (adendo, item 4): ganchos registrados por quem implementa
export const pregeracoes: Record<string, (params: unknown, preferir?: string) => Promise<Resultado>> = {};

async function executar(t: { tipo: string; params?: unknown }, preferirGerador?: string): Promise<Resultado> {
  if (t.tipo === "gerar") {
    const p = t.params as ItemPlano;
    const r = await gerarQuestao(p.topicId, p.dificuldade ?? 1 + Math.floor(Math.random() * 5), { preferirGerador, noturno: true });
    return r.ok ? { ok: true, resultadoId: r.questionId } : { ok: false, motivo: r.motivo, detalhes: r.detalhes?.join(" | ").slice(0, 500) };
  }
  if (t.tipo === "verificar_modelos") {
    const r = await verificarModelos();
    return { ok: true, detalhes: `${r.filter((x) => x.http === 200 && x.json).length}/${r.length} modelos responderam` };
  }
  const gancho = pregeracoes[t.tipo];
  if (gancho) return gancho(t.params, preferirGerador);
  return { ok: false, motivo: `tipo_desconhecido:${t.tipo}` };
}

// Trava por tópico entre os trabalhadores do mesmo processo: nunca dois no mesmo tópico
export class TravaTopicos {
  private ocupados = new Set<string>();
  get lista() {
    return [...this.ocupados];
  }
  get vazia() {
    return !this.ocupados.size;
  }
  pegar(topico: string): boolean {
    if (this.ocupados.has(topico)) return false;
    this.ocupados.add(topico);
    return true;
  }
  soltar(topico: string) {
    this.ocupados.delete(topico);
  }
}

export interface ResumoNoite { rodadas: number; concluidas: number; aprovadas: number; descartadas: number; aguardando: number; esgotadas: number; orfas: number }

// Roda a fila com até NOTURNO_TRABALHADORES (padrão 3) ao mesmo tempo, dentro de UM job:
// nunca dois no mesmo tópico, cada um começando por um gerador diferente da corrente.
// Para no que vier primeiro: META_APROVADAS_NOITE (100), "max" tarefas ou o fim da janela ("ate").
// Com "ate", espera a próxima que estiver aguardando nova tentativa, se couber na janela.
export async function rodarFila(opcoes: { ate?: Date; max?: number; trabalhadores?: number; metaAprovadas?: number; geradores?: string[]; tarefaIds?: string[] } = {}) {
  const n = Math.max(1, opcoes.trabalhadores ?? (Number(process.env.NOTURNO_TRABALHADORES) || 3));
  const metaAprovadas = opcoes.metaAprovadas ?? (Number(process.env.META_APROVADAS_NOITE) || 100);
  const geradores = opcoes.geradores ?? [];
  const resumo: ResumoNoite = { rodadas: 0, concluidas: 0, aprovadas: 0, descartadas: 0, aguardando: 0, esgotadas: 0, orfas: await recuperarOrfas() };
  const trava = new TravaTopicos();
  const acabou = () =>
    (opcoes.max !== undefined && resumo.rodadas >= opcoes.max) || resumo.aprovadas >= metaAprovadas || (!!opcoes.ate && Date.now() >= +opcoes.ate);

  const pegar = async () => {
    const t = await Tarefa.findOneAndUpdate(
      {
        status: { $in: ["pendente", "aguardando"] },
        proximaEm: { $lte: new Date() },
        $nor: [{ tipo: "gerar", "params.topicId": { $in: trava.lista } }],
        ...(opcoes.tarefaIds ? { _id: { $in: opcoes.tarefaIds.map((id) => new Types.ObjectId(id)) } } : {}),
      },
      { status: "rodando", iniciadaEm: new Date() },
      { sort: { proximaEm: 1, createdAt: 1 }, new: true }
    );
    const topico = t?.tipo === "gerar" ? String((t.params as ItemPlano).topicId) : null;
    if (t && topico && !trava.pegar(topico)) {
      // outro trabalhador pegou o mesmo tópico entre a consulta e agora: devolve
      await Tarefa.updateOne({ _id: t._id }, { status: "pendente" });
      return { t: null, topico: null, devolveu: true };
    }
    return { t, topico, devolveu: false };
  };

  const trabalhador = async (k: number) => {
    const preferir = geradores.length ? geradores[k % geradores.length] : undefined;
    while (!acabou()) {
      const { t, topico, devolveu } = await pegar();
      if (devolveu) continue;
      if (!t) {
        const proxima = opcoes.ate ? await Tarefa.findOne({ status: "aguardando", proximaEm: { $lt: opcoes.ate } }).sort({ proximaEm: 1 }).lean() : null;
        // fila vazia agora: com outros trabalhando, espera um pouco (podem liberar tópico); sem nada, encerra
        if (!proxima && trava.vazia) return;
        await new Promise((ok) => setTimeout(ok, proxima ? Math.min(30 * 60_000, Math.max(5_000, +proxima.proximaEm - Date.now())) : 5_000));
        continue;
      }
      resumo.rodadas++;
      let r: Resultado;
      try {
        r = await executar(t, preferir);
      } catch (e) {
        r = { ok: false, motivo: "erro_inesperado", detalhes: String(e instanceof Error ? e.message : e).slice(0, 500) };
      } finally {
        if (topico) trava.soltar(topico);
      }
      const d = destinoDaTarefa(r, t.tentativas ?? 0, new Date(), undefined, t.tipo === "corrigir_redacao");
      await Tarefa.updateOne({ _id: t._id }, { ...d, detalhes: r.detalhes, resultadoId: r.resultadoId });
      const chave = ({ concluida: "concluidas", descartada: "descartadas", aguardando: "aguardando", esgotada: "esgotadas" } as const)[d.status];
      resumo[chave]++;
      if (t.tipo === "gerar" && d.status === "concluida") resumo.aprovadas++;
      console.log(`[${k + 1}] ${d.status === "concluida" ? "✔" : d.status === "aguardando" ? "↻" : "✖"} ${t.tipo} ${(t.params as { assunto?: string } | undefined)?.assunto ?? ""} → ${d.status}${"motivo" in d && d.motivo ? ` (${d.motivo})` : ""}`);
    }
  };
  await Promise.all(Array.from({ length: n }, (_, k) => trabalhador(k)));
  return resumo;
}

// Botão "tentar de novo agora" (tela Fila): tarefa aguardando/esgotada volta já para a fila
export async function tentarDeNovoAgora(id: string) {
  const r = await Tarefa.updateOne({ _id: id, status: { $in: ["aguardando", "esgotada"] } }, { status: "pendente", proximaEm: new Date(), tentativas: 0 });
  return r.modifiedCount === 1;
}
