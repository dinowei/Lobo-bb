// ============================================================
// BB Estudos — Motor de estudo do SERVIDOR (implementa a interface Api do front)
// As regras (XP, SM-2, prioridade, painel) vêm de shared/motor.ts — as mesmas do modo demo.
// ============================================================
import { Types } from "mongoose";
import { Attempt, Question, ReviewState, Topic, Report, Source } from "./models.js";
import {
  ESTADO_INICIAL,
  agendar,
  calcularPainel,
  cotasPorDisciplina,
  notaSM2,
  prioridade,
  sortearPonderado,
  xpDaTentativa,
} from "../shared/motor.js";
import type {
  Api,
  Confianca,
  CorrecaoDTO,
  Disciplina,
  ErroDTO,
  Letra,
  Modo,
  QuestaoDTO,
  ResultadoSimuladoDTO,
  TentativaBruta,
  TopicoDTO,
} from "../shared/tipos.js";
import { gerarQuestao } from "./pipeline.js";

// App pessoal: um aluno só. Para multiusuário, troque por autenticação.
export const ALUNO = () => new Types.ObjectId(process.env.ALUNO_ID || "000000000000000000000001");
const oid = (s: string) => {
  if (!/^[0-9a-f]{24}$/i.test(s)) throw new Error(`id inválido: ${s}`);
  return new Types.ObjectId(s);
};

// ------------------------------------------------------------
// Conversões
// ------------------------------------------------------------
async function mapaTopicos() {
  const ts = await Topic.find({ ativo: true }).lean();
  return new Map(ts.map((t) => [String(t._id), t]));
}

async function listarTopicos(): Promise<TopicoDTO[]> {
  return [...(await mapaTopicos()).values()].map((t) => ({
    id: String(t._id),
    disciplina: t.disciplina as Disciplina,
    assunto: t.assunto,
    subtopicos: t.subtopicos ?? [],
    peso: t.questoesNaProva ?? null,
  }));
}

type QuestaoDoc = {
  _id: Types.ObjectId;
  topicId: Types.ObjectId;
  origem: string;
  prova?: string | null;
  numeroOriginal?: number | null;
  textoBase?: string | null;
  enunciado: string;
  alternativas: { letra: string; texto: string; correta: boolean; explicacao?: string | null; pegadinha?: string | null }[];
  gabarito: string;
  dificuldade?: number | null;
  explicacaoGeral?: string | null;
  dicaDeProva?: string | null;
  fontes?: { sourceId?: Types.ObjectId | null; trecho?: string | null }[];
  auditoria?: { respostaCega?: string | null } | null;
};

function paraDTO(q: QuestaoDoc, topicos: Map<string, { disciplina: string; assunto: string }>): QuestaoDTO {
  const t = topicos.get(String(q.topicId));
  return {
    id: String(q._id),
    topicoId: String(q.topicId),
    disciplina: (t?.disciplina ?? "conhecimentos_bancarios") as Disciplina,
    assunto: t?.assunto ?? "",
    origem: q.origem as "oficial" | "gerada",
    prova: q.prova ?? undefined,
    numeroOriginal: q.numeroOriginal ?? undefined,
    textoBase: q.textoBase ?? undefined,
    enunciado: q.enunciado,
    alternativas: q.alternativas.map((a) => ({ letra: a.letra as Letra, texto: a.texto })),
    dificuldade: q.dificuldade ?? 3,
  };
}

