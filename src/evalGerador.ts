// ============================================================
// BB Estudos — eval do gerador (F4): 1 questão (ou n) em cada um dos 8 tópicos de maior peso na prova.
// Peso do tópico = cota da disciplina ÷ tópicos da disciplina (a mesma conta da meta do noturno, data/estrutura-prova.json).
// Pelo pipeline de verdade (aprovada entra no banco), em série, uma IA por vez. Saída: aprovação por tópico
// e os 3 motivos de descarte mais comuns.
// ============================================================
import { readFile } from "node:fs/promises";
import { Source, Topic } from "./models.js";
import { gerarQuestao } from "./pipeline.js";
import { metaDoTopico } from "./noturno.js";

type Estrutura = { totalQuestoes: number; metaBanco: number; cotas: Record<string, number>; esperamLiberacao?: Record<string, string[]> };
type TopicoEval = { id: string; disciplina: string; assunto: string };

// Os n de maior peso; empate de peso alterna disciplinas (para não pegar 8 tópicos da mesma)
export function topicosDeMaiorPeso(topicos: TopicoEval[], e: Estrutura, bloqueados: Set<string>, n = 8): (TopicoEval & { peso: number })[] {
  const elegiveis = topicos.filter((t) => !bloqueados.has(t.assunto) && (e.cotas[t.disciplina] ?? 0) > 0);
  const porDisciplina = new Map<string, number>();
  for (const t of elegiveis) porDisciplina.set(t.disciplina, (porDisciplina.get(t.disciplina) ?? 0) + 1);
  const comPeso = elegiveis.map((t) => ({ ...t, peso: metaDoTopico(t.disciplina, porDisciplina.get(t.disciplina)!, e.cotas, e.totalQuestoes, e.metaBanco) }));
  const vezes = new Map<string, number>();
  const ordem = comPeso
    .sort((a, b) => b.peso - a.peso || a.disciplina.localeCompare(b.disciplina) || a.assunto.localeCompare(b.assunto))
    .map((t) => { const k = vezes.get(t.disciplina) ?? 0; vezes.set(t.disciplina, k + 1); return { t, rodada: k }; })
    .sort((a, b) => b.t.peso - a.t.peso || a.rodada - b.rodada || a.t.disciplina.localeCompare(b.t.disciplina));
  return ordem.slice(0, n).map((x) => x.t);
}

export function motivosMaisComuns(motivos: string[], k = 3) {
  const conta = new Map<string, number>();
  for (const m of motivos) conta.set(m, (conta.get(m) ?? 0) + 1);
  return [...conta].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, k).map(([motivo, n]) => ({ motivo, n }));
}

export async function executarEvalGerador(n = 1, assuntos: string[] = []) {
  const e = JSON.parse(await readFile(new URL("../data/estrutura-prova.json", import.meta.url), "utf8")) as Estrutura;
  // tópico que espera fonte liberada pelo dono só entra se a fonte já estiver no banco
  const bloqueados = new Set<string>();
  for (const [fonte, tops] of Object.entries(e.esperamLiberacao ?? {})) if (!(await Source.exists({ titulo: fonte, revogada: false }))) tops.forEach((t) => bloqueados.add(t));
  const todos = (await Topic.find({ ativo: true }).select("disciplina assunto").lean()).map((t) => ({ id: String(t._id), disciplina: t.disciplina as string, assunto: t.assunto }));
  const alvo = assuntos.length ? todos.filter((t) => assuntos.includes(t.assunto)).map((t) => ({ ...t, peso: 0 })) : topicosDeMaiorPeso(todos, e, bloqueados);
  const linhas: { assunto: string; disciplina: string; aprovadas: number; total: number; motivos: string[]; segundos: number }[] = [];
  for (const t of alvo) {
    const linha = { assunto: t.assunto, disciplina: t.disciplina, aprovadas: 0, total: 0, motivos: [] as string[], segundos: 0 };
    for (let i = 0; i < n; i++) {
      const t0 = Date.now();
      const r = await gerarQuestao(t.id, 3);
      linha.total++;
      linha.segundos += Math.round((Date.now() - t0) / 1000);
      if (r.ok) linha.aprovadas++;
      else linha.motivos.push(r.motivo);
      console.log(`${r.ok ? "✔" : "✖"} ${t.assunto}${r.ok ? "" : ` → ${r.motivo}${r.detalhes?.length ? ` (${r.detalhes.join(" | ").replace(/\s+/g, " ").slice(0, 160)})` : ""}`}`);
      if (!r.ok && r.motivo === "teto_diario") return { linhas, motivos: motivosMaisComuns(linhas.flatMap((l) => l.motivos)), parouNoTeto: true };
    }
    linhas.push(linha);
  }
  return { linhas, motivos: motivosMaisComuns(linhas.flatMap((l) => l.motivos)), parouNoTeto: false };
}
