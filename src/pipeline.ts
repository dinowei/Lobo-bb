// ============================================================
// BB Estudos — Pipeline: tópico → fontes → gerador → auditor → banco
// ============================================================
import { Types } from "mongoose";
import type { z } from "zod";
import {
  Topic,
  Source,
  Chunk,
  Question,
  Geracao,
  INDICE_VETORIAL,
  DISCIPLINAS_COM_FONTE_OBRIGATORIA,
  type Disciplina,
  type Letra,
} from "./models.js";
import {
  QuestaoGeradaZ,
  RespostaCegaZ,
  RevisaoZ,
  GERADOR_SYSTEM,
  geradorUser,
  geradorConstruidoUser,
  FrasesCraseZ,
  FraseUnicaCraseZ,
  CRASE_ESCRITOR_SYSTEM,
  craseEscritorUser,
  craseReescritaUser,
  VereditoFraseZ,
  AUDITOR_FRASE_SYSTEM,
  AUDITOR_CEGO_SYSTEM,
  auditorCegoUser,
  AUDITOR_REVISAO_SYSTEM,
  auditorRevisaoUser,
  type QuestaoGerada,
} from "./prompts.js";
import { validarOuReparar, embed, ehFalhaDeInfra, SemModeloDisponivel } from "./llm.js";
import { chatJSONFuncao } from "./corrente.js";
import { construir, tiposConstruidos, type Montada } from "./construcao.js";
import { descreverFigura, tirarTabelaCopiada } from "./construcaoFiguras.js";
import {
  construirCrase,
  conferirFrase,
  explicarAlternativa,
  explicacaoGeralCrase,
  DICA_CRASE,
  REGRAS_CRASE,
  type HistoricoCrase,
  type CraseMontada,
} from "./portugues.js";
import { normalizar, hashTexto } from "./extrair.js";
import { ehDisciplinaDeCalculo, verificarConta, numerosDoTexto } from "./verificacao.js";
import { sortearVariacao, type Variacao } from "./variacao.js";
import { filtrarRepeticao, detalheSimilaridade, impressaoEstrutural } from "./similaridade.js";
import { carregarCenarios, sortearCenario, descreverCenario, N_PROIBIDOS, type Cenario } from "./cenarios.js";

// ------------------------------------------------------------
// RAG (Atlas Vector Search na coleção de trechos)
// ------------------------------------------------------------
export type FonteTrecho = { sourceId: Types.ObjectId; titulo: string; texto: string };

async function vizinhos(topicId: Types.ObjectId, vetor: number[], k: number): Promise<FonteTrecho[]> {
  return Chunk.aggregate<FonteTrecho>([
    {
      $vectorSearch: {
        index: INDICE_VETORIAL(),
        path: "embedding",
        queryVector: vetor,
        numCandidates: Math.max(100, k * 20),
        limit: k,
        filter: { topicIds: topicId, revogada: false },
      },
    },
    { $lookup: { from: Source.collection.name, localField: "sourceId", foreignField: "_id", as: "fonte" } },
    { $unwind: "$fonte" },
    { $project: { _id: 0, sourceId: 1, texto: 1, titulo: "$fonte.titulo" } },
  ]);
}

// Para GERAR: sorteia um trecho-semente do tópico e pega a vizinhança dele.
// Assim cada questão nasce de um pedaço diferente da matéria.
export async function buscarFontesVariadas(topicId: Types.ObjectId, k = 5): Promise<FonteTrecho[]> {
  const [semente] = await Chunk.aggregate<{ embedding?: number[] }>([
    { $match: { topicIds: topicId, revogada: false } },
    { $sample: { size: 1 } },
    { $project: { _id: 0, embedding: 1 } },
  ]);
  if (!semente?.embedding?.length) return [];
  return vizinhos(topicId, semente.embedding, k);
}

// Para EXPLICAR/AUDITAR uma questão já existente: busca pelo próprio enunciado.
export async function buscarFontesPorConsulta(
  topicId: Types.ObjectId,
  consulta: string,
  k = 5
): Promise<FonteTrecho[]> {
  if (!(await Chunk.exists({ topicIds: topicId, revogada: false }))) return [];
  return vizinhos(topicId, await embed(consulta, "query"), k);
}

async function exemplosOficiais(topicId: Types.ObjectId, n = 2) {
  const qs = await Question.aggregate<{ enunciado: string; alternativas: { letra: string; texto: string }[]; gabarito: string }>([
    { $match: { topicId, origem: "oficial", status: "aprovada" } },
    { $sample: { size: n } },
    { $project: { enunciado: 1, alternativas: 1, gabarito: 1 } },
  ]);
  return qs.map(
    (q) => `${q.enunciado}\n${q.alternativas.map((a) => `(${a.letra}) ${a.texto}`).join("\n")}\nGabarito: ${q.gabarito}`
  );
}

