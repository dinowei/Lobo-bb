// Temas pré-gerados e correção persistente de redações (Etapa 8.4).
import { Types } from "mongoose";
import { z } from "zod";
import type { CorrecaoRedacaoDTO, RedacaoDTO, TemaRedacaoDTO } from "../shared/tipos.js";
import { usuarioAtualId } from "./auth.js";
import { correnteAtiva, chatJSONFuncao } from "./corrente.js";
import { naFila } from "./fila.js";
import { Redacao, TemaRedacao, Tarefa } from "./models.js";
import { pregeracoes, rodarFila } from "./noturno.js";
import { SemModeloDisponivel, ehFalhaDeInfra } from "./llm.js";
import { LINHAS_REDACAO, linhasDaFolha, situacaoDasLinhas, textoAteOLimite } from "../shared/redacaoLinhas.js";

const TemaZ = z.object({
  tema: z.string().trim().min(8).max(140),
  proposta: z.string().trim().min(40).max(1200),
  textosMotivadores: z.array(z.string().trim().min(50).max(800)).min(2).max(3),
});

const NOMES_CRITERIO = [
  "Adequação ao tema e ao tipo textual",
  "Estrutura e coesão",
  "Argumentação",
  "Norma-padrão",
] as const;
const CriterioZ = z.object({
  nome: z.enum(NOMES_CRITERIO),
  nota: z.number().int().min(0).max(25),
  max: z.literal(25),
  comentario: z.string().trim().min(10).max(1200),
  trechos: z.array(z.string().trim().min(1).max(400)).max(8),
});
const CorrecaoZ = z.object({
  criterios: z.array(CriterioZ).length(4),
  notaTotal: z.number().int().min(0).max(100),
  pontosFortes: z.array(z.string().trim().min(4).max(300)).min(1).max(6),
  melhorias: z.array(z.string().trim().min(4).max(300)).min(1).max(8),
  paragrafoReescrito: z.string().trim().min(40).max(1600),
}).superRefine((r, ctx) => {
  if (new Set(r.criterios.map((c) => c.nome)).size !== NOMES_CRITERIO.length)
    ctx.addIssue({ code: "custom", message: "Use exatamente os quatro critérios, uma vez cada.", path: ["criterios"] });
  if (r.notaTotal !== r.criterios.reduce((s, c) => s + c.nota, 0))
    ctx.addIssue({ code: "custom", message: "A nota total deve ser a soma dos quatro critérios.", path: ["notaTotal"] });
});

const SISTEMA_TEMA = `Você prepara temas inéditos de redação dissertativo-argumentativa no estilo de concursos bancários brasileiros.
Não copie texto de lei, notícia, prova ou artigo. Crie 2 ou 3 textos motivadores curtos e originais, com fatos apresentados como contexto hipotético quando necessário.
O tema deve permitir discutir sociedade, tecnologia, sistema financeiro ou cidadania sem exigir conhecimento de fato recente.
Responda somente com JSON válido: {"tema":"...","proposta":"...","textosMotivadores":["...","..."]}.`;

const SISTEMA_CORRECAO = `Você é um avaliador de redação dissertativo-argumentativa para concurso do Banco do Brasil.
Avalie o texto do candidato com rigor e respeito. A nota é uma estimativa de treino, nunca uma garantia de resultado.
Dê exatamente quatro critérios, uma vez cada, nesta ordem: ${NOMES_CRITERIO.join("; ")}.
Cada critério vale de 0 a 25 pontos. A notaTotal é a soma exata dos quatro valores.
Nota ZERO em todos os critérios (edital BB, item 7.3.5) se o texto: fugir ao tipo dissertativo-argumentativo em prosa; fugir ao tema proposto; ou não for texto articulado em língua portuguesa (só desenhos, números, palavras soltas ou versos). Nesse caso, explique o motivo no comentário.
Em cada critério, cite em trechos[] somente fragmentos LITERAIS e contíguos do texto do candidato que sustentem um problema; se não houver trecho adequado, use []. Nunca invente nem corrija uma citação.
Não desconte por opinião diferente da sua. Considere a proposta, o tema e os textos motivadores. Aponte pontos fortes, melhorias concretas e reescreva um parágrafo do próprio texto como exemplo, preservando a tese.
Responda somente com JSON válido neste formato:
{"criterios":[{"nome":"Adequação ao tema e ao tipo textual","nota":0,"max":25,"comentario":"...","trechos":[]}],"notaTotal":0,"pontosFortes":["..."],"melhorias":["..."],"paragrafoReescrito":"..."}`;

