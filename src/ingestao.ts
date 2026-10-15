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
  type RespostaGabarito,
} from "./extrair.js";
import { embedLote, chatJSON, auditor, gerador, modelo, cosseno } from "./llm.js";
import {
  EXTRATOR_SYSTEM,
  extratorUser,
  ExtracaoZ,
  EXPLICADOR_SYSTEM,
  explicadorUser,
  ExplicacaoZ,
  AUDITOR_CEGO_SYSTEM,
  auditorCegoUser,
  RespostaCegaZ,
  type QuestaoExtraida,
} from "./prompts.js";
import { buscarFontesPorConsulta } from "./pipeline.js";

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

  const { disciplina: _ignorada, ...metaFonte } = meta;
  const fonte = await Source.create({
    ...metaFonte,
    hashArquivo: hash,
    arquivoNome: basename(caminho),
    paginas: paginas.length,
    totalChunks: trechos.length,
  });

  const docs = trechos.map((t, i) => ({
    sourceId: fonte._id,
    ordem: i,
    pagina: t.pagina,
    texto: t.texto,
    embedding: vetores[i],
    topicIds: classificar(vetores[i], topicos),
    revogada: false,
  }));
  await Chunk.insertMany(docs);

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

async function extrairQuestoes(paginas: string[]): Promise<QuestaoExtraida[]> {
  const JANELA = 4; // páginas por chamada
  const PASSO = 3; // 1 página de sobreposição (questão quebrada entre páginas)
  const porNumero = new Map<number, QuestaoExtraida>();
  let secaoAtual = "desconhecida";

  for (let ini = 0; ini < paginas.length; ini += PASSO) {
    const fatia = paginas.slice(ini, ini + JANELA);
    const texto = fatia.map((p, i) => `=== PÁGINA ${ini + i + 1} ===\n${p}`).join("\n\n");
    console.log(`… extraindo páginas ${ini + 1}–${ini + fatia.length} de ${paginas.length}`);
    try {
      const bruto = await chatJSON(
        auditor(),
        modelo("AUDITOR_MODEL"),
        EXTRATOR_SYSTEM,
        extratorUser(texto, secaoAtual),
        0,
        16_000
      );
      const r = ExtracaoZ.parse(bruto);
      for (const q of r.questoes) {
        const atual = porNumero.get(q.numero);
        if (!atual || pontuar(q) > pontuar(atual)) porNumero.set(q.numero, q);
      }
      const ultima = r.questoes.at(-1);
      if (ultima && ehDisciplina(ultima.disciplina)) secaoAtual = ultima.disciplina;
    } catch (e) {
      console.warn(`⚠ janela ${ini + 1}–${ini + fatia.length} falhou: ${(e as Error).message.slice(0, 200)}`);
    }
    if (ini + JANELA >= paginas.length) break;
  }

  // questão que cita "o texto" mas cujo texto ficou em outra janela herda o último texto da mesma disciplina
  const ordenadas = [...porNumero.values()].sort((a, b) => a.numero - b.numero);
  let ultimoTexto: { disciplina: string; texto: string } | null = null;
  for (const q of ordenadas) {
    if (q.textoBase) ultimoTexto = { disciplina: q.disciplina, texto: q.textoBase };
    else if (q.referenciaTexto && ultimoTexto?.disciplina === q.disciplina) q.textoBase = ultimoTexto.texto;
  }
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

  const questoes = await extrairQuestoes(paginas);
  if (!questoes.length) throw new Error("Nenhuma questão extraída. O PDF tem texto selecionável?");
  const cobertas = questoes.filter((q) => gabarito.has(q.numero)).length;
  if (cobertas < questoes.length * 0.9)
    throw new Error(`O gabarito cobre só ${cobertas} de ${questoes.length} questões extraídas. ${MSG_GABARITO}`);

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

  const rel = { extraidas: questoes.length, salvas: 0, anuladas: 0, dependemDeImagem: 0, incompletas: 0, semGabarito: 0, duplicadas: 0 };

  type Valida = QuestaoExtraida & { resposta: Letra };
  const validas: Valida[] = [];
  for (const q of questoes) {
    const resp: RespostaGabarito | undefined = gabarito.get(q.numero);
    const alts = LETRAS.map((l) => q.alternativas[l]);
    if (!resp) rel.semGabarito++;
    else if (resp === "anulada") rel.anuladas++;
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
  console.log('Próximo passo: "npm run bb -- explicar" para a IA escrever as explicações.');
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

  const mod = modelo("AUDITOR_MODEL");
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
      const cego = RespostaCegaZ.parse(
        await chatJSON(auditor(), mod, AUDITOR_CEGO_SYSTEM, auditorCegoUser(base, fontesTxt), 0, 2000)
      );
      // 2) escreve a explicação com o gabarito oficial travado
      const exp = ExplicacaoZ.parse(
        await chatJSON(auditor(), mod, EXPLICADOR_SYSTEM, explicadorUser({ ...base, gabarito: q.gabarito }, fontesTxt), 0.2, 5000)
      );

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
        modelo: mod,
        respostaCega: cego.resposta,
        veredito: "aprovada",
        problemas: acertou
          ? []
          : [`A IA marcou ${cego.resposta} às cegas; o gabarito oficial é ${q.gabarito}. Questão traiçoeira: leia a explicação com atenção.`],
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
  console.log(
    `✔ "${fonte.titulo}" revogada · ${c.modifiedCount} trechos fora da busca · ${q.modifiedCount} questões geradas tiradas de circulação`
  );
}

// ============================================================
// 7. STATUS — o raio-x do seu banco
// ============================================================
export async function mostrarStatus() {
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
    }))
  );
  console.log(`${fontes} fonte(s) ativa(s) · ${orfaos} trecho(s) sem tópico`);
}
