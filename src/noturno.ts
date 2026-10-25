// ============================================================
// BB Estudos — Noturno: fila persistida de tarefas (sobrevive a reinício; infraestrutura volta, qualidade descarta)
// Planeja (questões que faltam por tópico + verificação semanal dos modelos) e roda uma por vez.
// Falha de infraestrutura volta para a fila até 3 vezes, com espera crescente (NOTURNO_ESPERAS_MIN);
// descarte só por qualidade, com o motivo. Sobrevive a reinício: tarefa "rodando" de um processo
// que morreu volta para a fila.
// ============================================================
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Types } from "mongoose";
import { Tarefa, Topic, Question, Chunk, Source, Attempt, Config, DISCIPLINAS_COM_FONTE_OBRIGATORIA, type Disciplina } from "./models.js";
import { statusDe, dominioDe } from "../shared/motor.js";
import { SUBTOPICO_POR_ID, subtopicosDoTopico } from "../shared/subtopicos.js";
import { concursosDoTema, MINIMO_NOVAS, situacaoTrilha, TRILHA, type InicioTrilha } from "../shared/trilha.js";
import { diaLocal, diasDaTrilha } from "../shared/desempenhoTema.js";
import { carregarVariacoes } from "./variacao.js";
import { incidenciaPorTopico } from "./incidencia.js";

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

// ---------- plano da noite (meta do banco pela cota da prova) ----------
export interface TopicoPlano { id: string; assunto: string; disciplina: string; elegivel: boolean }
export interface AlunoPlano {
  respondidas: Map<string, number>; // tópico → questões aprovadas já respondidas
  dominados: Set<string>; // tópicos dominados
  recentes: Set<string>; // tópicos estudados nos últimos 7 dias
}
export interface ItemPlano {
  topicId: string;
  assunto: string;
  motivo: "meta" | "poucas_ineditas" | "dominado" | "trilha";
  dificuldade?: number;
  subtopico?: string; // trilha: o tema que precisa de questões novas
  tipo?: string; // tipo de variação forçado quando o tópico mistura subtópicos (crase em "Regência … e crase")
}

// Trilha (F12): o tema de AMANHÃ de cada aluno precisa de MINIMO_NOVAS questões que ele ainda não viu.
// alvo = um tema; "falta" já desconta o que está aberto na fila. Puro; o banco fica em alvosDaTrilha().
export interface AlvoTrilha { subtopico: string; topicId: string; assunto: string; tipo?: string; novasParaAluno: number; abertas: number }
export function itensDaTrilha(alvos: AlvoTrilha[], minimo = MINIMO_NOVAS): { item: ItemPlano; quantas: number }[] {
  const porTema = new Map<string, { item: ItemPlano; quantas: number }>();
  for (const a of alvos) {
    const falta = minimo - a.novasParaAluno - a.abertas;
    if (falta <= 0) continue;
    const atual = porTema.get(a.subtopico);
    if (atual && atual.quantas >= falta) continue; // dois alunos no mesmo tema: vale a maior falta
    porTema.set(a.subtopico, { item: { topicId: a.topicId, assunto: a.assunto, motivo: "trilha", subtopico: a.subtopico, ...(a.tipo ? { tipo: a.tipo } : {}) }, quantas: falta });
  }
  return [...porTema.values()];
}

// tipo de variação que gera o subtópico quando o tópico tem mais de um (senão, qualquer tipo serve)
export function tipoDoSubtopico(assunto: string, subtopico: string, tiposDoTopico: string[]): string | undefined {
  const s = SUBTOPICO_POR_ID.get(subtopico);
  if (!s?.tipos?.length || subtopicosDoTopico(assunto).length < 2) return undefined;
  const norm = (x: string) => x.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const casam = tiposDoTopico.filter((t) => s.tipos!.some((k) => norm(t).includes(norm(k))));
  return casam.find((t) => t.includes("por construção")) ?? casam[0];
}

