// ============================================================
// BB Estudos — Ingestão: tópicos, fontes (leis/normas), provas oficiais
// ============================================================
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { z } from "zod";
import { Types } from "mongoose";
import {
  Topic,
  Source,
  Chunk,
  Question,
  Geracao,
  Cartao,
  DISCIPLINAS,
  LETRAS,
  INDICE_VETORIAL,
  type Disciplina,
  type Letra,
} from "./models.js";
import {
  lerArquivo,
  fatiar,
  avisarSeEscaneado,
  hashTexto,
  lerGabarito,
  lerDistribuicao,
  TextoPdf,
  paginaDaSecao,
  type RespostaGabarito,
} from "./extrair.js";
import { embedLote, chatJSON, chatJSONAuditor, validarOuReparar, auditor, gerador, modelo, cosseno } from "./llm.js";
import {
  EXTRATOR_SYSTEM,
  extratorUser,
  TEXTO_APOIO_SYSTEM,
  textoApoioUser,
  TextoApoioZ,
  QuestaoExtraidaZ,
  EXPLICADOR_SYSTEM,
  explicadorUser,
  ExplicacaoZ,
  AUDITOR_CEGO_SYSTEM,
  auditorCegoUser,
  RespostaCegaZ,
  type QuestaoExtraida,
} from "./prompts.js";
import { buscarFontesPorConsulta, geracoesHoje, tetoDiario } from "./pipeline.js";
import { MOTIVOS_REPETICAO } from "./similaridade.js";

const ehDisciplina = (s: string): s is Disciplina => (DISCIPLINAS as readonly string[]).includes(s);

// ============================================================
// 0. TESTAR CONEXÕES (não precisa de Mongo)
// ============================================================
export async function testarConexoes() {
  const [v] = await embedLote(["teste de conexão"], "query");
  console.log(`✔ embeddings OK — ${v.length} dimensões → coloque EMBED_DIM=${v.length} no .env`);
  for (const [nome, client, mod] of [
    ["gerador", gerador(), modelo("GERADOR_MODEL")],
    ["auditor", auditor(), modelo("AUDITOR_MODEL")],
  ] as const) {
    const r = await chatJSON(client, mod, 'Responda apenas {"ok": true}', "ping", 0, 50);
    console.log(`✔ ${nome} OK (${mod}) →`, JSON.stringify(r));
  }
}

// ============================================================
// 1. ÍNDICE VETORIAL no Atlas (rode uma vez, depois de definir EMBED_DIM)
// ============================================================
export async function criarIndice() {
  const dim = Number(process.env.EMBED_DIM);
  if (!dim) throw new Error('Defina EMBED_DIM no .env (rode "npm run bb -- testar" para descobrir).');
  await Chunk.createCollection().catch(() => undefined);
  const nome = INDICE_VETORIAL();
  const existentes = await Chunk.collection.listSearchIndexes(nome).toArray();
  if (existentes.length) {
    const status = (existentes[0] as { status?: string }).status ?? "?";
    console.log(`↷ índice "${nome}" já existe (status: ${status})`);
    return;
  }
  await Chunk.collection.createSearchIndex({
    name: nome,
    type: "vectorSearch",
    definition: {
      fields: [
        { type: "vector", path: "embedding", numDimensions: dim, similarity: "cosine" },
        { type: "filter", path: "topicIds" },
        { type: "filter", path: "revogada" },
      ],
    },
  });
  console.log(`✔ índice "${nome}" criado (${dim} dim). O Atlas leva ~1 min para deixá-lo READY.`);
}

// ============================================================
// 2. TÓPICOS — semeia/atualiza a partir de um JSON
// ============================================================
const TopicoItemZ = z.object({
  assunto: z.string().min(2),
  subtopicos: z.array(z.string()).default([]),
  descricao: z.string().optional(),
  questoesNaProva: z.number().int().positive().nullish(),
  volatil: z.boolean().default(false),
});
const ArquivoTopicosZ = z.object({ disciplinas: z.record(z.string(), z.array(TopicoItemZ)) });

const textoDoTopico = (t: { disciplina: string; assunto: string; subtopicos: string[]; descricao?: string }) =>
  `${t.disciplina.replace(/_/g, " ")} — ${t.assunto}. ${t.subtopicos.join("; ")}. ${t.descricao ?? ""}`.trim();

export async function semearTopicos(caminho: string) {
  const arq = ArquivoTopicosZ.parse(JSON.parse(await readFile(caminho, "utf8")));
  const itens: (z.infer<typeof TopicoItemZ> & { disciplina: Disciplina })[] = [];
  for (const [disc, lista] of Object.entries(arq.disciplinas)) {
    if (!ehDisciplina(disc)) throw new Error(`Disciplina desconhecida: "${disc}". Use: ${DISCIPLINAS.join(", ")}`);
    for (const t of lista) itens.push({ ...t, disciplina: disc });
  }
  console.log(`… ${itens.length} tópicos, gerando embeddings`);
  const vetores = await embedLote(itens.map(textoDoTopico), "query");
  await Topic.bulkWrite(
    itens.map((t, i) => ({
      updateOne: {
        filter: { disciplina: t.disciplina, assunto: t.assunto },
        update: {
          $set: {
            subtopicos: t.subtopicos,
            descricao: t.descricao,
            questoesNaProva: t.questoesNaProva ?? null,
            volatil: t.volatil,
            ativo: true,
            embedding: vetores[i],
          },
        },
        upsert: true,
      },
    }))
  );
  const semPeso = itens.filter((t) => !t.questoesNaProva).length;
  console.log(`✔ ${itens.length} tópicos gravados em ${Object.keys(arq.disciplinas).length} disciplinas`);
  if (semPeso) console.log(`ℹ ${semPeso} tópico(s) sem "questoesNaProva" — o motor usa peso 5 até você preencher pelo edital.`);
}

