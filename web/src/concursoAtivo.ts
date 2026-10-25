// Aba ativa do site: "geral" (visão do todo: trilha única e domínio global) ou um concurso (lente sobre o
// mesmo domínio: prontidão, matérias e formato da banca dele). Guardada neste navegador e mandada ao servidor
// em toda requisição (cabeçalho X-Concurso; "geral" = sem lente); o modo demo lê daqui também.
import { IDS_CONCURSO, type IdConcurso } from "../../shared/concursos";

export type IdConcursoAtivo = IdConcurso | "geral";
const CHAVE = "lobo-concurso";

export function concursoAtivo(): IdConcursoAtivo {
  try {
    const c = localStorage.getItem(CHAVE);
    return (IDS_CONCURSO as readonly string[]).includes(c ?? "") ? (c as IdConcurso) : "geral";
  } catch {
    return "geral";
  }
}

// a lente (null na aba Geral)
export const lenteAtiva = (): IdConcurso | null => {
  const c = concursoAtivo();
  return c === "geral" ? null : c;
};

export function guardarConcurso(c: IdConcursoAtivo) {
  try { localStorage.setItem(CHAVE, c); } catch { /* sem armazenamento: vale só nesta visita */ }
}
