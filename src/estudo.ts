// ============================================================
// BB Estudos — Motor de estudo do SERVIDOR (implementa a interface Api do front)
// As regras (XP, SM-2, prioridade, painel) vêm de shared/motor.ts — as mesmas do modo demo.
// ============================================================
import { Types } from "mongoose";
import { Attempt, Question, RatingAluno, ReviewState, Topic, Report, Source, Redacao, ItemCE, RespostaCE, Simulado } from "./models.js";
import { corrigirCE, recomendarBranco, type GabaritoCE } from "../shared/certoErrado.js";
import { MISTURA_DIAGNOSTICO, PREFIXO_DIAGNOSTICO, ratingDoDiagnostico } from "../shared/diagnostico.js";
import { atualizarRatings, dificuldadeExibida, pesoPorProximidade, ratingInicialQuestao, ALVO_ACIMA, RATING_ALUNO_INICIAL } from "../shared/rating.js";
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
import { usuarioAtualId, usuarioAtual, concursoDaRequisicao } from "./auth.js";
import { bancaConfigurada, infoConcursos } from "./concursosConfig.js";
import { Geracao } from "./models.js";
import { MOTIVOS_REPETICAO } from "./similaridade.js";
import { inicioDaNoite } from "../shared/motor.js";
import { pesoDoTopico, cotasPorFaixa, faixaDe, sortearDisciplinaMista, COTAS_PROVA, MISTURA_SIMULADO } from "../shared/estruturaProva.js";
import { BANCAS, bancaEmUso, CONCURSO_PADRAO, type IdBanca, type IdConcurso } from "../shared/concursos.js";
import { fatorNaoSabia, palavrasDecisivas, JANELA_NAO_SABIA_DIAS, MENSAGEM_MOTIVO, REVISAO_CHUTE_MIN, TEMPO_ALVO_SEG } from "../shared/aprendizado.js";
import type { AcaoMotivoDTO, ConcursoInfoDTO, CorrecaoCEDTO, MotivoErro, ProximoItemCEDTO } from "../shared/tipos.js";
import { enviarRedacao, historicoRedacoes, listarTemasRedacao, marcarRedacoesVistas, pedirTemaRedacao } from "./redacao.js";
import { aulaDoTopico } from "./aulas.js";
import { explicarSobDemanda } from "./outroJeito.js";
import { perguntarAoBinho } from "./chatBinho.js";
import { avaliarCartao, filaCartoes } from "./cartoes.js";
import { fontesDaQuestao } from "./fontesAtuais.js";
import { definirTemaDoDia, desempenhoTemas, paginaTema, pedirPrioridade, prontidao, proximaDoTema, proximoErroDoTema, temasDaMistura, trilha } from "./temas.js";
import { listarSimulados, salvarSimulado } from "./simulados.js";
import { espacoLo, salvarPosicaoAudio } from "./espacoLo.js";

// quem está usando: o usuário da sessão; no modo dono único (sem login), o ALUNO_ID
export const ALUNO = usuarioAtualId;
// em que concurso e banca o aluno está estudando agora (Elo, tentativas, simulado e formato da banca).
// F5: o concurso vem da aba do site (cabeçalho X-Concurso, no contexto da requisição); a banca é a que o
// admin configurou ou, "a definir", a de referência (BACEN: Cebraspe). Aba "Geral": o BB de sempre.
export function chaveConcurso(): { concurso: IdConcurso; banca: IdBanca } {
  const concurso = (concursoDaRequisicao() ?? CONCURSO_PADRAO) as IdConcurso;
  return { concurso, banca: bancaEmUso(concurso, bancaConfigurada(concurso)) };
}
// Trilha única (25/10/2026): a aba do concurso é uma LENTE sobre o mesmo domínio; "Geral" (sem lente) = tudo
export const lenteAtiva = (): IdConcurso | null => (concursoDaRequisicao() as IdConcurso | undefined) ?? null;
const oid = (s: string) => {
  if (!/^[0-9a-f]{24}$/i.test(s)) throw new Error(`id inválido: ${s}`);
  return new Types.ObjectId(s);
};