// ------------------------------------------------------------
// Classificação por similaridade (trecho/questão → tópico)
// ------------------------------------------------------------
type TopicoVetor = { _id: Types.ObjectId; disciplina: string; assunto: string; embedding: number[] };

async function topicosComVetor(disciplina?: string): Promise<TopicoVetor[]> {
  const filtro: Record<string, unknown> = { ativo: true };
  if (disciplina) filtro.disciplina = disciplina;
  const ts = (await Topic.find(filtro).select("+embedding disciplina assunto").lean()) as unknown as TopicoVetor[];
  const comVetor = ts.filter((t) => t.embedding?.length);
  if (!comVetor.length)
    throw new Error(
      disciplina
        ? `Nenhum tópico com vetor na disciplina "${disciplina}". Rode "topicos" antes.`
        : 'Nenhum tópico cadastrado. Rode "npm run bb -- topicos data/topicos.json" antes.'
    );
  return comVetor;
}

const simMin = () => Number(process.env.EMBED_MIN_SIM ?? 0.3);

function classificar(
  v: number[],
  topicos: TopicoVetor[],
  { max = 2, margem = 0.03, forcar = false } = {}
): Types.ObjectId[] {
  const ranking = topicos.map((t) => ({ id: t._id, s: cosseno(v, t.embedding) })).sort((a, b) => b.s - a.s);
  const top = ranking[0];
  if (!top) return [];
  if (forcar) return [top.id];
  if (top.s < simMin()) return [];
  return ranking
    .filter((r, i) => i === 0 || (i < max && top.s - r.s <= margem && r.s >= simMin()))
    .map((r) => r.id);
}

// ============================================================
// 3. FONTE — lei, norma do BACEN/CMN, edital, material próprio
// ============================================================
export type MetaFonte = {
  tipo: "edital" | "lei" | "norma_bacen_cmn" | "material_proprio";
  titulo: string;
  orgao?: string;
  ano?: number;
  url?: string;
  vigenteDesde?: Date;
  disciplina?: string; // restringe a classificação a uma disciplina (recomendado)
};

// Trechos sem tópico de uma fonte (ingerida antes do "forcar") vão para o tópico mais próximo da
// disciplina, usando o embedding já salvo (sem chamar IA)
export async function reclassificarFonte(titulo: string, disciplina: string) {
  const fonte = await Source.findOne({ titulo }).select("_id").lean();
  if (!fonte) return 0;
  const topicos = await topicosComVetor(disciplina);
  const chunks = await Chunk.find({ sourceId: fonte._id, topicIds: { $size: 0 } }).select("+embedding").lean();
  if (!chunks.length) return 0;
  await Chunk.bulkWrite(
    chunks.map((c) => ({ updateOne: { filter: { _id: c._id }, update: { $set: { topicIds: classificar(c.embedding as number[], topicos, { forcar: true }) } } } }))
  );
  return chunks.length;
}

// Decisão de fontes atuais: uma lei pode sustentar mais de um tópico. A ligação é explícita e aditiva;
// preserva os tópicos já classificados e nunca inclui trechos revogados.
export async function vincularFonteAoTopico(tituloFonte: string, assunto: string) {
  const [fonte, topico] = await Promise.all([
    Source.findOne({ titulo: tituloFonte }).select("_id titulo").lean(),
    Topic.findOne({ assunto, ativo: true }).select("_id assunto").lean(),
  ]);
  if (!fonte) throw new Error(`Fonte não encontrada: ${tituloFonte}`);
  if (!topico) throw new Error(`Tópico ativo não encontrado: ${assunto}`);
  const filtro = { sourceId: fonte._id, revogada: false, topicIds: { $ne: topico._id } };
  const novos = await Chunk.updateMany(filtro, { $addToSet: { topicIds: topico._id } });
  const total = await Chunk.countDocuments({ sourceId: fonte._id, revogada: false, topicIds: topico._id });
  return { fonte: fonte.titulo, assunto: topico.assunto, novos: novos.modifiedCount, total };
}

export async function ingerirFonte(caminho: string, meta: MetaFonte) {
  if (meta.disciplina && !ehDisciplina(meta.disciplina))
    throw new Error(`--disciplina inválida. Use: ${DISCIPLINAS.join(", ")}`);

  const { paginas, hash } = await lerArquivo(caminho);
  const existente = await Source.findOne({ hashArquivo: hash }).select("titulo");
  if (existente) {
    console.log(`↷ esse arquivo já foi ingerido como "${existente.titulo}" — pulando`);
    return;
  }
  avisarSeEscaneado(paginas, caminho);

  const trechos = fatiar(paginas);
  if (!trechos.length) throw new Error("Nenhum texto aproveitável no arquivo.");
  console.log(`… ${paginas.length} página(s) → ${trechos.length} trechos`);

  const topicos = await topicosComVetor(meta.disciplina);
  const vetores = await embedLote(
    trechos.map((t) => t.texto),
    "passage"
  );

  const docsSemFonte = trechos.map((t, i) => ({
    ordem: i,
    pagina: t.pagina,
    texto: t.texto,
    embedding: vetores[i],
    // com a disciplina declarada, todo trecho vai para o tópico mais próximo dela: a similaridade
    // tópico (consulta curta) × artigo de lei fica abaixo de EMBED_MIN_SIM e o trecho sumiria da busca
    topicIds: classificar(vetores[i], topicos, { forcar: !!meta.disciplina }),
    revogada: false,
  }));
  const { disciplina: _ignorada, ...metaFonte } = meta;
  const fonte = await Source.create({
    ...metaFonte,
    hashArquivo: hash,
    arquivoNome: basename(caminho),
    paginas: paginas.length,
    totalChunks: trechos.length,
  });
  const docs = docsSemFonte.map((d) => ({ ...d, sourceId: fonte._id }));
  try {
    await Chunk.insertMany(docs);
  } catch {
    try {
      await Chunk.deleteMany({ sourceId: fonte._id });
      await Source.deleteOne({ _id: fonte._id });
    } catch {
      throw new Error(`Falha na ingestão e no rollback automático; confira a fonte nova ${fonte._id} antes de repetir.`);
    }
    throw new Error("Falha na gravação dos trechos; a fonte nova foi removida pelo rollback automático.");
  }

  // relatório: quanto da fonte caiu em cada tópico
  const nomes = new Map(topicos.map((t) => [String(t._id), t.assunto]));
  const cont = new Map<string, number>();
  let orfaos = 0;
  for (const d of docs) {
    if (!d.topicIds.length) orfaos++;
    for (const id of d.topicIds) {
      const n = nomes.get(String(id)) ?? String(id);
      cont.set(n, (cont.get(n) ?? 0) + 1);
    }
  }
  console.log(`✔ "${meta.titulo}" ingerida (id ${fonte._id})`);
  console.table([...cont].sort((a, b) => b[1] - a[1]).map(([assunto, trechos]) => ({ assunto, trechos })));
  if (orfaos)
    console.log(
      `⚠ ${orfaos} trecho(s) sem tópico (similaridade < ${simMin()}). Normal em sumário e preâmbulo; ` +
        `se forem muitos, revise os tópicos, use --disciplina ou baixe EMBED_MIN_SIM.`
    );
}

