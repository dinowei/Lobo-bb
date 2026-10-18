// ============================================================
// BB Estudos — fonte da prova + fonte atual em cada explicação (docs/ADENDO-FONTES-ATUAIS.md)
// Nada da questão é reescrito: só se ACRESCENTA a camada "referencias". Gabarito oficial não muda
// (regra 1). "mudou" só chega ao aluno depois do OK do dono (Admin → Pendências).
// ============================================================
import { Types } from "mongoose";
import { Question, Source, Tarefa, Topic } from "./models.js";
import { chatJSONFuncao, correnteAtiva } from "./corrente.js";
import { SemModeloDisponivel, ehFalhaDeInfra } from "./llm.js";
import { ConfereFonteAtualZ, CONFERE_FONTE_ATUAL_SYSTEM, confereFonteAtualUser } from "./prompts.js";
import { buscarFontesPorConsulta } from "./pipeline.js";
import { familiaDe } from "./catalogo.js";
import { pregeracoes, rodarFila } from "./noturno.js";
import type { Disciplina, FontesQuestaoDTO } from "../shared/tipos.js";

// regra que não muda com o tempo: só a origem aparece
export const SEM_FONTE_ATUAL: readonly Disciplina[] = ["lingua_portuguesa", "lingua_inglesa", "matematica", "matematica_financeira", "probabilidade_estatistica"];
const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

type Situacao = "confirmada" | "mudou" | "pendente" | "nao_se_aplica";
type FonteConsulta = { indice: number; sourceId: string; titulo: string; texto: string; url?: string; revogada?: boolean };

// ---------- partes puras (testadas sem banco) ----------
export function situacaoInicial(disciplina: Disciplina, temTrechoDeFonte: boolean): Situacao {
  if (SEM_FONTE_ATUAL.includes(disciplina)) return "nao_se_aplica";
  return temTrechoDeFonte ? "confirmada" : "pendente";
}

export const origemDe = (q: { origem: string; prova?: string | null; numeroOriginal?: number | null }) =>
  q.origem === "oficial" && q.prova ? { papel: "origem" as const, tipo: "prova" as const, ref: q.prova, ...(q.numeroOriginal ? { questao: `Q${q.numeroOriginal}` } : {}) } : null;

// Checagens determinísticas sobre a resposta do conferente: trecho literal, fonte existente e vigente,
// "mudou" com antes/hoje. Falhou → "pendente" (nada é gravado como verdade).
type Conferencia = { situacao: "confirmada" | "mudou" | "pendente"; indice?: number; trecho?: string; antes?: string; hoje?: string; respostaMudaria?: boolean };
export function validarConferencia(r: Conferencia, fontes: FonteConsulta[]): { situacao: Situacao; fonte?: FonteConsulta; motivo?: string } {
  if (r.situacao === "pendente") return { situacao: "pendente", motivo: "sem fonte atual ingerida sobre o assunto" };
  const fonte = fontes.find((f) => f.indice === r.indice);
  if (!fonte) return { situacao: "pendente", motivo: "trecho aponta para fonte inexistente" };
  if (fonte.revogada) return { situacao: "pendente", motivo: "fonte revogada" };
  if (!r.trecho || r.trecho.length < 20 || !normalizar(fonte.texto).includes(normalizar(r.trecho))) return { situacao: "pendente", motivo: "trecho não é literal" };
  if (r.situacao === "mudou" && (!r.antes?.trim() || !r.hoje?.trim())) return { situacao: "pendente", motivo: "mudou sem dizer antes e hoje" };
  return { situacao: r.situacao, fonte };
}

// Depois do OK do dono: resposta que seria outra hoje → desatualizada (fora do treino e do simulado,
// com nota do que mudou); só detalhe → continua em circulação com o aviso
export const statusDepoisDeAprovar = (respostaMudaria: boolean | undefined, statusAtual: string) =>
  respostaMudaria && statusAtual === "aprovada" ? "desatualizada" : statusAtual;

