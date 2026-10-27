// Sessão do tema (v1.1, estudo sequencial): revisões do tema → novas do tema por subtema (fácil → difícil)
// → revisão dos erros do tema. Todo pedido leva o tema; a mistura de matérias fica só em Simulado e Revisões.
export const ETAPAS_SESSAO_TEMA = ["revisoes", "tema", "erros"] as const;
export type EtapaSessaoTema = (typeof ETAPAS_SESSAO_TEMA)[number];

export function pedidoDaEtapa(etapa: EtapaSessaoTema, s: { subtopico: string; banca?: string }, excluir: string[]) {
  if (etapa === "revisoes") return { revisao: true, subtopico: s.subtopico, excluir };
  if (etapa === "erros") return { erros: true, subtopico: s.subtopico, excluir };
  return { subtopico: s.subtopico, excluir, ...(s.banca ? { banca: s.banca } : {}) };
}
