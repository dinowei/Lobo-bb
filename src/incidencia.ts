// ============================================================
// BB Estudos — Incidência das provas oficiais (F8), só código: lê as questões oficiais do banco,
// conta por subtópico/tópico, banca e ano (shared/incidencia.ts) e vira peso no noturno.
// `bb -- incidencia` grava docs/INCIDENCIA.md e mostra o top 10.
// ============================================================
import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Types } from "mongoose";
import { Question } from "./models.js";
import { contarIncidencia, pesoIncidencia, type ItemOficial, type LinhaIncidencia } from "../shared/incidencia.js";
import { SUBTOPICO_POR_ID } from "../shared/subtopicos.js";
import { bancaEmUso, BANCAS, type IdBanca, type IdConcurso } from "../shared/concursos.js";
import { bancaConfigurada, carregarConfigConcursos } from "./concursosConfig.js";

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