// Bloco "Fontes" da correção (aluno não vê menção a IA nem a modelos)
export function fontesDaQuestao(q: {
  referencias?: { papel: string; ref: string; questao?: string | null; trecho?: string | null; conferidoEm?: Date | null }[] | null;
  situacaoFonte?: string | null;
  oQueMudou?: { antes?: string | null; hoje?: string | null; trechoHoje?: string | null; fonteHoje?: string | null; aprovadoEm?: Date | null } | null;
}): FontesQuestaoDTO | undefined {
  if (!q.situacaoFonte) return undefined;
  const origem = q.referencias?.find((r) => r.papel === "origem");
  const atual = q.referencias?.find((r) => r.papel === "atual" && r.trecho);
  const mudouAprovado = q.situacaoFonte === "mudou" && q.oQueMudou?.aprovadoEm;
  return {
    ...(origem ? { origem: { ref: origem.ref, ...(origem.questao ? { questao: origem.questao } : {}) } } : {}),
    ...(atual && q.situacaoFonte === "confirmada" ? { atual: { ref: atual.ref, trecho: atual.trecho!, ...(atual.conferidoEm ? { conferidoEm: new Date(atual.conferidoEm).toISOString() } : {}) } } : {}),
    ...(mudouAprovado ? { mudou: { antes: q.oQueMudou!.antes ?? "", hoje: q.oQueMudou!.hoje ?? "", trecho: q.oQueMudou!.trechoHoje ?? "", ref: q.oQueMudou!.fonteHoje ?? "" } } : {}),
    // "mudou" ainda não revisado pelo dono também aparece como "em conferência"
    emConferencia: q.situacaoFonte === "pendente" || (q.situacaoFonte === "mudou" && !mudouAprovado),
  };
}

// ---------- migração: acrescenta a camada sem apagar nada ----------
export async function migrarReferencias() {
  const disciplinaDo = new Map((await Topic.find().select("disciplina").lean()).map((t) => [String(t._id), t.disciplina as Disciplina]));
  const qs = await Question.find({ situacaoFonte: { $exists: false } }).select("origem prova numeroOriginal topicId fontes").lean();
  const titulos = new Map((await Source.find({ _id: { $in: qs.flatMap((q) => (q.fontes ?? []).map((f) => f.sourceId)).filter(Boolean) } }).select("titulo url revogada").lean()).map((s) => [String(s._id), s]));
  let n = 0;
  for (const q of qs) {
    const disciplina = disciplinaDo.get(String(q.topicId));
    if (!disciplina) continue;
    const comTrecho = (q.fontes ?? []).filter((f) => f.trecho && f.sourceId && titulos.get(String(f.sourceId)) && !titulos.get(String(f.sourceId))!.revogada);
    const situacao = situacaoInicial(disciplina, q.origem === "gerada" && comTrecho.length > 0);
    const referencias = [
      ...(origemDe(q) ? [origemDe(q)!] : []),
      // gerada com trechoFonte: já é fonte ingerida vigente → vira "atual" direto
      ...(situacao === "confirmada"
        ? comTrecho.map((f) => {
            const s = titulos.get(String(f.sourceId))!;
            return { papel: "atual", tipo: "norma", ref: s.titulo, sourceId: f.sourceId, trecho: f.trecho, ...(s.url ? { url: s.url } : {}), conferidoEm: new Date() };
          })
        : []),
    ];
    await Question.updateOne({ _id: q._id, situacaoFonte: { $exists: false } }, { $set: { referencias, situacaoFonte: situacao } });
    n++;
  }
  return n;
}

