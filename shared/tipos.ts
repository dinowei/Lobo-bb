// ============================================================
// Contratos entre front-end e API (usados pelos dois lados)
// ============================================================
import type { DesempenhoTemaDTO } from "./desempenhoTema.js";
import type { ResumoSimulado } from "./simulados.js";
import type { IdConcurso } from "./concursos.js";
import type { ProntidaoDTO } from "./prontidao.js";
import type { EspacoLoDTO, PosicaoAudio } from "./espacoLo.js";
export type { DesempenhoTemaDTO, ProntidaoDTO, ResumoSimulado };

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
  // BACEN Técnico (data/concursos/bacen.json); as comuns acima servem aos dois concursos
  "raciocinio_logico",
  "direito_constitucional",
  "direito_administrativo",
  "gestao_publica",
  "suporte_tecnico_administrativo",
  // TJ-SP Escrevente (data/concursos/tjsp.json)
  "direito_penal",
  "direito_processual_penal",
  "direito_processual_civil",
  "normas_corregedoria",
  "atualidades",
  // CVM Agente Executivo (data/concursos/cvm.json)
  "mercado_valores_mobiliarios",
  "fundamentos_direito",
  "fluencia_dados",
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
  raciocinio_logico: "Raciocínio Lógico",
  direito_constitucional: "Direito Constitucional",
  direito_administrativo: "Direito Administrativo",
  gestao_publica: "Gestão Pública",
  suporte_tecnico_administrativo: "Suporte Técnico-Administrativo",
  direito_penal: "Direito Penal",
  direito_processual_penal: "Direito Processual Penal",
  direito_processual_civil: "Direito Processual Civil",
  normas_corregedoria: "Normas da Corregedoria Geral da Justiça",
  atualidades: "Atualidades",
  mercado_valores_mobiliarios: "Mercado de Valores Mobiliários",
  fundamentos_direito: "Fundamentos de Direito",
  fluencia_dados: "Fluência em Dados",
};

export const LETRAS = ["A", "B", "C", "D", "E"] as const;
export type Letra = (typeof LETRAS)[number];
export type Confianca = 1 | 2 | 3; // 1 = chutei · 2 = dúvida · 3 = certeza
export type Modo = "treino" | "revisao" | "simulado";

// Por que errou (1 toque, opcional, depois do erro)
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
  origem: "oficial" | "gerada" | "cursinho";
  prova?: string;
  numeroOriginal?: number;
  /** banca da questão (oficial: a da prova; gerada: o estilo) e o formato (trilha única: questões de qualquer banca) */
  banca?: string;
  formato?: "multipla" | "certo_errado";
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
  /** sessão do tema (v1.1): subtema do edital em que a questão caiu (achado por código) */
  subtema?: string;
}

export interface AlternativaCorrigida {
  letra: Letra;
  texto: string;
  correta: boolean;
  explicacao: string;
  pegadinha?: string;
}

// Admin: fontes atuais (confirmadas/mudou/pendentes, mudanças esperando OK e normas a ingerir)
export interface AdminFontesAtuaisDTO {
  porDisciplina: Record<string, Record<string, number>>;
  mudancas: { id: string; questao: string; antes: string; hoje: string; fonte: string; respostaMudaria: boolean }[];
  faltaIngerir: { topico: string; disciplina: string; questoes: number }[];
}

// Bloco "Fontes" embaixo da explicação: de onde veio e se ainda vale hoje
export interface FontesQuestaoDTO {
  origem?: { ref: string; questao?: string };
  atual?: { ref: string; trecho: string; conferidoEm?: string };
  mudou?: { antes: string; hoje: string; trecho: string; ref: string };
  emConferencia: boolean; // base atual ainda sendo conferida
}

export interface CorrecaoDTO {
  acertou: boolean;
  gabarito: Letra;
  alternativas: AlternativaCorrigida[];
  explicacaoGeral: string;
  dicaDeProva?: string;
  fontes: { titulo: string; trecho?: string }[];
  referencias?: FontesQuestaoDTO;
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
  tempoSeg?: number; // tempo ativo na questão (aba visível); base das horas líquidas
}

// Motivos de erro por disciplina (gráfico do painel)
export interface MotivosDisciplinaDTO {
  disciplina: Disciplina;
  erros: number; // todos os erros fora de simulado
  motivos: Record<MotivoErro, number>;
}