// a noite prepara o dia de estudo que vem: de madrugada é o próprio dia; de dia/noite, o dia seguinte
export const diaDeEstudo = (agora: Date) => {
  const local = new Date(agora.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  return diaLocal(local.getHours() < 12 ? agora : new Date(agora.getTime() + 86_400_000));
};

// Meta do tópico: meta do banco × cota da disciplina na prova ÷ tópicos da disciplina
export function metaDoTopico(disciplina: string, topicosNaDisciplina: number, cotas: Record<string, number>, total: number, meta: number) {
  return Math.ceil(((meta * (cotas[disciplina] ?? 0)) / total) / Math.max(1, topicosNaDisciplina));
}

// temas pedidos na página do tema (Config "prioridade_temas") → tópicos que os contêm
async function topicosPedidos(topicos: { _id: unknown; assunto: string }[]) {
  const subs = Object.keys(((await Config.findById("prioridade_temas").lean())?.valor ?? {}) as Record<string, string>);
  const assuntos = new Set(subs.flatMap((s) => SUBTOPICO_POR_ID.get(s)?.topicos ?? []));
  return new Set(topicos.filter((t) => assuntos.has(t.assunto)).map((t) => String(t._id)));
}

// tema do próximo dia de estudo de cada aluno (mesma regra da tela: shared/trilha.ts) e quantas aprovadas
// desse tema ele ainda não respondeu; "abertas" = tarefas de trilha do tema ainda na fila
export async function alvosDaTrilha(topicos: { _id: unknown; assunto: string }[], agora = new Date()): Promise<AlvoTrilha[]> {
  const ativos = new Map(topicos.map((t) => [t.assunto, String(t._id)]));
  const [qs, tentativas, inicios, abertas] = await Promise.all([
    Question.find({ status: "aprovada", subtopico: { $exists: true } }).select("_id subtopico").lean(),
    Attempt.find({ modo: { $ne: "simulado" } }).select("userId questionId acertou createdAt").lean(),
    Config.find({ _id: /^trilha_inicio:/ }).lean(),
    Tarefa.aggregate<{ _id: string; n: number }>([
      { $match: { tipo: "gerar", "params.motivo": "trilha", status: { $in: ["pendente", "rodando", "aguardando"] } } },
      { $group: { _id: "$params.subtopico", n: { $sum: 1 } } },
    ]),
  ]);
  const subDe = new Map(qs.map((q) => [String(q._id), q.subtopico!]));
  const abertasPor = new Map(abertas.map((a) => [a._id, a.n]));
  const inicioDe = new Map(inicios.map((c) => [String(c._id).split(":")[1], c.valor as InicioTrilha]));
  const alunos = new Set([...tentativas.map((t) => String(t.userId)), ...inicioDe.keys()]);
  const temas = TRILHA.filter((t) => concursosDoTema(t).includes("bb"));
  const variacoes = carregarVariacoes();
  const dia = diaDeEstudo(agora);
  const alvos: AlvoTrilha[] = [];
  for (const u of alunos) {
    const minhas = tentativas.filter((t) => String(t.userId) === u);
    const ts = minhas.flatMap((t) => {
      const sub = subDe.get(String(t.questionId));
      return sub ? [{ questaoId: String(t.questionId), subtopico: sub, acertou: t.acertou, data: (t.createdAt as Date).toISOString(), simulado: false, origem: "gerada" as const }] : [];
    });
    const s = situacaoTrilha(diasDaTrilha(ts), dia, temas, inicioDe.get(u) ?? null);
    if (!s.tema) continue; // domingo ou treino de prova: sem tema novo
    const sub = SUBTOPICO_POR_ID.get(s.tema.subtopico);
    const assunto = sub?.topicos.find((a) => ativos.has(a));
    if (!assunto) continue;
    const vistas = new Set(minhas.map((t) => String(t.questionId)));
    const novas = qs.filter((q) => q.subtopico === s.tema!.subtopico && !vistas.has(String(q._id))).length;
    const tipo = tipoDoSubtopico(assunto, s.tema.subtopico, Object.keys(variacoes.tipos[assunto] ?? {}));
    alvos.push({ subtopico: s.tema.subtopico, topicId: ativos.get(assunto)!, assunto, ...(tipo ? { tipo } : {}), novasParaAluno: novas, abertas: abertasPor.get(s.tema.subtopico) ?? 0 });
  }
  return alvos;
}

export function planoDaNoite(p: {
  topicos: TopicoPlano[];
  aprovadas: Map<string, number>;
  alunos: AlunoPlano[];
  cotas: Record<string, number>;
  totalQuestoes: number;
  metaBanco: number;
  max: number;
  pedidos?: Set<string>; // tópicos de temas com < 15 aprovadas que o aluno pediu (página do tema): vão na frente
  trilha?: { item: ItemPlano; quantas: number }[]; // tema de amanhã sem 15 novas: antes de tudo
  incidencia?: Map<string, number>; // tópico → 0..1, o quanto caiu na banca do concurso (F8); sem dado = 0
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
    const pedido = !!p.pedidos?.has(t.id);
    if (!item && pedido) {
      item = { topicId: t.id, assunto: t.assunto, motivo: "poucas_ineditas" };
      quantas = 3;
    }
    if (!item) continue;
    if (item.motivo !== "meta" && alunos.some((a) => a.dominados.has(t.id))) item.dificuldade = 4;
    // pedido do aluno > estudado nos últimos 7 dias > peso na prova × incidência na banca > tamanho da falta
    const incidencia = p.incidencia?.get(t.id) ?? 0;
    const prioridade = (pedido ? 2000 : 0) + (recente ? 1000 : 0) + peso * 10 * (1 + incidencia) + Math.min(9, (quantas / meta) * 10);
    necessidades.push({ item, quantas, prioridade });
  }
  // trilha: o tema de amanhã vem antes de pedido, recente e peso (F12, prioridade 1)
  for (const t of p.trilha ?? []) necessidades.push({ item: t.item, quantas: t.quantas, prioridade: 3000 + t.quantas });
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
// Pré-geração da noite, na ordem: questões → explicações alternativas → aulas → cartões → fontes atuais →
// temas → áudio. A fila executa na ordem de criação, então a ordem do plano é a ordem da noite.
export const ORDEM_PRE_GERACAO = ["gerar", "explicar_outro_jeito", "aula", "cartoes", "fonte_atual", "tema", "voz"] as const;
export type EtapaNoite = (typeof ORDEM_PRE_GERACAO)[number];
export async function planejarEtapasDaNoite(planejadores: Record<EtapaNoite, () => Promise<number>>) {
  const feitas = {} as Record<EtapaNoite, number>;
  for (const etapa of ORDEM_PRE_GERACAO) feitas[etapa] = await planejadores[etapa]();
  return feitas;
}

export async function planejarNoite(lote: string, opcoes: { max?: number } = {}) {
  const estrutura = JSON.parse(await readFile(join(RAIZ, "data", "estrutura-prova.json"), "utf8")) as {
    totalQuestoes: number; metaBanco: number; cotas: Record<string, number>; esperamLiberacao: Record<string, string[]>;
  };
  const max = opcoes.max ?? (Number(process.env.GERACAO_MAX_TENTATIVAS_NOITE) || Number(process.env.GERACAO_MAX_NOITE) || 200);
  const seteDias = new Date(Date.now() - 7 * 86_400_000);
  const [topicos, aprovadas, abertas, comTrecho, fontes, tentativas] = await Promise.all([
    Topic.find({ ativo: true }).select("assunto disciplina volatil concursos").lean(),
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
    pedidos: await topicosPedidos(topicos),
    trilha: itensDaTrilha(await alvosDaTrilha(topicos)),
    incidencia: await incidenciaPorTopico(topicos),
  });
  const novas = itens.map((i) => ({ tipo: "gerar" as const, params: i, lote, prioridade: i.motivo === "trilha" ? 3 : 0 }));
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
    const r = await gerarQuestao(p.topicId, p.dificuldade ?? 1 + Math.floor(Math.random() * 5), { preferirGerador, noturno: true, ...(p.tipo ? { tipo: p.tipo } : {}) });
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
// Meta de aprovadas batida: a fila deixa de pegar "gerar" (o que sobrou fica para a próxima noite)
export const filtroDaMeta = (aprovadas: number, meta: number): { tipo?: { $ne: "gerar" } } => (aprovadas >= meta ? { tipo: { $ne: "gerar" } } : {});

export function calcularAteFila(ate: Date | undefined, inicio: Date = new Date()): Date | undefined {
  if (!ate) return undefined;
  return new Date(Math.max(+inicio, +ate - 5 * 60_000));
}

export async function rodarFila(opcoes: { ate?: Date; max?: number; trabalhadores?: number; metaAprovadas?: number; geradores?: string[]; tarefaIds?: string[] } = {}) {
  const n = Math.max(1, opcoes.trabalhadores ?? (Number(process.env.NOTURNO_TRABALHADORES) || 3));
  const metaAprovadas = opcoes.metaAprovadas ?? (Number(process.env.META_APROVADAS_NOITE) || 100);
  const geradores = opcoes.geradores ?? [];
  const resumo: ResumoNoite = { rodadas: 0, concluidas: 0, aprovadas: 0, descartadas: 0, aguardando: 0, esgotadas: 0, orfas: await recuperarOrfas() };
  const trava = new TravaTopicos();
  // a meta de aprovadas para só a geração de questões; explicações, aulas, cartões e temas seguem
  // (ordem do adendo: questões até a meta → explicações → aulas → temas)
  const acabou = () => (opcoes.max !== undefined && resumo.rodadas >= opcoes.max) || (!!opcoes.ate && Date.now() >= +opcoes.ate);

  const pegar = async () => {
    const t = await Tarefa.findOneAndUpdate(
      {
        status: { $in: ["pendente", "aguardando"] },
        proximaEm: { $lte: new Date() },
        ...filtroDaMeta(resumo.aprovadas, metaAprovadas),
        $nor: [{ tipo: "gerar", "params.topicId": { $in: trava.lista } }],
        ...(opcoes.tarefaIds ? { _id: { $in: opcoes.tarefaIds.map((id) => new Types.ObjectId(id)) } } : {}),
      },
      { status: "rodando", iniciadaEm: new Date() },
      { sort: { prioridade: -1, proximaEm: 1, createdAt: 1 }, returnDocument: "after" }
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
      const detalhe = r.detalhes ? ` — ${r.detalhes.replace(/\s+/g, " ").slice(0, 320)}` : "";
      console.log(`[${k + 1}] ${d.status === "concluida" ? "✔" : d.status === "aguardando" ? "↻" : "✖"} ${t.tipo} ${(t.params as { assunto?: string } | undefined)?.assunto ?? ""} → ${d.status}${"motivo" in d && d.motivo ? ` (${d.motivo})` : ""}${detalhe}`);
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
