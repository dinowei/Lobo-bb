// Incidência (F8), só código: quantas vezes cada subtópico (ou tópico) caiu nas provas oficiais, por banca e ano.
// Vira peso no noturno (peso no edital × incidência) e no plano. Questão anulada não conta.

export interface ItemOficial { chave: string; banca?: string | null; prova?: string | null; anulada?: boolean }
export interface LinhaIncidencia { chave: string; total: number; provas: number; porBanca: Record<string, number>; porAno: Record<string, number> }

// ano da prova pelo nome ("BB 2023 — Escriturário"); sem ano: "s/ano"
export const anoDaProva = (prova?: string | null) => prova?.match(/\b(19|20)\d{2}\b/)?.[0] ?? "s/ano";

export function contarIncidencia(itens: ItemOficial[], banca?: string): LinhaIncidencia[] {
  const linhas = new Map<string, LinhaIncidencia & { _provas: Set<string> }>();
  for (const i of itens) {
    if (i.anulada || !i.chave || (banca && i.banca !== banca)) continue;
    const l = linhas.get(i.chave) ?? { chave: i.chave, total: 0, provas: 0, porBanca: {}, porAno: {}, _provas: new Set<string>() };
    l.total++;
    const b = i.banca ?? "s/banca";
    l.porBanca[b] = (l.porBanca[b] ?? 0) + 1;
    const ano = anoDaProva(i.prova);
    l.porAno[ano] = (l.porAno[ano] ?? 0) + 1;
    l._provas.add(i.prova ?? "?");
    linhas.set(i.chave, l);
  }
  return [...linhas.values()]
    .map(({ _provas, ...l }) => ({ ...l, provas: _provas.size }))
    .sort((a, b) => b.total - a.total || b.provas - a.provas || a.chave.localeCompare(b.chave));
}

// 0..1 em relação ao que mais caiu; o que nunca caiu fica de fora (o noturno trata como 0)
export function pesoIncidencia(linhas: LinhaIncidencia[]): Map<string, number> {
  const max = Math.max(0, ...linhas.map((l) => l.total));
  return new Map(max ? linhas.map((l) => [l.chave, l.total / max]) : []);
}
