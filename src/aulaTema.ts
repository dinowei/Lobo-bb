// ============================================================
// BB Estudos — aula COMPLETA por tema (v1.1, item 4)
// Uma seção por subtema (explicação, exemplos, contraexemplos da Lo, pegadinhas da banca, resumo), escrita pela
// corrente "tutor" e auditada SEÇÃO POR SEÇÃO por auditor de outra família. Seção reprovada fica "em preparo" e
// não bloqueia as aprovadas. Hierarquia A > B > C com citação literal conferida por código (regras 3 e 18):
// Bancários, Atualidades e Vendas só com fonte ingerida. A origem que o aluno vê é decidida pelo código.
// Prova primeiro em 2 temas (PROVA_AULA_TEMA); só vai para a esteira depois do OK do dono.
// ============================================================
import { Types } from "mongoose";
import { AulaTema, Chunk, DISCIPLINAS_COM_FONTE_OBRIGATORIA, Ficha, Question, Source, Topic } from "./models.js";
import { chatJSONFuncao } from "./corrente.js";
import { SemModeloDisponivel, ehFalhaDeInfra, validarOuReparar } from "./llm.js";
import { CONFERE_SECAO_SYSTEM, CONFERE_SECAO_Z, SECAO_AULA_TEMA_SYSTEM, SecaoAulaTemaZ, secaoAulaTemaUser } from "./prompts.js";
import { ancorarCitacao, contarPalavrasMarkdown } from "./aulas.js";
import { escolherTrechos } from "./chatBinho.js";
import { SUBTOPICO_POR_ID } from "../shared/subtopicos.js";
import { disciplinaDoTema } from "../shared/trilhaUnica.js";
import { subtemasDoTema } from "../shared/estudoTema.js";
import { TRILHA } from "../shared/trilha.js";
import type { AulaTemaDTO } from "../shared/tipos.js";

// os 2 temas da prova (decisão do dono, fechamento v1.1): Concordância e um de Matemática
export const PROVA_AULA_TEMA = ["concordancia", "porcentagem"] as const;

type Camada = "A" | "B" | "C";
export type FonteSecao = { indice: number; titulo: string; camada: Camada; texto: string };
type Secao = ReturnType<typeof SecaoAulaTemaZ.parse>;

const normalizar = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

// tipo da fonte → camada: oficial (lei, norma, edital, prova) A; material próprio B; cursinho C
export const camadaDoTipo = (tipo?: string | null): Camada =>
  tipo === "material_cursinho" ? "C" : tipo === "material_proprio" ? "B" : "A";

// conferência determinística da seção: [N] existe, citação literal, fonte listada é citada; disciplina com fonte
// obrigatória exige citação
export function validarSecao(s: Secao, disciplina: string, fontes: FonteSecao[]): string | undefined {
  const porIndice = new Map(fontes.map((f) => [f.indice, f]));
  const citados = [...s.conteudo.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]));
  if (citados.some((i) => !porIndice.has(i))) return "A seção cita um índice de fonte inexistente.";
  for (const f of s.fontes) {
    const original = porIndice.get(f.indice);
    if (!original) return `A citação aponta para uma fonte inexistente (${f.indice}).`;
    if (!citados.includes(f.indice)) return `A fonte ${f.indice} foi listada mas não é citada no conteúdo.`;
    if (!normalizar(original.texto).includes(normalizar(f.trecho))) return `A citação da fonte ${f.indice} não existe literalmente no trecho.`;
  }
  if ((DISCIPLINAS_COM_FONTE_OBRIGATORIA as readonly string[]).includes(disciplina) && !s.fontes.length) return "Esta disciplina exige fonte ingerida e citação literal.";
  return undefined;
}

// origem mostrada ao aluno: a melhor camada citada (A > B > C); sem citação, "conceito"
export function origemDaSecao(citadas: { camada: string }[]): "A" | "B" | "C" | "conceito" {
  for (const c of ["A", "B", "C"] as const) if (citadas.some((x) => x.camada === c)) return c;
  return "conceito";
}

