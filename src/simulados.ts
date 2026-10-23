// ============================================================
// BB Estudos — simulados guardados (F4): resumo de cada simulado na coleção "simulados" e migração dos
// antigos a partir das tentativas (simular → contar → migrar → contar). Nada é apagado: as tentativas
// continuam sendo a fonte; o resumo pode ser recalculado a qualquer hora (por isso fica fora do backup).
// ============================================================
import type { Types } from "mongoose";
import { Attempt, Question, Simulado, Topic } from "./models.js";
import { resumirSimulado, type ItemSimulado, type ResumoSimulado } from "../shared/simulados.js";
import { ehDiagnostico } from "../shared/diagnostico.js";
import type { IdBanca, IdConcurso } from "../shared/concursos.js";
import type { Disciplina } from "../shared/tipos.js";

async function itensDe(userId: Types.ObjectId, simuladoId: string) {
  const ts = await Attempt.find({ userId, simuladoId, modo: "simulado" }).select("questionId topicId acertou resposta tempoSeg concurso banca createdAt").sort({ createdAt: 1 }).lean();
  const [topicos, questoes] = await Promise.all([
    Topic.find({ _id: { $in: ts.map((t) => t.topicId) } }).select("disciplina").lean(),
    Question.find({ _id: { $in: ts.map((t) => t.questionId) } }).select("subtopico").lean(),
  ]);
  const disc = new Map(topicos.map((t) => [String(t._id), t.disciplina as Disciplina]));
  const sub = new Map(questoes.map((q) => [String(q._id), q.subtopico ?? null]));
  const itens: ItemSimulado[] = ts.map((t) => ({
    disciplina: disc.get(String(t.topicId)) ?? "conhecimentos_bancarios",
    subtopico: sub.get(String(t.questionId)) ?? null,
    acertou: t.acertou,
    branco: !t.resposta,
    tempoSeg: t.tempoSeg ?? 0,
  }));
  return { ts, itens };
}

export async function salvarSimulado(userId: Types.ObjectId, simuladoId: string, ctx: { concurso: IdConcurso; banca: IdBanca }, tamanho: number, recalculado = false) {
  const { ts, itens } = await itensDe(userId, simuladoId);
  if (!ts.length) return null;
  const r = resumirSimulado({ id: simuladoId, data: (ts[0].createdAt as Date).toISOString(), concurso: ctx.concurso, banca: ctx.banca, diagnostico: ehDiagnostico(simuladoId), tamanho }, itens);
  const { id, data, ...resto } = r;
  await Simulado.updateOne({ _id: id }, { $set: { ...resto, userId, data: new Date(data), recalculado } }, { upsert: true });
  return r;
}

export async function listarSimulados(userId: Types.ObjectId): Promise<ResumoSimulado[]> {
  const docs = await Simulado.find({ userId }).sort({ data: 1 }).lean();
  return docs.map((d) => ({
    id: d._id,
    data: (d.data as Date).toISOString(),
    concurso: (d.concurso ?? "bb") as IdConcurso,
    banca: (d.banca ?? "cesgranrio") as IdBanca,
    diagnostico: !!d.diagnostico,
    tamanho: d.tamanho ?? d.total ?? 0,
    total: d.total ?? 0,
    acertos: d.acertos ?? 0,
    erros: d.erros ?? 0,
    brancos: d.brancos ?? 0,
    tempoSeg: d.tempoSeg ?? 0,
    completo: !!d.completo,
    porDisciplina: (d.porDisciplina ?? []).map((p) => ({ disciplina: p.disciplina as Disciplina, total: p.total ?? 0, acertos: p.acertos ?? 0 })),
    porSubtopico: (d.porSubtopico ?? []).map((p) => ({ subtopico: p.subtopico ?? "", total: p.total ?? 0, acertos: p.acertos ?? 0 })),
    nota: { valor: d.nota?.valor ?? 0, maximo: d.nota?.maximo ?? 0, criterio: (d.nota?.criterio ?? "pontos") as "pontos" | "liquida" },
  }));
}

// ---------- migração: simulados antigos ganham o resumo recalculado das tentativas ----------
async function contagens() {
  const ids = (await Attempt.distinct("simuladoId", { modo: "simulado", simuladoId: { $exists: true, $ne: null } })) as string[];
  const comResumo = await Simulado.countDocuments({ _id: { $in: ids } });
  return { tentativas: await Attempt.countDocuments(), tentativasSimulado: await Attempt.countDocuments({ modo: "simulado" }), simulados: ids.length, comResumo, ids };
}

export async function simularMigracaoSimulados() {
  const c = await contagens();
  return { tentativas: c.tentativas, tentativasSimulado: c.tentativasSimulado, simulados: c.simulados, comResumo: c.comResumo, faltam: c.simulados - c.comResumo };
}

export async function migrarSimulados() {
  const antes = await contagens();
  const existentes = new Set((await Simulado.find({ _id: { $in: antes.ids } }).select("_id").lean()).map((d) => d._id));
  let criados = 0;
  for (const id of antes.ids) {
    if (existentes.has(id)) continue;
    const a = await Attempt.findOne({ simuladoId: id }).select("userId concurso banca").lean();
    if (!a) continue;
    const n = await Attempt.countDocuments({ simuladoId: id });
    if (await salvarSimulado(a.userId, id, { concurso: (a.concurso ?? "bb") as IdConcurso, banca: (a.banca ?? "cesgranrio") as IdBanca }, n, true)) criados++;
  }
  const depois = await contagens();
  // as tentativas não podem mudar; cada simulado precisa ter um resumo
  const ok = depois.tentativas === antes.tentativas && depois.tentativasSimulado === antes.tentativasSimulado && depois.comResumo === depois.simulados;
  return { antes: { tentativas: antes.tentativas, simulados: antes.simulados, comResumo: antes.comResumo }, depois: { tentativas: depois.tentativas, simulados: depois.simulados, comResumo: depois.comResumo }, criados, ok };
}
