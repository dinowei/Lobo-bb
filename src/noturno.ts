// ============================================================
// BB Estudos — Noturno: fila persistida de tarefas (PROMPT-RETOMADA R2.2; PROMPT-VIAGEM etapa 6)
// Planeja (questões que faltam por tópico + verificação semanal dos modelos) e roda uma por vez.
// Falha de infraestrutura volta para a fila até 3 vezes, com espera crescente (NOTURNO_ESPERAS_MIN);
// descarte só por qualidade, com o motivo. Sobrevive a reinício: tarefa "rodando" de um processo
// que morreu volta para a fila.
// ============================================================
import { Types } from "mongoose";
import { Tarefa, Topic, Question, Chunk, DISCIPLINAS_COM_FONTE_OBRIGATORIA, type Disciplina } from "./models.js";
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
export function destinoDaTarefa(r: { ok: boolean; motivo?: string }, tentativas: number, agora: Date, esperas = esperasMin()): Destino {
  if (r.ok) return { status: "concluida" };
  const motivo = r.motivo ?? "sem_motivo";
  // teto diário não é falha: fica para amanhã, sem gastar tentativa
  if (motivo === "teto_diario") return { status: "aguardando", tentativas, proximaEm: amanhaCedo(agora), motivo };
  if (!MOTIVOS_INFRA.includes(motivo)) return { status: "descartada", motivo };
  const n = tentativas + 1;
  if (n > MAX_FALHAS_INFRA) return { status: "esgotada", tentativas: n, motivo };
  const espera = esperas[Math.min(n - 1, esperas.length - 1)] ?? 10;
  return { status: "aguardando", tentativas: n, proximaEm: new Date(+agora + espera * 60_000), motivo };
}

// Tarefas "rodando" de processo morto voltam para a fila
export async function recuperarOrfas(agora = new Date()) {
  const r = await Tarefa.updateMany({ status: "rodando", iniciadaEm: { $lt: new Date(+agora - ORFA_MS) } }, { status: "pendente", proximaEm: agora });
  return r.modifiedCount;
}

// Plano da noite: tópicos abaixo do estoque mínimo, os mais vazios primeiro, até GERACAO_MAX_NOITE
// tarefas (sem passar do teto diário). Tópico que exige fonte e não tem trecho fica de fora.
export async function planejarNoite(lote: string, opcoes: { max?: number; estoqueMin?: number } = {}) {
  const max = Math.min(opcoes.max ?? (Number(process.env.GERACAO_MAX_NOITE) || 20), Math.max(0, tetoDiario() - (await geracoesHoje())));
  const estoqueMin = opcoes.estoqueMin ?? (Number(process.env.ESTOQUE_MIN) || 30);
  const [topicos, aprovadas, abertas, comTrecho] = await Promise.all([
    Topic.find({ ativo: true }).select("assunto disciplina volatil").lean(),
    Question.aggregate<{ _id: Types.ObjectId; n: number }>([{ $match: { status: "aprovada" } }, { $group: { _id: "$topicId", n: { $sum: 1 } } }]),
    Tarefa.aggregate<{ _id: string; n: number }>([
      { $match: { tipo: "gerar", status: { $in: ["pendente", "rodando", "aguardando"] } } },
      { $group: { _id: "$params.topicId", n: { $sum: 1 } } },
    ]),
    Chunk.distinct("topicIds", { revogada: false }),
  ]);
  const nAprov = new Map(aprovadas.map((a) => [String(a._id), a.n]));
  const nAbertas = new Map(abertas.map((a) => [String(a._id), a.n]));
  const temTrecho = new Set(comTrecho.map(String));
  const fila = topicos
    .filter((t) => !(t.volatil || DISCIPLINAS_COM_FONTE_OBRIGATORIA.includes(t.disciplina as Disciplina)) || temTrecho.has(String(t._id)))
    .map((t) => ({ t, falta: estoqueMin - (nAprov.get(String(t._id)) ?? 0) - (nAbertas.get(String(t._id)) ?? 0) }))
    .filter((x) => x.falta > 0)
    .sort((a, b) => b.falta - a.falta);
  // rodízio: uma por tópico por volta, os mais vazios primeiro
  const novas: { tipo: "gerar"; params: { topicId: string; assunto: string }; lote: string }[] = [];
  for (let volta = 0; novas.length < max && fila.some((x) => x.falta > volta); volta++)
    for (const x of fila) {
      if (novas.length >= max) break;
      if (x.falta > volta) novas.push({ tipo: "gerar", params: { topicId: String(x.t._id), assunto: x.t.assunto }, lote });
    }
  if (await verificacaoVencida()) await Tarefa.create({ tipo: "verificar_modelos", lote });
  if (novas.length) await Tarefa.insertMany(novas);
  return novas.length;
}

