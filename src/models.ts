// ============================================================
// BB Estudos — Esquema do banco (MongoDB + Mongoose)
// ============================================================
import { Schema, model, Types } from "mongoose";

export const INDICE_VETORIAL = () => process.env.VECTOR_INDEX || "chunks_vector";

// ------------------------------------------------------------
// 1. TÓPICOS — o mapa do edital. Tudo gira em torno disso.
// ------------------------------------------------------------
import { DISCIPLINAS, LETRAS, MOTIVOS_ERRO, type Disciplina, type Letra } from "../shared/tipos.js";
export { DISCIPLINAS, LETRAS, type Disciplina, type Letra };

// Matérias normativas: só geram questão nova com fonte primária por trás.
// As demais (Português, Matemática...) são estáveis e podem gerar sem fonte.
export const DISCIPLINAS_COM_FONTE_OBRIGATORIA: readonly Disciplina[] = [
  "conhecimentos_bancarios",
  "atualidades_mercado_financeiro",
  "vendas_negociacao", // a banca cobra doutrina, não senso comum (6 de 13 traiçoeiras eram de Vendas)
];

const TopicSchema = new Schema(
  {
    disciplina: { type: String, enum: DISCIPLINAS, required: true, index: true },
    assunto: { type: String, required: true }, // ex.: "Estrutura do Sistema Financeiro Nacional"
    subtopicos: { type: [String], default: [] },
    descricao: String,
    editalRef: String, // trecho literal do edital que cita este assunto
    questoesNaProva: Number, // preencher a partir do edital
    // "volátil" = muda com norma nova (Pix, Open Finance...) → exige fonte atualizada
    volatil: { type: Boolean, default: false },
    ativo: { type: Boolean, default: true },
    embedding: { type: [Number], select: false }, // usado para classificar trechos e questões
  },
  { timestamps: true }
);
TopicSchema.index({ disciplina: 1, assunto: 1 }, { unique: true });
export const Topic = model("Topic", TopicSchema);

// ------------------------------------------------------------
// 2. FONTES — de onde a verdade vem. Só fonte primária ou prova oficial.
// ------------------------------------------------------------
const SourceSchema = new Schema(
  {
    tipo: {
      type: String,
      enum: ["prova_oficial", "edital", "lei", "norma_bacen_cmn", "material_proprio"],
      required: true,
    },
    titulo: { type: String, required: true }, // ex.: "Resolução BCB nº 1/2020 (Regulamento Pix)"
    orgao: String, // BACEN, CMN, Cesgranrio...
    url: String,
    banca: String, // para provas oficiais
    ano: Number,
    vigenteDesde: Date,
    revogada: { type: Boolean, default: false }, // fonte revogada nunca alimenta questão nova
    hashArquivo: { type: String, unique: true, sparse: true }, // evita ingerir o mesmo arquivo 2x
    arquivoNome: String,
    paginas: Number,
    totalChunks: Number,
  },
  { timestamps: true }
);
export const Source = model("Source", SourceSchema);

// ------------------------------------------------------------
// 3. TRECHOS (chunks) — coleção própria, é aqui que mora o índice vetorial
// ------------------------------------------------------------
const ChunkSchema = new Schema(
  {
    sourceId: { type: Schema.Types.ObjectId, ref: "Source", required: true, index: true },
    ordem: Number,
    pagina: Number,
    texto: { type: String, required: true },
    embedding: { type: [Number], select: false },
    topicIds: [{ type: Schema.Types.ObjectId, ref: "Topic" }],
    revogada: { type: Boolean, default: false }, // espelho de Source.revogada (filtro do $vectorSearch)
  },
  { timestamps: true }
);
ChunkSchema.index({ topicIds: 1, revogada: 1 });
export const Chunk = model("Chunk", ChunkSchema);

// ------------------------------------------------------------
// 4. QUESTÕES — oficiais e geradas, no mesmo formato
// ------------------------------------------------------------

// Questão oficial entra "pendente" (sem explicação) e só vira "aprovada" depois de explicada.
function exigeSeAprovada(this: any): boolean {
  const dono = typeof this?.ownerDocument === "function" ? this.ownerDocument() : this;
  return dono?.status === "aprovada";
}

const AlternativaSchema = new Schema(
  {
    letra: { type: String, enum: LETRAS, required: true },
    texto: { type: String, required: true },
    correta: { type: Boolean, required: true },
    explicacao: { type: String, required: exigeSeAprovada }, // por que está certa / errada
    pegadinha: String, // qual erro clássico essa alternativa explora
  },
  { _id: false }
);