// ------------------------------------------------------------
// Conversões
// ------------------------------------------------------------
// lente do concurso: só os tópicos dele (matéria comum aparece em todos; tópico antigo sem concurso = BB).
// Aba "Geral": todos os tópicos ativos.
export async function mapaTopicos() {
  const lente = lenteAtiva();
  const ts = await Topic.find(
    lente ? { ativo: true, $or: [{ concursos: lente }, ...(lente === "bb" ? [{ concursos: { $exists: false } }] : [])] } : { ativo: true }
  ).lean();
  // BACEN: a matéria da área (Suporte Técnico-Administrativo) só entra para quem é dessa área
  const area = infoConcursos().find((c) => c.id === "bacen")?.area;
  const fora = (lente === "bacen" || !lente) && area !== "suporte_tecnico_administrativo" ? "suporte_tecnico_administrativo" : null;
  return new Map(ts.filter((t) => t.disciplina !== fora).map((t) => [String(t._id), t]));
}


// questões dos tópicos do concurso ativo (revisões, erros e simulado filtram por elas; matéria comum vale nos dois)
async function questoesDoConcurso(mapa?: Awaited<ReturnType<typeof mapaTopicos>>): Promise<Types.ObjectId[]> {
  const m = mapa ?? (await mapaTopicos());
  return (await Question.distinct("_id", { topicId: { $in: [...m.values()].map((t) => t._id) } })) as Types.ObjectId[];
}

async function simuladosDaLente<T extends { id: string }>(userId: Types.ObjectId, lente: IdConcurso, lista: T[]): Promise<T[]> {
  const docs = await Simulado.find({ userId }).select("_id concurso").lean();
  const daLente = new Set(docs.filter((d) => (d.concurso ?? "bb") === lente).map((d) => String(d._id)));
  const conhecidos = new Set(docs.map((d) => String(d._id)));
  return lista.filter((s) => daLente.has(s.id) || (!conhecidos.has(s.id) && lente === "bb"));
}

// ------------------------------------------------------------
// Certo/Errado (F10): itens aprovados do concurso ativo; recomendação de "em branco" e nota pela banca dele
// ------------------------------------------------------------
async function historicoCE(subtopico: string | null | undefined) {
  if (!subtopico) return { acertos: 0, total: 0 };
  const rs = await RespostaCE.find({ userId: ALUNO(), subtopico, resposta: { $ne: null } }).select("acertou").lean();
  return { acertos: rs.filter((r) => r.acertou).length, total: rs.length };
}

// banca do Certo/Errado: a da lente; na aba Geral, a Cebraspe (o formato C/E é dela)
const bancaCE = (): IdBanca => (lenteAtiva() ? chaveConcurso().banca : "cebraspe");

async function proximoItemCE(f: { subtopico?: string; disciplina?: Disciplina; excluir?: string[] }): Promise<ProximoItemCEDTO> {
  const banca = bancaCE();
  const mapa = await mapaTopicos();
  const topicos = [...mapa.values()].filter((t) => !f.disciplina || t.disciplina === f.disciplina);
  const filtro: Record<string, unknown> = { status: "aprovada", topicId: { $in: topicos.map((t) => t._id) } };
  if (f.subtopico) filtro.subtopico = f.subtopico;
  const excluir = (f.excluir ?? []).filter((x) => /^[0-9a-f]{24}$/i.test(x)).map(oid);
  // primeiro os que o aluno nunca respondeu; depois qualquer um
  const respondidos = await RespostaCE.distinct("itemId", { userId: ALUNO() });
  let [item] = await ItemCE.aggregate([{ $match: { ...filtro, _id: { $nin: [...excluir, ...respondidos] } } }, { $sample: { size: 1 } }]);
  if (!item) [item] = await ItemCE.aggregate([{ $match: { ...filtro, _id: { $nin: excluir } } }, { $sample: { size: 1 } }]);
  const nomeBanca = BANCAS[banca].nome;
  if (!item) return { item: null, recomendacao: null, banca, nomeBanca, aviso: "Ainda não há itens Certo/Errado aprovados aqui. Eles chegam com a derivação noturna e as provas da Cebraspe." };
  const t = mapa.get(String(item.topicId));
  return {
    item: {
      id: String(item._id), topicoId: String(item.topicId), disciplina: (t?.disciplina as Disciplina) ?? null, assunto: t?.assunto ?? "",
      subtopico: item.subtopico ?? null, afirmacao: item.afirmacao, ...(item.textoBase ? { textoBase: item.textoBase } : {}),
      origem: item.origem, ...(item.prova ? { prova: item.prova } : {}),
    },
    recomendacao: recomendarBranco(await historicoCE(item.subtopico), banca),
    banca,
    nomeBanca,
  };
}

