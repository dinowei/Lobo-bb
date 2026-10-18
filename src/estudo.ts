// ============================================================
// BB Estudos — Motor de estudo do SERVIDOR (implementa a interface Api do front)
// As regras (XP, SM-2, prioridade, painel) vêm de shared/motor.ts — as mesmas do modo demo.
// ============================================================
import { Types } from "mongoose";
import { Attempt, Question, ReviewState, Topic, Report, Source, Redacao } from "./models.js";
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
} from "../shared/motor.js";
import type {
  Api,
  Confianca,
  CorrecaoDTO,
  Disciplina,
  ErroDTO,
  FiguraDTO,
  GraficoDados,
  Letra,
  Modo,
  PlanilhaDados,
  PosicaoFigura,
  QuestaoDTO,
  TabelaDados,
  TelaProgramaDados,
  TipoFigura,
  ResultadoSimuladoDTO,
  TentativaBruta,
  TopicoDTO,
} from "../shared/tipos.js";
import { gerarQuestao } from "./pipeline.js";
import { seFilaLivre } from "./fila.js";
import { alertasAdminAgora } from "./adminTelas.js";
import { usuarioAtualId, usuarioAtual } from "./auth.js";
import { Geracao } from "./models.js";
import { MOTIVOS_REPETICAO } from "./similaridade.js";
import { inicioDaNoite } from "../shared/motor.js";
import { pesoDoTopico, misturaDasOficiais, cotasPorFaixa, faixaDe, sortearDisciplinaMista, type Mistura } from "../shared/estruturaProva.js";
import { fatorNaoSabia, palavrasDecisivas, JANELA_NAO_SABIA_DIAS, MENSAGEM_MOTIVO, REVISAO_CHUTE_MIN, TEMPO_ALVO_SEG } from "../shared/aprendizado.js";
import type { AcaoMotivoDTO, MotivoErro } from "../shared/tipos.js";
import { enviarRedacao, historicoRedacoes, listarTemasRedacao, marcarRedacoesVistas, pedirTemaRedacao } from "./redacao.js";
import { aulaDoTopico } from "./aulas.js";
import { explicarSobDemanda } from "./outroJeito.js";
import { avaliarCartao, filaCartoes } from "./cartoes.js";

// quem está usando: o usuário da sessão; no modo dono único (sem login), o ALUNO_ID
export const ALUNO = usuarioAtualId;
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

// mistura de dificuldade das oficiais (≥ 30 com dificuldade) ou a estimativa padrão
async function misturaOficial(): Promise<Mistura> {
  const difs = await Question.find({ origem: "oficial", status: "aprovada", dificuldade: { $exists: true } }).select("dificuldade").lean();
  return misturaDasOficiais(difs.map((q) => q.dificuldade ?? 3));
}