async function correcaoDe(q: QuestaoDoc, resposta: Letra | null, xpGanho: number, dias: number): Promise<CorrecaoDTO> {
  const ids = (q.fontes ?? []).map((f) => f.sourceId).filter(Boolean);
  const titulos = new Map((await Source.find({ _id: { $in: ids } }).select("titulo").lean()).map((s) => [String(s._id), s.titulo]));
  return {
    acertou: resposta === q.gabarito,
    gabarito: q.gabarito as Letra,
    alternativas: q.alternativas.map((a) => ({
      letra: a.letra as Letra,
      texto: a.texto,
      correta: a.correta,
      explicacao: a.explicacao ?? "",
      pegadinha: a.pegadinha ?? undefined,
    })),
    explicacaoGeral: q.explicacaoGeral ?? "",
    dicaDeProva: q.dicaDeProva ?? undefined,
    fontes: (q.fontes ?? [])
      .filter((f) => f.sourceId && titulos.has(String(f.sourceId)))
      .map((f) => ({ titulo: titulos.get(String(f.sourceId))!, trecho: f.trecho ?? undefined })),
    traicoeira: q.origem === "oficial" && !!q.auditoria?.respostaCega && q.auditoria.respostaCega !== q.gabarito,
    xpGanho,
    proximaRevisaoDias: dias,
  };
}

// ------------------------------------------------------------
// Registrar resposta: tentativa + XP + revisão espaçada (SM-2)
// ------------------------------------------------------------
async function registrar(
  q: QuestaoDoc,
  resposta: Letra | null,
  confianca: Confianca,
  modo: Modo,
  tempoSeg?: number,
  simuladoId?: string
) {
  const userId = ALUNO();
  const acertou = resposta === q.gabarito;
  const xp = xpDaTentativa({ acertou, dificuldade: q.dificuldade ?? 3, confianca, modo });

  await Attempt.create({ userId, questionId: q._id, topicId: q.topicId, resposta: resposta ?? undefined, acertou, tempoSeg, confianca, modo, xp, simuladoId });
  await Question.updateOne({ _id: q._id }, { $inc: { "stats.tentativas": 1, "stats.acertos": acertou ? 1 : 0 } });

  const atual = await ReviewState.findOne({ userId, questionId: q._id });
  const novo = agendar(atual ?? ESTADO_INICIAL, notaSM2(acertou, confianca));
  await ReviewState.updateOne(
    { userId, questionId: q._id },
    { $set: { ...novo, proximaRevisao: new Date(Date.now() + novo.intervaloDias * 86_400_000) } },
    { upsert: true }
  );
  return { acertou, xp, dias: novo.intervaloDias };
}

// ------------------------------------------------------------
// Geração sob demanda: estoque baixo num tópico → a IA gera em segundo plano
// ------------------------------------------------------------
const gerando = new Set<string>();
function reabastecerEmSegundoPlano(topicId: string, quantas = 3) {
  if (gerando.has(topicId) || !process.env.GERADOR_API_KEY) return;
  gerando.add(topicId);
  (async () => {
    try {
      for (let i = 0; i < quantas; i++) await gerarQuestao(topicId);
    } catch (e) {
      console.warn(`[estoque] ${topicId}: ${(e as Error).message}`);
    } finally {
      gerando.delete(topicId);
    }
  })();
}