const QuestionSchema = new Schema(
  {
    topicId: { type: Schema.Types.ObjectId, ref: "Topic", required: true, index: true },
    origem: { type: String, enum: ["oficial", "gerada"], required: true },
    estiloBanca: { type: String, default: "cesgranrio" },
    prova: String, // ex.: "BB 2023 — Escriturário Agente Comercial" (só oficiais)
    numeroOriginal: Number, // número da questão na prova original
    precisaImagem: Boolean, // depende de figura/tabela/tela que não veio no texto (status precisa_imagem)
    faltaImagem: String, // o que falta (ex.: "tabela de preços da embalagem")
    notaNorma: String, // oficial que cita norma revogada (status desatualizada): o que mudou e a norma vigente
    // Figuras: DADO desenhado por código (tabela, planilha, gráfico, tela) ou, nas oficiais, a
    // imagem original extraída do PDF. Só aparecem no treino com status "ok" (conferidas pelo dono).
    figuras: {
      type: [
        {
          tipo: { type: String, enum: ["tabela", "planilha", "grafico", "imagem", "tela_programa"], required: true },
          posicao: { type: String, enum: ["enunciado", "textoBase", "alternativas"], default: "enunciado" },
          legenda: String,
          dados: Schema.Types.Mixed, // TabelaDados | PlanilhaDados | GraficoDados | TelaProgramaDados
          imagem: String, // data URL PNG (oficial: imagem original do PDF)
          recorte: { pagina: Number, x: Number, y: Number, w: Number, h: Number, _id: false }, // em pontos do PDF
          recortePng: String, // data URL do recorte da página, para conferência
          origem: { type: String, enum: ["pdf", "construcao"], default: "pdf" },
          status: { type: String, enum: ["aguardando_conferencia", "ok", "fora"], default: "aguardando_conferencia" },
        },
      ],
      default: undefined,
    },
    dificuldade: { type: Number, min: 1, max: 5, default: 3 },

    textoBase: String, // texto de apoio (interpretação de texto)
    enunciado: { type: String, required: true },
    alternativas: {
      type: [AlternativaSchema],
      validate: [
        (v: unknown[]) => v.length === 5,
        "A questão precisa de exatamente 5 alternativas",
      ],
    },
    gabarito: { type: String, enum: LETRAS, required: true },
    explicacaoGeral: { type: String, required: exigeSeAprovada }, // o conceito por trás da questão
    dicaDeProva: String, // atalho mental para a hora da prova

    fontes: [
      {
        sourceId: { type: Schema.Types.ObjectId, ref: "Source" },
        trecho: String, // trecho que sustenta o gabarito
        _id: false,
      },
    ],

    // pipeline de qualidade
    status: {
      type: String,
      // anulada: oficial anulada pela banca · precisa_imagem: depende de figura/tabela que o texto não trouxe (fora do treino)
      enum: ["pendente", "aprovada", "rejeitada", "contestada", "desatualizada", "anulada", "precisa_imagem"],
      default: "pendente",
      index: true,
    },
    geradaPor: String, // modelo gerador
    auditoria: {
      modelo: String,
      respostaCega: { type: String, enum: LETRAS }, // o que o auditor marcou sem ver o gabarito
      veredito: { type: String, enum: ["aprovada", "rejeitada"] },
      problemas: [String],
      // Português por construção: veredito do auditor frase a frase (sem saber a regra)
      porFrase: {
        type: [
          {
            letra: { type: String, enum: LETRAS },
            regraEsperada: String, // regra que o código atribuiu à letra
            correta: Boolean, // o que o auditor julgou
            regra: String, // a regra que o auditor citou
            _id: false,
          },
        ],
        default: undefined, // só existe em questões de Português por construção
      },
      // Crase: frases em que o auditor discordou do banco de regras e o Ultra desempatou às cegas
      desempates: {
        type: [
          {
            letra: { type: String, enum: LETRAS },
            auditor: Boolean, // o que o auditor principal disse ("correta?")
            ultra: Boolean, // o que o Ultra disse (null = falhou)
            regraUltra: String,
            _id: false,
          },
        ],
        default: undefined,
      },
      _id: false,
    },
    // tipo e contexto sorteados pelo código antes de gerar (src/variacao.ts)
    variacao: {
      tipo: String,
      contexto: String,
      duasEtapas: Boolean,
      _id: false,
    },
    // cálculo: conta conferida por código (mathjs) antes do auditor — regra 10
    verificacao: {
      expressao: String,
      fatoresDados: Schema.Types.Mixed,
      valorEsperado: Number,
      _id: false,
    },
    hashEnunciado: { type: String, index: true, unique: true, sparse: true }, // evita duplicata
    // filtro anti-repetição (src/similaridade.ts): embedding de enunciado + correta,
    // impressão estrutural (tipo, contexto, parâmetros) e cenário sorteado (src/cenarios.ts)
    embedding: { type: [Number], select: false, default: undefined },
    impressao: { type: String, index: true },
    cenario: { perfil: String, situacao: String, _id: false },
    // "me explica de outro jeito": gerada de noite, conferida por modelo de outra família
    explicacaoAlternativa: { texto: String, modelo: String, conferidaPor: String, em: Date, _id: false },

    // estatística agregada (taxa de acerto geral = termômetro de dificuldade real)
    stats: {
      tentativas: { type: Number, default: 0 },
      acertos: { type: Number, default: 0 },
      _id: false,
    },
  },
  { timestamps: true }
);
QuestionSchema.index({ topicId: 1, status: 1, dificuldade: 1 });
QuestionSchema.index({ "fontes.sourceId": 1 });
export const Question = model("Question", QuestionSchema);