// Calibragem da confiança: quanto você acerta em cada nível de confiança
export interface FaixaConfianca { n: number; acertos: number }
export interface CalibragemDTO {
  disciplina: Disciplina | null; // null = geral
  certeza: FaixaConfianca;
  duvida: FaixaConfianca;
  chute: FaixaConfianca;
  ilusao: boolean; // certeza acerta menos de 85% (com amostra mínima)
}

// Diagnóstico inicial (8.8)
export interface ResultadoDisciplina { disciplina: Disciplina; total: number; acertos: number }
export interface DiagnosticoResumo { id: string; data: string; total: number; acertos: number; porDisciplina: ResultadoDisciplina[] }

// Cartões (flashcards) de normas e vocabulário de Inglês, na revisão espaçada própria
export interface CartaoDTO {
  id: string;
  disciplina: Disciplina;
  assunto: string;
  tipo: "norma" | "vocabulario";
  frente: string;
  verso: string;
  fonte?: { titulo: string; trecho: string };
  novo: boolean; // nunca visto
}
export interface FilaCartoesDTO {
  cartoes: CartaoDTO[]; // vencidos primeiro, depois novos até o limite do dia
  vencidos: number;
  novosRestantesHoje: number;
  total: number; // aprovados no banco
}
export type NotaCartao = 1 | 3 | 4 | 5; // errei · difícil · bom · fácil

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
  hojePorDisciplina: { disciplina: Disciplina; n: number }[]; // treino e revisão de hoje (plano: o que foi cumprido)
  revisoesFeitasHoje: number;
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
  horasSemana: { disciplina: Disciplina; seg: number }[]; // horas líquidas dos últimos 7 dias
  niveis?: { disciplina: Disciplina; rating: number; n: number }[]; // nível estimado (Elo) por disciplina
  diagnosticos: DiagnosticoResumo[]; // Raio-X feitos, do mais antigo ao mais novo
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
  voz?: VozIADTO; // a narração da Lo (Magpie TTS)
  banco?: UsoBancoDTO & { audioMB: number; tetoAudioMB: number; colecoes: { nome: string; mb: number }[] };
}
// Admin → Convites e Contas (só admin)
export interface ConviteDTO {
  id: string;
  codigo: string;
  criadoEm: string;
  expiraEm: string;
  situacao: "valido" | "usado" | "expirado" | "cancelado";
  usadoPor?: string; // nome de quem usou
}
export interface ContaDTO { id: string; nome: string; email: string; papel: "admin" | "aluno"; ultimoAcesso?: string; criadoEm?: string }

// espaço do banco (Atlas grátis): alerta a partir de 80% do limite
  export interface UsoBancoDTO {
    usadoMB: number; limiteMB: number; fracao: number; alerta: boolean; dadosMB: number; indicesMB: number; discoMB: number;
    atlasReferenciaMB: number; chunks: number; dimensoesVetor: number; indiceVetorMB: number; vetorKBPorChunk: number;
    crescimentoKBPorChunk: number; novosChunksAteAlerta: number; novosChunksAteLimite: number;
  }
