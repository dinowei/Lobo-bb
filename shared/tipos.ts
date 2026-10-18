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

// Por que errou (1 toque, opcional, depois do erro) — PLANO-MESTRE 5.3
export const MOTIVOS_ERRO = ["nao_sabia", "confundi", "desatencao", "chutei"] as const;
export type MotivoErro = (typeof MOTIVOS_ERRO)[number];
export const NOME_MOTIVO: Record<MotivoErro, string> = {
  nao_sabia: "Não sabia",
  confundi: "Confundi com outra coisa",
  desatencao: "Li errado / desatenção",
  chutei: "Chutei",
};

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
// Amostra de figura gerada por código (tela Figuras → Geradas): sem IA, nada é salvo
export interface AmostraFiguraDTO {
  assunto: string;
  tipo: string;
  pergunta: string;
  dados: string[];
  resolucao: string;
  figura: FiguraDTO;
  alternativas: { letra: Letra; texto: string; correta: boolean; erro: string | null }[];
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
  /** errou por desatenção: volta na revisão com tempo-alvo */
  tempoAlvoSeg?: number;
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
  confianca?: Confianca; // simulado não pergunta
  motivoErro?: MotivoErro;
  resposta?: Letra | null; // modo demo: a letra marcada (o servidor guarda na tentativa)
}

// Motivos de erro por disciplina (gráfico do painel)
export interface MotivosDisciplinaDTO {
  disciplina: Disciplina;
  erros: number; // todos os erros fora de simulado
  motivos: Record<MotivoErro, number>;
}

// Calibragem da confiança (PLANO-MESTRE 5.4): quanto você acerta em cada nível de confiança
export interface FaixaConfianca { n: number; acertos: number }
export interface CalibragemDTO {
  disciplina: Disciplina | null; // null = geral
  certeza: FaixaConfianca;
  duvida: FaixaConfianca;
  chute: FaixaConfianca;
  ilusao: boolean; // certeza acerta menos de 85% (com amostra mínima)
}

// O que o app faz com o motivo informado
export interface AcaoMotivoDTO {
  motivo: MotivoErro;
  mensagem: string;
  topicoId?: string; // não sabia: treinar o tópico
  proximaQuestaoId?: string; // confundi: questão que compara os conceitos
  palavrasChave?: string[]; // desatenção: o que decidia a questão
  revisaoEmMin?: number; // chutei: revisão antecipada
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
  motivosErro: MotivosDisciplinaDTO[];
  calibragem: CalibragemDTO[]; // primeiro o geral, depois por disciplina
  redacaoCorrigidaPendente?: boolean;
  banco?: BancoDTO; // cartão "Banco de questões"
  alertasAdmin?: string[]; // só o admin vê (modelos, regras); o aluno nunca vê menção a IA
}

// Cartão "Banco de questões" do painel: aprovadas (oficiais contam), inéditas para o aluno e
// as que entraram desde o começo da última noite (18 h)
export interface BancoDTO {
  total: number;
  ineditas: number;
  estaNoite: number;
  repetidasNoite?: number; // descartadas por serem parecidas demais com outra (só no servidor)
  porDisciplina: { disciplina: Disciplina; total: number; ineditas: number }[];
}