// peso no treino: o do edital (questoesNaProva) ou a cota da disciplina na prova ÷ tópicos dela
async function listarTopicos(): Promise<TopicoDTO[]> {
  const ts = [...(await mapaTopicos()).values()];
  const porDisc = new Map<string, number>();
  for (const t of ts) porDisc.set(t.disciplina, (porDisc.get(t.disciplina) ?? 0) + 1);
  return ts.map((t) => ({
    id: String(t._id),
    disciplina: t.disciplina as Disciplina,
    assunto: t.assunto,
    subtopicos: t.subtopicos ?? [],
    peso: pesoDoTopico(t.disciplina as Disciplina, porDisc.get(t.disciplina) ?? 1, t.questoesNaProva),
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
  variacao?: { tipo?: string | null } | null;
  explicacaoGeral?: string | null;
  dicaDeProva?: string | null;
  fontes?: { sourceId?: Types.ObjectId | null; trecho?: string | null }[];
  auditoria?: { respostaCega?: string | null } | null;
  notaNorma?: string | null;
  figuras?: { tipo: string; posicao?: string | null; legenda?: string | null; dados?: unknown; imagem?: string | null; status?: string | null }[] | null;
};

// Só figuras conferidas (status ok) vão para a questão
function figurasDTO(q: QuestaoDoc): FiguraDTO[] | undefined {
  const ok = (q.figuras ?? []).filter((f) => f.status === "ok");
  if (!ok.length) return undefined;
  return ok.map((f) => {
    const base: FiguraDTO = {
      tipo: f.tipo as TipoFigura,
      posicao: (f.posicao ?? "enunciado") as PosicaoFigura,
      legenda: f.legenda ?? undefined,
      imagem: f.imagem ?? undefined,
    };
    if (f.tipo === "tabela" && f.dados) base.tabela = f.dados as TabelaDados;
    if (f.tipo === "planilha" && f.dados) base.planilha = f.dados as PlanilhaDados;
    if (f.tipo === "grafico" && f.dados) base.grafico = f.dados as GraficoDados;
    if (f.tipo === "tela_programa" && f.dados) base.tela = f.dados as TelaProgramaDados;
    return base;
  });
}

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
    notaNorma: q.notaNorma ?? undefined,
    figuras: figurasDTO(q),
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
    {
      $set: { ...novo, proximaRevisao: new Date(Date.now() + novo.intervaloDias * 86_400_000) },
      ...(acertou ? { $unset: { comTempo: 1 } } : {}), // acertou: sai do treino com tempo
    },
    { upsert: true }
  );
  return { acertou, xp, dias: novo.intervaloDias };
}

// ------------------------------------------------------------
// Geração sob demanda: estoque baixo num tópico → a IA gera em segundo plano
// ------------------------------------------------------------
const gerando = new Set<string>();
// De dia o app só usa o que está pronto (PLANO-MESTRE 5.1): o banco cresce no noturno.
// GERACAO_DE_DIA=1 religa a geração sob demanda (útil só enquanto o noturno não roda).
const geraDeDia = () => process.env.GERACAO_DE_DIA === "1";
function reabastecerEmSegundoPlano(topicId: string, quantas = 3) {
  if (!geraDeDia() || gerando.has(topicId) || !process.env.GERADOR_API_KEY) return;
  gerando.add(topicId);
  (async () => {
    try {
      // um job de IA por vez: se a CLI estiver gerando/explicando/ingerindo, tenta de novo depois
      const rodou = await seFilaLivre(`estoque do tópico ${topicId} (servidor)`, async () => {
        for (let i = 0; i < quantas; i++) {
          const r = await gerarQuestao(topicId);
          if (!r.ok && r.motivo === "teto_diario") break; // GERACAO_MAX_DIA
        }
      });
      if (!rodou) console.log(`[estoque] ${topicId}: fila ocupada, fica para a próxima`);
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
  aula: aulaDoTopico,
  explicarMais: (questaoId, duvida) => explicarSobDemanda(questaoId, String(ALUNO()), duvida),
  cartoes: filaCartoes,
  avaliarCartao,

  async painel() {
    const userId = ALUNO();
    const [topicos, tentativas, revisoes, aprovadas, alertasAdmin, redacaoCorrigidaPendente, redacoes] = await Promise.all([
      listarTopicos(),
      Attempt.find({ userId }).select("questionId topicId acertou xp modo simuladoId confianca motivoErro tempoSeg createdAt").lean(),
      ReviewState.find({ userId }).select("proximaRevisao").lean(),
      Question.find({ status: "aprovada" }).select("_id topicId origem createdAt").lean(),
      // só o admin vê (com o login da Etapa 4, só vai para o papel admin)
      usuarioAtual()?.papel === "aluno" ? ([] as string[]) : alertasAdminAgora().catch(() => [] as string[]),
      Redacao.exists({ userId, status: "corrigida", avisada: false }),
      Redacao.find({ userId, status: "corrigida" }).select("correcao").lean(),
    ]);
    const brutas: TentativaBruta[] = tentativas.map((t) => ({
      questaoId: String(t.questionId),
      topicoId: String(t.topicId),
      acertou: t.acertou,
      xp: t.xp ?? 0,
      modo: (t.modo ?? "treino") as Modo,
      simuladoId: t.simuladoId ?? undefined,
      data: (t.createdAt as Date).toISOString(),
      confianca: (t.confianca ?? undefined) as Confianca | undefined,
      motivoErro: (t.motivoErro ?? undefined) as MotivoErro | undefined,
      tempoSeg: t.tempoSeg ?? undefined,
    }));
    const painel = calcularPainel({
      topicos,
      tentativas: brutas,
      revisoes: revisoes.map((r) => (r.proximaRevisao as Date).toISOString()),
      redacoes: redacoes.map((r) => ({ notaTotal: Number((r.correcao as { notaTotal?: number } | null)?.notaTotal ?? 0) })),
    });
    const disciplinaDo = new Map(topicos.map((t) => [t.id, t.disciplina]));
    const banco = calcularBanco(
      aprovadas.flatMap((q) => {
        const disciplina = disciplinaDo.get(String(q.topicId));
        return disciplina ? [{ id: String(q._id), disciplina, gerada: q.origem === "gerada", criadaEm: (q.createdAt as Date).toISOString() }] : [];
      }),
      new Set(brutas.map((t) => t.questaoId))
    );
    banco.repetidasNoite = await Geracao.countDocuments({ em: { $gte: inicioDaNoite() }, motivo: { $in: MOTIVOS_REPETICAO } });
    return { ...painel, banco, alertasAdmin, redacaoCorrigidaPendente: !!redacaoCorrigidaPendente };
  },

  async proxima(f) {
    const userId = ALUNO();
    const topicos = await mapaTopicos();

    if (f.questaoId) {
      const q = await Question.findById(oid(f.questaoId)).lean<QuestaoDoc>();
      return { questao: q ? paraDTO(q, topicos) : null, modo: "treino" };
    }

    // treino misturado: sorteia a disciplina desta questão no peso da prova (nunca a da anterior)
    if (f.misto && !f.topicoId) {
      const comQuestao = new Set((await Question.distinct("topicId", { status: "aprovada" })).map(String));
      const disponiveis = [...new Set([...topicos.values()].filter((t) => comQuestao.has(String(t._id))).map((t) => t.disciplina as Disciplina))];
      const d = sortearDisciplinaMista(disponiveis, f.anterior);
      if (d) f = { ...f, disciplina: d };
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
        const v = vencidas.find((x) => porId.has(String(x.questionId)));
        if (v) {
          const dto = paraDTO(porId.get(String(v.questionId))!, topicos);
          return { questao: v.comTempo ? { ...dto, tempoAlvoSeg: TEMPO_ALVO_SEG } : dto, modo: "revisao" };
        }
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
          ? geraDeDia()
            ? "O lobo está preparando questões deste tópico. Tente de novo em um ou dois minutos."
            : "Este tópico ainda não tem questões prontas. O lobo prepara mais toda noite; por hoje, escolha outro."
          : 'Ainda não há questões aprovadas aqui. Ingira uma prova ou rode "npm run bb -- gerar --assunto ...".',
      };
    }
    const desempenho = await Attempt.aggregate<{ _id: Types.ObjectId; n: number; a: number }>([
      { $match: { userId } },
      { $group: { _id: "$topicId", n: { $sum: 1 }, a: { $sum: { $cond: ["$acertou", 1, 0] } } } },
    ]);
    const stats = new Map(desempenho.map((d) => [String(d._id), d]));
    const pesoPorTopico = new Map((await listarTopicos()).map((t) => [t.id, t.peso]));
    // "não sabia" recente sobe o tópico na fila (diagnóstico do erro)
    const naoSabia = await Attempt.aggregate<{ _id: Types.ObjectId; n: number }>([
      { $match: { userId, motivoErro: "nao_sabia", createdAt: { $gte: new Date(Date.now() - JANELA_NAO_SABIA_DIAS * 86_400_000) } } },
      { $group: { _id: "$topicId", n: { $sum: 1 } } },
    ]);
    const naoSabiaPor = new Map(naoSabia.map((d) => [String(d._id), d.n]));
    const elegiveis = candidatos.filter((t) => comQuestao.has(String(t._id)));
    const escolhido = sortearPonderado(elegiveis, (t) => {
      const s = stats.get(String(t._id));
      return prioridade(pesoPorTopico.get(String(t._id)) ?? null, s?.n ?? 0, s?.a ?? 0) * fatorNaoSabia(naoSabiaPor.get(String(t._id)) ?? 0);
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
      aviso: naoVistas ? undefined : "Você já viu todas as questões deste tópico; chegam novas esta noite. Por ora, repetindo uma.",
    };
  },

  async responder(r) {
    const q = await Question.findById(oid(r.questaoId)).lean<QuestaoDoc>();
    if (!q) throw new Error("Questão não encontrada");
    const { xp, dias } = await registrar(q, r.resposta, r.confianca, r.modo, r.tempoSeg);
    return correcaoDe(q, r.resposta, xp, dias);
  },

  // Diagnóstico do erro: grava o motivo no último erro dessa questão e aplica a ação
  async motivoErro(questaoId, motivo): Promise<AcaoMotivoDTO> {
    const userId = ALUNO();
    const qid = oid(questaoId);
    const tentativa = await Attempt.findOneAndUpdate(
      { userId, questionId: qid, acertou: false, modo: { $ne: "simulado" } },
      { $set: { motivoErro: motivo } },
      { sort: { createdAt: -1 }, returnDocument: "after" }
    ).lean();
    if (!tentativa) throw new Error("Não achei um erro recente nessa questão.");
    const q = await Question.findById(qid).lean<QuestaoDoc>();
    if (!q) throw new Error("Questão não encontrada");
    const acao: AcaoMotivoDTO = { motivo, mensagem: MENSAGEM_MOTIVO[motivo], topicoId: String(q.topicId) };

    if (motivo === "chutei") {
      await ReviewState.updateOne({ userId, questionId: qid }, { $set: { proximaRevisao: new Date(Date.now() + REVISAO_CHUTE_MIN * 60_000) } });
      acao.revisaoEmMin = REVISAO_CHUTE_MIN;
    } else if (motivo === "desatencao") {
      await ReviewState.updateOne({ userId, questionId: qid }, { $set: { comTempo: true } });
      const certa = q.alternativas.find((a) => a.letra === q.gabarito)?.texto ?? "";
      const marcada = q.alternativas.find((a) => a.letra === tentativa.resposta)?.texto ?? "";
      acao.palavrasChave = palavrasDecisivas(certa, marcada);
    } else if (motivo === "confundi") {
      // mesma regra/tipo no mesmo tópico (por construção) ou outra do tópico; inédita primeiro
      const vistas = await Attempt.distinct("questionId", { userId, topicId: q.topicId });
      const base = { topicId: q.topicId, status: "aprovada", _id: { $ne: qid } };
      const tipo = q.variacao?.tipo;
      const tentativas = [
        ...(tipo ? [{ ...base, "variacao.tipo": tipo, _id: { $nin: [qid, ...vistas] } }, { ...base, "variacao.tipo": tipo }] : []),
        { ...base, _id: { $nin: [qid, ...vistas] } },
        base,
      ];
      for (const filtro of tentativas) {
        const [par] = await Question.aggregate<{ _id: Types.ObjectId }>([{ $match: filtro }, { $sample: { size: 1 } }, { $project: { _id: 1 } }]);
        if (par) {
          acao.proximaQuestaoId = String(par._id);
          break;
        }
      }
      if (!acao.proximaQuestaoId) acao.mensagem = "Anotado. Ainda não há outra questão desse tópico para comparar; ela volta na revisão.";
    }
    return acao;
  },

  async misturaSimulado() {
    return misturaOficial();
  },

  // Simulado fiel: cotas da prova real por disciplina e, dentro delas, a mistura de dificuldade
  async simulado(n) {
    const topicos = await listarTopicos();
    const comQuestao = new Set((await Question.distinct("topicId", { status: "aprovada" })).map(String));
    const validos = topicos.filter((t) => comQuestao.has(t.id));
    const cotas = cotasPorDisciplina(n, validos);
    const mistura = await misturaOficial();
    const mapa = await mapaTopicos();
    const escolhidas: QuestaoDoc[] = [];
    const FAIXAS = { facil: [1, 2], media: [3], dificil: [4, 5] } as const;
    for (const [disc, k] of cotas) {
      if (!k) continue;
      const ids = validos.filter((t) => t.disciplina === disc).map((t) => oid(t.id));
      const daDisc: QuestaoDoc[] = [];
      for (const [faixa, q] of cotasPorFaixa(k, mistura)) {
        if (!q) continue;
        daDisc.push(...(await Question.aggregate<QuestaoDoc>([
          { $match: { topicId: { $in: ids }, status: "aprovada", dificuldade: { $in: [...FAIXAS[faixa]] } } },
          { $sample: { size: q } },
        ])));
      }
      // faltou numa faixa: completa com qualquer dificuldade da mesma disciplina
      if (daDisc.length < k)
        daDisc.push(...(await Question.aggregate<QuestaoDoc>([
          { $match: { topicId: { $in: ids }, status: "aprovada", _id: { $nin: daDisc.map((q) => q._id) } } },
          { $sample: { size: k - daDisc.length } },
        ])));
      escolhidas.push(...daDisc);
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

  temasRedacao: listarTemasRedacao,
  pedirTemaRedacao,
  corrigirRedacao: enviarRedacao,
  redacoes: historicoRedacoes,
  marcarRedacoesVistas,
};
