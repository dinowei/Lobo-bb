// ============================================================
// BB Estudos — Catálogo de cenários (anti-repetição: perfil + situação, o menos usado no tópico)
// Quem aparece na questão (perfil) e por quê (situação), por grupo de disciplinas.
// O código sorteia o MENOS usado no tópico, nunca um dos 15 últimos; o gerador recebe
// os 15 últimos como proibidos. Sem números e sem produto (o produto vem do contexto).
// ============================================================
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const ListaZ = z.array(z.string().min(3).refine((s) => !/\d/.test(s), "cenário não pode ter número")).min(1);
const CatalogoZ = z.object({
  grupos: z.record(
    z.string(),
    z.object({
      disciplinas: z.array(z.string()).min(1),
      perfis: z.object({ pf: ListaZ.optional(), pj: ListaZ.optional(), func: ListaZ.optional() }),
      situacoes: ListaZ,
    })
  ),
});
export type CatalogoCenarios = z.infer<typeof CatalogoZ>;
export interface Cenario { perfil: string; situacao: string }

let cache: CatalogoCenarios | null = null;
export function carregarCenarios(): CatalogoCenarios {
  if (cache) return cache;
  const bruto = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "data", "cenarios.json"), "utf8"));
  const r = CatalogoZ.safeParse(bruto);
  if (!r.success) throw new Error(`data/cenarios.json inválido: ${z.prettifyError(r.error)}`);
  return (cache = r.data);
}

// pessoa física ou jurídica pelo texto do contexto (variacoes.json); sem pista, vale qualquer uma
export function pessoaDoContexto(contexto: string): "pf" | "pj" | "ambas" {
  if (/\b(PJ|MEI)\b|jurídica|empresa|lojista|duplicata|receb[ií]veis|comerciante|fornecedor/i.test(contexto)) return "pj";
  if (/\bPF\b|pessoa física|pessoal|poupança|imobiliário|veículo|salário|aposentad/i.test(contexto)) return "pf";
  return "ambas";
}

export const N_PROIBIDOS = 15;

// Sorteia o par (perfil, situação) menos usado no tópico, fora dos 15 últimos pares e sem repetir
// perfil nem situação das últimas questões. historico: do mais recente para o mais antigo.
export function sortearCenario(
  cat: CatalogoCenarios,
  disciplina: string,
  contexto: string,
  historico: Cenario[],
  evitar: Cenario[] = []
): Cenario | null {
  const grupo = Object.values(cat.grupos).find((g) => g.disciplinas.includes(disciplina));
  if (!grupo) return null;
  const pessoa = pessoaDoContexto(contexto);
  const perfis =
    grupo.perfis.func ?? (pessoa === "ambas" ? [...(grupo.perfis.pf ?? []), ...(grupo.perfis.pj ?? [])] : grupo.perfis[pessoa] ?? []);
  if (!perfis.length) return null;

  const recentes = [...evitar, ...historico.slice(0, N_PROIBIDOS)];
  const usoPerfil = new Map<string, number>();
  const usoSituacao = new Map<string, number>();
  for (const h of historico) {
    usoPerfil.set(h.perfil, (usoPerfil.get(h.perfil) ?? 0) + 1);
    usoSituacao.set(h.situacao, (usoSituacao.get(h.situacao) ?? 0) + 1);
  }
  // perfil e situação das últimas questões ficam de fora (o quanto a lista permitir)
  const ultimos = (campo: keyof Cenario, total: number) => new Set(recentes.slice(0, Math.min(5, total - 1)).map((h) => h[campo]));
  const fora = { perfil: ultimos("perfil", perfis.length), situacao: ultimos("situacao", grupo.situacoes.length) };
  const parUsado = (p: string, s: string) => recentes.some((h) => h.perfil === p && h.situacao === s);

  let melhores: Cenario[] = [];
  let menor = Infinity;
  for (const perfil of perfis)
    for (const situacao of grupo.situacoes) {
      if (fora.perfil.has(perfil) || fora.situacao.has(situacao) || parUsado(perfil, situacao)) continue;
      const custo = (usoPerfil.get(perfil) ?? 0) + (usoSituacao.get(situacao) ?? 0);
      if (custo < menor) [menor, melhores] = [custo, []];
      if (custo === menor) melhores.push({ perfil, situacao });
    }
  return melhores.length ? melhores[Math.floor(Math.random() * melhores.length)] : null;
}

export const descreverCenario = (c: Cenario) => `${c.perfil}, ${c.situacao}`;
