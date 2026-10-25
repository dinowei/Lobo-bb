// ============================================================
// BB Estudos — Incidência das provas oficiais (F8), só código: lê as questões oficiais do banco,
// conta por subtópico/tópico, banca e ano (shared/incidencia.ts) e vira peso no noturno.
// `bb -- incidencia` grava docs/INCIDENCIA.md e mostra o top 10.
// ============================================================
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Types } from "mongoose";
import { Question } from "./models.js";
import { contarIncidencia, pesoIncidencia, type ItemOficial, type LinhaIncidencia } from "../shared/incidencia.js";
import { SUBTOPICO_POR_ID } from "../shared/subtopicos.js";
import { bancaEmUso, BANCAS, type IdBanca, type IdConcurso } from "../shared/concursos.js";
import { bancaConfigurada, carregarConfigConcursos } from "./concursosConfig.js";
import { ordenarTrilha } from "../shared/trilhaUnica.js";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");

async function oficiais() {
  return Question.find({ origem: "oficial" }).select("topicId subtopico banca prova status").lean();
}
const item = (q: { banca?: string | null; prova?: string | null; status?: string }, chave: string): ItemOficial => ({
  chave, banca: q.banca, prova: q.prova, anulada: q.status === "anulada",
});

// tópico → 0..1 na banca em uso do concurso do tópico (BB: Cesgranrio; BACEN: a escolhida ou a de referência)
export async function incidenciaPorTopico(topicos: { _id: Types.ObjectId; concursos?: string[] | null }[]): Promise<Map<string, number>> {
  await carregarConfigConcursos();
  const qs = await oficiais();
  const bancaDe = new Map(topicos.map((t) => {
    const c = (t.concursos?.[0] ?? "bb") as IdConcurso;
    return [String(t._id), bancaEmUso(c, bancaConfigurada(c))];
  }));
  const itens = qs.filter((q) => q.banca === bancaDe.get(String(q.topicId))).map((q) => item(q, String(q.topicId)));
  return pesoIncidencia(contarIncidencia(itens));
}

// subtópico → 0..1 (todas as bancas): entra na ordem da trilha única
export async function incidenciaPorSubtopico(): Promise<Map<string, number>> {
  const qs = await oficiais();
  return pesoIncidencia(contarIncidencia(qs.filter((q) => q.subtopico).map((q) => item(q, q.subtopico!))));
}

// Trilha única: recalcula a ordem (shared/trilhaUnica.ts) e, com "gravar", reescreve data/trilha.json.
// O progresso é por tema e não depende da ordem (shared/trilha.ts), então mudar a ordem não apaga nada.
export async function ordenarTrilhaUnica(gravar: boolean) {
  const arquivo = join(RAIZ, "data", "trilha.json");
  const atual = JSON.parse(await readFile(arquivo, "utf8")) as { temas: { n: number; subtopico: string; nome: string }[] };
  const ordemAntiga = new Map(atual.temas.map((t) => [t.subtopico, t.n]));
  const nova = ordenarTrilha({ incidencia: await incidenciaPorSubtopico(), ordemAntiga });
  const entram = nova.filter((t) => !ordemAntiga.has(t.subtopico)).map((t) => t.subtopico);
  const saem = atual.temas.filter((t) => !nova.some((x) => x.subtopico === t.subtopico)).map((t) => t.subtopico);
  if (gravar) {
    const sobre = "Trilha ÚNICA (decisão do dono, 25/10/2026): a união dos temas de todos os concursos (BB, TJ-SP, BACEN, CVM), sem duplicar tema. Ordem por código ('bb -- trilha-ordenar'): matérias comuns primeiro, depois peso nos editais × incidência nas provas, respeitando os pré-requisitos (data/trilha-regras.json). O avanço é por tema, uma vez só, e não depende da ordem. Rodada 2 = mesmos temas, menor acerto primeiro; Rodada 3 = treino de prova.";
    const linhas = nova.map((t) => `    { "n": ${t.n}, "subtopico": ${JSON.stringify(t.subtopico)}, "nome": ${JSON.stringify(t.nome)}, "concursos": [${t.concursos.map((c) => `"${c}"`).join(", ")}] }`);
    await writeFile(arquivo, `{\n  "_sobre": ${JSON.stringify(sobre)},\n  "temas": [\n${linhas.join(",\n")}\n  ]\n}\n`, "utf8");
  }
  return { nova, entram, saem, antes: atual.temas.length };
}

export async function relatorioIncidencia(): Promise<{ linhas: LinhaIncidencia[]; semSubtopico: number; arquivo: string }> {
  const qs = await oficiais();
  const linhas = contarIncidencia(qs.filter((q) => q.subtopico).map((q) => item(q, q.subtopico!)));
  const semSubtopico = qs.filter((q) => !q.subtopico && q.status !== "anulada").length;
  const bancas = [...new Set(linhas.flatMap((l) => Object.keys(l.porBanca)))].sort();
  const nome = (id: string) => SUBTOPICO_POR_ID.get(id)?.nome ?? id;
  const md = [
    "# Incidência nas provas oficiais",
    "",
    `Gerado por \`npm run bb -- incidencia\` em ${new Date().toLocaleString("pt-BR")}. Só código, a partir das questões oficiais do banco (anuladas não contam).`,
    `Questões oficiais sem subtópico: ${semSubtopico} (ficam fora até a classificação).`,
    "",
    `| # | subtópico | total | provas | ${bancas.map((b) => BANCAS[b as IdBanca]?.nome ?? b).join(" | ")} | anos |`,
    `|---|---|---|---|${bancas.map(() => "---").join("|")}|---|`,
    ...linhas.map((l, i) =>
      `| ${i + 1} | ${nome(l.chave)} | ${l.total} | ${l.provas} | ${bancas.map((b) => l.porBanca[b] ?? 0).join(" | ")} | ${Object.entries(l.porAno).sort().map(([a, n]) => `${a}: ${n}`).join(", ")} |`),
    "",
  ].join("\n");
  const arquivo = join(RAIZ, "docs", "INCIDENCIA.md");
  await writeFile(arquivo, md, "utf8");
  return { linhas, semSubtopico, arquivo };
}