export interface VozIADTO {
  configurada: boolean;
  vozPadrao: string;
  h24: { chamadas: number; falhas: number; porTipo: Record<string, number> };
  d7: { chamadas: number; falhas: number };
  cache: { audios: number; daVozPadrao: number; mb: number; minutos: number };
  ultimaFalha?: string;
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
  explicacao?: string; // "Estudar ouvindo" lê esta explicação
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
// "Pergunte ao Binho" por tópico: resposta conferida ou mensagem (cota, ocupado, demo)
export interface RespostaBinhoDTO {
  resposta?: string;
  citacoes?: { titulo: string; trecho: string }[];
  origem?: "cache" | "nova";
  restantesHoje?: number;
  requerServidor?: boolean;
  mensagem?: string;
}

export interface ExplicacaoMaisDTO {
  explicacao?: string;
  origem?: "pregerada" | "cache" | "nova";
  restantesHoje?: number;
  requerServidor?: boolean;
  mensagem?: string;
}

export type MotivoContestacao = "gabarito_errado" | "duas_corretas" | "desatualizada" | "ambigua" | "explicacao_ruim";

// Concursos (F5): banca em uso (ou a de referência, se "a definir") e área de cada um
export interface ConcursoInfoDTO {
  id: IdConcurso;
  nome: string;
  cargo: string | null;
  banca: string; // id da banca ou "a_definir"
  aDefinir: boolean;
  bancaEmUso: string; // a que vale para o estilo e a nota (referência quando a definir)
  nomeBanca: string;
  areas: { id: string; nome: string }[];
  area: string | null;
}
// Certo/Errado (F10): afirmação + Certo / Errado / Em branco, nota com a penalidade da banca do concurso ativo
export interface ItemCEDTO {
  id: string;
  topicoId: string;
  disciplina: Disciplina | null;
  assunto: string;
  subtopico: string | null;
  afirmacao: string;
  textoBase?: string;
  origem: "oficial" | "derivada" | "cursinho";
  prova?: string;
}
export interface RecomendacaoBrancoDTO { recomenda: "responder" | "branco" | "sem_dados"; taxa: number | null; motivo: string }
export interface ProximoItemCEDTO { item: ItemCEDTO | null; recomendacao: RecomendacaoBrancoDTO | null; banca: string; nomeBanca: string; aviso?: string }
export interface CorrecaoCEDTO {
  gabarito: "C" | "E" | "anulada";
  acertou: boolean | null; // null = em branco
  pontos: number; // no critério da banca: +1, −1 (Cebraspe) ou 0
  explicacao: string;
  recomendacao: RecomendacaoBrancoDTO; // já com esta resposta no histórico
}

export interface RegistroConcursoDTO { em: string; quem: string; concurso: string; campo: "banca" | "area"; de: string; para: string; motivo: string }

// Trilha de estudos (F4): tema do dia, estados e fila de retomada (regra em shared/trilha.ts)
export interface TrilhaDTO {
  rodada: number;
  modo: "tema" | "sabado" | "domingo" | "prova";
  concluidos: number;
  total: number;
  filaRetomada: string[];
  hoje: {
    n: number;
    subtopico: string;
    nome: string;
    disciplina: Disciplina | null;
    estado: "novo" | "reforco" | "concluido" | "retomada";
    refazer: boolean;
    diaNoTema: number;
    aprovadas: number;
    novasFeitasHoje: number;
    acertosHoje: number;
    tamanho: number; // novas do tema na sessão
    mistas: number; // +N da matéria inteira no fim
  } | null;
  revisoesVencidas: number;
  temas: { n: number; subtopico: string; nome: string; estado: "novo" | "reforco" | "concluido" | "retomada"; acerto: number | null; aprovadas: number }[];
}

// Página do tema: área de ESTUDO (acervo, lei, ficha, pontos, YouTube) e de PRÁTICA (contagens)
export interface TemaDTO {
  subtopico: string;
  nome: string;
  n: number | null; // posição na trilha
  disciplina: Disciplina | null;
  topicoIds: string[];
  concursos: string[];
  aprovadas: number;
  poucas: boolean; // < 15 aprovadas
  estudo: {
    tempoMin: number;
    objetivo: string | null;
    pontos: string[];
    lei: { nome: string; url: string } | null;
    ficha: { texto: string; citacao: string; fonte: string } | null;
    materiais: { arquivo: string; paginas: string; pagina: number; camada: "A" | "B" | "C"; titulo: string; disponivel: boolean }[];
    materialAutomatico?: boolean; // mapa por palavra-chave, ainda não conferido
    // ficha aprovada pela rede (gerador + código + auditor de outra família): cada frase com o trecho literal
    fichaAcervo?: { afirmacoes: { texto: string; classe: string; trecho: string; titulo: string; pagina: number; camada: "A" | "B" | "C" }[]; conflitos: string[]; em: string } | null;
    youtube: string;
    oficiaisNoAcervo: string[];
  };
  pratica: { novas: number; revisoes: number; erradas: number; oficiais: number; geradas: number; derivadas: number; cursinho: number };
}

// A mesma interface serve para o modo demo (navegador) e para o servidor de verdade
export interface Api {
  modo: "demo" | "servidor";
  topicos(): Promise<TopicoDTO[]>;
  painel(): Promise<PainelDTO>;
  // misto: intercala disciplinas no peso da prova; anterior = disciplina da última questão
  // subtopico: só aquele tema, novas primeiro ("crase só traz crase"); excluir = já vistas nesta sessão
  // banca: questões do tema de uma banca só (trilha única: o padrão é qualquer banca)
  // erros + subtopico (v1.1): revisão dos erros do tema (questões cuja última resposta foi errada)
  proxima(f: { topicoId?: string; disciplina?: Disciplina; questaoId?: string; revisao?: boolean; erros?: boolean; misto?: boolean; anterior?: Disciplina; subtopico?: string; banca?: string; excluir?: string[] }): Promise<{
    questao: QuestaoDTO | null;
    modo: "treino" | "revisao";
    aviso?: string;
    repetida?: boolean; // tema sem novas: veio uma já respondida
  }>;
  desempenhoTemas(): Promise<DesempenhoTemaDTO[]>;
  trilha(): Promise<TrilhaDTO>;
  tema(subtopico: string): Promise<TemaDTO | null>;
  pedirPrioridadeTema(subtopico: string): Promise<void>;
  // põe a trilha neste tema (ele vira o tema do dia; dali em diante a regra decide)
  definirTemaDoDia(subtopico: string): Promise<void>;
  // histórico dos simulados com o detalhe guardado (evolução, tabela, CSV)
  simulados(): Promise<ResumoSimulado[]>;
  // concursos disponíveis (abas BB/BACEN): banca em uso e área
  concursos(): Promise<ConcursoInfoDTO[]>;
  // "Prontidão para X" de cada concurso, do mesmo domínio por tema (trilha única)
  prontidao(): Promise<ProntidaoDTO[]>;
  proximoItemCE(f: { subtopico?: string; disciplina?: Disciplina; excluir?: string[] }): Promise<ProximoItemCEDTO>;
  responderItemCE(r: { itemId: string; resposta: "C" | "E" | null; tempoSeg: number }): Promise<CorrecaoCEDTO>;
  responder(r: { questaoId: string; resposta: Letra; confianca: Confianca; tempoSeg: number; modo: Modo }): Promise<CorrecaoDTO>;
  aula(topicoId: string): Promise<AulaDTO | null>;
  explicarMais(questaoId: string, duvida?: string): Promise<ExplicacaoMaisDTO>;
  perguntarBinho(topicoId: string, pergunta: string): Promise<RespostaBinhoDTO>;
  cartoes(): Promise<FilaCartoesDTO>;
  avaliarCartao(cartaoId: string, nota: NotaCartao): Promise<{ proximaRevisaoDias: number }>;
  // motivo do último erro nessa questão; devolve a ação (aula/tópico, comparação, palavra-chave, revisão antecipada)
  motivoErro(questaoId: string, motivo: MotivoErro): Promise<AcaoMotivoDTO>;
  // diagnostico: Raio-X de 30 questões médias; na correção, define o nível inicial por disciplina
  simulado(n: number, opcoes?: { diagnostico?: boolean }): Promise<QuestaoDTO[]>;
  corrigirSimulado(r: { questaoId: string; resposta: Letra | null; tempoSeg: number }[], opcoes?: { diagnostico?: boolean }): Promise<ResultadoSimuladoDTO>;
  // mistura de dificuldade do simulado: a das oficiais (≥ 30 com dificuldade) ou a estimativa 20/50/30
  misturaSimulado(): Promise<{ facil: number; media: number; dificil: number; estimativa: boolean; base: number }>;
  erros(): Promise<ErroDTO[]>;
  contestar(questaoId: string, motivo: MotivoContestacao, comentario?: string): Promise<void>;
  temasRedacao(): Promise<TemaRedacaoDTO[]>;
  pedirTemaRedacao(): Promise<{ status: "gerando" | "demo" }>;
  corrigirRedacao(r: { temaId: string; texto: string; linhas: number; tempoSeg: number }): Promise<RedacaoDTO>;
  redacoes(): Promise<RedacaoDTO[]>;
  marcarRedacoesVistas(): Promise<void>;
  // Espaço da Lo: seu dia, playlist do tema do dia, biblioteca de áudios e recados (tudo montado por código)
  espacoLo(): Promise<EspacoLoDTO>;
  // "continuar de onde parei": posição de um áudio, salva por aluno
  salvarPosicaoAudio(id: string, p: { fracao: number; frase: number; segundos: number }): Promise<PosicaoAudio>;
}