// ============================================================
// 4. PROVA OFICIAL — PDF da prova + gabarito DEFINITIVO
// ============================================================
const MSG_GABARITO =
  'Não consegui ler o gabarito automaticamente. Crie um "gabarito.txt" com uma questão por linha ' +
  'no formato "1 A" (anulada: "7 X") e passe com --gabarito gabarito.txt. Use o gabarito DEFINITIVO (pós-recursos).';

function pontuar(q: QuestaoExtraida): number {
  const alts = Object.values(q.alternativas).filter(Boolean) as string[];
  return (
    (q.completa ? 10_000 : 0) +
    alts.length * 1_000 +
    (q.textoBase ? 500 : 0) +
    q.enunciado.length +
    alts.reduce((s, a) => s + a.length, 0)
  );
}

// questão que cita "o texto" mas cujo texto ficou em outra janela herda o último texto da mesma disciplina
function herdarTextoBase(ordenadas: QuestaoExtraida[]) {
  let ultimoTexto: { disciplina: string; texto: string } | null = null;
  for (const q of ordenadas) {
    if (q.textoBase) ultimoTexto = { disciplina: q.disciplina, texto: q.textoBase };
    else if (q.referenciaTexto && ultimoTexto?.disciplina === q.disciplina) q.textoBase = ultimoTexto.texto;
  }
}

// Fração dos trechos (frases) da cópia que existem literalmente no texto cru do PDF.
// Normaliza hifenização, números de linha da margem, aspas e espaços (o PDF vem em duas colunas).
function coberturaLiteral(copia: string, cru: string): number {
  const norm = (s: string) =>
    s
      .replace(/-\n/g, "")
      .replace(/^\s*\d{1,3}\s*$/gm, " ")
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/\s+/g, " ")
      .toLowerCase();
  const alvo = norm(cru);
  const trechos = norm(copia)
    .split(/(?<=[.!?;:])\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 25);
  if (!trechos.length) return 0;
  return trechos.filter((t) => alvo.includes(t)).length / trechos.length;
}

// Extrai UMA questão pelo número: acha no texto cru a página onde o número aparece sozinho
// na linha (fora da capa) e pede SÓ aquela questão, com a página seguinte junto.
async function extrairUma(paginas: string[], n: number, secao: string): Promise<QuestaoExtraida | null> {
  const marcador = new RegExp(`(^|\\n)\\s*${n}\\s*(\\n|$)`);
  const pag = paginas.findIndex((p, i) => i > 0 && marcador.test(p));
  if (pag < 0) {
    console.warn(`  ⚠ nº ${n}: não achei o número no texto do PDF`);
    return null;
  }
  const fatia = paginas.slice(pag, pag + 2); // a questão pode continuar na página seguinte
  const texto = fatia.map((p, i) => `=== PÁGINA ${pag + i + 1} ===\n${p}`).join("\n\n");
  try {
    const { json } = await chatJSONAuditor(
      EXTRATOR_SYSTEM,
      `${extratorUser(texto, secao)}\n\nEXTRAIA SOMENTE A QUESTÃO DE NÚMERO ${n}, com as cinco alternativas dela. ` +
        "Ignore as outras questões destas páginas (o PDF tem duas colunas: outra questão pode aparecer no meio do texto).",
      0,
      6_000,
      { pensar: false }
    );
    const itens = (json as { questoes?: unknown })?.questoes;
    const achada = (Array.isArray(itens) ? itens : [])
      .map((item) => QuestaoExtraidaZ.safeParse(item))
      .find((v) => v.success && v.data.numero === n);
    if (achada?.success) {
      console.log(`  ✔ nº ${n} recuperada (página ${pag + 1})`);
      return achada.data;
    }
    console.warn(`  ⚠ nº ${n}: o modelo não devolveu a questão válida`);
  } catch (e) {
    console.warn(`  ⚠ nº ${n}: ${(e as Error).message.replace(/\s+/g, " ").slice(0, 150)}`);
  }
  return null;
}