async function fontesDoSubtema(subtopico: string, tema: string, subtema: string, topicIds: Types.ObjectId[]): Promise<FonteSecao[]> {
  const chunks = await Chunk.find({ topicIds: { $in: topicIds }, revogada: false }).sort({ ordem: 1, pagina: 1 }).limit(300).select("sourceId pagina texto").lean();
  const fontes = await Source.find({ _id: { $in: [...new Set(chunks.map((c) => String(c.sourceId)))] }, revogada: false }).select("titulo tipo").lean();
  const porId = new Map(fontes.map((f) => [String(f._id), f]));
  const dosChunks = chunks.flatMap((c) => {
    const f = porId.get(String(c.sourceId));
    return f ? [{ titulo: `${f.titulo}${c.pagina ? `, p. ${c.pagina}` : ""}`, camada: camadaDoTipo(f.tipo), texto: c.texto.slice(0, 1800) }] : [];
  });
  const ficha = await Ficha.findOne({ subtopico, status: "aprovada" }).sort({ createdAt: -1 }).select("afirmacoes").lean();
  const daFicha = (ficha?.afirmacoes ?? []).filter((a) => a.trecho && a.trecho.length >= 20)
    .map((a) => ({ titulo: `Ficha do tema · ${a.arquivo?.split(/[\\/]/).pop() ?? "material"}${a.pagina ? `, p. ${a.pagina}` : ""}`, camada: (a.camada ?? "C") as Camada, texto: a.trecho! }));
  const busca = `${tema} ${subtema}`;
  // A antes de B antes de C entre os escolhidos (hierarquia), sem perder os mais ligados ao subtema
  const escolhidos = [...escolherTrechos(busca, dosChunks, 6), ...escolherTrechos(busca, daFicha, 3)]
    .sort((a, b) => a.camada.localeCompare(b.camada));
  return escolhidos.map((f, i) => ({ indice: i + 1, ...f }));
}

async function gerarSecao(c: { disciplina: string; tema: string; subtema: string; outros: string[]; fontes: FonteSecao[]; oficiais: { enunciado: string; gabarito: string }[] }) {
  const entrada = secaoAulaTemaUser({ disciplina: c.disciplina, tema: c.tema, subtema: c.subtema, outrosSubtemas: c.outros, fontes: c.fontes, oficiais: c.oficiais });
  const preparar = (json: unknown): Secao => {
    const s = SecaoAulaTemaZ.parse(json);
    const texto = new Map(c.fontes.map((f) => [f.indice, f.texto]));
    return { ...s, fontes: s.fontes.map((f) => ({ ...f, trecho: texto.has(f.indice) ? ancorarCitacao(f.trecho, texto.get(f.indice)!) : f.trecho })) };
  };
  let escritor = await chatJSONFuncao("tutor", SECAO_AULA_TEMA_SYSTEM, entrada, 0.3, 4000);
  let secao = preparar(await validarOuReparar(SecaoAulaTemaZ, escritor.json, { client: escritor.client, model: escritor.modelo, system: SECAO_AULA_TEMA_SYSTEM, user: entrada }));
  let erro = validarSecao(secao, c.disciplina, c.fontes);
  if (erro) {
    // uma correção com o mesmo modelo
    const pedido = `${entrada}\n\nSEÇÃO QUE PRECISA DE CORREÇÃO:\n${JSON.stringify(secao).slice(0, 6000)}\n\nERRO DETERMINÍSTICO: ${erro}\nReescreva o JSON completo. Cada [N] do texto precisa de uma citação literal (20 a 120 caracteres consecutivos) do trecho [N] em "fontes"; não liste fonte que não citou.`;
    escritor = await chatJSONFuncao("tutor", SECAO_AULA_TEMA_SYSTEM, pedido, 0.1, 4000, { preferir: escritor.modelo });
    secao = preparar(await validarOuReparar(SecaoAulaTemaZ, escritor.json, { client: escritor.client, model: escritor.modelo, system: SECAO_AULA_TEMA_SYSTEM, user: pedido }));
    erro = validarSecao(secao, c.disciplina, c.fontes);
  }
  const citadas = secao.fontes.map((f) => ({ ...f, fonte: c.fontes.find((x) => x.indice === f.indice)! }));
  const base = {
    subtema: c.subtema, conteudo: secao.conteudo, exemplos: secao.exemplos, contraexemplos: secao.contraexemplos, pegadinhas: secao.pegadinhas, resumo: secao.resumo,
    fontes: citadas.map((x) => ({ titulo: x.fonte.titulo, trecho: x.trecho, camada: x.fonte.camada })),
    origem: origemDaSecao(citadas.map((x) => x.fonte)),
    palavras: contarPalavrasMarkdown([secao.conteudo, ...secao.exemplos, ...secao.contraexemplos, ...secao.pegadinhas, secao.resumo].join("\n")),
    geradaPor: escritor.modelo,
  };
  if (erro) return { ...base, status: "em_preparo" as const, motivos: [erro] };
  // auditor de OUTRA família, só esta seção
  const auditor = await chatJSONFuncao("auditor", CONFERE_SECAO_SYSTEM, `${entrada}\n\nSEÇÃO A CONFERIR:\n${JSON.stringify(secao)}`, 0, 1800, { excluirFamilias: [escritor.familia] });
  const parecer = CONFERE_SECAO_Z.parse(auditor.json);
  return { ...base, auditadaPor: auditor.modelo, status: parecer.ok ? ("aprovada" as const) : ("em_preparo" as const), motivos: parecer.ok ? [] : parecer.problemas };
}

