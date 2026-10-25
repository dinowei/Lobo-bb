// Concurso ativo do site (F5): uma aba por concurso. Guardado neste navegador e mandado ao servidor em toda
// requisição (cabeçalho X-Concurso); o modo demo lê daqui também. Sem escolha, o BB de sempre.
import { IDS_CONCURSO, type IdConcurso } from "../../shared/concursos";

export type IdConcursoAtivo = IdConcurso;
const CHAVE = "lobo-concurso";

export function concursoAtivo(): IdConcursoAtivo {
  try {
    const c = localStorage.getItem(CHAVE);
    return (IDS_CONCURSO as readonly string[]).includes(c ?? "") ? (c as IdConcursoAtivo) : "bb";
  } catch {
    return "bb";
  }
}

export function guardarConcurso(c: IdConcursoAtivo) {
  try { localStorage.setItem(CHAVE, c); } catch { /* sem armazenamento: vale só nesta visita */ }
}