async function extrairQuestoes(
  paginas: string[],
  esperadas: number[] = [],
  distribuicao: Map<number, string> | null = null
): Promise<QuestaoExtraida[]> {
  const JANELA = 3; // páginas por chamada (4 passava do tempo limite do auditor)
  const PASSO = 2; // 1 página de sobreposição (questão quebrada entre páginas)
  const porNumero = new Map<number, QuestaoExtraida>();
  const secaoNoInicio = new Map<number, string>(); // seção vigente no início de cada janela
  let secaoAtual = "desconhecida";

  const janelas: number[] = [];
  for (let ini = 0; ini < paginas.length; ini += PASSO) {
    janelas.push(ini);
    if (ini + JANELA >= paginas.length) break;
  }

  // Extrai uma janela. Valida questão por questão: um item ruim não derruba as outras da janela.
  async function extrairJanela(ini: number): Promise<boolean> {
    const fatia = paginas.slice(ini, ini + JANELA);
    const texto = fatia.map((p, i) => `=== PÁGINA ${ini + i + 1} ===\n${p}`).join("\n\n");
    console.log(`… extraindo páginas ${ini + 1}–${ini + fatia.length} de ${paginas.length}`);
    try {
      // copiar não exige raciocínio: sem "pensar" fica rápido; se o auditor cair, usa a reserva
      const secao = secaoNoInicio.get(ini) ?? secaoAtual;
      const { json } = await chatJSONAuditor(EXTRATOR_SYSTEM, extratorUser(texto, secao), 0, 16_000, { pensar: false });
      const itens = (json as { questoes?: unknown })?.questoes;
      if (!Array.isArray(itens)) throw new Error("resposta sem a lista 'questoes'");
      const boas: QuestaoExtraida[] = [];
      for (const item of itens) {
        const v = QuestaoExtraidaZ.safeParse(item);
        if (v.success) boas.push(v.data);
        else console.warn(`  ⚠ item descartado (nº ${(item as { numero?: unknown })?.numero ?? "?"}): ${v.error.issues[0]?.message}`);
      }
      for (const q of boas) {
        const atual = porNumero.get(q.numero);
        if (!atual || pontuar(q) > pontuar(atual)) porNumero.set(q.numero, q);
      }
      const ultima = boas.at(-1);
      if (ultima && ehDisciplina(ultima.disciplina)) secaoAtual = ultima.disciplina;
      return true;
    } catch (e) {
      console.warn(`⚠ janela ${ini + 1}–${ini + fatia.length} falhou: ${(e as Error).message.replace(/\s+/g, " ").slice(0, 200)}`);
      return false;
    }
  }

  const falharam: number[] = [];
  for (const ini of janelas) {
    secaoNoInicio.set(ini, secaoAtual);
    if (!(await extrairJanela(ini))) falharam.push(ini);
  }
  // segunda chance para as janelas que falharam (provedor instável)
  if (falharam.length) {
    console.log(`… repetindo ${falharam.length} janela(s) que falharam`);
    for (const ini of falharam) await extrairJanela(ini);
  }

  // Busca dirigida: o modelo às vezes pula questões de uma janela grande. Para cada número que
  // faltou, acha no texto cru a página onde ele aparece sozinho na linha e pede SÓ aquela questão.
  const faltam = esperadas.filter((n) => !porNumero.has(n));
  if (faltam.length) console.log(`… buscando uma a uma ${faltam.length} questão(ões) que faltaram: ${faltam.join(", ")}`);
  for (const n of faltam) {
    const anterior = [...porNumero.values()].filter((q) => q.numero < n).sort((a, b) => b.numero - a.numero)[0];
    const q = await extrairUma(paginas, n, anterior?.disciplina ?? secaoAtual);
    if (q) porNumero.set(n, q);
  }

  const ordenadas = [...porNumero.values()].sort((a, b) => a.numero - b.numero);

  // Disciplina oficial vem da capa (determinística); a da IA só vale se a capa não for legível
  if (distribuicao)
    for (const q of ordenadas) {
      const d = distribuicao.get(q.numero);
      if (d && d !== q.disciplina) {
        console.log(`  ↻ nº ${q.numero}: disciplina corrigida pela capa (${q.disciplina} → ${d})`);
        q.disciplina = d;
      }
    }
  // Em Português e Inglês, questão que cita o texto PRECISA do texto de apoio (marcado por código)
  const CITA_TEXTO = /\b(texto|text|trecho|fragmento|fragment|par[aá]grafo|paragraph|passagem|passage|linhas?|lines?)\b/i;
  for (const q of ordenadas)
    if (["lingua_portuguesa", "lingua_inglesa"].includes(q.disciplina) && CITA_TEXTO.test(`${q.enunciado} ${Object.values(q.alternativas).join(" ")}`))
      q.referenciaTexto = true;
  herdarTextoBase(ordenadas);

  // Texto de apoio longo que o modelo não copiou: pedido à parte, por grupo de questões
  // seguidas da mesma disciplina, e só aceito se for cópia literal do PDF (conferido por código)
  const semTexto = ordenadas.filter((q) => q.referenciaTexto && !q.textoBase);
  const grupos: QuestaoExtraida[][] = [];
  for (const q of semTexto) {
    const g = grupos.at(-1);
    if (g && g.at(-1)!.disciplina === q.disciplina) g.push(q);
    else grupos.push([q]);
  }
  for (const g of grupos) {
    const numeros = g.map((q) => q.numero);
    // o texto fica entre o título da seção e a 1ª questão do grupo (nunca nas páginas da Redação)
    const secao = paginaDaSecao(paginas, g[0].disciplina);
    if (secao < 0) {
      console.warn(`  ⚠ não achei o título da seção ${g[0].disciplina}; questões ${numeros.join(", ")} ficam sem texto de apoio`);
      continue;
    }
    const marcador = new RegExp(`(^|\\n)\\s*${numeros[0]}\\s*(\\n|$)`);
    const rel = paginas.slice(secao).findIndex((p) => marcador.test(p));
    const pag = rel < 0 ? secao : secao + rel;
    const ini = Math.max(secao, pag - 1);
    const fatia = paginas.slice(ini, pag + 1);
    const texto = fatia.map((p, i) => `=== PÁGINA ${ini + i + 1} ===\n${p}`).join("\n\n");
    console.log(`… copiando o texto de apoio das questões ${numeros.join(", ")}`);
    try {
      const { json } = await chatJSONAuditor(TEXTO_APOIO_SYSTEM, textoApoioUser(texto, numeros, g[0].disciplina), 0, 8_000, { pensar: false });
      const { textoBase } = TextoApoioZ.parse(json);
      const cobertura = coberturaLiteral(textoBase, paginas.join("\n"));
      if (cobertura < 0.9) {
        console.warn(`  ⚠ texto de apoio recusado: só ${Math.round(cobertura * 100)}% dele existe literalmente no PDF`);
        continue;
      }
      for (const q of g) q.textoBase = textoBase;
      console.log(`  ✔ texto de apoio (${textoBase.length} caracteres, ${Math.round(cobertura * 100)}% conferido no PDF)`);
    } catch (e) {
      console.warn(`  ⚠ texto de apoio das questões ${numeros.join(", ")}: ${(e as Error).message.replace(/\s+/g, " ").slice(0, 150)}`);
    }
  }
  herdarTextoBase(ordenadas);
  return ordenadas;
}