// ------------------------------------------------------------
// 5. TENTATIVAS — cada resposta sua, crua
// ------------------------------------------------------------
const AttemptSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    questionId: { type: Schema.Types.ObjectId, ref: "Question", required: true },
    topicId: { type: Schema.Types.ObjectId, ref: "Topic", required: true },
    resposta: { type: String, enum: LETRAS }, // vazio = em branco (simulado)
    acertou: { type: Boolean, required: true },
    tempoSeg: Number,
    confianca: { type: Number, min: 1, max: 3 }, // 1=chutei 2=dúvida 3=certeza
    modo: { type: String, enum: ["treino", "revisao", "simulado"], default: "treino" },
    xp: { type: Number, default: 0 }, // calculado em shared/motor.ts no momento da resposta
    simuladoId: String,
    motivoErro: { type: String, enum: MOTIVOS_ERRO }, // informado pelo aluno depois do erro
  },
  { timestamps: true }
);
AttemptSchema.index({ userId: 1, topicId: 1, createdAt: -1 });
export const Attempt = model("Attempt", AttemptSchema);

// ------------------------------------------------------------
// 6. REVISÃO ESPAÇADA — estado SM-2 por (usuário, questão)
// ------------------------------------------------------------
const ReviewStateSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    questionId: { type: Schema.Types.ObjectId, ref: "Question", required: true },
    facilidade: { type: Number, default: 2.5 }, // ease factor
    intervaloDias: { type: Number, default: 0 },
    repeticoes: { type: Number, default: 0 },
    proximaRevisao: { type: Date, required: true, index: true },
    comTempo: Boolean, // errou por desatenção: revisão com tempo-alvo até acertar
  },
  { timestamps: true }
);
ReviewStateSchema.index({ userId: 1, questionId: 1 }, { unique: true });
ReviewStateSchema.index({ userId: 1, proximaRevisao: 1 });
export const ReviewState = model("ReviewState", ReviewStateSchema);

// ------------------------------------------------------------
// 7. CONTESTAÇÕES — você achou erro? A questão sai de circulação na hora.
// ------------------------------------------------------------
const ReportSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    questionId: { type: Schema.Types.ObjectId, ref: "Question", required: true },
    motivo: {
      type: String,
      enum: ["gabarito_errado", "duas_corretas", "desatualizada", "ambigua", "explicacao_ruim"],
      required: true,
    },
    comentario: String,
    resolvido: { type: Boolean, default: false },
  },
  { timestamps: true }
);
export const Report = model("Report", ReportSchema);

// ------------------------------------------------------------
// 8. GERAÇÕES — cada tentativa de gerar uma questão (aprovada, rejeitada ou descartada).
// Dá o teto diário (GERACAO_MAX_DIA), os descartes por motivo no "status" e a taxa de aprovação.
// ------------------------------------------------------------
const GeracaoSchema = new Schema(
  {
    topicId: { type: Schema.Types.ObjectId, ref: "Topic", index: true },
    resultado: { type: String, enum: ["aprovada", "rejeitada", "descartada"], required: true },
    motivo: String, // descartada: motivo do pipeline (ex.: "parecida", "auditor_discordou")
    questionId: { type: Schema.Types.ObjectId, ref: "Question" },
    tipo: String,
    contexto: String,
    ms: Number,
    em: { type: Date, default: Date.now, index: true },
  }
);
export const Geracao = model("Geracao", GeracaoSchema, "geracoes");