const letraAleatoria = (): Letra => (["A", "B", "C", "D", "E"] as const)[Math.floor(Math.random() * 5)];

// ------------------------------------------------------------
// O pipeline completo
// ------------------------------------------------------------
export type Resultado = (
  | { ok: true; questionId: Types.ObjectId }
  | { ok: false; motivo: string; detalhes?: string[]; questionId?: Types.ObjectId } // questionId: salva como rejeitada
) & { variacao?: Variacao };

// erro em uma linha só (zod e afins vêm em várias)
const umaLinha = (e: unknown) => String(e instanceof Error ? e.message : e).replace(/\s*\n\s*/g, " ⏎ ");

// Falha de modelo: "aguardando_modelo" (nenhum elegível agora, a questão espera), "provedor_falhou"
// (429, 5xx, timeout: infraestrutura) ou o motivo de qualidade de cada etapa
export const MOTIVOS_INFRA = ["aguardando_modelo", "provedor_falhou", "auditor_falhou", "erro_inesperado"];
const motivoDaFalha = (e: unknown, padrao: string) => (e instanceof SemModeloDisponivel ? "aguardando_modelo" : ehFalhaDeInfra(e) ? "provedor_falhou" : padrao);

// confere se o enunciado trouxe cada dado fixado pelo código, sem alterar número
function dadosFaltando(enunciado: string, dados: string[]): string[] {
  // aspas curvas da IA (“>=20”) contam como retas na fórmula
  const norm = (t: string) => t.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, " ").toLowerCase();
  const e = norm(enunciado);
  return dados.filter((d) => {
    const [esq, dir] = d.split(" = "); // fator "1,04^8 = 1,3686": exige a base e o valor
    return dir ? !(e.includes(norm(dir)) && e.includes(norm(esq.split("^")[0]))) : !e.includes(norm(d));
  });
}

// Nenhuma falha (rede, banco, IA) derruba o lote: vira um Resultado com o motivo
type EstadoGeracao = { variacao?: Variacao; tipo?: string; cenario?: Cenario | null; evitar: Cenario[] };

export async function gerarQuestao(topicId: string, dificuldade = 3, opcoes: { tipo?: string } = {}): Promise<Resultado> {
  const estado: EstadoGeracao = { tipo: opcoes.tipo, evitar: [] };
  const r = await tentarGerar(topicId, dificuldade, estado);
  if (r.ok || r.motivo !== "parecida") return r;
  // "parecida" com outra do banco: descarta e pede outro cenário, uma vez só
  if (estado.cenario) estado.evitar.push(estado.cenario);
  return tentarGerar(topicId, dificuldade, estado);
}

// Teto de gerações por dia (regra A7): cada tentativa conta, aprovada ou não
export async function geracoesHoje() {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Geracao.countDocuments({ em: { $gte: hoje } });
}
export const tetoDiario = () => Number(process.env.GERACAO_MAX_DIA) || 60;

async function tentarGerar(topicId: string, dificuldade: number, estado: EstadoGeracao): Promise<Resultado> {
  if ((await geracoesHoje()) >= tetoDiario())
    return { ok: false, motivo: "teto_diario", detalhes: [`já foram ${tetoDiario()} gerações hoje (GERACAO_MAX_DIA)`] };
  const inicio = Date.now();
  let r: Resultado;
  try {
    r = { ...(await gerarQuestaoInterna(topicId, dificuldade, estado)), variacao: estado.variacao };
  } catch (e) {
    r = { ok: false, motivo: "erro_inesperado", detalhes: [umaLinha(e)], variacao: estado.variacao };
  }
  // registro de toda tentativa: teto diário, aprovação e descartes por motivo no "status"
  await Geracao.create({
    topicId: Types.ObjectId.isValid(topicId) ? topicId : undefined,
    resultado: r.ok ? "aprovada" : r.questionId ? "rejeitada" : "descartada",
    motivo: r.ok ? undefined : r.motivo,
    questionId: r.questionId,
    tipo: estado.variacao?.tipo,
    contexto: estado.variacao?.contexto,
    ms: Date.now() - inicio,
  }).catch(() => undefined);
  return r;
}

// cenários já usados no tópico (fora as rejeitadas), do mais recente para o mais antigo
async function historicoCenarios(topicId: Types.ObjectId): Promise<Cenario[]> {
  const qs = await Question.find({ topicId, status: { $ne: "rejeitada" }, "cenario.perfil": { $exists: true } })
    .sort({ createdAt: -1 })
    .limit(500)
    .select("cenario")
    .lean();
  return qs.flatMap((q) => (q.cenario?.perfil && q.cenario.situacao ? [{ perfil: q.cenario.perfil, situacao: q.cenario.situacao }] : []));
}