// ---------- conferência (uma tarefa por questão, na fila da noite) ----------
async function conferirFonteAtual(questionId: string, preferir?: string) {
  if (!Types.ObjectId.isValid(questionId)) return { ok: false, motivo: "questao_inexistente" };
  const q = await Question.findById(questionId).lean();
  if (!q) return { ok: false, motivo: "questao_inexistente" };
  const topico = await Topic.findById(q.topicId).select("disciplina").lean();
  if (!topico || SEM_FONTE_ATUAL.includes(topico.disciplina as Disciplina)) {
    await Question.updateOne({ _id: q._id }, { $set: { situacaoFonte: "nao_se_aplica" } });
    return { ok: true };
  }
  // busca por código só nos trechos de fontes vigentes do tópico (regra 6: revogada não entra)
  const achados = await buscarFontesPorConsulta(q.topicId, `${q.enunciado}\n${q.alternativas.find((a) => a.letra === q.gabarito)?.texto ?? ""}`, 5);
  const fontesDb = new Map((await Source.find({ _id: { $in: achados.map((a) => a.sourceId) } }).select("titulo url revogada").lean()).map((s) => [String(s._id), s]));
  const fontes: FonteConsulta[] = achados.map((a, i) => ({ indice: i + 1, sourceId: String(a.sourceId), titulo: a.titulo, texto: a.texto, url: fontesDb.get(String(a.sourceId))?.url ?? undefined, revogada: fontesDb.get(String(a.sourceId))?.revogada ?? true }));
  if (!fontes.length) {
    await Question.updateOne({ _id: q._id }, { $set: { situacaoFonte: "pendente" } });
    return { ok: false, motivo: "sem_fontes", detalhes: "nenhuma fonte vigente ingerida para o tópico" };
  }
  try {
    // auditor de família diferente de quem escreveu a explicação, quando se sabe quem foi
    const excluir = q.geradaPor ? [familiaDe(q.geradaPor)] : [];
    const r = await chatJSONFuncao("auditor", CONFERE_FONTE_ATUAL_SYSTEM, confereFonteAtualUser(q, fontes), 0, 1400, { preferir, excluirFamilias: excluir });
    const resp = ConfereFonteAtualZ.parse(r.json);
    const v = validarConferencia(resp, fontes);
    const origem = origemDe(q);
    if (v.situacao === "confirmada") {
      await Question.updateOne({ _id: q._id }, { $set: {
        situacaoFonte: "confirmada",
        referencias: [...(origem ? [origem] : []), { papel: "atual", tipo: "norma", ref: v.fonte!.titulo, sourceId: new Types.ObjectId(v.fonte!.sourceId), trecho: resp.trecho, ...(v.fonte!.url ? { url: v.fonte!.url } : {}), conferidoEm: new Date() }],
      } });
    } else if (v.situacao === "mudou") {
      // fica esperando o OK do dono; nada muda para o aluno até lá
      await Question.updateOne({ _id: q._id }, { $set: {
        situacaoFonte: "mudou",
        oQueMudou: { antes: resp.antes, hoje: resp.hoje, trechoHoje: resp.trecho, fonteHoje: v.fonte!.titulo, sourceId: new Types.ObjectId(v.fonte!.sourceId), respostaMudaria: !!resp.respostaMudaria },
      } });
    } else {
      await Question.updateOne({ _id: q._id }, { $set: { situacaoFonte: "pendente" } });
      return { ok: false, motivo: "fonte_pendente", detalhes: v.motivo };
    }
    return { ok: true };
  } catch (e) {
    const motivo = e instanceof SemModeloDisponivel ? "aguardando_modelo" : ehFalhaDeInfra(e) ? "provedor_falhou" : "conferencia_invalida";
    return { ok: false, motivo, detalhes: String(e instanceof Error ? e.message : e).slice(0, 400) };
  }
}

pregeracoes["fonte_atual"] = (params, preferir) => conferirFonteAtual((params as { questionId: string }).questionId, preferir);

// Noturno: questões aprovadas pendentes (e oficiais nunca conferidas) das disciplinas com norma
export async function planejarFontesAtuais(lote: string, max = Number(process.env.FONTES_ATUAIS_NOITE) || 20) {
  await migrarReferencias();
  const abertas = new Set((await Tarefa.distinct("params.questionId", { tipo: "fonte_atual", status: { $in: ["pendente", "rodando", "aguardando"] } })).map(String));
  const qs = await Question.find({ situacaoFonte: "pendente", status: { $in: ["aprovada", "desatualizada"] } }).sort({ updatedAt: 1 }).select("_id").limit(max * 3).lean();
  const novas = qs.map((q) => String(q._id)).filter((id) => !abertas.has(id)).slice(0, max);
  if (novas.length) await Tarefa.insertMany(novas.map((questionId) => ({ tipo: "fonte_atual", params: { questionId }, lote })));
  return novas.length;
}