// ------------------------------------------------------------
// 9. TELEMETRIA DE MODELOS — uma linha por chamada HTTP (sem texto, sem chave). Some em 35 dias.
// ------------------------------------------------------------
export const TIPOS_FALHA = ["429", "5xx", "timeout", "formato", "permanente", "outro"] as const;
const ChamadaModeloSchema = new Schema({
  modelo: { type: String, required: true },
  familia: String,
  funcao: String, // gerador, auditor, escritor_pt, juiz_pt, embed, verificacao, benchmark…
  ok: { type: Boolean, required: true },
  falha: { type: String, enum: TIPOS_FALHA },
  http: Number,
  ms: Number,
  reserva: Boolean, // atendeu no lugar do principal da corrente
  em: { type: Date, default: Date.now },
});
ChamadaModeloSchema.index({ em: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 35 });
ChamadaModeloSchema.index({ modelo: 1, em: -1 });
export const ChamadaModelo = model("ChamadaModelo", ChamadaModeloSchema, "chamadas_modelo");

// ------------------------------------------------------------
// 10. CONFIGURAÇÃO — chave → valor (corrente aprovada pelo dono, última verificação dos modelos)
// ------------------------------------------------------------
const ConfigSchema = new Schema({ _id: { type: String, required: true }, valor: Schema.Types.Mixed, em: { type: Date, default: Date.now } });
export const Config = model("Config", ConfigSchema, "config");

// 11. Redação: temas pré-gerados e textos corrigidos por usuário.
const TemaRedacaoSchema = new Schema(
  {
    tema: { type: String, required: true },
    proposta: { type: String, required: true },
    textosMotivadores: { type: [String], required: true },
    ativo: { type: Boolean, default: true, index: true },
    modelo: String,
  },
  { timestamps: true }
);
export const TemaRedacao = model("TemaRedacao", TemaRedacaoSchema, "temas_redacao");

const RedacaoSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    temaId: { type: Schema.Types.ObjectId, ref: "TemaRedacao", required: true },
    tema: { type: String, required: true },
    proposta: { type: String, required: true },
    texto: { type: String, required: true },
    linhas: { type: Number, required: true },
    tempoSeg: { type: Number, required: true },
    status: { type: String, enum: ["aguardando", "corrigindo", "corrigida", "erro"], default: "aguardando", index: true },
    correcao: Schema.Types.Mixed,
    avisada: { type: Boolean, default: false },
    erro: String,
  },
  { timestamps: true }
);
RedacaoSchema.index({ userId: 1, createdAt: -1 });
export const Redacao = model("Redacao", RedacaoSchema, "redacoes");

// 11. Aulas curtas por tópico: só conteúdo aprovado aparece para o aluno.
const AulaSchema = new Schema(
  {
    topicId: { type: Schema.Types.ObjectId, ref: "Topic", required: true, unique: true, index: true },
    status: { type: String, enum: ["rascunho", "aprovada", "reprovada"], default: "rascunho", index: true },
    conteudo: { type: String, required: true },
    pontosChave: { type: [String], default: [] },
    comoABancaCobra: { type: String, required: true },
    pegadinhasComuns: { type: [String], default: [] },
    exemplos: { type: [String], default: [] },
    fontes: [{ sourceId: { type: Schema.Types.ObjectId, ref: "Source", required: true }, titulo: String, trecho: String, _id: false }],
    geradaPor: String,
    auditoria: { modelo: String, veredito: { type: String, enum: ["aprovada", "reprovada"] }, problemas: [String], em: Date, _id: false },
    erro: String,
  },
  { timestamps: true }
);
export const Aula = model("Aula", AulaSchema, "aulas");

// Respostas do tutor pedidas durante o treino, em cache por aluno/questão/dúvida.
const ExplicacaoTutorSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    questionId: { type: Schema.Types.ObjectId, ref: "Question", required: true },
    duvidaHash: { type: String, required: true },
    explicacao: { type: String, required: true },
    modelo: String,
  },
  { timestamps: true }
);
ExplicacaoTutorSchema.index({ userId: 1, questionId: 1, duvidaHash: 1 }, { unique: true });
export const ExplicacaoTutor = model("ExplicacaoTutor", ExplicacaoTutorSchema, "explicacoes_tutor");

// Contador atômico por aluno e dia: cache-hit e explicação pré-gerada não consomem cota.
const TutorUsoSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    dia: { type: String, required: true },
    quantidade: { type: Number, default: 0 },
  },
  { timestamps: true }
);
TutorUsoSchema.index({ userId: 1, dia: 1 }, { unique: true });
export const TutorUso = model("TutorUso", TutorUsoSchema, "tutor_usos");