export async function ingerirProva(
  caminhoProva: string,
  caminhoGabarito: string,
  meta: { nome: string; banca: string; ano?: number }
) {
  const { paginas, hash } = await lerArquivo(caminhoProva);
  const existente = await Source.findOne({ hashArquivo: hash }).select("titulo");
  if (existente) {
    console.log(`↷ essa prova já foi ingerida como "${existente.titulo}" — pulando`);
    return;
  }
  avisarSeEscaneado(paginas, caminhoProva);

  // gabarito primeiro: se não der pra ler, nem gasta IA com a extração
  const gab = await lerArquivo(caminhoGabarito);
  const gabarito = lerGabarito(gab.paginas.join("\n"));
  if (gabarito.size === 0) throw new Error(MSG_GABARITO);
  console.log(`… gabarito: ${gabarito.size} respostas lidas`);

  const distribuicao = lerDistribuicao(paginas);
  console.log(
    distribuicao
      ? `… disciplinas lidas da capa: ${distribuicao.size} questões`
      : "⚠ não consegui ler a distribuição de disciplinas da capa; a disciplina vem da IA (confira depois)"
  );
  const questoes = await extrairQuestoes(paginas, [...gabarito.keys()], distribuicao);
  if (!questoes.length) throw new Error("Nenhuma questão extraída. O PDF tem texto selecionável?");
  const cobertas = questoes.filter((q) => gabarito.has(q.numero)).length;
  if (cobertas < questoes.length * 0.9)
    throw new Error(`O gabarito cobre só ${cobertas} de ${questoes.length} questões extraídas. ${MSG_GABARITO}`);
  // prova pela metade não entra: se faltou extrair qualquer número do gabarito, nada é salvo
  const extraidas = new Set(questoes.map((q) => q.numero));
  const faltando = [...gabarito.keys()].filter((n) => !extraidas.has(n)).sort((a, b) => a - b);
  if (faltando.length)
    throw new Error(
      `Extração incompleta: faltam ${faltando.length} de ${gabarito.size} questões (${faltando.join(", ")}). ` +
        "Nada foi salvo. Rode de novo (o provedor pode ter caído no meio)."
    );

  const fonte = await Source.create({
    tipo: "prova_oficial",
    titulo: meta.nome,
    banca: meta.banca,
    ano: meta.ano,
    hashArquivo: hash,
    arquivoNome: basename(caminhoProva),
    paginas: paginas.length,
    totalChunks: 0,
  });

  // Conferência literal contra o PDF: a IA copia, o código confere (e corrige palavra trocada).
  // Enunciado/alternativa que não bate fica de fora e vai para "conferir à mão".
  const pdf = new TextoPdf(paginas);
  const naoConfere = new Map<number, string[]>();
  let correcoes = 0;
  const textosCorrigidos = new Map<string, string>();
  for (const q of questoes) {
    const problemas: string[] = [];
    const conferir = (t: string, nome: string) => {
      const c = pdf.conferir(t);
      if (c.status === "corrigido") {
        correcoes++;
        console.log(`  ✎ nº ${q.numero} ${nome}: ${c.detalhe}`);
      } else if (c.status === "suspeito") problemas.push(`${nome}: ${c.detalhe}`);
      return c.texto;
    };
    q.enunciado = conferir(q.enunciado, "enunciado");
    for (const l of LETRAS) {
      const alt = q.alternativas[l];
      if (alt) q.alternativas[l] = conferir(alt, `alternativa ${l}`);
    }
    if (problemas.length) naoConfere.set(q.numero, problemas);
    // texto de apoio: frase a frase, só aplica correções (em duas colunas a ordem pode embaralhar)
    if (q.textoBase) {
      if (!textosCorrigidos.has(q.textoBase)) {
        const partes = q.textoBase.split(/(?<=[.!?])(\s+)/);
        const novo = partes
          .map((p) => {
            if (!p.trim()) return p;
            const c = pdf.conferir(p);
            if (c.status !== "corrigido") return p;
            correcoes++;
            console.log(`  ✎ texto de apoio (nº ${q.numero}): ${c.detalhe}`);
            return c.texto;
          })
          .join("");
        textosCorrigidos.set(q.textoBase, novo);
      }
      q.textoBase = textosCorrigidos.get(q.textoBase)!;
    }
  }

  const rel = { extraidas: questoes.length, salvas: 0, anuladas: 0, dependemDeImagem: 0, incompletas: 0, naoConfereComPdf: naoConfere.size, corrigidasPeloPdf: correcoes, semGabarito: 0, duplicadas: 0 };

  type Valida = QuestaoExtraida & { resposta: Letra };
  const validas: Valida[] = [];
  for (const q of questoes) {
    const resp: RespostaGabarito | undefined = gabarito.get(q.numero);
    const alts = LETRAS.map((l) => q.alternativas[l]);
    if (!resp) rel.semGabarito++;
    else if (resp === "anulada") rel.anuladas++;
    else if (naoConfere.has(q.numero)) continue; // já contada em naoConfereComPdf
    else if (q.dependeDeImagem) rel.dependemDeImagem++;
    else if (!q.completa || alts.some((a) => !a?.trim())) rel.incompletas++;
    else validas.push({ ...q, resposta: resp });
  }

  const vetores = await embedLote(
    validas.map((q) => `${q.enunciado}\n${LETRAS.map((l) => q.alternativas[l]).join("\n")}`),
    "passage"
  );

  const cacheTopicos = new Map<string, TopicoVetor[]>();
  const topicosDa = async (disc: string) => {
    const chave = ehDisciplina(disc) ? disc : "*";
    if (!cacheTopicos.has(chave)) {
      cacheTopicos.set(
        chave,
        await topicosComVetor(chave === "*" ? undefined : chave).catch(() => topicosComVetor())
      );
    }
    return cacheTopicos.get(chave)!;
  };

  for (const [i, q] of validas.entries()) {
    const [topicId] = classificar(vetores[i], await topicosDa(q.disciplina), { forcar: true });
    try {
      await Question.create({
        topicId,
        origem: "oficial",
        estiloBanca: meta.banca,
        prova: meta.nome,
        numeroOriginal: q.numero,
        textoBase: q.textoBase ?? undefined,
        enunciado: q.enunciado,
        alternativas: LETRAS.map((l) => ({ letra: l, texto: q.alternativas[l]!.trim(), correta: l === q.resposta })),
        gabarito: q.resposta,
        fontes: [{ sourceId: fonte._id }],
        status: "pendente", // vira "aprovada" depois do comando "explicar"
        hashEnunciado: hashTexto(
          `${q.textoBase ?? ""}|${q.enunciado}|${LETRAS.map((l) => q.alternativas[l]).join("|")}`
        ),
      });
      rel.salvas++;
    } catch (e) {
      if ((e as { code?: number }).code === 11000) rel.duplicadas++;
      else throw e;
    }
  }

  console.log(`✔ "${meta.nome}" ingerida`);
  console.table(rel);
  if (rel.dependemDeImagem)
    console.log("ℹ Questões com gráfico ou tabela ilegível ficaram de fora; dá pra cadastrar na mão depois.");
  if (naoConfere.size) {
    console.log("⚠ Conferir à mão (não bateram com o PDF; costuma ser fórmula que o PDF perdeu) — ficaram de fora:");
    for (const [n, ps] of naoConfere) console.log(`  nº ${n}: ${ps.join(" | ")}`);
  }
  const salvasOuExplicadas = new Set([...validas.map((v) => v.numero), ...naoConfere.keys()]);
  const outras = questoes.filter((q) => !salvasOuExplicadas.has(q.numero) && gabarito.get(q.numero) !== "anulada");
  if (outras.length)
    console.log(`ℹ Ficaram de fora (incompletas ou dependem de imagem): nº ${outras.map((q) => q.numero).join(", ")}`);
  console.log('Próximo passo: "npm run bb -- explicar" para a IA escrever as explicações.');
}

