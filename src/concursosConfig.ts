// ============================================================
// BB Estudos — banca e área de cada concurso (F5). O padrão vem de data/concursos/*.json; o admin troca
// quando sai edital novo (Admin → Concursos), com registro de quem, quando, de que para que e por quê.
// Fica em memória (chaveConcurso() é síncrono) e no Config "concursos_config"; recarrega ao trocar.
// ============================================================
import { Config } from "./models.js";
import { BANCAS, CONCURSOS, type IdBanca, type IdConcurso } from "../shared/concursos.js";

export interface AjusteConcurso { banca?: string; area?: string }
export interface RegistroConcurso { em: string; quem: string; concurso: string; campo: "banca" | "area"; de: string; para: string; motivo: string }
interface ValorConfig { concursos: Partial<Record<IdConcurso, AjusteConcurso>>; historico: RegistroConcurso[] }

const ID = "concursos_config";
let cache: ValorConfig = { concursos: {}, historico: [] };

export async function carregarConfigConcursos() {
  const c = await Config.findById(ID).lean();
  cache = { concursos: {}, historico: [], ...((c?.valor ?? {}) as Partial<ValorConfig>) };
  return cache;
}

// banca escolhida pelo admin (ou null = a do JSON; "a_definir" cai na de referência em bancaEmUso)
export const bancaConfigurada = (concurso: IdConcurso): string | null => cache.concursos[concurso]?.banca ?? null;

export function infoConcursos() {
  return (Object.keys(CONCURSOS) as IdConcurso[]).map((id) => {
    const j = CONCURSOS[id] as { nome: string; cargo?: string; bancaPadrao: string; bancaReferencia?: string; areas?: { id: string; nome: string }[] | string[] };
    const banca = cache.concursos[id]?.banca ?? j.bancaPadrao;
    const aDefinir = banca === "a_definir";
    const emUso = aDefinir ? j.bancaReferencia ?? "cebraspe" : banca;
    const areas = (j.areas ?? []).map((a) => (typeof a === "string" ? { id: a, nome: a.replace(/_/g, " ") } : a));
    return {
      id, nome: j.nome, cargo: j.cargo ?? null, banca, aDefinir,
      bancaEmUso: emUso, nomeBanca: (BANCAS as Record<string, { nome: string }>)[emUso]?.nome ?? emUso,
      areas, area: cache.concursos[id]?.area ?? areas[0]?.id ?? null,
    };
  });
}

export function historicoConcursos() { return [...cache.historico].reverse(); }

// troca de banca ou área (admin), com registro; banca precisa ser conhecida ou "a_definir"
export async function ajustarConcurso(concurso: IdConcurso, campo: "banca" | "area", para: string, motivo: string, quem: string) {
  if (!(concurso in CONCURSOS)) throw new Error("Concurso desconhecido.");
  if (campo === "banca" && para !== "a_definir" && !(para in BANCAS)) throw new Error("Banca desconhecida.");
  if (campo === "area" && !infoConcursos().find((c) => c.id === concurso)?.areas.some((a) => a.id === para)) throw new Error("Área desconhecida.");
  if (motivo.trim().length < 5) throw new Error("Diga o motivo (ex.: edital novo publicado).");
  await carregarConfigConcursos();
  const atual = infoConcursos().find((c) => c.id === concurso)!;
  const de = campo === "banca" ? atual.banca : atual.area ?? "";
  if (de === para) return { mudou: false };
  const registro: RegistroConcurso = { em: new Date().toISOString(), quem, concurso, campo, de, para, motivo: motivo.trim().slice(0, 300) };
  const concursos = { ...cache.concursos, [concurso]: { ...cache.concursos[concurso], [campo]: para } };
  await Config.updateOne({ _id: ID }, { $set: { "valor.concursos": concursos, em: new Date() }, $push: { "valor.historico": registro } }, { upsert: true });
  await carregarConfigConcursos();
  return { mudou: true, registro };
}

export const bancaDoConcurso = (concurso: IdConcurso): IdBanca | null => {
  const b = bancaConfigurada(concurso);
  return b && b in BANCAS ? (b as IdBanca) : null;
};