const temaDTO = (t: any): TemaRedacaoDTO => ({ id: String(t._id), tema: t.tema, proposta: t.proposta, textosMotivadores: t.textosMotivadores });
const redacaoDTO = (r: any): RedacaoDTO => ({
  id: String(r._id),
  temaId: String(r.temaId),
  tema: r.tema,
  proposta: r.proposta,
  texto: r.texto,
  linhas: r.linhas,
  tempoSeg: r.tempoSeg,
  status: r.status,
  correcao: r.correcao ?? undefined,
  erro: r.erro ?? undefined,
  criadoEm: new Date(r.createdAt).toISOString(),
});

async function gerarTema(preferir?: string) {
  const recentes = await TemaRedacao.find({ ativo: true }).sort({ createdAt: -1 }).limit(30).select("tema").lean();
  const user = `Crie um tema novo. Evite repetir estes temas recentes:\n${recentes.map((t) => `- ${t.tema}`).join("\n") || "(nenhum)"}`;
  try {
    const r = await chatJSONFuncao("tutor", SISTEMA_TEMA, user, 0.7, 2400, { preferir });
    const tema = TemaZ.parse(r.json);
    const normalizar = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (recentes.some((t) => normalizar(t.tema) === normalizar(tema.tema))) return { ok: false, motivo: "tema_repetido", detalhes: "O tema repetiu um dos mais recentes." };
    const salvo = await TemaRedacao.create({ ...tema, modelo: r.modelo });
    return { ok: true, resultadoId: salvo._id };
  } catch (e) {
    const motivo = e instanceof SemModeloDisponivel ? "aguardando_modelo" : ehFalhaDeInfra(e) ? "provedor_falhou" : "tema_invalido";
    return { ok: false, motivo, detalhes: String(e instanceof Error ? e.message : e).slice(0, 500) };
  }
}

async function avaliarUma(redacao: { tema: string; proposta: string; texto: string }, preferir?: string) {
  const user = `TEMA: ${redacao.tema}\nPROPOSTA: ${redacao.proposta}\n\nREDAÇÃO DO CANDIDATO (preserve as quebras de linha):\n${redacao.texto}`;
  const r = await chatJSONFuncao("redacao", SISTEMA_CORRECAO, user, 0.1, 6000, { preferir });
  const avaliacao = CorrecaoZ.parse(r.json);
  const inventados = avaliacao.criterios.flatMap((c) => c.trechos.filter((trecho) => !redacao.texto.includes(trecho)));
  if (inventados.length) throw new Error("A correção citou trecho que não aparece literalmente na redação.");
  return avaliacao;
}

// Abaixo do mínimo de linhas da folha: nota zero decidida por código, antes de qualquer IA
export function correcaoZerada(linhas: number): CorrecaoRedacaoDTO {
  const motivo = `O texto ocupa cerca de ${linhas} linhas da folha; o mínimo da prova é ${LINHAS_REDACAO.minimo}.`;
  return {
    criterios: NOMES_CRITERIO.map((nome) => ({ nome, nota: 0, max: 25 as const, comentario: "Não avaliado: texto abaixo do mínimo de linhas.", trechos: [] })),
    notaTotal: 0,
    pontosFortes: [],
    melhorias: [
      `Escreva de ${LINHAS_REDACAO.minimo} a ${LINHAS_REDACAO.maximo} linhas (cerca de ${LINHAS_REDACAO.minimo * LINHAS_REDACAO.caracteresPorLinha} a ${LINHAS_REDACAO.maximo * LINHAS_REDACAO.caracteresPorLinha} caracteres).`,
      "Planeje introdução, dois parágrafos de desenvolvimento e conclusão com proposta.",
    ],
    paragrafoReescrito: "",
    estimada: true,
    penalidade: `${motivo} Na banca, isso costuma zerar a redação; aqui ela fica com nota zero até o edital confirmar a regra.`,
  };
}