async function gerarQuestaoInterna(topicId: string, dificuldadePedida: number, estado: EstadoGeracao): Promise<Resultado> {
  const topic = await Topic.findById(topicId);
  if (!topic) return { ok: false, motivo: "topico_inexistente" };

  // Variedade sorteada pelo código: tipo + contexto (+ duas etapas em cálculo)
  const variacao = await sortearVariacao(topic, estado.tipo);
  estado.variacao = variacao;
  const dificuldade = variacao.duasEtapas ? Math.max(3, dificuldadePedida) : dificuldadePedida;

  // 1. Fontes
  const fontes = await buscarFontesVariadas(topic._id);
  const exigeFonte =
    topic.volatil || DISCIPLINAS_COM_FONTE_OBRIGATORIA.includes(topic.disciplina as Disciplina);
  if (exigeFonte && fontes.length === 0) return { ok: false, motivo: "sem_fontes_para_o_topico" };

  // Português por construção (Crase): caminho próprio, com auditoria frase a frase
  if (variacao.tipo === TIPO_CRASE) return gerarCraseConstruida(topic, variacao);

  const recentes = await Question.find({ topicId: topic._id, status: "aprovada" })
    .sort({ createdAt: -1 })
    .limit(15)
    .select("enunciado");

  // Cenário (perfil + situação) sorteado pelo código: o menos usado no tópico, nunca um dos 15 últimos
  const historico = await historicoCenarios(topic._id);
  const cenario = sortearCenario(carregarCenarios(), topic.disciplina, variacao.contexto, historico, estado.evitar);
  estado.cenario = cenario;
  const cenariosRecentes = historico.slice(0, N_PROIBIDOS).map(descreverCenario);

  // 2. Geração
  const gabaritoObrigatorio = letraAleatoria();

  // Por construção (Matemática, figuras): o código fixa números, figura, alternativas e gabarito;
  // a IA só escreve. Vale para todo tipo que tem template (inclusive Informática e Vendas com figura).
  // Impressão digital estrutural (tipo, contexto, parâmetros) não se repete no tópico: monta de novo.
  let montada: Montada | null = null;
  let impressao: string | undefined;
  if (tiposConstruidos(topic.assunto).includes(variacao.tipo)) {
    for (let k = 0; k < 20 && !montada; k++) {
      const m = construir(topic.assunto, variacao.tipo, gabaritoObrigatorio);
      if (!m) return { ok: false, motivo: "construcao_falhou", detalhes: [`sem template para "${variacao.tipo}"`] };
      const imp = impressaoEstrutural(variacao.tipo, variacao.contexto, [m.dados, m.figura?.dados ?? null]);
      if (await Question.exists({ topicId: topic._id, impressao: imp, status: { $ne: "rejeitada" } })) continue;
      [montada, impressao] = [m, imp];
    }
    if (!montada) return { ok: false, motivo: "impressao_repetida", detalhes: ["20 montagens já existiam no tópico"] };
    variacao.duasEtapas = montada.etapas >= 2; // a verdade vem do template
  }

  const userGerador = montada
    ? geradorConstruidoUser({
        disciplina: topic.disciplina,
        assunto: topic.assunto,
        dificuldade: montada.dificuldade,
        contexto: variacao.contexto,
        duasEtapas: montada.etapas >= 2,
        pergunta: montada.pergunta,
        dados: montada.dados,
        resolucao: montada.resolucao,
        alternativas: montada.alternativas,
        gabarito: montada.gabarito,
        enunciadosRecentes: recentes.map((r) => r.enunciado),
        figura: montada.figura ? { tipo: montada.figura.tipo, descricao: descreverFigura(montada.figura) } : undefined,
        cenario,
        cenariosRecentes,
      })
    : geradorUser({
        disciplina: topic.disciplina,
        assunto: topic.assunto,
        subtopicos: topic.subtopicos,
        dificuldade,
        gabaritoObrigatorio,
        fontes,
        exemplosOficiais: await exemplosOficiais(topic._id),
        enunciadosRecentes: recentes.map((r) => r.enunciado),
        variacao,
        cenario,
        cenariosRecentes,
      });
  let q: QuestaoGerada;
  let geradoPor: { modelo: string; familia: string };
  try {
    const g = await chatJSONFuncao("gerador", GERADOR_SYSTEM, userGerador, 0.8, 4000);
    geradoPor = { modelo: g.modelo, familia: g.familia };
    if (g.json && typeof g.json === "object" && "erro" in g.json) return { ok: false, motivo: "fonte_insuficiente" };
    // zod falhou → o mesmo modelo recebe a resposta + o erro e devolve só o JSON corrigido
    q = await validarOuReparar(QuestaoGeradaZ, g.json, { client: g.client, model: g.modelo, system: GERADOR_SYSTEM, user: userGerador });
  } catch (e) {
    return { ok: false, motivo: motivoDaFalha(e, "geracao_invalida"), detalhes: [umaLinha(e)] };
  }

  if (montada) {
    // a figura é desenhada pelo app: cópia dela em texto ("| A | B |…") sai do enunciado
    if (montada.figura) q = { ...q, enunciado: tirarTabelaCopiada(q.enunciado) };
    // números são do código: a IA não pode ter mexido em nenhum
    const textoIA = new Map(q.alternativas.map((a) => [a.letra, a]));
    const alterada = montada.alternativas.find((a) => textoIA.get(a.letra)?.texto.replace(/\s+/g, " ").trim() !== a.texto);
    if (alterada)
      return { ok: false, motivo: "numero_alterado", detalhes: [`alternativa ${alterada.letra}: esperado "${alterada.texto}", veio "${textoIA.get(alterada.letra)?.texto}"`] };
    const faltam = dadosFaltando(q.enunciado, montada.dados);
    if (faltam.length) return { ok: false, motivo: "numero_alterado", detalhes: [`enunciado sem os dados: ${faltam.join(" ; ")}`] };
    const certa = montada.alternativas.find((a) => a.correta)!;
    if (montada.unidade !== "rotulo" && q.enunciado.includes(certa.texto))
      return { ok: false, motivo: "resposta_no_enunciado", detalhes: [certa.texto] };
    if (montada.figura) {
      // a figura sozinha não pode entregar a resposta (célula-alvo vazia, linha com "?")
      const desc = descreverFigura(montada.figura);
      // (na planilha a trava é estrutural: a célula-alvo fica vazia; achar o valor numa célula É a habilidade cobrada)
      if (montada.figura.tipo === "tabela" && montada.unidade !== "rotulo" && certa.texto.length >= 4 && desc.includes(certa.texto.replace(/^R\$ /, "")))
        return { ok: false, motivo: "figura_entrega_resposta", detalhes: [certa.texto] };
      // todo número do enunciado tem que vir dos dados ou da figura (a IA não inventa valor)
      const permitidos = numerosDoTexto(`${montada.dados.join(" ")} ${montada.pergunta} ${desc}`);
      const soltos = numerosDoTexto(q.enunciado).filter((n) => !permitidos.some((p) => Math.abs(p - n) < 1e-9));
      if (soltos.length) return { ok: false, motivo: "numero_fora_da_figura", detalhes: [`números no enunciado que não estão nos dados nem na figura: ${soltos.join(", ")}`] };
    }
    q = {
      ...q,
      gabarito: montada.gabarito,
      alternativas: montada.alternativas.map((a) => ({
        letra: a.letra,
        texto: a.texto,
        correta: a.correta,
        explicacao: textoIA.get(a.letra)!.explicacao,
        pegadinha: a.correta ? null : textoIA.get(a.letra)?.pegadinha ?? a.erro,
      })),
      verificacao: { expressao: montada.expressao, fatoresDados: montada.fatoresDados },
    };
  }

  // 3. Checagens determinísticas (de graça, antes de gastar com o auditor)
  const corretas = q.alternativas.filter((a) => a.correta);
  if (corretas.length !== 1 || corretas[0].letra !== q.gabarito)
    return { ok: false, motivo: "gabarito_inconsistente" };
  if (q.gabarito !== gabaritoObrigatorio) return { ok: false, motivo: "ignorou_gabarito_obrigatorio" };
  if (new Set(q.alternativas.map((a) => a.letra)).size !== 5) return { ok: false, motivo: "letras_repetidas" };

  let fonteDoTrecho: FonteTrecho | undefined;
  // por construção a resposta é calculada pelo código, não tirada de trecho de fonte
  if (fontes.length && !montada) {
    if (!q.trechoFonte || q.trechoFonte.length < 10) return { ok: false, motivo: "sem_trecho_fonte" };
    const alvo = normalizar(q.trechoFonte).slice(0, 80);
    fonteDoTrecho = fontes.find((f) => normalizar(f.texto).includes(alvo));
    if (!fonteDoTrecho) return { ok: false, motivo: "trecho_fonte_inventado" };
  }

  const h = hashTexto(q.enunciado);
  if (await Question.exists({ hashEnunciado: h })) return { ok: false, motivo: "duplicada" };

  // Regra 10: em cálculo, o número da correta é conferido por código, nunca só pela IA
  let valorEsperado: number | null = null;
  if (ehDisciplinaDeCalculo(topic.disciplina)) {
    const conta = verificarConta(q);
    if (!conta.ok) return { ok: false, motivo: conta.motivo, detalhes: conta.detalhes };
    valorEsperado = conta.valorEsperado;
  }

  // Filtro anti-repetição (antes de gastar com o auditor): mesmo tópico + oficiais da disciplina
  const sim = await filtrarRepeticao(q.enunciado, corretas[0].texto, topic._id, topic.disciplina);
  if (sim.veredito.classe !== "nova") return { ok: false, motivo: sim.veredito.classe, detalhes: [detalheSimilaridade(sim.veredito)] };

  const fontesTxt = fontes.map((f) => `${f.titulo}\n${f.texto}`);
  let modeloAuditor = "";
  // o auditor só lê texto: a figura vai convertida em descrição estruturada
  const qAud = montada?.figura ? { ...q, textoBase: `FIGURA DA QUESTÃO (desenhada no app):\n${descreverFigura(montada.figura)}` } : q;
  // regra de família: o auditor nunca é da família de quem gerou (vale com a corrente aprovada)
  const auditar = (system: string, user: string) => chatJSONFuncao("auditor", system, user, 0, 2000, { excluirFamilias: [geradoPor.familia] });

  // 4. Auditoria cega: o auditor resolve sem ver o gabarito
  let cego: z.infer<typeof RespostaCegaZ>;
  try {
    const r = await auditar(AUDITOR_CEGO_SYSTEM, auditorCegoUser(qAud, fontesTxt));
    modeloAuditor = r.modelo;
    cego = RespostaCegaZ.parse(r.json);
  } catch (e) {
    return { ok: false, motivo: motivoDaFalha(e, "auditor_falhou"), detalhes: [umaLinha(e)] };
  }
  if (cego.resposta !== q.gabarito) {
    return {
      ok: false,
      motivo: "auditor_discordou",
      detalhes: [`auditor marcou ${cego.resposta}: ${cego.raciocinio}`],
    };
  }

  // 5. Revisão completa
  let rev: z.infer<typeof RevisaoZ>;
  try {
    const r = await auditar(AUDITOR_REVISAO_SYSTEM, auditorRevisaoUser(qAud, fontesTxt));
    if (r.modelo !== modeloAuditor) modeloAuditor = `${modeloAuditor} + ${r.modelo}`;
    rev = RevisaoZ.parse(r.json);
  } catch (e) {
    return { ok: false, motivo: motivoDaFalha(e, "auditor_falhou"), detalhes: [umaLinha(e)] };
  }
  const aprovada = rev.veredito === "aprovada";

  // 6. Salva (rejeitadas também, para você analisar onde o gerador erra)
  const doc = await Question.create({
    topicId: topic._id,
    origem: "gerada",
    // por construção, a dificuldade vem do template (nº de etapas), nunca da IA
    dificuldade: montada ? montada.dificuldade : variacao.duasEtapas ? Math.max(3, q.dificuldade) : q.dificuldade,
    enunciado: q.enunciado,
    alternativas: q.alternativas.map((a) => ({ ...a, pegadinha: a.correta ? undefined : a.pegadinha ?? undefined })),
    gabarito: q.gabarito,
    explicacaoGeral: q.explicacaoGeral,
    dicaDeProva: q.dicaDeProva ?? undefined,
    fontes: fonteDoTrecho ? [{ sourceId: fonteDoTrecho.sourceId, trecho: q.trechoFonte }] : [],
    status: aprovada ? "aprovada" : "rejeitada",
    geradaPor: geradoPor.modelo,
    auditoria: {
      modelo: modeloAuditor,
      respostaCega: cego.resposta,
      veredito: rev.veredito,
      problemas: rev.problemas,
    },
    variacao,
    verificacao: q.verificacao ? { ...q.verificacao, valorEsperado } : undefined,
    // figura gerada por código: dado desenhado no site (já conferido pelas checagens e pelo auditor)
    figuras: montada?.figura ? [{ ...montada.figura, origem: "construcao", status: "ok" }] : undefined,
    hashEnunciado: h,
    embedding: sim.embedding ?? undefined,
    impressao,
    cenario: cenario ?? undefined,
  });

  return aprovada
    ? { ok: true, questionId: doc._id }
    : { ok: false, motivo: "reprovada_na_revisao", detalhes: rev.problemas, questionId: doc._id };
}

