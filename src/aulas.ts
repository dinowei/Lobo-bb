// ============================================================
// BB Estudos — aulas curtas por tópico (Etapa 8.5)
// A aula só aparece depois da conferência por auditor de outra família.
// ============================================================
import { Types } from "mongoose";
import { Aula, Chunk, DISCIPLINAS_COM_FONTE_OBRIGATORIA, Question, Source, Tarefa, Topic } from "./models.js";
import { correnteAtiva, chatJSONFuncao } from "./corrente.js";
import { SemModeloDisponivel, ehFalhaDeInfra } from "./llm.js";
import { AulaZ, AULA_SYSTEM, aulaUser, CONFERE_AULA_Z, CONFERE_AULA_SYSTEM, confereAulaUser } from "./prompts.js";
import { pregeracoes, rodarFila } from "./noturno.js";
import type { AulaDTO } from "../shared/tipos.js";

type FonteEntrada = { indice: number; sourceId: string; titulo: string; pagina?: number; texto: string };
type Gerada = ReturnType<typeof AulaZ.parse>;

const escaparRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const normalizar = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();

export function contarPalavrasMarkdown(texto: string) {
  const limpo = texto
    .replace(/<[^>]*>/g, " ")
    .replace(/\[\d+\]/g, " ")
    .replace(/[`*_#>\[\]()]/g, " ")
    .replace(/\s+/g, " ");
  return limpo.match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}

// Fonte listada e não citada no texto (ou repetida) sai por código; ficam no máximo 8. Não muda nenhuma
// citação: o que sobra ainda passa pela conferência literal em validarAulaGerada.
export const MAX_FONTES_AULA = 8;
export function normalizarFontes(aula: Gerada): Gerada {
  const citados = new Set([...aula.conteudo.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])));
  const vistos = new Set<string>();
  // citação longa: corta na última palavra antes de 120 caracteres (continua sendo trecho literal)
  const curto = (s: string) => {
    if (s.length <= 120) return s;
    const corte = s.slice(0, 120);
    const espaco = corte.lastIndexOf(" ");
    return (espaco >= 40 ? corte.slice(0, espaco) : corte).trim();
  };
  const fontes = aula.fontes
    .map((f) => ({ ...f, trecho: curto(f.trecho) }))
    .filter((f) => citados.has(f.indice))
    .filter((f) => !vistos.has(`${f.indice}|${f.trecho}`) && vistos.add(`${f.indice}|${f.trecho}`))
    .slice(0, MAX_FONTES_AULA);
  return { ...aula, fontes };
}

// Citação parafraseada: troca pela frase da fonte com mais palavras em comum (≥ 60% das palavras da
// citação), cortada em 120 caracteres numa palavra. A citação final é sempre texto literal da fonte; se
// nenhuma frase bate, fica como veio e a validação recusa.
const palavras = (s: string) => new Set(normalizar(s).toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []);
export function ancorarCitacao(trecho: string, textoFonte: string): string {
  if (normalizar(textoFonte).includes(normalizar(trecho))) return trecho;
  const alvo = palavras(trecho);
  if (!alvo.size) return trecho;
  let melhor = { frase: "", cobertura: 0 };
  for (const frase of textoFonte.split(/(?<=[.;:!?])\s+|\n+/)) {
    const p = palavras(frase);
    const comuns = [...alvo].filter((w) => p.has(w)).length;
    if (comuns / alvo.size > melhor.cobertura) melhor = { frase: frase.trim(), cobertura: comuns / alvo.size };
  }
  if (melhor.cobertura < 0.6 || melhor.frase.length < 20) return trecho;
  if (melhor.frase.length <= 120) return melhor.frase;
  const corte = melhor.frase.slice(0, 120);
  const espaco = corte.lastIndexOf(" ");
  return (espaco >= 40 ? corte.slice(0, espaco) : corte).trim();
}

export function desembrulhar(json: unknown): unknown {
  if (!json || typeof json !== "object" || Array.isArray(json) || "conteudo" in json) return json;
  const valores = Object.values(json as Record<string, unknown>);
  const dentro = valores.find((v) => v && typeof v === "object" && !Array.isArray(v) && "conteudo" in (v as object));
  return valores.length === 1 && dentro ? dentro : json;
}

export function validarAulaGerada(aula: Gerada, disciplina: string, fontes: FonteEntrada[]) {
  if (contarPalavrasMarkdown(aula.conteudo) > 400) return "A aula passou do limite de 400 palavras.";
  const porIndice = new Map(fontes.map((f) => [f.indice, f]));
  const citacoesNoTexto = [...aula.conteudo.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]));
  if (citacoesNoTexto.some((i) => !porIndice.has(i))) return "A aula cita um índice de fonte inexistente.";
  const citados = new Set(citacoesNoTexto);
  for (const fonte of aula.fontes) {
    const original = porIndice.get(fonte.indice);
    if (!original) return `A citação aponta para uma fonte inexistente (${fonte.indice}).`;
    if (!citados.has(fonte.indice)) return `A fonte ${fonte.indice} foi listada mas não é citada no conteúdo.`;
    if (fonte.trecho.length > 120) return `A citação da fonte ${fonte.indice} excedeu 120 caracteres.`;
    if (!normalizar(original.texto).includes(normalizar(fonte.trecho))) return `A citação da fonte ${fonte.indice} não existe literalmente no trecho ingerido.`;
  }
  const exigeFonte = (DISCIPLINAS_COM_FONTE_OBRIGATORIA as readonly string[]).includes(disciplina);
  if (exigeFonte && (!aula.fontes.length || !citacoesNoTexto.length)) return "Esta disciplina exige fonte ingerida e citação na aula.";
  return undefined;
}

export async function fontesDoTopico(topicId: Types.ObjectId): Promise<FonteEntrada[]> {
  const chunks = await Chunk.find({ topicIds: topicId, revogada: false })
    .sort({ ordem: 1, pagina: 1 })
    .limit(12)
    .select("sourceId pagina texto")
    .lean();
  if (!chunks.length) return [];
  const fontesValidas = await Source.find({ _id: { $in: chunks.map((c) => c.sourceId) }, revogada: false }).select("titulo").lean();
  const titulos = new Map(fontesValidas.map((f) => [String(f._id), f.titulo]));
  return chunks.flatMap((c, i) => {
    const titulo = titulos.get(String(c.sourceId));
    if (!titulo) return [];
    return [{ indice: i + 1, sourceId: String(c.sourceId), titulo, pagina: c.pagina ?? undefined, texto: c.texto.slice(0, 1800) }];
  });
}

async function questoesOficiais(topicId: Types.ObjectId) {
  const qs = await Question.find({ topicId, origem: "oficial", status: "aprovada" })
    .sort({ createdAt: -1 })
    .limit(6)
    .select("enunciado alternativas gabarito")
    .lean();
  return qs.map((q) => ({
    enunciado: q.enunciado,
    alternativas: q.alternativas.map((a) => ({ letra: a.letra, texto: a.texto })),
    gabarito: q.gabarito,
  }));
}

async function gerarAula(topicId: string, preferir?: string) {
  if (!Types.ObjectId.isValid(topicId)) return { ok: false, motivo: "topico_inexistente" };
  const topic = await Topic.findOne({ _id: new Types.ObjectId(topicId), ativo: true }).lean();
  if (!topic) return { ok: false, motivo: "topico_inexistente" };
  const pronta = await Aula.findOne({ topicId: topic._id, status: "aprovada" }).select("_id").lean();
  if (pronta) return { ok: true, resultadoId: pronta._id };

  const fontes = await fontesDoTopico(topic._id);
  if ((DISCIPLINAS_COM_FONTE_OBRIGATORIA as readonly string[]).includes(topic.disciplina) && !fontes.length)
    return { ok: false, motivo: "sem_fontes" };
  const oficiais = await questoesOficiais(topic._id);
  const entrada = aulaUser(
    {
      disciplina: topic.disciplina,
      assunto: topic.assunto,
      subtopicos: topic.subtopicos ?? [],
      descricao: topic.descricao ?? undefined,
      editalRef: topic.editalRef ?? undefined,
    },
    fontes,
    oficiais
  );
  try {
    let escritor = await chatJSONFuncao("tutor", AULA_SYSTEM, entrada, 0.3, 3200, { preferir });
    // JSON embrulhado numa chave só ({"aula": {...}}): desembrulha por código antes de pedir reparo
    escritor = { ...escritor, json: desembrulhar(escritor.json) };
    // JSON fora do formato (campo faltando): uma rodada de reparo com o mesmo modelo
    const primeira = AulaZ.safeParse(escritor.json);
    if (!primeira.success) {
      const faltas = primeira.error.issues.map((i) => i.path.join(".") || "(raiz)").join(", ");
      console.log(`↻ Reparando formato da aula de "${topic.assunto}": ${faltas}`);
      const pedido = `${entrada}\n\nSUA RESPOSTA ANTERIOR NÃO SEGUIU O FORMATO (campos com problema: ${faltas}).\n${JSON.stringify(escritor.json).slice(0, 4000)}\n\nReescreva o JSON COMPLETO, com todos os campos do formato pedido.`;
      escritor = await chatJSONFuncao("tutor", AULA_SYSTEM, pedido, 0.1, 3200, { preferir: escritor.modelo });
    }
    // ancora citação parafraseada na frase literal da fonte, depois limpa e limita as fontes
    const preparar = (json: unknown): Gerada => {
      const bruta = AulaZ.parse(json);
      const texto = new Map(fontes.map((f) => [f.indice, f.texto]));
      return normalizarFontes({ ...bruta, fontes: bruta.fontes.map((f) => ({ ...f, trecho: texto.has(f.indice) ? ancorarCitacao(f.trecho, texto.get(f.indice)!) : f.trecho })) });
    };
    let aula: Gerada = preparar(escritor.json);
    let erro = validarAulaGerada(aula, topic.disciplina, fontes);
    if (erro) {
      console.log(`↻ Reparando aula de "${topic.assunto}": ${erro}`);
      const correcao = `${entrada}\n\nAULA QUE PRECISA DE CORREÇÃO:\n${JSON.stringify(aula)}\n\nERRO DETERMINÍSTICO: ${erro}\n\nReescreva o JSON completo. Para cada fonte, copie uma sequência literal contínua de 20 a 120 caracteres diretamente dos trechos originais acima; preserve acentos e pontuação. Não invente nem parafraseie citações.`;
      escritor = await chatJSONFuncao("tutor", AULA_SYSTEM, correcao, 0.1, 3200, { preferir: escritor.modelo });
      aula = preparar(escritor.json);
      erro = validarAulaGerada(aula, topic.disciplina, fontes);
    }
    if (erro) {
      await Aula.findOneAndUpdate(
        { topicId: topic._id },
        {
          $set: {
            topicId: topic._id,
            status: "reprovada",
            conteudo: aula.conteudo,
            pontosChave: aula.pontosChave,
            comoABancaCobra: aula.comoABancaCobra,
            pegadinhasComuns: aula.pegadinhasComuns,
            exemplos: aula.exemplos,
            fontes: [],
            erro,
            geradaPor: escritor.modelo,
            auditoria: { veredito: "reprovada", problemas: [erro], em: new Date() },
          },
        },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
      );
      return { ok: false, motivo: "aula_invalida", detalhes: erro };
    }

    const entradaAuditoria = confereAulaUser(entrada, aula, fontes, oficiais);
    const auditor = await chatJSONFuncao("auditor", CONFERE_AULA_SYSTEM, entradaAuditoria, 0, 1800, { excluirFamilias: [escritor.familia] });
    const parecer = CONFERE_AULA_Z.parse(auditor.json);
    const dados = {
      topicId: topic._id,
      status: parecer.ok ? "aprovada" : "reprovada",
      conteudo: aula.conteudo,
      pontosChave: aula.pontosChave,
      comoABancaCobra: aula.comoABancaCobra,
      pegadinhasComuns: aula.pegadinhasComuns,
      exemplos: aula.exemplos,
      fontes: aula.fontes.map((f) => {
        const fonte = fontes.find((x) => x.indice === f.indice)!;
        return { sourceId: new Types.ObjectId(fonte.sourceId), titulo: fonte.titulo, trecho: f.trecho };
      }),
      geradaPor: escritor.modelo,
      auditoria: { modelo: auditor.modelo, veredito: parecer.ok ? "aprovada" : "reprovada", problemas: parecer.problemas, em: new Date() },
      erro: parecer.ok ? undefined : parecer.problemas.join(" | ").slice(0, 700),
    };
    const salva = await Aula.findOneAndUpdate({ topicId: topic._id }, { $set: dados }, { upsert: true, returnDocument: "after", setDefaultsOnInsert: true });
    if (!parecer.ok) return { ok: false, motivo: "aula_reprovada", detalhes: parecer.problemas.join(" | ").slice(0, 500) };
    return { ok: true, resultadoId: salva?._id };
  } catch (e) {
    const motivo = e instanceof SemModeloDisponivel ? "aguardando_modelo" : ehFalhaDeInfra(e) ? "provedor_falhou" : "aula_invalida";
    return { ok: false, motivo, detalhes: String(e instanceof Error ? e.message : e).slice(0, 500) };
  }
}

pregeracoes["aula"] = (params, preferir) => gerarAula((params as { topicId: string }).topicId, preferir);

async function topicosElegiveis(opcoes: { assunto?: string; max: number }) {
  const filtro = opcoes.assunto ? { assunto: new RegExp(escaparRegex(opcoes.assunto), "i"), ativo: true } : { ativo: true };
  const topicos = await Topic.find(filtro).sort({ disciplina: 1, assunto: 1 }).select("_id disciplina assunto").lean();
  if (!topicos.length) return [];
  const aprovadas = new Set((await Aula.distinct("topicId", { status: "aprovada", topicId: { $in: topicos.map((t) => t._id) } })).map(String));
  const abertas = new Set((await Tarefa.distinct("params.topicId", { tipo: "aula", status: { $in: ["pendente", "rodando", "aguardando"] }, "params.topicId": { $in: topicos.map((t) => String(t._id)) } })).map(String));
  const chunks = await Chunk.find({ topicIds: { $in: topicos.map((t) => t._id) }, revogada: false }).select("topicIds sourceId").lean();
  const sources = new Set((await Source.distinct("_id", { _id: { $in: chunks.map((c) => c.sourceId) }, revogada: false })).map(String));
  const comFonte = new Set(chunks.filter((c) => sources.has(String(c.sourceId))).flatMap((c) => c.topicIds.map(String)));
  return filtrarTopicosParaAula(topicos, aprovadas, abertas, comFonte, opcoes.max);
}

// Regra 18 no planejamento: sem aula aprovada nem tarefa aberta; Bancários, Atualidades e Vendas só com fonte ingerida
export function filtrarTopicosParaAula<T extends { _id: unknown; disciplina: string }>(topicos: T[], aprovadas: Set<string>, abertas: Set<string>, comFonte: Set<string>, max: number): T[] {
  return topicos
    .filter((t) => !aprovadas.has(String(t._id)) && !abertas.has(String(t._id)))
    .filter((t) => !(DISCIPLINAS_COM_FONTE_OBRIGATORIA as readonly string[]).includes(t.disciplina) || comFonte.has(String(t._id)))
    .slice(0, Math.max(0, Math.floor(max)));
}

export async function planejarAulas(lote: string, max = Number(process.env.AULAS_NOITE) || 10) {
  const elegiveis = await topicosElegiveis({ max });
  if (elegiveis.length) await Tarefa.insertMany(elegiveis.map((t) => ({ tipo: "aula", params: { topicId: String(t._id) }, lote })));
  return elegiveis.length;
}

export async function gerarAulas(opcoes: { assunto?: string; n?: number } = {}) {
  const limite = Math.max(1, Math.min(20, Math.floor(opcoes.n ?? 3)));
  const lote = `aulas ${new Date().toISOString().slice(0, 10)}`;
  const topicos = await topicosElegiveis({ assunto: opcoes.assunto, max: limite });
  const tarefas = topicos.length ? await Tarefa.insertMany(topicos.map((t) => ({ tipo: "aula", params: { topicId: String(t._id) }, lote }))) : [];
  const atual = await correnteAtiva();
  return rodarFila({ max: tarefas.length, trabalhadores: 1, tarefaIds: tarefas.map((t) => String(t._id)), geradores: atual.correntes.tutor });
}

export async function aulaDoTopico(topicId: string): Promise<AulaDTO | null> {
  if (!Types.ObjectId.isValid(topicId)) return null;
  const aula = await Aula.findOne({ topicId: new Types.ObjectId(topicId), status: "aprovada" }).lean();
  if (!aula) return null;
  const topico = await Topic.findById(aula.topicId).select("assunto disciplina").lean();
  if (!topico) return null;
  const fontesIds = [...new Set((aula.fontes ?? []).map((f) => String(f.sourceId)))];
  if ((DISCIPLINAS_COM_FONTE_OBRIGATORIA as readonly string[]).includes(topico.disciplina) && !fontesIds.length) return null;
  if (fontesIds.length && (await Source.countDocuments({ _id: { $in: fontesIds }, revogada: false })) !== fontesIds.length) return null;
  return {
    topicoId: String(aula.topicId),
    assunto: topico.assunto,
    conteudo: aula.conteudo,
    pontosChave: aula.pontosChave,
    comoABancaCobra: aula.comoABancaCobra,
    pegadinhasComuns: aula.pegadinhasComuns,
    exemplos: aula.exemplos,
    fontes: (aula.fontes ?? []).map((f) => ({ titulo: f.titulo ?? "Fonte", trecho: f.trecho ?? "" })),
  };
}