// ------------------------------------------------------------
// 12. TAREFAS — fila persistida do noturno: sobrevive a reinício; falha de infraestrutura
// volta para a fila com espera crescente; descarte só por qualidade, com motivo.
// ------------------------------------------------------------
export const STATUS_TAREFA = ["pendente", "rodando", "aguardando", "concluida", "descartada", "esgotada"] as const;
const TarefaSchema = new Schema(
  {
    // aula e tema: ganchos prontos, ativados na Fase B (8.5 e 8.4)
    tipo: { type: String, enum: ["gerar", "verificar_modelos", "benchmark", "explicar_outro_jeito", "aula", "tema", "corrigir_redacao"], required: true },
    params: Schema.Types.Mixed, // gerar: { topicId, assunto, tipo? }
    status: { type: String, enum: STATUS_TAREFA, default: "pendente", index: true },
    tentativas: { type: Number, default: 0 }, // falhas de infraestrutura até agora
    proximaEm: { type: Date, default: Date.now }, // "aguardando": quando pode rodar de novo
    motivo: String,
    detalhes: String,
    resultadoId: Schema.Types.ObjectId, // questão aprovada
    iniciadaEm: Date,
    lote: String, // ex.: "noite 2026-10-17"
  },
  { timestamps: true }
);
TarefaSchema.index({ status: 1, proximaEm: 1 });
export const Tarefa = model("Tarefa", TarefaSchema, "tarefas");

// ------------------------------------------------------------
// 12. BENCHMARK — resposta às cegas de cada modelo para cada questão da amostra
// ------------------------------------------------------------
const BenchmarkRespostaSchema = new Schema({
  rodada: { type: String, required: true, index: true }, // ex.: "auditor-2026-10"
  modelo: { type: String, required: true },
  questionId: { type: Schema.Types.ObjectId, ref: "Question" },
  item: String, // Português: id do caso (frase)
  disciplina: String,
  resposta: String, // letra, ou "correta"/"incorreta"
  acertou: Boolean,
  falha: { type: String, enum: TIPOS_FALHA }, // sem resposta: por quê
  ms: Number,
  em: { type: Date, default: Date.now },
});
BenchmarkRespostaSchema.index({ rodada: 1, modelo: 1, questionId: 1, item: 1 });
export const BenchmarkResposta = model("BenchmarkResposta", BenchmarkRespostaSchema, "benchmark_respostas");

// ------------------------------------------------------------
// 12b. RELATÓRIO DA NOITE (adendo, item 5): aprovadas, tentativas, descartes por motivo,
// aprovadas por hora, modelo que mais atendeu e progresso até a meta do banco
// ------------------------------------------------------------
const RelatorioSchema = new Schema({
  lote: { type: String, required: true },
  inicio: { type: Date, required: true },
  fim: { type: Date, required: true },
  resumo: Schema.Types.Mixed, // ResumoNoite (tarefas)
  noite: Schema.Types.Mixed, // RelatorioNoiteDTO (gerações desde o início)
  progresso: { aprovadas: Number, meta: Number, _id: false },
});
RelatorioSchema.index({ fim: -1 });
export const Relatorio = model("Relatorio", RelatorioSchema, "relatorios");

// ------------------------------------------------------------
// 13. LOGIN (PLANO-MESTRE 5.7) — usuário, sessão (só o hash do token) e convite de uso único.
// Enquanto não existe usuário, o app segue no modo dono único (ALUNO_ID), sem tela de login.
// ------------------------------------------------------------
const UserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    nome: { type: String, required: true, trim: true },
    senhaHash: { type: String, required: true, select: false },
    papel: { type: String, enum: ["admin", "aluno"], default: "aluno" },
    plano: { type: String, default: "gratuito" }, // só o campo, para o futuro
    ultimoLogin: Date,
    criadoEm: { type: Date, default: Date.now },
  }
);
export const User = model("User", UserSchema);

const SessaoSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  expiraEm: { type: Date, required: true },
  criadaEm: { type: Date, default: Date.now },
  ultimoUso: { type: Date, default: Date.now },
});
SessaoSchema.index({ expiraEm: 1 }, { expireAfterSeconds: 0 });
export const Sessao = model("Sessao", SessaoSchema, "sessoes");

const ConviteSchema = new Schema({
  codigo: { type: String, required: true, unique: true },
  criadoPor: { type: Schema.Types.ObjectId, ref: "User" },
  expiraEm: { type: Date, required: true },
  usadoEm: Date,
  usadoPor: { type: Schema.Types.ObjectId, ref: "User" },
  criadoEm: { type: Date, default: Date.now },
});
export const Convite = model("Convite", ConviteSchema, "convites");

export type ObjectId = Types.ObjectId;