// ------------------------------------------------------------
// Crase por construção: o código sorteia 1 regra correta + 4 de erro e a letra;
// a IA escreve as frases; o auditor julga cada frase isolada (sem saber a regra).
// Aprova só se exatamente 1 frase for "correta" e for a do gabarito; depois, revisão completa.
// ------------------------------------------------------------
export const TIPO_CRASE = "crase (por construção)";

// Histórico SÓ das aprovadas no banco: contagem de uso por regra e as regras da última
// aprovada (para não repetir). Tentativa descartada não conta.
async function historicoCrase(topicId: Types.ObjectId): Promise<HistoricoCrase> {
  const idPorNome = new Map(REGRAS_CRASE.map((r) => [r.nome, r.id]));
  const aprovadas = await Question.find({ topicId, "variacao.tipo": TIPO_CRASE, status: "aprovada" })
    .sort({ _id: 1 })
    .select("auditoria.porFrase.regraEsperada")
    .lean();
  const ids = (q: (typeof aprovadas)[number]) =>
    (q.auditoria?.porFrase ?? []).flatMap((p) => idPorNome.get(p.regraEsperada ?? "") ?? []);
  const uso = new Map<string, number>();
  for (const q of aprovadas) for (const id of ids(q)) uso.set(id, (uso.get(id) ?? 0) + 1);
  const ultima = aprovadas.at(-1);
  return { uso, anterior: new Set(ultima ? ids(ultima) : []) };
}