// ------------------------------------------------------------
// A API
// ------------------------------------------------------------
export const apiServidor: Omit<Api, "modo"> = {
  topicos: listarTopicos,

  async painel() {
    const userId = ALUNO();
    const [topicos, tentativas, revisoes] = await Promise.all([
      listarTopicos(),
      Attempt.find({ userId }).select("questionId topicId acertou xp modo simuladoId createdAt").lean(),
      ReviewState.find({ userId }).select("proximaRevisao").lean(),
    ]);
    const brutas: TentativaBruta[] = tentativas.map((t) => ({
      questaoId: String(t.questionId),
      topicoId: String(t.topicId),
      acertou: t.acertou,
      xp: t.xp ?? 0,
      modo: (t.modo ?? "treino") as Modo,
      simuladoId: t.simuladoId ?? undefined,
      data: (t.createdAt as Date).toISOString(),
    }));
    return calcularPainel({ topicos, tentativas: brutas, revisoes: revisoes.map((r) => (r.proximaRevisao as Date).toISOString()) });
  },

  async proxima(f) {
    const userId = ALUNO();
    const topicos = await mapaTopicos();

    if (f.questaoId) {
      const q = await Question.findById(oid(f.questaoId)).lean<QuestaoDoc>();
      return { questao: q ? paraDTO(q, topicos) : null, modo: "treino" };
    }

    // 1. revisões vencidas
    const semFiltro = !f.topicoId && !f.disciplina;
    if (f.revisao || semFiltro) {
      const vencidas = await ReviewState.find({ userId, proximaRevisao: { $lte: new Date() } })
        .sort({ proximaRevisao: 1 })
        .limit(30)
        .lean();
      if (vencidas.length) {
        const qs = await Question.find({ _id: { $in: vencidas.map((v) => v.questionId) }, status: "aprovada" }).lean<QuestaoDoc[]>();
        const porId = new Map(qs.map((q) => [String(q._id), q]));
        const primeira = vencidas.map((v) => porId.get(String(v.questionId))).find(Boolean);
        if (primeira) return { questao: paraDTO(primeira, topicos), modo: "revisao" };
      }
      if (f.revisao) return { questao: null, modo: "revisao", aviso: "Nenhuma revisão vencida agora. Volte amanhã ou pratique um tópico novo." };
    }

    // 2. tópico ponderado (peso no edital × fraqueza)
    const candidatos = [...topicos.values()].filter(
      (t) => (!f.topicoId || String(t._id) === f.topicoId) && (!f.disciplina || t.disciplina === f.disciplina)
    );
    const comQuestao = new Set(
      (await Question.distinct("topicId", { status: "aprovada", topicId: { $in: candidatos.map((t) => t._id) } })).map(String)
    );
    if (!comQuestao.size) {
      candidatos.slice(0, 3).forEach((t) => reabastecerEmSegundoPlano(String(t._id)));
      return {
        questao: null,
        modo: "treino",
        aviso: process.env.GERADOR_API_KEY
          ? "Ainda não há questões aprovadas aqui. A IA começou a gerar algumas; tente de novo em um ou dois minutos."
          : 'Ainda não há questões aprovadas aqui. Ingira uma prova ou rode "npm run bb -- gerar --assunto ...".',
      };
    }
    const desempenho = await Attempt.aggregate<{ _id: Types.ObjectId; n: number; a: number }>([
      { $match: { userId } },
      { $group: { _id: "$topicId", n: { $sum: 1 }, a: { $sum: { $cond: ["$acertou", 1, 0] } } } },
    ]);
    const stats = new Map(desempenho.map((d) => [String(d._id), d]));
    const elegiveis = candidatos.filter((t) => comQuestao.has(String(t._id)));
    const escolhido = sortearPonderado(elegiveis, (t) => {
      const s = stats.get(String(t._id));
      return prioridade(t.questoesNaProva ?? null, s?.n ?? 0, s?.a ?? 0);
    })!;

    // 3. questão ainda não respondida desse tópico
    const respondidas = await Attempt.distinct("questionId", { userId, topicId: escolhido._id });
    const naoVistas = await Question.countDocuments({ topicId: escolhido._id, status: "aprovada", _id: { $nin: respondidas } });
    if (naoVistas < 3) reabastecerEmSegundoPlano(String(escolhido._id));
    const [q] = await Question.aggregate<QuestaoDoc>([
      { $match: { topicId: escolhido._id, status: "aprovada", ...(naoVistas ? { _id: { $nin: respondidas } } : {}) } },
      { $sample: { size: 1 } },
    ]);
    return {
      questao: paraDTO(q, topicos),
      modo: "treino",
      aviso: naoVistas ? undefined : "Você já viu todas as questões deste tópico; a IA está gerando novas. Por ora, repetindo uma.",
    };
  },

  async responder(r) {
    const q = await Question.findById(oid(r.questaoId)).lean<QuestaoDoc>();
    if (!q) throw new Error("Questão não encontrada");
    const { xp, dias } = await registrar(q, r.resposta, r.confianca, r.modo, r.tempoSeg);
    return correcaoDe(q, r.resposta, xp, dias);
  },

  async simulado(n) {
    const topicos = await listarTopicos();
    const comQuestao = new Set((await Question.distinct("topicId", { status: "aprovada" })).map(String));
    const validos = topicos.filter((t) => comQuestao.has(t.id));
    const cotas = cotasPorDisciplina(n, validos);
    const mapa = await mapaTopicos();
    const escolhidas: QuestaoDoc[] = [];
    for (const [disc, k] of cotas) {
      if (!k) continue;
      const ids = validos.filter((t) => t.disciplina === disc).map((t) => oid(t.id));
      escolhidas.push(...(await Question.aggregate<QuestaoDoc>([{ $match: { topicId: { $in: ids }, status: "aprovada" } }, { $sample: { size: k } }])));
    }
    if (escolhidas.length < n) {
      const extra = await Question.aggregate<QuestaoDoc>([
        { $match: { status: "aprovada", _id: { $nin: escolhidas.map((q) => q._id) } } },
        { $sample: { size: n - escolhidas.length } },
      ]);
      escolhidas.push(...extra);
    }
    return escolhidas.sort(() => Math.random() - 0.5).map((q) => paraDTO(q, mapa));
  },

  async corrigirSimulado(respostas) {
    const simuladoId = new Types.ObjectId().toString();
    const mapa = await mapaTopicos();
    const porDisc = new Map<Disciplina, { total: number; acertos: number }>();
    let acertos = 0;
    let xpTotal = 0;
    const correcoes: ResultadoSimuladoDTO["correcoes"] = [];
    for (const r of respostas) {
      const q = await Question.findById(oid(r.questaoId)).lean<QuestaoDoc>();
      if (!q) continue;
      const { acertou, xp, dias } = await registrar(q, r.resposta, 2, "simulado", r.tempoSeg, simuladoId);
      if (acertou) acertos++;
      xpTotal += xp;
      const disc = (mapa.get(String(q.topicId))?.disciplina ?? "conhecimentos_bancarios") as Disciplina;
      const d = porDisc.get(disc) ?? { total: 0, acertos: 0 };
      d.total++;
      if (acertou) d.acertos++;
      porDisc.set(disc, d);
      correcoes.push({ ...(await correcaoDe(q, r.resposta, xp, dias)), questaoId: String(q._id), enunciado: q.enunciado, resposta: r.resposta });
    }
    return {
      simuladoId,
      total: correcoes.length,
      acertos,
      xpGanho: xpTotal,
      porDisciplina: [...porDisc].map(([disciplina, v]) => ({ disciplina, ...v })),
      correcoes,
    };
  },

  async erros() {
    const userId = ALUNO();
    const grupos = await Attempt.aggregate<{ _id: Types.ObjectId; ultima: boolean; erradas: number; data: Date }>([
      { $match: { userId } },
      { $sort: { createdAt: 1 } },
      {
        $group: {
          _id: "$questionId",
          ultima: { $last: "$acertou" },
          erradas: { $sum: { $cond: ["$acertou", 0, 1] } },
          data: { $last: "$createdAt" },
        },
      },
      { $match: { ultima: false } },
      { $sort: { data: -1 } },
      { $limit: 300 },
    ]);
    const mapa = await mapaTopicos();
    const qs = new Map(
      (await Question.find({ _id: { $in: grupos.map((g) => g._id) } }).select("enunciado topicId").lean()).map((q) => [String(q._id), q])
    );
    return grupos
      .filter((g) => qs.has(String(g._id)))
      .map((g): ErroDTO => {
        const q = qs.get(String(g._id))!;
        const t = mapa.get(String(q.topicId));
        return {
          questaoId: String(g._id),
          disciplina: (t?.disciplina ?? "conhecimentos_bancarios") as Disciplina,
          assunto: t?.assunto ?? "",
          enunciado: q.enunciado,
          vezesErrada: g.erradas,
          ultimaData: g.data.toISOString(),
        };
      });
  },

  async contestar(questaoId, motivo, comentario) {
    const id = oid(questaoId);
    await Report.create({ userId: ALUNO(), questionId: id, motivo, comentario });
    await Question.updateOne({ _id: id }, { status: "contestada" }); // sai de circulação até você revisar
  },
};
