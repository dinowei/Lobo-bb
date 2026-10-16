// ============================================================
// Contratos entre front-end e API (usados pelos dois lados)
// ============================================================

export const DISCIPLINAS = [
  "lingua_portuguesa",
  "lingua_inglesa",
  "matematica",
  "atualidades_mercado_financeiro",
  "probabilidade_estatistica",
  "conhecimentos_bancarios",
  "matematica_financeira",
  "informatica",
  "vendas_negociacao",
] as const;
export type Disciplina = (typeof DISCIPLINAS)[number];

export const NOME_DISCIPLINA: Record<Disciplina, string> = {
  lingua_portuguesa: "Língua Portuguesa",
  lingua_inglesa: "Língua Inglesa",
  matematica: "Matemática",
  atualidades_mercado_financeiro: "Atualidades do Mercado Financeiro",
  probabilidade_estatistica: "Probabilidade e Estatística",
  conhecimentos_bancarios: "Conhecimentos Bancários",
  matematica_financeira: "Matemática Financeira",
  informatica: "Informática",
  vendas_negociacao: "Vendas e Negociação",
};

export const LETRAS = ["A", "B", "C", "D", "E"] as const;
export type Letra = (typeof LETRAS)[number];
export type Confianca = 1 | 2 | 3; // 1 = chutei · 2 = dúvida · 3 = certeza
export type Modo = "treino" | "revisao" | "simulado";

export interface TopicoDTO {
  id: string;
  disciplina: Disciplina;
  assunto: string;
  subtopicos: string[];
  peso: number | null; // questões na prova (edital)
}

// ---------- Figuras: DADO desenhado por código no site (nunca imagem gerada por IA) ----------
export type TipoFigura = "tabela" | "planilha" | "grafico" | "imagem" | "tela_programa";
export type PosicaoFigura = "enunciado" | "textoBase" | "alternativas";

export interface TabelaDados {
  cabecalho?: string[];
  linhas: string[][];
}
export interface PlanilhaDados {
  colunas: number; // nº de colunas (A, B, C…)
  linhas: number; // nº de linhas (1, 2, 3…)
  celulas: Record<string, string>; // "B2" → "5" ou "=SOMA(B2:B5)" (fórmula avaliada por código)
  selecionada?: string; // célula em destaque (ex.: "C10")
  formatos?: Record<string, "moeda" | "porcentagem" | "numero" | "texto">;
}
export interface GraficoDados {
  forma: "barras" | "linhas" | "pizza";
  titulo?: string;
  rotulos: string[];
  series: { nome: string; valores: number[] }[];
  unidade?: string; // "R$", "%", …
}
export interface TelaProgramaDados {
  janela: string; // título da janela
  menu?: string[];
  caixa?: { titulo: string; campos: { rotulo: string; valor?: string; marcado?: boolean }[]; botoes: string[] };
}

export interface FiguraDTO {
  tipo: TipoFigura;
  posicao: PosicaoFigura;
  legenda?: string;
  tabela?: TabelaDados;
  planilha?: PlanilhaDados;
  grafico?: GraficoDados;
  tela?: TelaProgramaDados;
  imagem?: string; // data URL (só figura oficial extraída do PDF)
}

// Conferência do dono (tela Figuras)
export interface RegiaoPdf { pagina: number; x: number; y: number; w: number; h: number }
export interface FiguraConferenciaDTO {
  id: string;
  tipo: TipoFigura;
  posicao: PosicaoFigura;
  legenda?: string;
  dados?: unknown;
  imagem?: string;
  recortePng?: string;
  recorte?: RegiaoPdf;
  origem: string;
  status: "aguardando_conferencia" | "ok" | "fora";
}
export interface QuestaoComFigurasDTO {
  questaoId: string;
  prova?: string;
  numero?: number;
  status: string;
  enunciado: string;
  figuras: FiguraConferenciaDTO[];
}

