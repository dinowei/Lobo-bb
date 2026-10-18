// ============================================================
// BB Estudos — Filtro anti-repetição (PLANO-MESTRE 5.8, fase 4)
// Antes do auditor, toda questão nova é comparada com as do mesmo tópico e com as oficiais
// da disciplina: cosseno do embedding (enunciado + correta) e sobreposição de trechos
// (Jaccard de 4 palavras, pega cópia com palavras trocadas). Nas questões por construção,
// a impressão digital estrutural (tipo, contexto, parâmetros) não se repete no tópico.
// Limites no .env, conservadores: só descarta o que é quase idêntico.
// ============================================================
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import type { Types } from "mongoose";
import { Question, Topic, type Disciplina } from "./models.js";
import { embedLote, cosseno } from "./llm.js";

const num = (v: string | undefined, padrao: number) => (v?.trim() && Number.isFinite(Number(v)) ? Number(v) : padrao);
export const limites = () => ({
  // calibrado em 17/10/2026 com 657 pares do banco (docs/CALIBRAGEM-SIMILARIDADE.md): 650 abaixo
  // de 0,80; o único par acima de 0,90 (0,939) é a mesma questão com outro capital
  duplicada: num(process.env.SIMILAR_DUPLICADA, 0.97), // cosseno: descarta
  parecida: num(process.env.SIMILAR_PARECIDA, 0.93), // cosseno: descarta e pede outro cenário (1 vez)
  oficial: num(process.env.SIMILAR_OFICIAL, 0.93), // cosseno com oficial: paráfrase, descarta
  jaccard: num(process.env.SIMILAR_JACCARD, 0.6), // trechos em comum: cópia, descarta
});
export type Limites = ReturnType<typeof limites>;

// o que se compara: enunciado + alternativa correta
export const textoComparavel = (enunciado: string, correta: string) => `${enunciado}\nResposta: ${correta}`;

// trechos de 4 palavras (sem acento e caixa; números contam como palavra)
const palavras = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().match(/[a-z0-9]+(?:[.,][0-9]+)*/g) ?? [];
export function trechos(texto: string, n = 4): Set<string> {
  const p = palavras(texto);
  const s = new Set<string>();
  for (let i = 0; i + n <= p.length; i++) s.add(p.slice(i, i + n).join(" "));
  return s;
}
// texto curto ("De acordo com o texto, …") não entra: poucos trechos inflam o índice
const MIN_TRECHOS = 12;
export function jaccard(a: Set<string>, b: Set<string>): number {
  if (Math.min(a.size, b.size) < MIN_TRECHOS) return 0;
  let comuns = 0;
  for (const x of a) if (b.has(x)) comuns++;
  return comuns / (a.size + b.size - comuns);
}

// (tipo, contexto, parâmetros principais) → impressão curta; igual no tópico = repetida
export const impressaoEstrutural = (tipo: string, contexto: string, parametros: unknown) =>
  createHash("sha1").update(JSON.stringify([tipo, contexto, parametros])).digest("hex").slice(0, 24);

export type Classe = "nova" | "parecida" | "duplicada" | "parafrase_oficial";
// motivos de descarte por repetição (relatório do "status")
export const MOTIVOS_REPETICAO = ["parecida", "duplicada", "parafrase_oficial", "impressao_repetida"];
const GRAVIDADE: Record<Classe, number> = { nova: 0, parecida: 1, duplicada: 2, parafrase_oficial: 3 };

export function classificar(cos: number, jac: number, oficial: boolean, l: Limites = limites()): Classe {
  if (oficial && (cos >= l.oficial || jac >= l.jaccard)) return "parafrase_oficial";
  if (cos >= l.duplicada || jac >= l.jaccard) return "duplicada";
  if (cos >= l.parecida) return "parecida";
  return "nova";
}

export interface Veredito {
  classe: Classe;
  comId?: string; // a questão mais parecida
  cosseno: number;
  jaccard: number;
  semEmbedding?: boolean; // embedding falhou: só a checagem de trechos valeu
}

export interface Comparavel {
  id: string;
  texto: string; // textoComparavel(enunciado, correta): o mesmo para embedding e trechos
  oficial: boolean;
  embedding?: number[];
}