// ---------- Admin (só o dono): abas IA, Fila, Benchmark e Pendências ----------
export type CorStatus = "verde" | "amarelo" | "vermelho" | "cinza";
export interface JanelaModeloDTO {
  chamadas: number;
  taxa: number;
  medianaMs: number;
  p95Ms: number;
  comoReserva: number;
  falhas: Record<string, number>;
}
export interface ModeloIADTO {
  id: string;
  familia: string;
  funcoes: string[];
  preview: boolean;
  cor: CorStatus;
  motivoCor: string;
  statusCatalogo: string;
  nota?: string;
  descontinuaEm?: string;
  h24: JanelaModeloDTO | null;
  d7: JanelaModeloDTO | null;
  ultimaResposta?: string;
  ultimaFalha?: string;
}
export interface AdminIADTO {
  modo: "aprovada" | "env" | "legado";
  aprovadaEm?: string;
  correntes: Record<string, string[]>;
  nomesFuncoes: Record<string, string>;
  alertas: string[];
  modelos: ModeloIADTO[];
  hoje: Record<string, { modelo: string; n: number }[]>;
  verificadoEm?: string;
}
export type StatusTarefa = "pendente" | "rodando" | "aguardando" | "concluida" | "descartada" | "esgotada";
export interface TarefaDTO {
  id: string;
  tipo: string;
  assunto?: string;
  status: StatusTarefa;
  tentativas: number;
  proximaEm?: string;
  motivo?: string;
  detalhes?: string;
  resultadoId?: string;
  lote?: string;
  atualizadaEm: string;
}
export interface RelatorioNoiteDTO {
  desde: string;
  tentativas: number;
  aprovadas: number;
  descartes: { grupo: "qualidade" | "similaridade" | "infraestrutura"; motivo: string; n: number }[];
  porHora: { hora: string; aprovadas: number }[];
  modeloQueMaisAtendeu?: string;
}
export interface AdminFilaDTO {
  contagem: Record<StatusTarefa, number>;
  tarefas: TarefaDTO[];
  progresso: { aprovadas: number; oficiais: number; geradas: number; meta: number };
  noite: RelatorioNoiteDTO;
}
export interface BenchmarkLinhaDTO {
  modelo: string;
  familia: string;
  preview: boolean;
  tentativas: number;
  respondidas: number;
  acertos: number;
  acerto: number;
  ic: [number, number];
  disponibilidade: number;
  medianaS: number;
  falhas: Record<string, number>;
  porDisciplina: Record<string, { n: number; acertos: number }>;
}
export interface PropostaCorrenteDTO {
  opcao: string;
  titulo: string;
  resumo: string;
  correntes: Record<string, string[]>;
  evidencias: string[];
  riscos: string[];
  reversao: string;
  erros: string[];
  avisos: string[];
}
export interface AdminBenchmarkDTO {
  rodadas: { chave: string; titulo: string; rotuloAcerto: string; linhas: BenchmarkLinhaDTO[]; empatados: string[] }[];
  disciplinas: string[];
  propostas: PropostaCorrenteDTO[];
  ativa: { modo: "aprovada" | "env" | "legado"; aprovadaEm?: string; correntes: Record<string, string[]> };
  nomesFuncoes: Record<string, string>;
}
export interface PendenciaDTO {
  titulo: string;
  prioridade: "alta" | "media" | "baixa" | null;
  markdown: string;
  links: { rotulo: string; destino: string }[]; // "#figuras", "#admin?aba=benchmark", "doc:CALIBRAGEM-SIMILARIDADE.md"
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

export interface TemaRedacaoDTO {
  id: string;
  tema: string;
  proposta: string;
  textosMotivadores: string[];
}
export interface CriterioRedacaoDTO {
  nome: string;
  nota: number;
  max: 25;
  comentario: string;
  trechos: string[];
}
export interface CorrecaoRedacaoDTO {
  criterios: CriterioRedacaoDTO[];
  notaTotal: number;
  pontosFortes: string[];
  melhorias: string[];
  paragrafoReescrito: string;
  estimada: true;
  /** regra de linhas aplicada por código antes da correção (abaixo do mínimo = zero; acima = cortada) */
  penalidade?: string;
}
export type StatusRedacaoDTO = "aguardando" | "corrigindo" | "corrigida" | "erro";
export interface RedacaoDTO {
  id: string;
  temaId: string;
  tema: string;
  proposta: string;
  texto: string;
  linhas: number;
  tempoSeg: number;
  status: StatusRedacaoDTO;
  correcao?: CorrecaoRedacaoDTO;
  erro?: string;
  criadoEm: string;
}

export interface AulaFonteDTO {
  titulo: string;
  trecho: string;
}
export interface AulaDTO {
  topicoId: string;
  assunto: string;
  conteudo: string; // Markdown sem HTML cru
  pontosChave: string[];
  comoABancaCobra: string;
  pegadinhasComuns: string[];
  exemplos: string[];
  fontes: AulaFonteDTO[];
}
export interface ExplicacaoMaisDTO {
  explicacao?: string;
  origem?: "pregerada" | "cache" | "nova";
  restantesHoje?: number;
  requerServidor?: boolean;
  mensagem?: string;
}

export type MotivoContestacao = "gabarito_errado" | "duas_corretas" | "desatualizada" | "ambigua" | "explicacao_ruim";

// A mesma interface serve para o modo demo (navegador) e para o servidor de verdade
export interface Api {
  modo: "demo" | "servidor";
  topicos(): Promise<TopicoDTO[]>;
  painel(): Promise<PainelDTO>;
  // misto: intercala disciplinas no peso da prova; anterior = disciplina da última questão
  proxima(f: { topicoId?: string; disciplina?: Disciplina; questaoId?: string; revisao?: boolean; misto?: boolean; anterior?: Disciplina }): Promise<{
    questao: QuestaoDTO | null;
    modo: "treino" | "revisao";
    aviso?: string;
  }>;
  responder(r: { questaoId: string; resposta: Letra; confianca: Confianca; tempoSeg: number; modo: Modo }): Promise<CorrecaoDTO>;
  aula(topicoId: string): Promise<AulaDTO | null>;
  explicarMais(questaoId: string, duvida?: string): Promise<ExplicacaoMaisDTO>;
  // motivo do último erro nessa questão; devolve a ação (aula/tópico, comparação, palavra-chave, revisão antecipada)
  motivoErro(questaoId: string, motivo: MotivoErro): Promise<AcaoMotivoDTO>;
  simulado(n: number): Promise<QuestaoDTO[]>;
  corrigirSimulado(r: { questaoId: string; resposta: Letra | null; tempoSeg: number }[]): Promise<ResultadoSimuladoDTO>;
  // mistura de dificuldade do simulado: a das oficiais (≥ 30 com dificuldade) ou a estimativa 20/50/30
  misturaSimulado(): Promise<{ facil: number; media: number; dificil: number; estimativa: boolean; base: number }>;
  erros(): Promise<ErroDTO[]>;
  contestar(questaoId: string, motivo: MotivoContestacao, comentario?: string): Promise<void>;
  temasRedacao(): Promise<TemaRedacaoDTO[]>;
  pedirTemaRedacao(): Promise<{ status: "gerando" | "demo" }>;
  corrigirRedacao(r: { temaId: string; texto: string; linhas: number; tempoSeg: number }): Promise<RedacaoDTO>;
  redacoes(): Promise<RedacaoDTO[]>;
  marcarRedacoesVistas(): Promise<void>;
}