// gera (ou completa) a aula do tema: seções já aprovadas ficam; as em preparo e as que faltam são (re)feitas
export async function gerarAulaTema(subtopico: string): Promise<{ ok: boolean; resumo: string }> {
  const s = SUBTOPICO_POR_ID.get(subtopico);
  if (!s) throw new Error(`Tema desconhecido: ${subtopico}`);
  const disciplina = disciplinaDoTema(s) as string;
  const topicos = await Topic.find({ assunto: { $in: s.topicos }, ativo: true }).select("_id assunto subtopicos").lean();
  const subtemas = subtemasDoTema(subtopico, topicos.map((t) => ({ assunto: t.assunto, subtopicos: t.subtopicos ?? [] })), TRILHA.map((t) => t.subtopico));
  if (!subtemas.length) return { ok: false, resumo: `${s.nome}: tema sem subtemas no edital` };
  const oficiais = (await Question.find({ subtopico, origem: "oficial", status: "aprovada" }).sort({ createdAt: -1 }).limit(4).select("enunciado gabarito").lean())
    .map((q) => ({ enunciado: q.enunciado.slice(0, 700), gabarito: q.gabarito }));
  const anterior = await AulaTema.findOne({ subtopico }).lean();
  const secoes: Record<string, unknown>[] = [];
  for (const [ordem, subtema] of subtemas.entries()) {
    const ja = anterior?.secoes.find((x) => x.subtema === subtema && x.status === "aprovada");
    if (ja) { secoes.push({ ...ja, ordem }); continue; }
    const fontes = await fontesDoSubtema(subtopico, s.nome, subtema, topicos.map((t) => t._id));
    if ((DISCIPLINAS_COM_FONTE_OBRIGATORIA as readonly string[]).includes(disciplina) && !fontes.length) {
      secoes.push({ ordem, subtema, status: "em_preparo", motivos: ["sem fonte ingerida (regras 3 e 18)"] });
      continue;
    }
    try {
      secoes.push({ ordem, ...(await gerarSecao({ disciplina, tema: s.nome, subtema, outros: subtemas.filter((x) => x !== subtema), fontes, oficiais })) });
    } catch (e) {
      // falha de modelo/infra: em preparo, tenta de novo numa próxima rodada
      const motivo = e instanceof SemModeloDisponivel || ehFalhaDeInfra(e) ? `infraestrutura: ${String((e as Error).message).slice(0, 160)}` : `formato: ${String((e as Error).message).slice(0, 160)}`;
      secoes.push({ ordem, subtema, status: "em_preparo", motivos: [motivo] });
    }
  }
  await AulaTema.updateOne({ subtopico }, { $set: { subtopico, nome: s.nome, secoes } }, { upsert: true });
  const aprovadas = secoes.filter((x) => x.status === "aprovada").length;
  const palavras = secoes.reduce((m, x) => m + (Number(x.palavras) || 0), 0);
  const reprovadas = secoes.filter((x) => x.status !== "aprovada").map((x) => `${x.subtema}: ${(x.motivos as string[] | undefined)?.join(" | ").slice(0, 200)}`);
  return { ok: aprovadas > 0, resumo: `${s.nome}: ${aprovadas}/${secoes.length} seções aprovadas, ${palavras} palavras${reprovadas.length ? `; em preparo: ${reprovadas.join(" · ")}` : ""}` };
}

// etapa da noite (só a prova, uma vez): os temas de PROVA_AULA_TEMA que ainda não têm aula
export async function etapaProvaAulaTema(): Promise<string | null> {
  const feitos: string[] = [];
  for (const sub of PROVA_AULA_TEMA) {
    if (await AulaTema.exists({ subtopico: sub })) continue;
    feitos.push((await gerarAulaTema(sub)).resumo);
  }
  return feitos.length ? feitos.join(" — ") : null;
}

export async function aulaDoTema(subtopico: string): Promise<AulaTemaDTO | null> {
  const a = await AulaTema.findOne({ subtopico }).lean();
  if (!a) return null;
  return {
    subtopico: a.subtopico, nome: a.nome ?? subtopico,
    secoes: [...a.secoes].sort((x, y) => x.ordem - y.ordem).map((x) =>
      x.status === "aprovada"
        ? { ordem: x.ordem, subtema: x.subtema, status: "aprovada" as const, conteudo: x.conteudo ?? "", exemplos: x.exemplos, contraexemplos: x.contraexemplos, pegadinhas: x.pegadinhas, resumo: x.resumo ?? "", fontes: (x.fontes ?? []).map((f) => ({ titulo: f.titulo ?? "", trecho: f.trecho ?? "", camada: f.camada ?? "" })), origem: x.origem ?? "conceito" }
        : { ordem: x.ordem, subtema: x.subtema, status: "em_preparo" as const }),
  };
}