// ============================================================
// 4b. RECUPERAR uma questão oficial que ficou de fora (ex.: intercalada com outra no PDF)
// Mesmas travas da ingestão: gabarito por código, disciplina da capa, conferência literal.
// ============================================================
export async function recuperarQuestao(caminhoProva: string, caminhoGabarito: string, nomeProva: string, numero: number) {
  const fonte = await Source.findOne({ tipo: "prova_oficial", titulo: nomeProva });
  if (!fonte) throw new Error(`Prova "${nomeProva}" não foi ingerida (use o nome exato do --nome da ingestão).`);
  if (await Question.exists({ origem: "oficial", prova: nomeProva, numeroOriginal: numero })) {
    console.log(`↷ a nº ${numero} de "${nomeProva}" já está no banco`);
    return;
  }
  const { paginas, hash } = await lerArquivo(caminhoProva);
  if (fonte.hashArquivo && fonte.hashArquivo !== hash) throw new Error("Esse PDF não é o mesmo da prova ingerida com esse nome.");
  const gabarito = lerGabarito((await lerArquivo(caminhoGabarito)).paginas.join("\n"));
  const resposta = gabarito.get(numero);
  if (!resposta) throw new Error(`O gabarito não tem a nº ${numero}.`);
  if (resposta === "anulada") throw new Error(`A nº ${numero} está anulada no gabarito.`);

  const disciplina = lerDistribuicao(paginas)?.get(numero);
  const q = await extrairUma(paginas, numero, disciplina ?? "desconhecida");
  if (!q) throw new Error(`Não consegui extrair a nº ${numero}.`);
  if (disciplina) q.disciplina = disciplina;

  // conferência literal: tudo precisa bater com o PDF (palavra trocada é corrigida pelo PDF)
  const pdf = new TextoPdf(paginas);
  const problemas: string[] = [];
  const conferir = (t: string, nome: string) => {
    const c = pdf.conferir(t);
    if (c.status === "corrigido") console.log(`  ✎ ${nome}: ${c.detalhe}`);
    if (c.status === "suspeito") problemas.push(`${nome}: ${c.detalhe}`);
    return c.texto;
  };
  q.enunciado = conferir(q.enunciado, "enunciado");
  for (const l of LETRAS) {
    const alt = q.alternativas[l];
    if (alt) q.alternativas[l] = conferir(alt, `alternativa ${l}`);
  }
  if (problemas.length) throw new Error(`A cópia não bateu com o PDF, nada foi salvo: ${problemas.join(" | ")}`);
  if (q.dependeDeImagem) throw new Error("A IA marcou a questão como dependente de imagem; confira no PDF.");
  if (LETRAS.some((l) => !q.alternativas[l]?.trim())) throw new Error("Faltou alguma alternativa; nada foi salvo.");

  const [vetor] = await embedLote([`${q.enunciado}\n${LETRAS.map((l) => q.alternativas[l]).join("\n")}`], "passage");
  const topicos = await topicosComVetor(ehDisciplina(q.disciplina) ? q.disciplina : undefined).catch(() => topicosComVetor());
  const [topicId] = classificar(vetor, topicos, { forcar: true });
  await Question.create({
    topicId,
    origem: "oficial",
    estiloBanca: fonte.banca ?? undefined,
    prova: nomeProva,
    numeroOriginal: numero,
    textoBase: q.textoBase ?? undefined,
    enunciado: q.enunciado,
    alternativas: LETRAS.map((l) => ({ letra: l, texto: q.alternativas[l]!.trim(), correta: l === resposta })),
    gabarito: resposta,
    fontes: [{ sourceId: fonte._id }],
    status: "pendente",
    hashEnunciado: hashTexto(`${q.textoBase ?? ""}|${q.enunciado}|${LETRAS.map((l) => q.alternativas[l]).join("|")}`),
  });
  console.log(`✔ nº ${numero} de "${nomeProva}" recuperada (${q.disciplina}, gabarito ${resposta}). Rode "npm run bb -- explicar".`);
  console.log(`  ${q.enunciado.replace(/\s+/g, " ").slice(0, 200)}`);
  for (const l of LETRAS) console.log(`  (${l}) ${q.alternativas[l]}${l === resposta ? "   ← gabarito" : ""}`);
}