async function gerarCraseConstruida(
  topic: { _id: Types.ObjectId; disciplina: string; assunto: string },
  variacao: Variacao
): Promise<Resultado> {
  const gabarito = letraAleatoria();
  // impressão estrutural: (contexto, regra correta, regras de erro) não se repete no tópico
  const historico = await historicoCrase(topic._id);
  const montar = async (): Promise<[CraseMontada, string] | null> => {
    for (let k = 0; k < 20; k++) {
      const c = construirCrase(gabarito, variacao.contexto, historico);
      const certa = c.frases.find((f) => f.letra === c.gabarito)!.regra.id;
      const erros = c.frases.filter((f) => f.letra !== c.gabarito).map((f) => f.regra.id).sort();
      const imp = impressaoEstrutural(TIPO_CRASE, variacao.contexto, { certa, erros });
      if (!(await Question.exists({ topicId: topic._id, impressao: imp, status: { $ne: "rejeitada" } }))) return [c, imp];
    }
    return null;
  };
  const montagem = await montar();
  if (!montagem) return { ok: false, motivo: "impressao_repetida", detalhes: ["20 montagens já existiam no tópico"] };
  const [m, impressao] = montagem;
  const anteriores = await Question.find({ topicId: topic._id, "variacao.tipo": TIPO_CRASE })
    .sort({ createdAt: -1 })
    .limit(6)
    .select("alternativas");
  const user = craseEscritorUser({
    contexto: variacao.contexto,
    frases: m.frases,
    frasesRecentes: anteriores.flatMap((a) => a.alternativas.map((x) => x.texto)),
  });

  // o escritor de Português é um modelo diferente do auditor (corrente "escritor_pt"); o juiz e a
  // revisão nunca são da família de quem escreveu (vale com a corrente aprovada)
  const escritores = new Set<string>();
  const familiasEscritor = new Set<string>();
  let escrito: z.infer<typeof FrasesCraseZ>;
  try {
    const r = await chatJSONFuncao("escritor_pt", CRASE_ESCRITOR_SYSTEM, user, 0.7, 2000);
    escritores.add(r.modelo);
    familiasEscritor.add(r.familia);
    escrito = await validarOuReparar(FrasesCraseZ, r.json, { client: r.client, model: r.modelo, system: CRASE_ESCRITOR_SYSTEM, user });
  } catch (e) {
    return { ok: false, motivo: motivoDaFalha(e, "geracao_invalida"), detalhes: [umaLinha(e)] };
  }
  const porLetra = new Map(escrito.frases.map((f) => [f.letra, { frase: f.frase, trecho: f.trecho }]));
  if (porLetra.size !== 5) return { ok: false, motivo: "letras_repetidas" };

  // Trava "frase fora da regra": o "à" tem que estar (ou não) exatamente onde a regra manda.
  // Frase que não bate é descartada e só ela é pedida de novo (1 tentativa).
  const reescritas: string[] = [];
  for (const f of m.frases) {
    const atual = porLetra.get(f.letra)!;
    const problema = conferirFrase(atual.frase, atual.trecho, f.regra);
    if (!problema) continue;
    try {
      const userUma = craseReescritaUser({ contexto: variacao.contexto, regra: f.regra, fraseAnterior: atual.frase, problema });
      const r = await chatJSONFuncao("escritor_pt", CRASE_ESCRITOR_SYSTEM, userUma, 0.7, 600);
      escritores.add(r.modelo);
      familiasEscritor.add(r.familia);
      const nova = await validarOuReparar(FraseUnicaCraseZ, r.json, {
        client: r.client,
        model: r.modelo,
        system: CRASE_ESCRITOR_SYSTEM,
        user: userUma,
      });
      const problema2 = conferirFrase(nova.frase, nova.trecho, f.regra);
      if (problema2)
        return {
          ok: false,
          motivo: "frase_fora_da_regra",
          detalhes: [`${f.letra} [${f.regra.nome}]: "${atual.frase}" → ${problema}; reescrita "${nova.frase}" → ${problema2}`],
        };
      porLetra.set(f.letra, nova);
      reescritas.push(`${f.letra} reescrita (${problema})`);
    } catch (e) {
      return { ok: false, motivo: "geracao_invalida", detalhes: [`reescrita da ${f.letra}: ${umaLinha(e)}`] };
    }
  }
  if (reescritas.length) console.log(`  ✎ ${reescritas.join("; ")}`);
  const linhas = m.frases.map((f) => `${f.letra}) ${porLetra.get(f.letra)!.frase} [regra: ${f.regra.nome}]`);

  // explicação, pegadinha e explicação geral vêm da REGRA (banco), não da IA
  const certa = m.frases.find((f) => f.letra === gabarito)!.regra;
  const q: QuestaoGerada = {
    enunciado: m.enunciado,
    alternativas: m.frases.map((f) => {
      const e = porLetra.get(f.letra)!;
      return { letra: f.letra, texto: e.frase, correta: f.letra === gabarito, ...explicarAlternativa(f.regra, e.trecho) };
    }),
    gabarito,
    explicacaoGeral: explicacaoGeralCrase(certa),
    dicaDeProva: DICA_CRASE,
    trechoFonte: null,
    dificuldade: m.dificuldade,
    verificacao: null,
  };
  // o enunciado é fixo: o que identifica a questão são as frases
  const h = hashTexto(q.enunciado + q.alternativas.map((a) => a.texto).join("|"));
  if (await Question.exists({ hashEnunciado: h })) return { ok: false, motivo: "duplicada" };
  // filtro anti-repetição antes dos auditores (enunciado + frase correta)
  const sim = await filtrarRepeticao(q.enunciado, q.alternativas.find((a) => a.correta)!.texto, topic._id, topic.disciplina);
  if (sim.veredito.classe !== "nova") return { ok: false, motivo: sim.veredito.classe, detalhes: [detalheSimilaridade(sim.veredito)] };

  // auditoria por frase, cada uma isolada (juiz de Português de outra família que a do escritor)
  const modelos = new Set<string>();
  const porFrase: { letra: Letra; regraEsperada: string; correta: boolean; regra: string; juiz: string }[] = [];
  const julgar = (frase: string, excluirModelos: string[] = []) =>
    chatJSONFuncao("juiz_pt", AUDITOR_FRASE_SYSTEM, `FRASE: ${frase}`, 0, 600, { excluirFamilias: [...familiasEscritor], excluirModelos });
  try {
    for (const f of m.frases) {
      const r = await julgar(porLetra.get(f.letra)!.frase);
      modelos.add(r.modelo);
      const v = VereditoFraseZ.parse(r.json);
      porFrase.push({ letra: f.letra, regraEsperada: f.regra.nome, correta: v.correta, regra: v.regra, juiz: r.modelo });
    }
  } catch (e) {
    return { ok: false, motivo: motivoDaFalha(e, "auditor_falhou"), detalhes: [umaLinha(e), ...linhas] };
  }
  // Desempate: frase em que o juiz discorda do banco de regras vai, às cegas (só a frase), para
  // OUTRO juiz da corrente (no legado, o Ultra). Se ele concordar com a regra, vale a regra;
  // senão (ou sem outro juiz), a questão é descartada.
  const desempates: { letra: Letra; auditor: boolean; ultra: boolean | null; regraUltra: string }[] = [];
  for (const [k, p] of porFrase.entries()) {
    const esperado = m.frases[k].regra.correta;
    if (p.correta === esperado) continue;
    let veredito: z.infer<typeof VereditoFraseZ> | null = null;
    let desempatador = "";
    try {
      const r = await julgar(porLetra.get(p.letra)!.frase, [p.juiz]);
      veredito = VereditoFraseZ.parse(r.json);
      desempatador = r.modelo;
      modelos.add(r.modelo);
    } catch (e) {
      console.warn(`  ⚠ desempate da ${p.letra} falhou: ${umaLinha(e).slice(0, 120)}`);
    }
    desempates.push({ letra: p.letra, auditor: p.correta, ultra: veredito?.correta ?? null, regraUltra: veredito?.regra ?? "" });
    if (veredito?.correta === esperado) {
      console.log(`  ⚖ ${p.letra}: juiz disse ${p.correta ? "SIM" : "não"}, ${desempatador} disse ${veredito.correta ? "SIM" : "não"} = regra → vale a regra`);
      p.correta = esperado;
      p.regra = `[desempate ${desempatador}] ${veredito.regra}`;
    }
  }
  const vereditos = porFrase.map(
    (p, k) => `${p.letra}) "${porLetra.get(p.letra)!.frase}" → auditor: ${p.correta ? "SIM" : "não"} (${p.regra}) | esperado: ${m.frases[k].regra.correta ? "SIM" : "não"}`
  );
  const resumoDesempates = desempates.map(
    (d) => `desempate ${d.letra}: auditor ${d.auditor ? "SIM" : "não"}, Ultra ${d.ultra === null ? "falhou" : d.ultra ? "SIM" : "não"}`
  );
  const sims = porFrase.filter((p) => p.correta);
  if (sims.length !== 1 || sims[0].letra !== gabarito)
    return {
      ok: false,
      motivo: "auditor_por_frase_discordou",
      detalhes: [`auditor disse SIM para: ${sims.map((p) => p.letra).join(", ") || "nenhuma"}; gabarito ${gabarito}`, ...resumoDesempates, ...vereditos],
    };

  // revisão completa de sempre
  let rev: z.infer<typeof RevisaoZ>;
  try {
    const r = await chatJSONFuncao("auditor", AUDITOR_REVISAO_SYSTEM, auditorRevisaoUser(q, []), 0, 2000, { excluirFamilias: [...familiasEscritor] });
    modelos.add(r.modelo);
    rev = RevisaoZ.parse(r.json);
  } catch (e) {
    return { ok: false, motivo: motivoDaFalha(e, "auditor_falhou"), detalhes: [umaLinha(e), ...vereditos] };
  }
  const aprovada = rev.veredito === "aprovada";

  const doc = await Question.create({
    topicId: topic._id,
    origem: "gerada",
    dificuldade: m.dificuldade,
    enunciado: q.enunciado,
    alternativas: q.alternativas.map((a) => ({ ...a, pegadinha: a.correta ? undefined : a.pegadinha ?? undefined })),
    gabarito,
    explicacaoGeral: q.explicacaoGeral,
    dicaDeProva: q.dicaDeProva ?? undefined,
    fontes: [],
    status: aprovada ? "aprovada" : "rejeitada",
    geradaPor: [...escritores].join(" + "),
    auditoria: {
      modelo: [...modelos].join(" + "),
      respostaCega: sims[0].letra,
      veredito: rev.veredito,
      problemas: rev.problemas,
      porFrase,
      desempates,
    },
    variacao,
    hashEnunciado: h,
    embedding: sim.embedding ?? undefined,
    impressao,
  });
  return aprovada
    ? { ok: true, questionId: doc._id }
    : { ok: false, motivo: "reprovada_na_revisao", detalhes: [...rev.problemas, ...vereditos], questionId: doc._id };
}