const mediana = (nums: number[]) => [...nums].sort((a, b) => a - b)[Math.floor(nums.length / 2)];
function combinar(avaliacoes: z.infer<typeof CorrecaoZ>[]): CorrecaoRedacaoDTO {
  const totalMediano = mediana(avaliacoes.map((a) => a.notaTotal));
  const principal = avaliacoes.find((a) => a.notaTotal === totalMediano) ?? avaliacoes[0];
  const criterios = NOMES_CRITERIO.map((nome) => {
    const xs = avaliacoes.map((a) => a.criterios.find((c) => c.nome === nome)!);
    const notas = xs.map((c) => c.nota);
    return {
      nome,
      nota: avaliacoes.length === 3 ? mediana(notas) : Math.round(notas.reduce((s, n) => s + n, 0) / notas.length),
      max: 25 as const,
      comentario: xs.map((c, i) => `${i + 1}. ${c.comentario}`).join(" "),
      trechos: [...new Set(xs.flatMap((c) => c.trechos))].slice(0, 8),
    };
  });
  const unicos = (campo: "pontosFortes" | "melhorias", max: number) => [...new Set(avaliacoes.flatMap((a) => a[campo]))].slice(0, max);
  return {
    criterios,
    notaTotal: criterios.reduce((s, c) => s + c.nota, 0),
    pontosFortes: unicos("pontosFortes", 6),
    melhorias: unicos("melhorias", 8),
    paragrafoReescrito: principal.paragrafoReescrito,
    estimada: true,
  };
}

async function corrigirRedacao(id: string, preferir?: string) {
  const doc = await Redacao.findById(id).lean();
  if (!doc) return { ok: false, motivo: "redacao_inexistente" };
  if (doc.status === "corrigida") return { ok: true, resultadoId: doc._id };
  await Redacao.updateOne({ _id: doc._id }, { $set: { status: "corrigindo", erro: null } });
  try {
    // a banca só lê até a linha 30: o que passa disso nem vai para a correção
    const lido = textoAteOLimite(doc.texto);
    const alvo = { ...doc, texto: lido };
    const avaliacoes = [await avaliarUma(alvo, preferir), await avaliarUma(alvo, preferir)];
    if (Math.abs(avaliacoes[0].notaTotal - avaliacoes[1].notaTotal) > 15) avaliacoes.push(await avaliarUma(alvo, preferir));
    const correcao = combinar(avaliacoes);
    if (lido.length < doc.texto.trim().length)
      correcao.penalidade = `Passou de ${LINHAS_REDACAO.maximo} linhas da folha: só o texto até a linha ${LINHAS_REDACAO.maximo} foi corrigido, como na prova.`;
    await Redacao.updateOne({ _id: doc._id }, { $set: { status: "corrigida", correcao, erro: null, avisada: false } });
    return { ok: true, resultadoId: doc._id };
  } catch (e) {
    const motivo = e instanceof SemModeloDisponivel ? "aguardando_modelo" : ehFalhaDeInfra(e) ? "provedor_falhou" : "correcao_invalida";
    await Redacao.updateOne({ _id: doc._id }, { $set: { status: ehFalhaDeInfra(e) ? "aguardando" : "erro", erro: String(e instanceof Error ? e.message : e).slice(0, 500) } });
    return { ok: false, motivo, detalhes: String(e instanceof Error ? e.message : e).slice(0, 500) };
  }
}

pregeracoes["tema"] = (_params, preferir) => gerarTema(preferir);
pregeracoes["corrigir_redacao"] = (params, preferir) => corrigirRedacao((params as { redacaoId: string }).redacaoId, preferir);

export async function planejarTemasRedacao(lote: string, meta = Number(process.env.META_TEMAS_REDACAO) || 40) {
  const [prontos, abertos] = await Promise.all([
    TemaRedacao.countDocuments({ ativo: true }),
    Tarefa.countDocuments({ tipo: "tema", status: { $in: ["pendente", "rodando", "aguardando"] } }),
  ]);
  const n = Math.max(0, meta - prontos - abertos);
  if (n) await Tarefa.insertMany(Array.from({ length: n }, () => ({ tipo: "tema", params: {}, lote })));
  return n;
}