// ============================================================
// 5. EXPLICAR — escreve o material didático das oficiais pendentes
// ============================================================
export async function explicarOficiais(limite = 50) {
  const pendentes = await Question.find({ origem: "oficial", status: "pendente" })
    .sort({ prova: 1, numeroOriginal: 1 })
    .limit(limite);
  if (!pendentes.length) {
    console.log("Nada pendente.");
    return;
  }

  let ok = 0;
  let falhas = 0;
  let discordou = 0;

  for (const [i, q] of pendentes.entries()) {
    const rotulo = `${q.prova ?? ""} #${q.numeroOriginal ?? q._id}`;
    try {
      const base = {
        textoBase: q.textoBase,
        enunciado: q.enunciado,
        alternativas: q.alternativas.map((a) => ({ letra: a.letra, texto: a.texto })),
      };
      const fontes = await buscarFontesPorConsulta(q.topicId, q.enunciado, 4);
      const fontesTxt = fontes.map((f) => `${f.titulo}\n${f.texto}`);

      // 1) a IA resolve às cegas: se errar, a questão é traiçoeira e você precisa saber
      const userCego = auditorCegoUser(base, fontesTxt);
      const rCego = await chatJSONAuditor(AUDITOR_CEGO_SYSTEM, userCego, 0, 2000);
      const cego = await validarOuReparar(RespostaCegaZ, rCego.json, {
        client: auditor(),
        model: rCego.modelo,
        system: AUDITOR_CEGO_SYSTEM,
        user: userCego,
      });
      // 2) escreve a explicação com o gabarito oficial travado (JSON inválido → reparo pelo mesmo modelo)
      const userExp = explicadorUser({ ...base, gabarito: q.gabarito }, fontesTxt);
      const rExp = await chatJSONAuditor(EXPLICADOR_SYSTEM, userExp, 0.2, 5000);
      const exp = await validarOuReparar(ExplicacaoZ, rExp.json, {
        client: auditor(),
        model: rExp.modelo,
        system: EXPLICADOR_SYSTEM,
        user: userExp,
        maxTokens: 5000,
      });
      const modelos = [...new Set([rCego.modelo, rExp.modelo])].join(" + ");

      const porLetra = new Map(exp.alternativas.map((a) => [a.letra, a]));
      if (LETRAS.some((l) => !porLetra.get(l)?.explicacao)) throw new Error("faltou explicação para alguma alternativa");

      for (const a of q.alternativas) {
        const e = porLetra.get(a.letra as Letra)!;
        a.explicacao = e.explicacao;
        a.pegadinha = a.correta ? undefined : e.pegadinha ?? undefined;
      }
      q.explicacaoGeral = exp.explicacaoGeral;
      q.dicaDeProva = exp.dicaDeProva ?? undefined;
      q.dificuldade = exp.dificuldade;

      const acertou = cego.resposta === q.gabarito;
      if (!acertou) discordou++;
      q.auditoria = {
        modelo: modelos,
        respostaCega: cego.resposta,
        veredito: "aprovada",
        problemas: acertou
          ? []
          : [
              `A IA marcou ${cego.resposta} às cegas; o gabarito oficial é ${q.gabarito}. Questão traiçoeira: leia a explicação com atenção.`,
              `Raciocínio da IA: ${cego.raciocinio.replace(/\s+/g, " ").slice(0, 400)}`,
            ],
      };
      for (const f of fontes.slice(0, 2)) q.fontes.push({ sourceId: f.sourceId, trecho: f.texto.slice(0, 600) });
      q.status = "aprovada";
      await q.save();
      ok++;
      console.log(`✔ ${i + 1}/${pendentes.length} ${rotulo}${acertou ? "" : "  ⚠ IA errou às cegas"}`);
    } catch (e) {
      falhas++;
      console.warn(`✖ ${i + 1}/${pendentes.length} ${rotulo}: ${(e as Error).message.slice(0, 200)}`);
    }
  }
  console.log(
    `\n✔ ${ok} explicadas · ⚠ ${discordou} em que a IA errou às cegas (revise essas) · ✖ ${falhas} falhas (rode de novo)`
  );
}