// pior veredito contra uma lista (puro, para testes). Crase tem enunciado fixo: por isso
// os trechos também incluem a correta, senão toda Crase pareceria cópia da outra.
export function pior(texto: string, embedding: number[] | null, outras: Comparavel[], l: Limites = limites()): Veredito {
  const meus = trechos(texto);
  let v: Veredito = { classe: "nova", cosseno: 0, jaccard: 0 };
  for (const o of outras) {
    const cos = embedding && o.embedding?.length ? cosseno(embedding, o.embedding) : 0;
    const jac = jaccard(meus, trechos(o.texto));
    const classe = classificar(cos, jac, o.oficial, l);
    if (GRAVIDADE[classe] > GRAVIDADE[v.classe] || (classe === v.classe && Math.max(cos, jac) > Math.max(v.cosseno, v.jaccard)))
      v = { classe, comId: o.id, cosseno: cos, jaccard: jac };
  }
  return embedding ? v : { ...v, semEmbedding: true };
}

// Questões com que a nova é comparada: mesmo tópico (fora as rejeitadas) + oficiais da disciplina
export async function comparaveis(topicId: Types.ObjectId, disciplina: string, ignorar?: Types.ObjectId): Promise<Comparavel[]> {
  const topicos = (await Topic.find({ disciplina: disciplina as Disciplina }).select("_id").lean()).map((t) => t._id);
  const qs = await Question.find({
    ...(ignorar ? { _id: { $ne: ignorar } } : {}),
    $or: [{ topicId, status: { $ne: "rejeitada" } }, { topicId: { $in: topicos }, origem: "oficial" }],
  })
    .select("+embedding enunciado alternativas origem")
    .lean();
  return qs.map((q) => ({
    id: String(q._id),
    texto: textoComparavel(q.enunciado, q.alternativas.find((a) => a.correta)?.texto ?? ""),
    oficial: q.origem === "oficial",
    embedding: q.embedding?.length ? q.embedding : undefined,
  }));
}

// Filtro completo: embedding da nova (se o provedor responder) + pior veredito contra o banco
export async function filtrarRepeticao(
  enunciado: string,
  correta: string,
  topicId: Types.ObjectId,
  disciplina: string
): Promise<{ veredito: Veredito; embedding: number[] | null }> {
  const texto = textoComparavel(enunciado, correta);
  let embedding: number[] | null = null;
  try {
    [embedding] = await embedLote([texto], "passage");
  } catch {
    embedding = null; // sem embedding, vale só a checagem de trechos; "similaridade --indexar" completa depois
  }
  return { veredito: pior(texto, embedding, await comparaveis(topicId, disciplina)), embedding };
}

// ---------- manutenção: embeddings que faltam e calibragem dos limites ----------

// Embedding de toda questão que ainda não tem (oficiais, geradas antigas, as que o provedor falhou)
export async function indexarQuestoes(lote = 32) {
  const faltam = await Question.find({ $or: [{ embedding: { $exists: false } }, { embedding: { $size: 0 } }] })
    .select("enunciado alternativas")
    .lean();
  console.log(`${faltam.length} questão(ões) sem embedding`);
  for (let i = 0; i < faltam.length; i += lote) {
    const parte = faltam.slice(i, i + lote);
    const textos = parte.map((q) => textoComparavel(q.enunciado, q.alternativas.find((a) => a.correta)?.texto ?? ""));
    const vetores = await embedLote(textos, "passage");
    await Question.bulkWrite(parte.map((q, k) => ({ updateOne: { filter: { _id: q._id }, update: { $set: { embedding: vetores[k] } } } })));
    console.log(`  ${Math.min(i + lote, faltam.length)}/${faltam.length}`);
  }
}

export interface Par { a: string; b: string; cosseno: number; jaccard: number; assunto: string }

// Pares comparáveis do banco: mesmo tópico (qualquer origem) + geradas × oficiais da disciplina
export async function paresDoBanco() {
  const [qs, tops] = await Promise.all([
    Question.find({ status: { $ne: "rejeitada" } }).select("+embedding enunciado alternativas origem topicId prova numeroOriginal").lean(),
    Topic.find().select("disciplina assunto").lean(),
  ]);
  const topico = new Map(tops.map((t) => [String(t._id), t]));
  const itens = qs.map((q) => {
    const texto = textoComparavel(q.enunciado, q.alternativas.find((a) => a.correta)?.texto ?? "");
    const t = topico.get(String(q.topicId));
    const rotulo = q.origem === "oficial" ? `${q.prova ?? "oficial"} nº ${q.numeroOriginal ?? "?"}` : `gerada ${q._id}`;
    return { id: String(q._id), q, texto, trechos: trechos(texto), disciplina: t?.disciplina ?? "", assunto: t?.assunto ?? "", rotulo };
  });
  const pares: Par[] = [];
  for (let i = 0; i < itens.length; i++)
    for (let j = i + 1; j < itens.length; j++) {
      const [x, y] = [itens[i], itens[j]];
      const mesmoTopico = String(x.q.topicId) === String(y.q.topicId);
      const geradaOficial = x.q.origem !== y.q.origem && x.disciplina === y.disciplina;
      if (!mesmoTopico && !geradaOficial) continue;
      const cos = x.q.embedding?.length && y.q.embedding?.length ? cosseno(x.q.embedding, y.q.embedding) : 0;
      pares.push({ a: x.id, b: y.id, cosseno: cos, jaccard: jaccard(x.trechos, y.trechos), assunto: x.assunto });
    }
  return { itens: new Map(itens.map((x) => [x.id, x])), pares };
}