export interface QuestaoDTO {
  id: string;
  topicoId: string;
  disciplina: Disciplina;
  assunto: string;
  origem: "oficial" | "gerada";
  prova?: string;
  numeroOriginal?: number;
  textoBase?: string;
  enunciado: string;
  alternativas: { letra: Letra; texto: string }[];
  dificuldade: number;
  /** oficial que cita norma revogada: o que mudou e a norma vigente (questão fora do treino) */
  notaNorma?: string;
  /** figuras conferidas (status ok) */
  figuras?: FiguraDTO[];
}

export interface AlternativaCorrigida {
  letra: Letra;
  texto: string;
  correta: boolean;
  explicacao: string;
  pegadinha?: string;
}

export interface CorrecaoDTO {
  acertou: boolean;
  gabarito: Letra;
  alternativas: AlternativaCorrigida[];
  explicacaoGeral: string;
  dicaDeProva?: string;
  fontes: { titulo: string; trecho?: string }[];
  traicoeira: boolean; // a IA errou essa às cegas
  xpGanho: number;
  proximaRevisaoDias: number;
}

export interface TentativaBruta {
  questaoId: string;
  topicoId: string;
  acertou: boolean;
  xp: number;
  modo: Modo;
  simuladoId?: string;
  data: string; // ISO
}

export type StatusTopico = "novo" | "andamento" | "dominado";

export interface TopicoProgresso extends TopicoDTO {
  tentativas: number;
  acertos: number;
  dominio: number; // 0–1, suavizado
  status: StatusTopico;
}

export interface DisciplinaProgresso {
  disciplina: Disciplina;
  nome: string;
  topicos: number;
  dominados: number;
  tentativas: number;
  acertos: number;
  progresso: number; // 0–1: fatia de tópicos dominados
}

export interface Conquista {
  id: string;
  titulo: string;
  descricao: string;
  obtida: boolean;
  progresso: number; // 0–1
}

export interface Nivel {
  numero: number;
  titulo: string;
  xpNoNivel: number;
  xpParaProximo: number;
}

export interface PainelDTO {
  xp: number;
  nivel: Nivel;
  sequenciaDias: number;
  respondeuHoje: number;
  semana: { respondidas: number; acertos: number };
  revisoesHoje: number;
  revisoesPorDia: { dia: string; total: number }[]; // próximos 7 dias
  disciplinas: DisciplinaProgresso[];
  topicos: TopicoProgresso[];
  conquistas: Conquista[];
  simulados: { id: string; data: string; total: number; acertos: number }[];
  totalRespondidas: number;
}

export interface ErroDTO {
  questaoId: string;
  disciplina: Disciplina;
  assunto: string;
  enunciado: string;
  vezesErrada: number;
  ultimaData: string;
}

export interface ResultadoSimuladoDTO {
  simuladoId: string;
  total: number;
  acertos: number;
  xpGanho: number;
  porDisciplina: { disciplina: Disciplina; total: number; acertos: number }[];
  correcoes: (CorrecaoDTO & { questaoId: string; enunciado: string; resposta: Letra | null })[];
}

export type MotivoContestacao = "gabarito_errado" | "duas_corretas" | "desatualizada" | "ambigua" | "explicacao_ruim";

// A mesma interface serve para o modo demo (navegador) e para o servidor de verdade
export interface Api {
  modo: "demo" | "servidor";
  topicos(): Promise<TopicoDTO[]>;
  painel(): Promise<PainelDTO>;
  proxima(f: { topicoId?: string; disciplina?: Disciplina; questaoId?: string; revisao?: boolean }): Promise<{
    questao: QuestaoDTO | null;
    modo: "treino" | "revisao";
    aviso?: string;
  }>;
  responder(r: { questaoId: string; resposta: Letra; confianca: Confianca; tempoSeg: number; modo: Modo }): Promise<CorrecaoDTO>;
  simulado(n: number): Promise<QuestaoDTO[]>;
  corrigirSimulado(r: { questaoId: string; resposta: Letra | null; tempoSeg: number }[]): Promise<ResultadoSimuladoDTO>;
  erros(): Promise<ErroDTO[]>;
  contestar(questaoId: string, motivo: MotivoContestacao, comentario?: string): Promise<void>;
}
