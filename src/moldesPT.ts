// ============================================================
// Gerador por MOLDES (decisão do dono, 26/10/2026): o código monta a frase e o gabarito a partir de
// data/moldes-crase.json. Lacuna crítica (gênero, verbo, hora) só o código preenche; a IA só pode
// AMPLIAR o vocabulário das lacunas neutras (sujeito, complemento), nunca mexer na estrutura.
// ============================================================
import { REGRAS_CRASE, type RegraCrase } from "./portugues.js";
import dados from "../data/moldes-crase.json" with { type: "json" };

export type Molde = { id: string; regra: string; texto: string };
export type Vocabulario = { criticas: Record<string, string[]>; neutras: Record<string, string[]> };
export type FraseMolde = { frase: string; trecho: string; molde: string; regra: RegraCrase };

export const MOLDES: Molde[] = dados.moldes;
export const VOCAB_BASE: Vocabulario = dados.vocabulario;
const LACUNA = /\{(\w+)\}/g;

// cada molde: regra que existe, um único [trecho], lacunas com vocabulário
export function validarMoldes(moldes: Molde[] = MOLDES, v: Vocabulario = VOCAB_BASE): string[] {
  const problemas: string[] = [];
  for (const m of moldes) {
    if (!REGRAS_CRASE.some((r) => r.id === m.regra)) problemas.push(`${m.id}: regra "${m.regra}" não existe`);
    if ((m.texto.match(/\[/g) ?? []).length !== 1 || (m.texto.match(/\]/g) ?? []).length !== 1) problemas.push(`${m.id}: precisa de exatamente um [trecho]`);
    for (const [, lac] of m.texto.matchAll(LACUNA)) if (!v.criticas[lac]?.length && !v.neutras[lac]?.length) problemas.push(`${m.id}: lacuna {${lac}} sem vocabulário`);
  }
  if (new Set(moldes.map((m) => m.id)).size !== moldes.length) problemas.push("id de molde repetido");
  return problemas;
}

const sortear = <T>(xs: readonly T[], rnd = Math.random): T => xs[Math.floor(rnd() * xs.length)];

// preenche o molde; devolve a frase e o trecho (o que estava entre colchetes)
export function preencher(m: Molde, v: Vocabulario = VOCAB_BASE, rnd = Math.random): FraseMolde {
  const valores = new Map<string, string>();
  const texto = m.texto.replace(LACUNA, (_, lac: string) => {
    if (!valores.has(lac)) valores.set(lac, sortear(v.criticas[lac] ?? v.neutras[lac], rnd));
    return valores.get(lac)!;
  });
  const trecho = texto.slice(texto.indexOf("[") + 1, texto.indexOf("]"));
  const frase = texto.replace(/[[\]]/g, "").replace(/\s+([.,;:!?])/g, "$1").replace(/\s{2,}/g, " ").trim();
  return { frase: frase[0].toUpperCase() + frase.slice(1), trecho, molde: m.id, regra: REGRAS_CRASE.find((r) => r.id === m.regra)! };
}

export const moldesDaRegra = (regra: string, moldes: Molde[] = MOLDES) => moldes.filter((m) => m.regra === regra);
export const regrasComMolde = (moldes: Molde[] = MOLDES) => new Set(moldes.map((m) => m.regra));

// vocabulário que a IA sugere para uma lacuna NEUTRA: só palavras, sem nada que mexa na crase
// (nenhum "a/à/as/às/ao/aquele" solto, sem números nem pontuação), tamanho curto
const PROIBIDO_NEUTRO = /(^|\s)(a|à|as|às|ao|aos|àquel\w*|aquel\w*|até)(\s|$)/iu;
export function valorNeutroValido(lacuna: string, valor: string): boolean {
  const t = valor.trim();
  if (t.length < 2 || t.length > 40) return false;
  if (!/^[\p{L} -]+$/u.test(t)) return false;
  if (PROIBIDO_NEUTRO.test(t)) return false;
  // sujeito: artigo + 1 a 4 palavras minúsculas (só letras do português), ex.: "O gerente de risco"
  if (lacuna === "sujeito" && !/^(O|A)( [a-zà-úç-]+){1,4}$/u.test(t)) return false;
  if (/\b(k|w|y)\p{L}*|\p{L}*(sh|th|ck)\p{L}*/iu.test(t)) return false; // palavra estrangeira (stakeholders, check…)
  return true;
}

// só o sujeito vem da IA: complemento solto ("segundo instruções", "com os stakeholders") passava no
// LanguageTool e soava mal (lote de prova de 26/10); complemento e grupo ficam com a lista do código
export const LACUNAS_IA = new Set(["sujeito"]);
export function ampliarVocabulario(v: Vocabulario, extra: Record<string, string[]>): Vocabulario {
  const neutras = { ...v.neutras };
  for (const [lac, valores] of Object.entries(extra)) {
    if (!neutras[lac] || !LACUNAS_IA.has(lac)) continue; // lacuna crítica, inexistente ou fora da lista: a IA não mexe
    neutras[lac] = [...new Set([...neutras[lac], ...valores.map((x) => x.trim()).filter((x) => valorNeutroValido(lac, x))])];
  }
  return { criticas: v.criticas, neutras };
}
