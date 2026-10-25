// Concurso ativo do site (F5): aba BB / BACEN. Guardado neste navegador e mandado ao servidor em toda
// requisição (cabeçalho X-Concurso); o modo demo lê daqui também. Sem escolha, o BB de sempre.
export type IdConcursoAtivo = "bb" | "bacen";
const CHAVE = "lobo-concurso";

export function concursoAtivo(): IdConcursoAtivo {
  try {
    return localStorage.getItem(CHAVE) === "bacen" ? "bacen" : "bb";
  } catch {
    return "bb";
  }
}

export function guardarConcurso(c: IdConcursoAtivo) {
  try { localStorage.setItem(CHAVE, c); } catch { /* sem armazenamento: vale só nesta visita */ }
}