async function executar(t: { tipo: string; params?: unknown }): Promise<{ ok: boolean; motivo?: string; detalhes?: string; resultadoId?: Types.ObjectId }> {
  if (t.tipo === "gerar") {
    const p = t.params as { topicId: string };
    const r = await gerarQuestao(p.topicId, 1 + Math.floor(Math.random() * 5));
    return r.ok ? { ok: true, resultadoId: r.questionId } : { ok: false, motivo: r.motivo, detalhes: r.detalhes?.join(" | ").slice(0, 500) };
  }
  if (t.tipo === "verificar_modelos") {
    const r = await verificarModelos();
    return { ok: true, detalhes: `${r.filter((x) => x.http === 200 && x.json).length}/${r.length} modelos responderam` };
  }
  return { ok: false, motivo: `tipo_desconhecido:${t.tipo}` };
}

// Roda as tarefas prontas, uma por vez. Com "ate" (janela da noite), espera a próxima que
// estiver aguardando nova tentativa, se couber na janela; sem "ate", para quando acabar o que está pronto.
export async function rodarFila(opcoes: { ate?: Date; max?: number } = {}) {
  const resumo = { rodadas: 0, concluidas: 0, descartadas: 0, aguardando: 0, esgotadas: 0, orfas: await recuperarOrfas() };
  for (;;) {
    if (opcoes.max !== undefined && resumo.rodadas >= opcoes.max) break;
    if (opcoes.ate && Date.now() >= +opcoes.ate) break;
    const t = await Tarefa.findOneAndUpdate(
      { status: { $in: ["pendente", "aguardando"] }, proximaEm: { $lte: new Date() } },
      { status: "rodando", iniciadaEm: new Date() },
      { sort: { proximaEm: 1, createdAt: 1 }, new: true }
    );
    if (!t) {
      const proxima = opcoes.ate ? await Tarefa.findOne({ status: "aguardando", proximaEm: { $lt: opcoes.ate } }).sort({ proximaEm: 1 }).lean() : null;
      if (!proxima) break;
      await new Promise((ok) => setTimeout(ok, Math.min(30 * 60_000, Math.max(5_000, +proxima.proximaEm - Date.now()))));
      continue;
    }
    resumo.rodadas++;
    let r: Awaited<ReturnType<typeof executar>>;
    try {
      r = await executar(t);
    } catch (e) {
      r = { ok: false, motivo: "erro_inesperado", detalhes: String(e instanceof Error ? e.message : e).slice(0, 500) };
    }
    const d = destinoDaTarefa(r, t.tentativas ?? 0, new Date());
    await Tarefa.updateOne({ _id: t._id }, { ...d, detalhes: r.detalhes, resultadoId: r.resultadoId });
    const chave = ({ concluida: "concluidas", descartada: "descartadas", aguardando: "aguardando", esgotada: "esgotadas" } as const)[d.status];
    resumo[chave]++;
    console.log(`${d.status === "concluida" ? "✔" : d.status === "aguardando" ? "↻" : "✖"} ${t.tipo} ${(t.params as { assunto?: string } | undefined)?.assunto ?? ""} → ${d.status}${"motivo" in d && d.motivo ? ` (${d.motivo})` : ""}`);
  }
  return resumo;
}

// Botão "tentar de novo agora" (tela Fila): tarefa aguardando/esgotada volta já para a fila
export async function tentarDeNovoAgora(id: string) {
  const r = await Tarefa.updateOne({ _id: id, status: { $in: ["aguardando", "esgotada"] } }, { status: "pendente", proximaEm: new Date(), tentativas: 0 });
  return r.modifiedCount === 1;
}
