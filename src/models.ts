// ============================================================
// BB Estudos — Esquema do banco (MongoDB + Mongoose)
// ============================================================
import { Schema, model, Types } from "mongoose";

export const INDICE_VETORIAL = () => process.env.VECTOR_INDEX || "chunks_vector";

// ------------------------------------------------------------
// 1. TÓPICOS — o mapa do edital. Tudo gira em torno disso.
// ------------------------------------------------------------
import { DISCIPLINAS, LETRAS, type Disciplina, type Letra } from "../shared/tipos.js";
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

export type ObjectId = Types.ObjectId;