// ============================================================
// 5b. ANULAR — questão oficial anulada no gabarito definitivo: sai de circulação
// (só mexe no status; o gabarito oficial continua intocado — regra 1)
// ============================================================
export async function anularOficial(provaParte: string, numero: number) {
  const prova = new RegExp(provaParte.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const qs = await Question.find({ origem: "oficial", prova, numeroOriginal: numero });
  const provas = [...new Set(qs.map((q) => q.prova))];
  if (!qs.length) {
    console.log(`✖ nenhuma questão oficial nº ${numero} em prova que contenha "${provaParte}". Se ela já foi anulada no gabarito, nem entrou no banco.`);
    return;
  }
  if (provas.length > 1) throw new Error(`"${provaParte}" bate com mais de uma prova (${provas.join(" | ")}). Seja mais específico.`);
  for (const q of qs) {
    const antes = q.status;
    q.status = "anulada";
    q.auditoria ??= { problemas: [] };
    q.auditoria.problemas.push(`Anulada pela banca no gabarito definitivo (marcada em ${new Date().toISOString().slice(0, 10)}).`);
    await q.save();
    console.log(`✔ ${q.prova} nº ${numero}: ${antes} → anulada (sai de circulação)`);
  }
}

// ============================================================
// 6. REVOGAR — norma mudou? tira a fonte e as questões dela de circulação
// ============================================================
export async function revogarFonte(alvo: string) {
  const fonte = /^[0-9a-f]{24}$/i.test(alvo)
    ? await Source.findById(alvo)
    : await Source.findOne({ titulo: new RegExp(alvo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") });
  if (!fonte) throw new Error(`Fonte não encontrada: ${alvo}`);
  fonte.revogada = true;
  await fonte.save();
  const c = await Chunk.updateMany({ sourceId: fonte._id }, { revogada: true });
  const q = await Question.updateMany(
    { origem: "gerada", status: "aprovada", "fontes.sourceId": fonte._id },
    { status: "desatualizada" }
  );
  const k = await Cartao.updateMany({ sourceId: fonte._id, status: "aprovado" }, { status: "desatualizado" });
  // ADENDO-FONTES-ATUAIS: questões cuja base atual era essa fonte voltam para a conferência
  await Question.updateMany(
    { $or: [{ "referencias.sourceId": fonte._id }, { "oQueMudou.sourceId": fonte._id }], situacaoFonte: { $in: ["confirmada", "mudou"] } },
    { $set: { situacaoFonte: "pendente" } }
  );
  console.log(
    `✔ "${fonte.titulo}" revogada · ${c.modifiedCount} trechos fora da busca · ${q.modifiedCount} questões geradas e ${k.modifiedCount} cartões tirados de circulação`
  );
}

// ============================================================
// 7. STATUS — o raio-x do seu banco
// ============================================================
export async function mostrarStatus() {
  const [cenariosPorTopico, repeticoesPorTopico, hoje] = await Promise.all([
    // cenários distintos (perfil + situação) nas geradas que estão no banco
    Question.aggregate<{ _id: Types.ObjectId; n: number }>([
      { $match: { origem: "gerada", status: { $ne: "rejeitada" }, "cenario.perfil": { $exists: true } } },
      { $group: { _id: { t: "$topicId", p: "$cenario.perfil", s: "$cenario.situacao" } } },
      { $group: { _id: "$_id.t", n: { $sum: 1 } } },
    ]),
    // descartes por repetição (filtro de similaridade e impressão estrutural)
    Geracao.aggregate<{ _id: Types.ObjectId; n: number }>([
      { $match: { motivo: { $in: MOTIVOS_REPETICAO } } },
      { $group: { _id: "$topicId", n: { $sum: 1 } } },
    ]),
    geracoesHoje(),
  ]);
  const cenarios = new Map(cenariosPorTopico.map((c) => [String(c._id), c.n]));
  const repeticoes = new Map(repeticoesPorTopico.map((c) => [String(c._id), c.n]));
  const [topicos, porTopicoChunks, porTopicoQuestoes, orfaos, fontes] = await Promise.all([
    Topic.find({ ativo: true }).select("disciplina assunto questoesNaProva").sort({ disciplina: 1, assunto: 1 }).lean(),
    Chunk.aggregate<{ _id: Types.ObjectId; n: number }>([
      { $match: { revogada: false } },
      { $unwind: "$topicIds" },
      { $group: { _id: "$topicIds", n: { $sum: 1 } } },
    ]),
    Question.aggregate<{ _id: { t: Types.ObjectId; o: string; s: string }; n: number }>([
      { $group: { _id: { t: "$topicId", o: "$origem", s: "$status" }, n: { $sum: 1 } } },
    ]),
    Chunk.countDocuments({ revogada: false, topicIds: { $size: 0 } }),
    Source.countDocuments({ revogada: false }),
  ]);

  const chunks = new Map(porTopicoChunks.map((c) => [String(c._id), c.n]));
  const qtd = (t: Types.ObjectId, o: string, s: string) =>
    porTopicoQuestoes.find((x) => String(x._id.t) === String(t) && x._id.o === o && x._id.s === s)?.n ?? 0;

  console.table(
    topicos.map((t) => ({
      disciplina: t.disciplina,
      assunto: t.assunto.slice(0, 48),
      peso: t.questoesNaProva ?? "-",
      trechos: chunks.get(String(t._id)) ?? 0,
      oficiais: qtd(t._id, "oficial", "aprovada"),
      "oficiais pend.": qtd(t._id, "oficial", "pendente"),
      geradas: qtd(t._id, "gerada", "aprovada"),
      "cenários": cenarios.get(String(t._id)) ?? 0,
      "desc. repetição": repeticoes.get(String(t._id)) ?? 0,
    }))
  );
  console.log(`${fontes} fonte(s) ativa(s) · ${orfaos} trecho(s) sem tópico · ${hoje}/${tetoDiario()} gerações hoje (GERACAO_MAX_DIA)`);
}
