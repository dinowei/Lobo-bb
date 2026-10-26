// Saúde do app (fechamento v1.0): o /api/saude diz se o banco responde, a versão (commit) e a hora do
// último noturno OK; o Admin mostra o selo "noturno atrasado" quando passou de 36 h. Funções puras.
export const LIMITE_NOTURNO_HORAS = 36;

export interface SaudeDTO {
  ok: boolean;
  banco: boolean;
  versao: string;
  ultimoNoturnoOk: string | null;
}

export function noturnoAtrasado(ultimoNoturnoOk: string | null, agora = new Date()): boolean {
  if (!ultimoNoturnoOk) return true;
  return agora.getTime() - new Date(ultimoNoturnoOk).getTime() > LIMITE_NOTURNO_HORAS * 3_600_000;
}
