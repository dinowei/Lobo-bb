// Sessão de estudo de UM tema (v1.1, estudo sequencial): só questões daquele tema e dos seus subtemas.
// Primeiro as revisões vencidas DO TEMA, depois as novas do tema. A mistura de matérias (estruturaProva)
// só existe em Simulado e Revisões, nunca dentro de um tema.
export const ETAPAS_SESSAO_TEMA = ["revisoes", "tema"] as const;
export type EtapaSessaoTema = (typeof ETAPAS_SESSAO_TEMA)[number];

export function pedidoDaEtapa(etapa: EtapaSessaoTema, s: { subtopico: string; banca?: string }, excluir: string[]) {
  return etapa === "revisoes"
    ? { revisao: true, subtopico: s.subtopico, excluir }
    : { subtopico: s.subtopico, excluir, ...(s.banca ? { banca: s.banca } : {}) };
}