export async function conferirFontesAgora(n = 5) {
  const lote = `fontes atuais ${new Date().toISOString().slice(0, 10)}`;
  await migrarReferencias();
  const qs = await Question.find({ situacaoFonte: "pendente", status: { $in: ["aprovada", "desatualizada"] } }).select("_id").limit(n).lean();
  const tarefas = qs.length ? await Tarefa.insertMany(qs.map((q) => ({ tipo: "fonte_atual", params: { questionId: String(q._id) }, lote }))) : [];
  const atual = await correnteAtiva();
  return rodarFila({ max: tarefas.length, trabalhadores: 1, tarefaIds: tarefas.map((t) => String(t._id)), geradores: atual.correntes.auditor });
}

// ---------- revogação: questões ligadas à fonte voltam para a fila ----------
export async function reabrirPorFonte(sourceId: Types.ObjectId) {
  const r = await Question.updateMany(
    { $or: [{ "referencias.sourceId": sourceId }, { "oQueMudou.sourceId": sourceId }], situacaoFonte: { $in: ["confirmada", "mudou"] } },
    { $set: { situacaoFonte: "pendente" } }
  );
  return r.modifiedCount;
}

// ---------- Admin: aprovar "mudou" (em lote) e relatório ----------
export async function aprovarMudancas(ids: string[]) {
  let aprovadas = 0;
  for (const id of ids.filter((x) => Types.ObjectId.isValid(x))) {
    const q = await Question.findOne({ _id: id, situacaoFonte: "mudou", "oQueMudou.aprovadoEm": { $exists: false } }).lean();
    if (!q) continue;
    const status = statusDepoisDeAprovar(q.oQueMudou?.respostaMudaria ?? false, q.status);
    await Question.updateOne({ _id: q._id }, { $set: {
      "oQueMudou.aprovadoEm": new Date(),
      status,
      ...(status === "desatualizada" ? { notaNorma: `Mudou desde a prova: ${q.oQueMudou?.hoje ?? ""} (${q.oQueMudou?.fonteHoje ?? "norma vigente"}).` } : {}),
    } });
    aprovadas++;
  }
  return aprovadas;
}

export async function relatorioFontesAtuais() {
  const disciplinaDo = new Map((await Topic.find().select("disciplina").lean()).map((t) => [String(t._id), t.disciplina]));
  const qs = await Question.find({ situacaoFonte: { $exists: true } }).select("topicId situacaoFonte oQueMudou enunciado prova numeroOriginal").lean();
  const porDisciplina: Record<string, Record<string, number>> = {};
  for (const q of qs) {
    const d = disciplinaDo.get(String(q.topicId)) ?? "?";
    porDisciplina[d] ??= {};
    porDisciplina[d][q.situacaoFonte!] = (porDisciplina[d][q.situacaoFonte!] ?? 0) + 1;
  }
  const mudancas = qs
    .filter((q) => q.situacaoFonte === "mudou" && !q.oQueMudou?.aprovadoEm)
    .map((q) => ({ id: String(q._id), questao: q.prova ? `${q.prova}${q.numeroOriginal ? ` · Q${q.numeroOriginal}` : ""}` : q.enunciado.slice(0, 80), antes: q.oQueMudou?.antes ?? "", hoje: q.oQueMudou?.hoje ?? "", fonte: q.oQueMudou?.fonteHoje ?? "", respostaMudaria: !!q.oQueMudou?.respostaMudaria }));
  // tópicos com questões pendentes e sem fonte ingerida: normas para o dono baixar
  const pendentesPorTopico = new Map<string, number>();
  for (const q of qs) if (q.situacaoFonte === "pendente") pendentesPorTopico.set(String(q.topicId), (pendentesPorTopico.get(String(q.topicId)) ?? 0) + 1);
  const topicos = await Topic.find({ _id: { $in: [...pendentesPorTopico.keys()] } }).select("assunto disciplina").lean();
  const faltaIngerir = topicos.map((t) => ({ topico: t.assunto, disciplina: t.disciplina, questoes: pendentesPorTopico.get(String(t._id)) ?? 0 })).sort((a, b) => b.questoes - a.questoes);
  return { porDisciplina, mudancas, faltaIngerir };
}