// ------------------------------------------------------------
// "Infinito" na prática: mantém um estoque mínimo por tópico.
// Roda em background (cron) e o aluno nunca espera a IA.
// ------------------------------------------------------------
export async function reabastecerEstoque(minPorTopico = 30, maxTentativas = 3) {
  const topicos = await Topic.find({ ativo: true });
  for (const t of topicos) {
    const estoque = await Question.countDocuments({ topicId: t._id, status: "aprovada" });
    const faltam = Math.max(0, minPorTopico - estoque);
    if (faltam) console.log(`[${t.assunto}] estoque ${estoque}/${minPorTopico}, gerando ${faltam}…`);
    for (let i = 0; i < faltam; i++) {
      for (let tentativa = 0; tentativa < maxTentativas; tentativa++) {
        const r = await gerarQuestao(String(t._id), 1 + Math.floor(Math.random() * 5));
        if (r.ok) break;
        console.warn(`  ✖ ${r.motivo}`, r.detalhes?.join(" | ") ?? "");
        if (r.motivo === "teto_diario") return; // GERACAO_MAX_DIA: para tudo até amanhã
        if (r.motivo === "sem_fontes_para_o_topico") {
          i = faltam; // não adianta insistir: falta ingerir fonte para esse tópico
          break;
        }
      }
    }
  }
}
