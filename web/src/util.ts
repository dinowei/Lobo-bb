import type { Disciplina } from "../../shared/tipos";
import mascote from "./assets/lobo.png";

export const MASCOTE = mascote;

export const SIGLA: Record<Disciplina, string> = {
  lingua_portuguesa: "LP",
  lingua_inglesa: "EN",
  matematica: "MT",
  atualidades_mercado_financeiro: "AT",
  probabilidade_estatistica: "PE",
  conhecimentos_bancarios: "CB",
  matematica_financeira: "MF",
  informatica: "IN",
  vendas_negociacao: "VN",
  raciocinio_logico: "RL",
  direito_constitucional: "DC",
  direito_administrativo: "DA",
  gestao_publica: "GP",
  suporte_tecnico_administrativo: "ST",
  direito_penal: "DP",
  direito_processual_penal: "PP",
  direito_processual_civil: "PC",
  normas_corregedoria: "NC",
  atualidades: "AT",
  mercado_valores_mobiliarios: "MV",
  fundamentos_direito: "FD",
  fluencia_dados: "FL",
};

// Nome curto para os cartões (quebra em duas linhas, como no layout)
export const CURTO: Record<Disciplina, string> = {
  lingua_portuguesa: "Língua\nPortuguesa",
  lingua_inglesa: "Língua\nInglesa",
  matematica: "Matemática\nbásica",
  atualidades_mercado_financeiro: "Atualidades\ndo mercado",
  probabilidade_estatistica: "Probabilidade\ne Estatística",
  conhecimentos_bancarios: "Conhecimentos\nBancários",
  matematica_financeira: "Matemática\nFinanceira",
  informatica: "Informática",
  vendas_negociacao: "Vendas e\nNegociação",
  raciocinio_logico: "Raciocínio\nLógico",
  direito_constitucional: "Direito\nConstitucional",
  direito_administrativo: "Direito\nAdministrativo",
  gestao_publica: "Gestão\nPública",
  suporte_tecnico_administrativo: "Suporte\nTéc.-Adm.",
  direito_penal: "Direito\nPenal",
  direito_processual_penal: "Processo\nPenal",
  direito_processual_civil: "Processo\nCivil",
  normas_corregedoria: "Normas da\nCorregedoria",
  atualidades: "Atualidades",
  mercado_valores_mobiliarios: "Mercado de\nCapitais",
  fundamentos_direito: "Fundamentos\nde Direito",
  fluencia_dados: "Fluência\nem Dados",
};

export const COR_DISC: Record<Disciplina, string> = {
  lingua_portuguesa: "#f5c542",
  lingua_inglesa: "#8b7cf6",
  matematica: "#4fc98a",
  atualidades_mercado_financeiro: "#5ab4f0",
  probabilidade_estatistica: "#f08a5a",
  conhecimentos_bancarios: "#ff5b1f",
  matematica_financeira: "#e6e1d6",
  informatica: "#59d1c4",
  vendas_negociacao: "#f05a9a",
  // matérias do BACEN: cores já existentes na paleta (regra 8: nada de cor nova)
  raciocinio_logico: "#4fc98a",
  direito_constitucional: "#8b7cf6",
  direito_administrativo: "#5ab4f0",
  gestao_publica: "#f5c542",
  suporte_tecnico_administrativo: "#e6e1d6",
  // TJ-SP e CVM: mesma paleta, sem cor nova
  direito_penal: "#f05a9a",
  direito_processual_penal: "#f08a5a",
  direito_processual_civil: "#59d1c4",
  normas_corregedoria: "#e6e1d6",
  atualidades: "#5ab4f0",
  mercado_valores_mobiliarios: "#ff5b1f",
  fundamentos_direito: "#8b7cf6",
  fluencia_dados: "#4fc98a",
};

export const pct = (x: number) => `${Math.round(x * 100)}%`;

export function diasAte(data: string): number | null {
  if (!data) return null;
  const alvo = new Date(`${data}T12:00:00`);
  if (Number.isNaN(alvo.getTime())) return null;
  return Math.ceil((alvo.getTime() - Date.now()) / 86_400_000);
}

export const fmtDiaCurto = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" }).replace(".", "");