// docs/CALIBRAGEM-SIMILARIDADE.md: distribuição + 10 pares perto de cada limite para o dono classificar
export async function calibrar(arquivo = "docs/CALIBRAGEM-SIMILARIDADE.md") {
  const l = limites();
  const { itens, pares } = await paresDoBanco();
  const comCos = pares.filter((p) => p.cosseno > 0);
  const faixas: [string, number, number][] = [
    ["< 0,80", -1, 0.8], ["0,80–0,85", 0.8, 0.85], ["0,85–0,90", 0.85, 0.9], ["0,90–0,93", 0.9, 0.93],
    ["0,93–0,95", 0.93, 0.95], ["0,95–0,97", 0.95, 0.97], ["≥ 0,97", 0.97, 2],
  ];
  const perto = (alvo: number, fora: Set<Par>) =>
    [...comCos].filter((p) => !fora.has(p)).sort((x, y) => Math.abs(x.cosseno - alvo) - Math.abs(y.cosseno - alvo)).slice(0, 10);
  const nDup = perto(l.duplicada, new Set());
  const nPar = perto(l.parecida, new Set(nDup));
  const f3 = (n: number) => n.toFixed(3).replace(".", ",");
  const resumo = (id: string) => {
    const x = itens.get(id)!;
    return `> **${x.rotulo}** — ${x.texto.replace(/\s+/g, " ").slice(0, 420)}${x.texto.length > 420 ? "…" : ""}`;
  };
  const bloco = (titulo: string, lista: Par[]) =>
    [`## ${titulo}`, "", ...lista.flatMap((p, k) => [
      `### ${k + 1}. cosseno ${f3(p.cosseno)} · trechos ${f3(p.jaccard)} · ${p.assunto}`, "", resumo(p.a), ">", resumo(p.b), "",
      "- [ ] repetida  - [ ] ok", "",
    ])];
  const md = [
    "# Calibragem do filtro de similaridade",
    "",
    `Gerado em ${new Date().toLocaleString("pt-BR")} por \`npm run bb -- similaridade calibrar\`.`,
    "",
    `**Limites atuais** (\`.env\`, conservadores): duplicada ≥ ${f3(l.duplicada)} · parecida ≥ ${f3(l.parecida)} · paráfrase de oficial ≥ ${f3(l.oficial)} · trechos (Jaccard) ≥ ${f3(l.jaccard)}.`,
    "",
    `**Base:** ${itens.size} questões (fora as rejeitadas), ${pares.length} pares comparados (mesmo tópico + geradas × oficiais da disciplina), ${comCos.length} com embedding nos dois lados.`,
    "",
    "| cosseno | pares |",
    "|---|---|",
    ...faixas.map(([r, a, b]) => `| ${r} | ${comCos.filter((p) => p.cosseno >= a && p.cosseno < b).length} |`),
    "",
    `Maior sobreposição de trechos: ${f3(Math.max(0, ...pares.map((p) => p.jaccard)))}.`,
    "",
    "**Como classificar:** marque `repetida` se um aluno sentiria que já fez essa questão; `ok` se são questões diferentes.",
    'Depois, ajuste `SIMILAR_DUPLICADA` e `SIMILAR_PARECIDA` no `.env` para que as "repetidas" fiquem acima do limite e as "ok" abaixo.',
    "",
    ...bloco(`Perto do limite "duplicada" (${f3(l.duplicada)})`, nDup),
    ...bloco(`Perto do limite "parecida" (${f3(l.parecida)})`, nPar),
  ].join("\n");
  await writeFile(arquivo, md, "utf8");
  console.log(`✔ ${arquivo}: ${pares.length} pares, ${comCos.length} com embedding`);
}

export const detalheSimilaridade = (v: Veredito) =>
  `mais parecida: ${v.comId ?? "-"} (cosseno ${v.cosseno.toFixed(3)}, trechos ${v.jaccard.toFixed(2)}${v.semEmbedding ? ", sem embedding" : ""})`;