async function responderItemCE(r: { itemId: string; resposta: "C" | "E" | null; tempoSeg: number }): Promise<CorrecaoCEDTO> {
  const { concurso } = chaveConcurso();
  const banca = bancaCE();
  const item = await ItemCE.findById(oid(r.itemId)).lean();
  if (!item || item.status !== "aprovada") throw new Error("Item fora de circulação.");
  const resposta = r.resposta === "C" || r.resposta === "E" ? r.resposta : null;
  const gabarito = item.gabarito as GabaritoCE;
  const acertou = resposta === null ? null : gabarito === "anulada" || resposta === gabarito;
  await RespostaCE.create({ userId: ALUNO(), itemId: item._id, subtopico: item.subtopico, resposta, acertou, concurso, banca, tempoSeg: Math.max(0, Math.min(3600, Math.round(r.tempoSeg || 0))) });
  const { nota: pontos } = corrigirCE([{ resposta, gabarito }], banca);
  return { gabarito, acertou, pontos, explicacao: item.explicacao ?? "", recomendacao: recomendarBranco(await historicoCE(item.subtopico), banca) };
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
  banca?: string | null;
  estiloBanca?: string | null;
  textoBase?: string | null;
  enunciado: string;
  alternativas: { letra: string; texto: string; correta: boolean; explicacao?: string | null; pegadinha?: string | null }[];
  gabarito: string;
  dificuldade?: number | null;
  variacao?: { tipo?: string | null } | null;
  rating?: number | null;
  ratingN?: number | null;
  explicacaoGeral?: string | null;
  dicaDeProva?: string | null;
  fontes?: { sourceId?: Types.ObjectId | null; trecho?: string | null }[];
  auditoria?: { respostaCega?: string | null } | null;
  notaNorma?: string | null;
  referencias?: { papel: string; ref: string; questao?: string | null; trecho?: string | null; conferidoEm?: Date | null }[] | null;
  situacaoFonte?: string | null;
  oQueMudou?: { antes?: string | null; hoje?: string | null; trechoHoje?: string | null; fonteHoje?: string | null; aprovadoEm?: Date | null } | null;
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
    origem: q.origem as "oficial" | "gerada" | "cursinho",
    prova: q.prova ?? undefined,
    numeroOriginal: q.numeroOriginal ?? undefined,
    banca: q.banca ?? q.estiloBanca ?? undefined,
    formato: "multipla",
    textoBase: q.textoBase ?? undefined,
    enunciado: q.enunciado,
    alternativas: q.alternativas.map((a) => ({ letra: a.letra as Letra, texto: a.texto })),
    dificuldade: dificuldadeExibida(q.dificuldade ?? 3, q.rating, q.ratingN),
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
    referencias: fontesDaQuestao(q),
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
  const ctx = chaveConcurso();

  await Attempt.create({ userId, questionId: q._id, topicId: q.topicId, resposta: resposta ?? undefined, acertou, tempoSeg, confianca, modo, xp, simuladoId, ...ctx });

  // rating Elo: aluno (por concurso + banca + disciplina) × questão; simulado também conta
  const disciplina = (await Topic.findById(q.topicId).select("disciplina").lean())?.disciplina;
  const ra = disciplina ? await RatingAluno.findOne({ userId, ...ctx, disciplina }).lean() : null;
  const r = atualizarRatings(ra?.rating ?? RATING_ALUNO_INICIAL, q.rating ?? ratingInicialQuestao(q.dificuldade ?? 3), acertou, confianca);
  await Question.updateOne({ _id: q._id }, { $inc: { "stats.tentativas": 1, "stats.acertos": acertou ? 1 : 0, ratingN: 1 }, $set: { rating: r.questao } });
  if (disciplina) await RatingAluno.updateOne({ userId, ...ctx, disciplina }, { $set: { rating: r.aluno }, $inc: { n: 1 } }, { upsert: true });

  // só os 3 campos do SM-2: espalhar o documento inteiro levava _id/__v para o $set e a 2ª resposta à
  // mesma questão (revisão, simulado) quebrava com "Updating the path '__v' would create a conflict"
  const atual = await ReviewState.findOne({ userId, questionId: q._id }).select("facilidade intervaloDias repeticoes").lean();
  const estado = atual ? { facilidade: atual.facilidade, intervaloDias: atual.intervaloDias, repeticoes: atual.repeticoes } : ESTADO_INICIAL;
  const novo = agendar(estado, notaSM2(acertou, confianca));
  await ReviewState.updateOne(
    { userId, questionId: q._id },
    {
      $set: { facilidade: novo.facilidade, intervaloDias: novo.intervaloDias, repeticoes: novo.repeticoes, proximaRevisao: new Date(Date.now() + novo.intervaloDias * 86_400_000) },
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
// De dia o app só usa o que está pronto: o banco cresce no noturno.
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
  perguntarBinho: (topicoId, pergunta) => perguntarAoBinho(topicoId, String(ALUNO()), pergunta),
  cartoes: filaCartoes,
  avaliarCartao,
  desempenhoTemas,
  trilha,
  tema: paginaTema,
  pedirPrioridadeTema: pedirPrioridade,
  definirTemaDoDia,
  simulados: async () => {
    const lente = lenteAtiva();
    return (await listarSimulados(ALUNO())).filter((s) => !lente || s.concurso === lente);
  },
  concursos: async () => infoConcursos() as ConcursoInfoDTO[],
  prontidao,
  proximoItemCE,
  responderItemCE,

  async painel() {
    const userId = ALUNO();
    const doConcurso = await questoesDoConcurso(); // revisões contam só as do concurso ativo; XP e sequência, tudo
    const [topicos, tentativas, revisoes, aprovadas, alertasAdmin, redacaoCorrigidaPendente, redacoes] = await Promise.all([
      listarTopicos(),
      Attempt.find({ userId }).select("questionId topicId acertou xp modo simuladoId confianca motivoErro tempoSeg createdAt").lean(),
      ReviewState.find({ userId, questionId: { $in: doConcurso } }).select("proximaRevisao").lean(),
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
    const niveis = (await RatingAluno.find({ userId, ...chaveConcurso() }).select("disciplina rating n").lean()).map((r) => ({ disciplina: r.disciplina as Disciplina, rating: Math.round(r.rating), n: r.n ?? 0 }));
    // lente: histórico só dos simulados daquele concurso (os antigos, sem concurso gravado, são do BB)
    const lente = lenteAtiva();
    const simulados = lente ? await simuladosDaLente(userId, lente, painel.simulados) : painel.simulados;
    return { ...painel, simulados, banco, alertasAdmin, redacaoCorrigidaPendente: !!redacaoCorrigidaPendente, niveis };
  },

  async proxima(f) {
    const userId = ALUNO();
    const topicos = await mapaTopicos();

    if (f.questaoId) {
      const q = await Question.findById(oid(f.questaoId)).lean<QuestaoDoc>();
      return { questao: q ? paraDTO(q, topicos) : null, modo: "treino" };
    }

    // praticar por TEMA: só o subtópico, novas primeiro ("crase só traz crase")
    // v1.1: revisão dentro do tema = só as vencidas DAQUELE tema (nunca de outra matéria)
    if (f.subtopico && f.revisao) {
      const doTema = await Question.find({ subtopico: f.subtopico, status: "aprovada" }).select("_id").lean();
      const fora = new Set(f.excluir ?? []);
      const vencidas = await ReviewState.find({ userId, proximaRevisao: { $lte: new Date() }, questionId: { $in: doTema.map((q) => q._id) } }).sort({ proximaRevisao: 1 }).limit(30).lean();
      const v = vencidas.find((x) => !fora.has(String(x.questionId)));
      const q = v ? await Question.findById(v.questionId).lean<QuestaoDoc>() : null;
      return q ? { questao: paraDTO(q, topicos), modo: "revisao" } : { questao: null, modo: "revisao", aviso: "Nenhuma revisão vencida neste tema." };
    }
    // v1.1 (item 3): revisão dos erros do tema, no fim da sessão do tema
    if (f.subtopico && f.erros) {
      const id = await proximoErroDoTema(f.subtopico, f.excluir);
      const q = id ? await Question.findOne({ _id: oid(id), status: "aprovada" }).lean<QuestaoDoc>() : null;
      return q ? { questao: paraDTO(q, topicos), modo: "treino" } : { questao: null, modo: "treino", aviso: "Nenhum erro para revisar neste tema." };
    }
    if (f.subtopico) {
      const r = await proximaDoTema(f.subtopico, f.excluir, f.banca);
      if (!r) return { questao: null, modo: "treino", aviso: "Este tema ainda não tem questões aprovadas. Pedi prioridade ao noturno." };
      const q = await Question.findById(r.id).lean<QuestaoDoc>();
      return {
        questao: q ? { ...paraDTO(q, topicos), ...(r.subtema ? { subtema: r.subtema } : {}) } : null,
        modo: "treino",
        aviso: r.nova ? undefined : "Acabaram as novas deste tema; repetindo uma. O noturno prepara mais.",
        repetida: !r.nova,
      };
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
      // v1.1 (item 3): a revisão misturada só traz temas concluídos (ou em andamento, se nenhum concluído)
      const mistura = await temasDaMistura();
      const permitidas = mistura
        ? ((await Question.distinct("_id", { _id: { $in: await questoesDoConcurso(topicos) }, subtopico: { $in: [...mistura] } })) as Types.ObjectId[])
        : await questoesDoConcurso(topicos);
      const vencidas = await ReviewState.find({ userId, proximaRevisao: { $lte: new Date() }, questionId: { $in: permitidas } })
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
    // no seu nível: entre até 40 candidatas, mais chance para rating perto do seu + 50 (Elo, 8.7)
    const candidatas = await Question.aggregate<{ _id: Types.ObjectId; rating?: number; dificuldade?: number }>([
      { $match: { topicId: escolhido._id, status: "aprovada", ...(naoVistas ? { _id: { $nin: respondidas } } : {}) } },
      { $sample: { size: 40 } },
      { $project: { rating: 1, dificuldade: 1 } },
    ]);
    const meu = (await RatingAluno.findOne({ userId, ...chaveConcurso(), disciplina: escolhido.disciplina }).lean())?.rating ?? RATING_ALUNO_INICIAL;
    const alvo = sortearPonderado(candidatas, (c) => pesoPorProximidade(c.rating ?? ratingInicialQuestao(c.dificuldade ?? 3), meu + ALVO_ACIMA))!;
    const q = await Question.findById(alvo._id).lean<QuestaoDoc>();
    if (!q) return { questao: null, modo: "treino", aviso: "Não deu para buscar a questão agora. Tente de novo." };
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

  // simulado: 20/50/30 fixo (decisão do dono); a dificuldade estimada das oficiais saía 72% fácil
  async misturaSimulado() {
    return MISTURA_SIMULADO;
  },

  // Simulado fiel: cotas da prova real por disciplina e, dentro delas, a mistura de dificuldade
  // simulado fiel: só oficiais e geradas (questão de cursinho, camada C, treina mas fica fora)
  async simulado(n, opcoes) {
    const topicos = await listarTopicos();
    const comQuestao = new Set((await Question.distinct("topicId", { status: "aprovada" })).map(String));
    const validos = topicos.filter((t) => comQuestao.has(t.id));
    const cotas = cotasPorDisciplina(n, validos);
    // Raio-X: só dificuldade média (completa com outras se faltar)
    const mistura = opcoes?.diagnostico ? MISTURA_DIAGNOSTICO : MISTURA_SIMULADO;
    const mapa = await mapaTopicos();
    // v1.1 (item 3): simulado só com temas concluídos (ou em andamento, se nenhum concluído); o Raio-X
    // (diagnóstico) continua olhando tudo, é ele que mostra onde começar
    const temas = opcoes?.diagnostico ? null : await temasDaMistura();
    const daMistura = temas ? { subtopico: { $in: [...temas] } } : {};
    const escolhidas: QuestaoDoc[] = [];
    const FAIXAS = { facil: [1, 2], media: [3], dificil: [4, 5] } as const;
    for (const [disc, k] of cotas) {
      if (!k) continue;
      const ids = validos.filter((t) => t.disciplina === disc).map((t) => oid(t.id));
      const daDisc: QuestaoDoc[] = [];
      for (const [faixa, q] of cotasPorFaixa(k, mistura)) {
        if (!q) continue;
        daDisc.push(...(await Question.aggregate<QuestaoDoc>([
          { $match: { topicId: { $in: ids }, status: "aprovada", origem: { $ne: "cursinho" }, dificuldade: { $in: [...FAIXAS[faixa]] }, ...daMistura } },
          { $sample: { size: q } },
        ])));
      }
      // faltou numa faixa: completa com qualquer dificuldade da mesma disciplina
      if (daDisc.length < k)
        daDisc.push(...(await Question.aggregate<QuestaoDoc>([
          { $match: { topicId: { $in: ids }, status: "aprovada", origem: { $ne: "cursinho" }, _id: { $nin: daDisc.map((q) => q._id) }, ...daMistura } },
          { $sample: { size: k - daDisc.length } },
        ])));
      escolhidas.push(...daDisc);
    }
    if (escolhidas.length < n) {
      // completa só com disciplinas da prova (fora do edital não entra em simulado nem no Raio-X)
      const daProva = validos.filter((t) => (COTAS_PROVA[t.disciplina] ?? 0) > 0).map((t) => oid(t.id));
      const extra = await Question.aggregate<QuestaoDoc>([
        { $match: { status: "aprovada", origem: { $ne: "cursinho" }, topicId: { $in: daProva }, _id: { $nin: escolhidas.map((q) => q._id) }, ...daMistura } },
        { $sample: { size: n - escolhidas.length } },
      ]);
      escolhidas.push(...extra);
    }
    return escolhidas.sort(() => Math.random() - 0.5).map((q) => paraDTO(q, mapa));
  },

  async corrigirSimulado(respostas, opcoes) {
    const simuladoId = `${opcoes?.diagnostico ? PREFIXO_DIAGNOSTICO : ""}${new Types.ObjectId().toString()}`;
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
    // guarda o resumo (concurso, banca, tempo, matérias, subtópicos, nota no critério da prova)
    if (correcoes.length) await salvarSimulado(ALUNO(), simuladoId, chaveConcurso(), respostas.length);
    // Raio-X: o resultado vira o nível inicial (rating) de cada disciplina medida
    if (opcoes?.diagnostico) {
      const userId = ALUNO();
      for (const [disciplina, v] of porDisc)
        await RatingAluno.updateOne({ userId, ...chaveConcurso(), disciplina }, { $set: { rating: ratingDoDiagnostico(v.acertos, v.total) }, $setOnInsert: { n: v.total } }, { upsert: true });
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
      (await Question.find({ _id: { $in: grupos.map((g) => g._id) } }).select("enunciado topicId explicacaoGeral").lean()).map((q) => [String(q._id), q])
    );
    return grupos
      // só os erros de tópicos do concurso ativo (matéria comum aparece nos dois)
      .filter((g) => qs.has(String(g._id)) && mapa.has(String(qs.get(String(g._id))!.topicId)))
      .map((g): ErroDTO => {
        const q = qs.get(String(g._id))!;
        const t = mapa.get(String(q.topicId));
        return {
          questaoId: String(g._id),
          disciplina: (t?.disciplina ?? "conhecimentos_bancarios") as Disciplina,
          assunto: t?.assunto ?? "",
          enunciado: q.enunciado,
          explicacao: q.explicacaoGeral ?? undefined,
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
  espacoLo,
  salvarPosicaoAudio,
};