export async function gerarTemas(n = 10) {
  const quantidade = Math.max(1, Math.min(40, Math.floor(n)));
  const lote = `temas ${new Date().toISOString().slice(0, 10)}`;
  const tarefas = await Tarefa.insertMany(Array.from({ length: quantidade }, () => ({ tipo: "tema", params: {}, lote })));
  const atual = await correnteAtiva();
  return rodarFila({ max: quantidade, trabalhadores: 1, tarefaIds: tarefas.map((t) => String(t._id)), geradores: atual.correntes.tutor });
}

export async function listarTemasRedacao(): Promise<TemaRedacaoDTO[]> {
  return (await TemaRedacao.find({ ativo: true }).sort({ createdAt: -1 }).limit(40).lean()).map(temaDTO);
}

export async function pedirTemaRedacao() {
  const agora = new Date();
  let tarefa = await Tarefa.findOneAndUpdate(
    { tipo: "tema", status: { $in: ["pendente", "aguardando"] } },
    { $set: { status: "pendente", proximaEm: agora } },
    { sort: { proximaEm: 1, createdAt: 1 }, returnDocument: "after" }
  );
  if (!tarefa && !(await Tarefa.exists({ tipo: "tema", status: "rodando" }))) {
    tarefa = await Tarefa.create({ tipo: "tema", params: {}, lote: `sob demanda ${agora.toISOString().slice(0, 10)}` });
  }
  if (tarefa) despachar(String(tarefa._id), "gerar tema de redação");
  return { status: "gerando" as const };
}

function despachar(id: string, rotulo: string) {
  void naFila(rotulo, async () => {
    const atual = await correnteAtiva();
    await rodarFila({ max: 1, trabalhadores: 1, tarefaIds: [id], geradores: atual.correntes.tutor });
  }).catch((e) => console.warn(`[redação] ${rotulo}: ${String(e).slice(0, 300)}`));
}

export async function enviarRedacao(input: { temaId: string; texto: string; tempoSeg: number }): Promise<RedacaoDTO> {
  if (!Types.ObjectId.isValid(input.temaId)) throw new Error("Escolha um tema válido.");
  const texto = input.texto.trim();
  if (texto.length < 100) throw new Error("Escreva pelo menos 100 caracteres antes de enviar.");
  if (texto.length > 12_000) throw new Error("A redação passou do limite de 12.000 caracteres.");
  const tema = await TemaRedacao.findOne({ _id: input.temaId, ativo: true }).lean();
  if (!tema) throw new Error("Esse tema não está mais disponível.");
  const linhas = linhasDaFolha(texto);
  // abaixo do mínimo: zero por código, sem gastar correção (regra mais conservadora até o edital)
  if (situacaoDasLinhas(linhas) === "abaixo") {
    const doc = await Redacao.create({
      userId: usuarioAtualId(),
      temaId: tema._id,
      tema: tema.tema,
      proposta: tema.proposta,
      texto,
      linhas,
      tempoSeg: Math.max(0, Math.min(8 * 60 * 60, Math.floor(input.tempoSeg || 0))),
      status: "corrigida",
      correcao: correcaoZerada(linhas),
      avisada: false,
    });
    return redacaoDTO(doc.toObject());
  }
  const doc = await Redacao.create({
    userId: usuarioAtualId(),
    temaId: tema._id,
    tema: tema.tema,
    proposta: tema.proposta,
    texto,
    linhas,
    tempoSeg: Math.max(0, Math.min(8 * 60 * 60, Math.floor(input.tempoSeg || 0))),
    status: "aguardando",
  });
  const tarefa = await Tarefa.create({ tipo: "corrigir_redacao", params: { redacaoId: String(doc._id) }, lote: `redação ${new Date().toISOString().slice(0, 10)}` });
  despachar(String(tarefa._id), "corrigir redação");
  return redacaoDTO(doc.toObject());
}

export async function historicoRedacoes(): Promise<RedacaoDTO[]> {
  return (await Redacao.find({ userId: usuarioAtualId() }).sort({ createdAt: -1 }).limit(50).lean()).map(redacaoDTO);
}

export async function marcarRedacoesVistas() {
  await Redacao.updateMany({ userId: usuarioAtualId(), status: "corrigida", avisada: false }, { $set: { avisada: true } });
}

