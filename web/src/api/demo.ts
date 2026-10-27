// ============================================================
// API do MODO DEMO — roda 100% no navegador, guarda o progresso no localStorage.
// Usa o mesmo motor (shared/motor.ts) que o servidor.
// ============================================================
import topicosJson from "../../../data/topicos.json";
import {
  DISCIPLINAS,
  type AcaoMotivoDTO,
  type Api,
  type CartaoDTO,
  type AulaDTO,
  type Confianca,
  type CorrecaoDTO,
  type Disciplina,
  type Letra,
  type MotivoContestacao,
  type QuestaoDTO,
  type RedacaoDTO,
  type TemaRedacaoDTO,
  type TentativaBruta,
  type TopicoDTO,
} from "../../../shared/tipos";
import {
  ESTADO_INICIAL,
  agendar,
  calcularPainel,
  calcularBanco,
  cotasPorDisciplina,
  notaSM2,
  prioridade,
  sortearPonderado,
  xpDaTentativa,
  type EstadoRevisao,
} from "../../../shared/motor";
import { QUESTOES_DEMO, type QuestaoDemo } from "../demo/questoes";
import { pesoDoTopico, cotasPorFaixa, faixaDe, sortearDisciplinaMista, COTAS_PROVA, MISTURA_SIMULADO } from "../../../shared/estruturaProva";
import { ehDiagnostico, MISTURA_DIAGNOSTICO, PREFIXO_DIAGNOSTICO, ratingDoDiagnostico } from "../../../shared/diagnostico";
import { reprocessar, type EventoRating, pesoPorProximidade, ratingInicialQuestao, ALVO_ACIMA, RATING_ALUNO_INICIAL } from "../../../shared/rating";
import { fatorNaoSabia, naoSabiaPorTopico, palavrasDecisivas, MENSAGEM_MOTIVO, REVISAO_CHUTE_MIN, TEMPO_ALVO_SEG } from "../../../shared/aprendizado";
import { classificarPorCodigo, concursosDoTopico, SUBTOPICO_POR_ID } from "../../../shared/subtopicos";
import { BANCAS, CONCURSOS, IDS_CONCURSO, type IdBanca } from "../../../shared/concursos";
import { corrigirCE, derivarItens, recomendarBranco } from "../../../shared/certoErrado";
import { lenteAtiva } from "../concursoAtivo";
import { prontidaoDeTodos } from "../../../shared/prontidao";
import { concursosDoTema, linkYoutube, MINIMO_NOVAS, MISTAS_FIM, situacaoTrilha, tamanhoSessao, TRILHA, type InicioTrilha } from "../../../shared/trilha";
import { desempenhoPorTema, diaLocal, diasDaTrilha, type TentativaTema } from "../../../shared/desempenhoTema";
import { resumirSimulado } from "../../../shared/simulados";
import { itensDoTema, montarRecados, unicos, registrarPosicao, resumirDia, rolarVisita, type EstadoTema, type EstadoVisita, type PosicaoAudio } from "../../../shared/espacoLo";
import { textoDaAula } from "../../../shared/fala";
import { errosDoTema, ordenarParaEstudo, subtemaDaQuestao, subtemasDoTema, temasParaMistura } from "../../../shared/estudoTema";
import temasJson from "../../../data/temas.json";

const CHAVE = "lobo-demo-v1";
const CHAVE_INICIO = "lobo-demo-trilha-inicio";
const CHAVE_ESTUDANDO = "lobo-demo-estudando";
const CHAVE_ESPACO_LO = "lobo-demo-espaco-lo";
const CONTEUDO_TEMAS = temasJson.temas as unknown as Record<string, { pontos?: string[]; ficha?: { texto: string } }>;

// Espaço da Lo: posição dos áudios e base dos recados, no aparelho
type EstadoEspacoLo = { audios: Record<string, PosicaoAudio>; visita: EstadoVisita | null };
let espacoLoMemoria: EstadoEspacoLo = { audios: {}, visita: null };
function lerEspacoLo(): EstadoEspacoLo {
  try { return { audios: {}, visita: null, ...JSON.parse(localStorage.getItem(CHAVE_ESPACO_LO) ?? "{}") }; } catch { return espacoLoMemoria; }
}
function gravarEspacoLo(e: EstadoEspacoLo) {
  espacoLoMemoria = e;
  try { localStorage.setItem(CHAVE_ESPACO_LO, JSON.stringify(e)); } catch { /* sem storage: fica na memória */ }
}
const slug = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// peso no treino: o do edital ou a cota da disciplina na prova ÷ tópicos dela (igual ao servidor)
export const TOPICOS: TopicoDTO[] = Object.entries(
  (topicosJson as { disciplinas: Record<string, { assunto: string; subtopicos?: string[]; questoesNaProva?: number | null }[]> }).disciplinas
)
  .filter(([d]) => (DISCIPLINAS as readonly string[]).includes(d))
  .flatMap(([d, lista]) =>
    lista.map((t) => ({
      id: `${d}:${slug(t.assunto)}`,
      disciplina: d as Disciplina,
      assunto: t.assunto,
      subtopicos: t.subtopicos ?? [],
      peso: pesoDoTopico(d as Disciplina, lista.length, t.questoesNaProva),
    }))
  );
const topicoDe = (q: QuestaoDemo) => `${q.disciplina}:${slug(q.assunto)}`;
// lente do concurso: só os tópicos dele (igual ao servidor; tópico sem subtópico mapeado = BB); aba Geral: todos
const lenteDemo = () => lenteAtiva();
const doConcurso = (assunto: string) => {
  const lente = lenteDemo();
  if (!lente) return true;
  const c = concursosDoTopico(assunto);
  return c.length ? c.includes(lente) : lente === "bb";
};
const topicosAtivos = () => TOPICOS.filter((t) => doConcurso(t.assunto));
const questaoAtiva = (q: QuestaoDemo) => doConcurso(q.assunto);
const porId = new Map(QUESTOES_DEMO.map((q) => [q.id, q]));

const AULAS_DEMO: Record<string, AulaDTO> = Object.fromEntries(
  [
    {
      assunto: "Juros compostos",
      conteudo: "## A ideia central\nNos juros compostos, cada período rende sobre o saldo acumulado. Os juros de hoje também passam a render nos períodos seguintes: é o chamado efeito de juros sobre juros.\n\nA fórmula é **M = C × (1 + i)ⁿ**. `C` é o capital inicial, `i` é a taxa por período em forma decimal, `n` é o número de períodos e `M` é o montante final. Para achar apenas os juros, calcule **J = M − C**.\n\nConfira se taxa e prazo estão na mesma unidade. Uma taxa mensal pede o prazo em meses; uma taxa anual pede o prazo em anos.",
      pontosChave: ["A taxa e o prazo precisam usar a mesma unidade.", "O montante inclui o capital e os juros acumulados.", "Juros compostos aplicam a taxa sobre o saldo de cada período."],
      comoABancaCobra: "A banca costuma pedir montante ou juros após vários períodos e mistura taxa com prazo em unidades diferentes.",
      pegadinhasComuns: ["Usar a fórmula de juros simples em uma capitalização composta.", "Esquecer que a taxa de 5% entra como 0,05.", "Subtrair o capital quando a questão pede o montante."],
      exemplos: ["R$ 1.000 a 10% por período durante 2 períodos: M = 1.000 × 1,1² = R$ 1.210; os juros são R$ 210."],
    },
    {
      assunto: "Regência verbal e nominal e crase",
      conteudo: "## Regência e crase\nRegência mostra qual preposição completa o sentido de um verbo ou nome. Quem **assiste a** uma palestra presencia algo; quem **obedece a** uma regra se submete a ela. Alguns verbos mudam de sentido conforme a preposição.\n\nA crase marca, em geral, a união da preposição **a** com o artigo feminino **a**. Troque o termo feminino por um masculino: se aparecer **ao**, há forte indicação de crase no feminino (vou **à** agência / vou **ao** banco).\n\nNão use crase antes de palavra masculina, verbo ou pronome pessoal. Em locuções femininas como **à noite** e **às vezes**, ela costuma aparecer.",
      pontosChave: ["Identifique a preposição exigida pelo verbo ou nome.", "Crase é a fusão da preposição a com o artigo a.", "O teste do masculino ajuda: a / à costuma corresponder a o / ao."],
      comoABancaCobra: "A questão apresenta uma frase e pergunta se a preposição ou o acento grave está de acordo com o contexto.",
      pegadinhasComuns: ["Colocar crase apenas porque a palavra seguinte é feminina.", "Esquecer a preposição pedida pelo verbo.", "Confundir a crase obrigatória com casos facultativos."],
      exemplos: ["Vou à agência: quem vai, vai a algum lugar; agência admite o artigo a. No masculino, vou ao banco."],
    },
    {
      assunto: "Concordância verbal e nominal",
      conteudo: "## Concordância\nNa concordância verbal, o verbo acompanha o núcleo do sujeito em pessoa e número. Na frase **A lista de clientes chegou**, o núcleo é *lista*, no singular; *clientes* está dentro de uma expressão que completa o nome.\n\nNa concordância nominal, artigos, pronomes, numerais e adjetivos se ajustam ao substantivo a que se referem: **as propostas aprovadas**. Quando há mais de um núcleo ou uma expressão partitiva, localize primeiro o termo que comanda a concordância e observe o contexto.\n\nUma boa revisão é perguntar: *quem praticou a ação?* Depois, retire termos intercalados e confira o núcleo sem se deixar levar pelo substantivo mais próximo.",
      pontosChave: ["O verbo concorda com o núcleo do sujeito.", "Termos entre sujeito e verbo não mudam o núcleo.", "Adjetivos e determinantes acompanham o substantivo a que se ligam."],
      comoABancaCobra: "A banca altera uma forma verbal ou nominal em frases longas e pede a opção que preserva a norma-padrão.",
      pegadinhasComuns: ["Fazer o verbo concordar com o termo mais próximo, que é complemento.", "Confundir sujeito simples com expressão partitiva.", "Deixar adjetivo no singular quando se refere a substantivo plural."],
      exemplos: ["A relação de documentos chegou: o núcleo do sujeito é relação, por isso o verbo fica no singular."],
    },
  ].flatMap((aula) => {
    const topico = TOPICOS.find((t) => t.assunto === aula.assunto);
    return topico ? [[topico.id, { topicoId: topico.id, ...aula, fontes: [] } satisfies AulaDTO]] : [];
  })
);

// Cartões de exemplo: o "trecho" é cópia literal do texto de uma questão do demo
const TEXTO_OPEN_BANKING = "Open banking lets customers share their financial data with authorized third-party providers. However, data can only be shared with the customer's explicit consent, which may be withdrawn at any time. Supporters say it increases competition and leads to cheaper services; critics worry about cybersecurity risks.";
const CARTOES_DEMO: CartaoDTO[] = [
  { frente: "withdrawn", verso: "retirado, revogado (o consentimento pode ser retirado a qualquer momento)", trecho: "which may be withdrawn at any time", tipo: "vocabulario" as const, disciplina: "lingua_inglesa" as const, assunto: "Compreensão de textos em inglês", titulo: "Texto da questão de exemplo" },
  { frente: "third-party providers", verso: "provedores terceiros (empresas de fora autorizadas)", trecho: "authorized third-party providers", tipo: "vocabulario" as const, disciplina: "lingua_inglesa" as const, assunto: "Compreensão de textos em inglês", titulo: "Texto da questão de exemplo" },
  { frente: "leads to", verso: "leva a, resulta em", trecho: "leads to cheaper services", tipo: "vocabulario" as const, disciplina: "lingua_inglesa" as const, assunto: "Compreensão de textos em inglês", titulo: "Texto da questão de exemplo" },
  { frente: "eventually", verso: "por fim, no final das contas (falso cognato: não é 'eventualmente')", trecho: "The bank will eventually replace its old payment system", tipo: "vocabulario" as const, disciplina: "lingua_inglesa" as const, assunto: "Vocabulário de finanças e tecnologia em inglês", titulo: "Enunciado da questão de exemplo" },
  { frente: "Qual órgão formula a política da moeda e do crédito no SFN?", verso: "O Conselho Monetário Nacional (CMN), órgão normativo máximo do SFN.", trecho: "O CMN é o órgão normativo máximo do SFN e formula a política da moeda e do crédito.", tipo: "norma" as const, disciplina: "conhecimentos_bancarios" as const, assunto: "Estrutura do Sistema Financeiro Nacional", titulo: "Explicação da questão de exemplo" },
  { frente: "Quem regula e fiscaliza o mercado de valores mobiliários?", verso: "A CVM (Comissão de Valores Mobiliários).", trecho: "A CVM regula e fiscaliza o mercado de valores mobiliários", tipo: "norma" as const, disciplina: "conhecimentos_bancarios" as const, assunto: "Estrutura do Sistema Financeiro Nacional", titulo: "Explicação da questão de exemplo" },
].map(({ titulo, trecho, ...c }, i) => ({ ...c, id: `cartao-demo-${i + 1}`, fonte: { titulo, trecho }, novo: true }));
// confere no carregamento que os trechos de vocabulário são literais do texto de exemplo
if (import.meta.env.DEV) for (const c of CARTOES_DEMO) if (c.fonte!.titulo === "Texto da questão de exemplo" && !TEXTO_OPEN_BANKING.includes(c.fonte!.trecho)) console.warn(`cartão demo sem trecho literal: ${c.frente}`);

interface Estado {
  tentativas: TentativaBruta[];
  revisoes: Record<string, EstadoRevisao & { proxima: string; comTempo?: boolean }>;
  cartoes?: Record<string, EstadoRevisao & { proxima: string; desde: string }>;
  contestadas: string[];
  respostasCE?: { itemId: string; subtopico: string; resposta: "C" | "E" | null; acertou: boolean | null }[];
}
const vazio = (): Estado => ({ tentativas: [], revisoes: {}, contestadas: [] });

// Certo/Errado no demo: os itens saem das questões de exemplo pela mesma regra do servidor (a certa → C,
// as erradas → E); sem IA, a afirmação é o comando + a alternativa
const ITENS_CE = QUESTOES_DEMO.flatMap((q) =>
  derivarItens({ enunciado: q.enunciado, alternativas: q.alternativas.map((a) => ({ ...a, correta: a.letra === q.gabarito })) }).map((it) => ({
    id: `${q.id}-ce-${it.letraOrigem}`,
    q,
    afirmacao: `${q.enunciado.trim().replace(/[:?]$/, "")}: ${q.alternativas.find((a) => a.letra === it.letraOrigem)!.texto.trim()}`,
    gabarito: it.gabarito,
    explicacao: it.explicacao,
  }))
);
const historicoCEDemo = (e: Estado, sub: string) => {
  const rs = (e.respostasCE ?? []).filter((r) => r.subtopico === sub && r.resposta !== null);
  return { acertos: rs.filter((r) => r.acertou).length, total: rs.length };
};
// banca da lente; na aba Geral o Certo/Errado usa a Cebraspe (é o formato dela)
const bancaDemo = (): IdBanca => {
  const lente = lenteDemo();
  if (!lente) return "cebraspe";
  const j = CONCURSOS[lente] as { bancaPadrao: string; bancaReferencia?: string };
  return ((j.bancaPadrao === "a_definir" ? j.bancaReferencia : j.bancaPadrao) ?? "cesgranrio") as IdBanca;
};

function ler(): Estado {
  try {
    const bruto = localStorage.getItem(CHAVE);
    return bruto ? { ...vazio(), ...JSON.parse(bruto) } : vazio();
  } catch {
    return memoria;
  }
}
let memoria: Estado = vazio(); // fallback quando o navegador bloqueia o localStorage
function gravar(e: Estado) {
  memoria = e;
  try {
    localStorage.setItem(CHAVE, JSON.stringify(e));
  } catch {
    /* segue só em memória */
  }
}
export function zerarDemo() {
  gravar(vazio());
}

function paraDTO(q: QuestaoDemo): QuestaoDTO {
  return {
    id: q.id,
    topicoId: topicoDe(q),
    disciplina: q.disciplina,
    assunto: q.assunto,
    origem: "gerada",
    banca: "cesgranrio",
    formato: "multipla",
    textoBase: q.textoBase,
    enunciado: q.enunciado,
    alternativas: q.alternativas.map(({ letra, texto }) => ({ letra, texto })),
    dificuldade: q.dificuldade,
  };
}

function correcao(q: QuestaoDemo, resposta: Letra | null, xpGanho: number, dias: number): CorrecaoDTO {
  return {
    acertou: resposta === q.gabarito,
    gabarito: q.gabarito,
    alternativas: q.alternativas.map((a) => ({ ...a, correta: a.letra === q.gabarito })),
    explicacaoGeral: q.explicacaoGeral,
    dicaDeProva: q.dicaDeProva,
    fontes: q.fontes,
    traicoeira: !!q.traicoeira,
    xpGanho,
    proximaRevisaoDias: dias,
  };
}

function registrar(e: Estado, q: QuestaoDemo, acertou: boolean, nota: number, xp: number, modo: TentativaBruta["modo"], simuladoId?: string, confianca?: Confianca) {
  const agora = new Date();
  e.tentativas.push({ questaoId: q.id, topicoId: topicoDe(q), acertou, xp, modo, simuladoId, data: agora.toISOString(), confianca });
  const novo = agendar(e.revisoes[q.id] ?? ESTADO_INICIAL, nota);
  // acertou: sai do treino com tempo (igual ao servidor)
  const comTempo = acertou ? undefined : e.revisoes[q.id]?.comTempo;
  e.revisoes[q.id] = { ...novo, proxima: new Date(agora.getTime() + novo.intervaloDias * 86_400_000).toISOString(), comTempo };
  return novo.intervaloDias;
}

// Elo no demo: reprocessa o histórico (pequeno) com a mesma função do servidor
function ratingsDemo(e: Estado) {
  const ordenadas = [...e.tentativas].sort((a, b) => a.data.localeCompare(b.data));
  const eventos: EventoRating[] = [];
  ordenadas.forEach((t, i) => {
    const disciplina = t.topicoId.split(":")[0];
    eventos.push({ questaoId: t.questaoId, disciplina, acertou: t.acertou, confianca: t.modo === "simulado" ? 2 : t.confianca });
    // fim de um Raio-X: o resultado fixa o nível de cada disciplina medida (igual ao servidor)
    if (ehDiagnostico(t.simuladoId) && ordenadas[i + 1]?.simuladoId !== t.simuladoId) {
      const doDiag = ordenadas.filter((x) => x.simuladoId === t.simuladoId);
      for (const d of new Set(doDiag.map((x) => x.topicoId.split(":")[0]))) {
        const daDisc = doDiag.filter((x) => x.topicoId.startsWith(`${d}:`));
        eventos.push({ fixar: ratingDoDiagnostico(daDisc.filter((x) => x.acertou).length, daDisc.length), disciplina: d });
      }
    }
  });
  return reprocessar(eventos, (id) => porId.get(id)?.dificuldade ?? 3);
}

const espera = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 120));

const TEMA_REDACAO_DEMO: TemaRedacaoDTO = {
  id: "tema-demo",
  tema: "Tecnologia e inclusão no acesso a serviços financeiros",
  proposta: "Redija um texto dissertativo-argumentativo sobre os desafios de ampliar o acesso digital a serviços financeiros sem deixar grupos vulneráveis para trás.",
  textosMotivadores: [
    "A digitalização pode reduzir deslocamentos e facilitar o uso de serviços financeiros, mas depende de conexão, equipamentos e familiaridade com aplicativos.",
    "A inclusão exige canais acessíveis, proteção contra fraudes e atendimento que considere as diferentes realidades dos clientes.",
  ],
};

// subtópico da questão demo pela mesma classificação por código do servidor (sem IA no navegador)
const subDe = (q: QuestaoDemo) => {
  const c = classificarPorCodigo({ assunto: q.assunto, texto: `${q.textoBase ?? ""}\n${q.enunciado}` });
  return c.subtopico ?? ("candidatos" in c ? c.candidatos[0] : undefined) ?? "";
};
function tentativasTema(e: Estado): TentativaTema[] {
  return e.tentativas.flatMap((t) => {
    const q = porId.get(t.questaoId);
    return q ? [{ questaoId: t.questaoId, subtopico: subDe(q), acertou: t.acertou, data: t.data, simulado: t.modo === "simulado", origem: "gerada" as const }] : [];
  });
}
const aprovadasDemo = (e: Estado) => {
  const m = new Map<string, number>();
  for (const q of QUESTOES_DEMO) if (!e.contestadas.includes(q.id)) m.set(subDe(q), (m.get(subDe(q)) ?? 0) + 1);
  return m;
};
const discDoSubDemo = (s: string) => QUESTOES_DEMO.find((q) => subDe(q) === s)?.disciplina ?? null;
// v1.1 (item 3): temas que podem entrar em Revisões e Simulados (igual ao servidor)
const misturaDemo = (e: Estado) =>
  temasParaMistura(new Map(desempenhoPorTema(tentativasTema(e), aprovadasDemo(e), discDoSubDemo).map((d) => [d.subtopico, { respondidas: d.respondidas, recentes: d.recentes, aprovadas: d.aprovadas }])));

export const apiDemo: Api = {
  modo: "demo",

  topicos: () => espera(topicosAtivos()),

  concursos: () => espera(IDS_CONCURSO.map((id) => {
    const j = CONCURSOS[id] as { nome: string; cargo?: string; bancaPadrao: string; bancaReferencia?: string; areas?: { id: string; nome: string }[] };
    const aDefinir = j.bancaPadrao === "a_definir";
    const emUso = aDefinir ? j.bancaReferencia ?? "cebraspe" : j.bancaPadrao;
    return { id, nome: j.nome, cargo: j.cargo ?? null, banca: j.bancaPadrao, aDefinir, bancaEmUso: emUso, nomeBanca: (BANCAS as Record<string, { nome: string }>)[emUso]?.nome ?? emUso, areas: j.areas ?? [], area: j.areas?.[0]?.id ?? null };
  })),

  proximoItemCE: (f) => {
    const e = ler();
    const banca = bancaDemo();
    const nomeBanca = BANCAS[banca].nome;
    const ativos = ITENS_CE.filter((i) => questaoAtiva(i.q) && !e.contestadas.includes(i.q.id) && (!f.disciplina || i.q.disciplina === f.disciplina) && (!f.subtopico || subDe(i.q) === f.subtopico) && !f.excluir?.includes(i.id));
    const ja = new Set((e.respostasCE ?? []).map((r) => r.itemId));
    const pool = ativos.filter((i) => !ja.has(i.id));
    const it = (pool.length ? pool : ativos)[Math.floor(Math.random() * (pool.length || ativos.length))];
    if (!it) return espera({ item: null, recomendacao: null, banca, nomeBanca, aviso: "Sem itens Certo/Errado de exemplo aqui." });
    return espera({
      item: { id: it.id, topicoId: topicoDe(it.q), disciplina: it.q.disciplina, assunto: it.q.assunto, subtopico: subDe(it.q), afirmacao: it.afirmacao, ...(it.q.textoBase ? { textoBase: it.q.textoBase } : {}), origem: "derivada" as const },
      recomendacao: recomendarBranco(historicoCEDemo(e, subDe(it.q)), banca),
      banca,
      nomeBanca,
    });
  },

  responderItemCE: (r) => {
    const e = ler();
    const it = ITENS_CE.find((i) => i.id === r.itemId);
    if (!it) return Promise.reject(new Error("Item fora de circulação."));
    const banca = bancaDemo();
    const resposta = r.resposta === "C" || r.resposta === "E" ? r.resposta : null;
    const acertou = resposta === null ? null : resposta === it.gabarito;
    e.respostasCE = [...(e.respostasCE ?? []), { itemId: it.id, subtopico: subDe(it.q), resposta, acertou }];
    gravar(e);
    return espera({ gabarito: it.gabarito, acertou, pontos: corrigirCE([{ resposta, gabarito: it.gabarito }], banca).nota, explicacao: it.explicacao, recomendacao: recomendarBranco(historicoCEDemo(e, subDe(it.q)), banca) });
  },

  desempenhoTemas: () => {
    const e = ler();
    const lente = lenteDemo();
    return espera(desempenhoPorTema(tentativasTema(e), aprovadasDemo(e), discDoSubDemo).filter((d) => !lente || d.concursos.includes(lente)));
  },

  prontidao: () => {
    const e = ler();
    const dominio = new Map(desempenhoPorTema(tentativasTema(e), aprovadasDemo(e), discDoSubDemo).filter((d) => d.respondidas > 0).map((d) => [d.subtopico, d.dominio]));
    return espera(prontidaoDeTodos(dominio));
  },

  trilha: () => {
    const e = ler();
    const ts = tentativasTema(e);
    const ap = aprovadasDemo(e);
    const temas = TRILHA; // trilha única: a mesma em qualquer aba
    const hoje = diaLocal(new Date());
    let inicio: InicioTrilha | null = null;
    try { inicio = JSON.parse(localStorage.getItem(CHAVE_INICIO) ?? "null"); } catch { /* sem storage */ }
    const s = situacaoTrilha(diasDaTrilha(ts), hoje, temas, inicio);
    const estado = s.tema ? s.estados[s.tema.subtopico] : "novo";
    const feitas = s.tema ? diasDaTrilha(ts).find((d) => d.data === hoje && d.subtopico === s.tema!.subtopico) : undefined;
    const agora = Date.now();
    return espera({
      rodada: s.rodada, modo: s.modo, concluidos: s.concluidos, total: temas.length,
      filaRetomada: s.filaRetomada.map((x) => SUBTOPICO_POR_ID.get(x)?.nome ?? x),
      hoje: s.tema ? {
        n: s.tema.n, subtopico: s.tema.subtopico, nome: s.tema.nome, disciplina: discDoSubDemo(s.tema.subtopico), estado, refazer: s.refazer,
        diaNoTema: s.diasNoTema + 1, aprovadas: ap.get(s.tema.subtopico) ?? 0, novasFeitasHoje: feitas?.novas ?? 0, acertosHoje: feitas?.acertos ?? 0,
        tamanho: tamanhoSessao(estado), mistas: MISTAS_FIM,
      } : null,
      revisoesVencidas: Object.values(e.revisoes).filter((r) => new Date(r.proxima).getTime() <= agora).length,
      temas: temas.map((t) => ({ n: t.n, subtopico: t.subtopico, nome: t.nome, estado: s.estados[t.subtopico], acerto: s.acerto[t.subtopico] ?? null, aprovadas: ap.get(t.subtopico) ?? 0 })),
    });
  },

  tema: (subtopico) => {
    const s = SUBTOPICO_POR_ID.get(subtopico);
    if (!s) return espera(null);
    const e = ler();
    const qs = QUESTOES_DEMO.filter((q) => subDe(q) === subtopico && !e.contestadas.includes(q.id));
    const vistas = new Set(e.tentativas.map((t) => t.questaoId));
    const erradas = new Set(e.tentativas.filter((t) => !t.acertou).map((t) => t.questaoId));
    const t = TRILHA.find((x) => x.subtopico === subtopico);
    return espera({
      subtopico, nome: s.nome, n: t?.n ?? null, disciplina: discDoSubDemo(subtopico),
      topicoIds: TOPICOS.filter((x) => s.topicos.includes(x.assunto)).map((x) => x.id),
      concursos: s.concursos, aprovadas: qs.length, poucas: qs.length < MINIMO_NOVAS,
      estudo: { tempoMin: 45, objetivo: null, pontos: [], lei: null, ficha: null, materiais: [], youtube: linkYoutube(s.nome, lenteDemo() ?? s.concursos[0] ?? "bb"), oficiaisNoAcervo: [] },
      pratica: { novas: qs.filter((q) => !vistas.has(q.id)).length, revisoes: 0, erradas: qs.filter((q) => erradas.has(q.id)).length, oficiais: 0, geradas: qs.length, derivadas: 0, cursinho: 0 },
    });
  },

  pedirPrioridadeTema: () => espera(undefined),

  definirTemaDoDia: (subtopico) => {
    // grava o subtópico: a ordem da trilha única pode mudar
    if (TRILHA.some((x) => x.subtopico === subtopico)) try { localStorage.setItem(CHAVE_INICIO, JSON.stringify({ subtopico, desde: diaLocal(new Date()) })); } catch { /* sem storage: fica no tema 1 */ }
    return espera(undefined);
  },

  // v1.1: tema escolhido à mão; no demo fica no navegador
  estudando: () => {
    let s = "";
    try { s = localStorage.getItem(CHAVE_ESTUDANDO) ?? ""; } catch { /* sem storage: segue a Grade */ }
    return espera(TRILHA.some((x) => x.subtopico === s) ? s : "");
  },
  definirEstudando: (subtopico) => {
    if (subtopico && !TRILHA.some((x) => x.subtopico === subtopico)) return Promise.reject(new Error("Esse tema não está na trilha."));
    try { localStorage.setItem(CHAVE_ESTUDANDO, subtopico); } catch { /* sem storage */ }
    return espera(undefined);
  },

  // no demo o resumo é recalculado das tentativas (mesma função do servidor)
  simulados: () => {
    const e = ler();
    const ids = [...new Set(e.tentativas.filter((t) => t.modo === "simulado" && t.simuladoId).map((t) => t.simuladoId!))];
    return espera(ids.map((id) => {
      const ts = e.tentativas.filter((t) => t.simuladoId === id).sort((a, b) => a.data.localeCompare(b.data));
      const itens = ts.flatMap((t) => {
        const q = porId.get(t.questaoId);
        return q ? [{ disciplina: q.disciplina, subtopico: subDe(q), acertou: t.acertou, branco: t.resposta === null, tempoSeg: t.tempoSeg ?? 0 }] : [];
      });
      return resumirSimulado({ id, data: ts[0].data, concurso: "bb", banca: "cesgranrio", diagnostico: ehDiagnostico(id) }, itens);
    }).filter((s) => { const lente = lenteDemo(); return !lente || s.concurso === lente; })); // lente: só os do concurso
  },

  painel: () => {
    const e = ler();
    // revisões só do concurso ativo; XP e sequência somam tudo (as tentativas vão inteiras)
    const revisoesAtivas = Object.entries(e.revisoes).filter(([id]) => { const q = porId.get(id); return !q || questaoAtiva(q); }).map(([, r]) => r.proxima);
    const painel = calcularPainel({ topicos: topicosAtivos(), tentativas: e.tentativas, revisoes: revisoesAtivas });
    // cartão "Banco de questões" com a mesma regra do servidor (no demo nada entra de noite)
    const banco = calcularBanco(
      QUESTOES_DEMO.filter((q) => !e.contestadas.includes(q.id)).map((q) => ({ id: q.id, disciplina: q.disciplina, gerada: false, criadaEm: "2026-01-01T00:00:00Z" })),
      new Set(e.tentativas.map((t) => t.questaoId))
    );
    const niveis = [...ratingsDemo(e).alunos].map(([d, a]) => ({ disciplina: d as Disciplina, rating: Math.round(a.rating), n: a.n }));
    return espera({ ...painel, banco, niveis });
  },

  async proxima(f) {
    const e = ler();
    const ativas = QUESTOES_DEMO.filter((q) => !e.contestadas.includes(q.id) && questaoAtiva(q));

    if (f.questaoId) {
      const q = porId.get(f.questaoId);
      return espera({ questao: q ? paraDTO(q) : null, modo: "treino" as const });
    }

    // v1.1: revisão dentro do tema = só as vencidas daquele tema (igual ao servidor)
    if (f.subtopico && f.revisao) {
      const agora = Date.now();
      const q = ativas.find((x) => subDe(x) === f.subtopico && !(f.excluir ?? []).includes(x.id) && e.revisoes[x.id] && new Date(e.revisoes[x.id].proxima).getTime() <= agora);
      return espera(q ? { questao: paraDTO(q), modo: "revisao" as const } : { questao: null, modo: "revisao" as const, aviso: "Nenhuma revisão vencida neste tema." });
    }
    // v1.1 (item 3): revisão dos erros do tema (última resposta errada), igual ao servidor
    if (f.subtopico && f.erros) {
      const doTema = new Set(ativas.filter((q) => subDe(q) === f.subtopico).map((q) => q.id));
      const id = errosDoTema(e.tentativas.filter((t) => doTema.has(t.questaoId))).find((x) => !(f.excluir ?? []).includes(x));
      const q = id ? porId.get(id) : undefined;
      return espera(q ? { questao: paraDTO(q), modo: "treino" as const } : { questao: null, modo: "treino" as const, aviso: "Nenhum erro para revisar neste tema." });
    }
    // praticar por tema: só o subtópico, novas primeiro, por subtema e fácil → difícil (igual ao servidor)
    if (f.subtopico) {
      // as questões de exemplo são todas no estilo Cesgranrio
      const doTema = ativas.filter((q) => subDe(q) === f.subtopico && !(f.excluir ?? []).includes(q.id) && (!f.banca || f.banca === "cesgranrio"));
      const vistas = new Set(e.tentativas.map((t) => t.questaoId));
      const subtemas = subtemasDoTema(f.subtopico, topicosAtivos(), TRILHA.map((t) => t.subtopico));
      const [primeira] = ordenarParaEstudo(doTema.filter((q) => !vistas.has(q.id)).map((q) => ({
        q, dificuldade: q.dificuldade, origem: "gerada", subtema: subtemaDaQuestao([q.enunciado, ...q.alternativas.map((a) => a.texto)].join(" "), subtemas),
      })));
      const nova = primeira?.q;
      const q = nova ?? doTema[0];
      if (!q) return espera({ questao: null, modo: "treino" as const, aviso: "Este tema ainda não tem questões no modo demo." });
      const subtema = primeira && primeira.subtema >= 0 ? subtemas[primeira.subtema] : undefined;
      return espera({ questao: { ...paraDTO(q), ...(subtema ? { subtema } : {}) }, modo: "treino" as const, aviso: nova ? undefined : "Acabaram as novas deste tema; repetindo uma.", repetida: !nova });
    }

    // treino misturado (mesma regra do servidor)
    if (f.misto && !f.topicoId) {
      const d = sortearDisciplinaMista([...new Set(ativas.map((q) => q.disciplina))], f.anterior);
      if (d) f = { ...f, disciplina: d };
    }

    // 1. revisões vencidas (no modo geral ou quando pedidas)
    const semFiltro = !f.topicoId && !f.disciplina;
    if (f.revisao || semFiltro) {
      const agora = Date.now();
      const mistura = misturaDemo(e); // só temas concluídos (ou em andamento, se nenhum concluído)
      const vencidas = ativas
        .filter((q) => e.revisoes[q.id] && new Date(e.revisoes[q.id].proxima).getTime() <= agora && (!mistura || mistura.has(subDe(q))))
        .sort((a, b) => e.revisoes[a.id].proxima.localeCompare(e.revisoes[b.id].proxima));
      if (vencidas.length) {
        const dto = paraDTO(vencidas[0]);
        return espera({ questao: e.revisoes[dto.id].comTempo ? { ...dto, tempoAlvoSeg: TEMPO_ALVO_SEG } : dto, modo: "revisao" as const });
      }
      if (f.revisao) return espera({ questao: null, modo: "revisao" as const, aviso: "Nenhuma revisão vencida agora. Volte amanhã ou pratique um tópico novo." });
    }

    // 2. tópico ponderado (peso × fraqueza) entre os que têm questões
    const candidatas = ativas.filter(
      (q) => (!f.topicoId || topicoDe(q) === f.topicoId) && (!f.disciplina || q.disciplina === f.disciplina)
    );
    if (!candidatas.length)
      return espera({
        questao: null,
        modo: "treino" as const,
        aviso: "O modo demo ainda não tem questões de exemplo deste tópico. Com o servidor ligado, o banco ganha questões dele toda noite.",
      });

    const respondidas = new Set(e.tentativas.map((t) => t.questaoId));
    const naoVistas = candidatas.filter((q) => !respondidas.has(q.id));
    const pool = naoVistas.length ? naoVistas : candidatas;
    const stats = (tid: string) => {
      const ts = e.tentativas.filter((t) => t.topicoId === tid);
      return [ts.length, ts.filter((t) => t.acertou).length] as const;
    };
    const topicosPool = [...new Set(pool.map(topicoDe))];
    const naoSabia = naoSabiaPorTopico(e.tentativas);
    const tid = sortearPonderado(topicosPool, (id) => {
      const tp = TOPICOS.find((t) => t.id === id);
      const [n, a] = stats(id);
      return prioridade(tp?.peso ?? null, n, a) * fatorNaoSabia(naoSabia.get(id) ?? 0);
    })!;
    const daqui = pool.filter((q) => topicoDe(q) === tid);
    // no seu nível (Elo): mais chance para rating perto do seu + 50
    const r = ratingsDemo(e);
    const meu = r.alunos.get(tid.split(":")[0])?.rating ?? RATING_ALUNO_INICIAL;
    const q = sortearPonderado(daqui, (x) => pesoPorProximidade(r.questoes.get(x.id)?.rating ?? ratingInicialQuestao(x.dificuldade), meu + ALVO_ACIMA))!;
    return espera({
      questao: paraDTO(q),
      modo: "treino" as const,
      aviso: naoVistas.length ? undefined : "Você já viu todas as questões de exemplo deste filtro; repetindo as que valem mais. No modo servidor, sempre há questão nova.",
    });
  },

  async responder(r) {
    const e = ler();
    const q = porId.get(r.questaoId);
    if (!q) throw new Error("Questão não encontrada");
    const acertou = r.resposta === q.gabarito;
    const xp = xpDaTentativa({ acertou, dificuldade: q.dificuldade, confianca: r.confianca, modo: r.modo });
    const dias = registrar(e, q, acertou, notaSM2(acertou, r.confianca), xp, r.modo, undefined, r.confianca);
    Object.assign(e.tentativas[e.tentativas.length - 1], { resposta: r.resposta, tempoSeg: r.tempoSeg });
    gravar(e);
    return espera(correcao(q, r.resposta, xp, dias));
  },

  aula(topicoId) {
    return espera(AULAS_DEMO[topicoId] ?? null);
  },
  explicarMais() {
    return espera({ requerServidor: true, mensagem: "O tutor precisa do servidor. No demo, use a explicação da questão." });
  },
  perguntarBinho() {
    return espera({ requerServidor: true, mensagem: "No modo demo o Binho não responde perguntas. Com o servidor ligado, ele responde por tópico." });
  },

  async cartoes() {
    const e = ler();
    const estado = e.cartoes ?? {};
    const agora = Date.now();
    const hoje = new Date().toDateString();
    const vistosHoje = Object.values(estado).filter((r) => new Date(r.desde).toDateString() === hoje).length;
    const novosRestantesHoje = Math.max(0, 20 - vistosHoje);
    const devidos = CARTOES_DEMO.filter((c) => estado[c.id] && new Date(estado[c.id].proxima).getTime() <= agora).map((c) => ({ ...c, novo: false }));
    const novos = CARTOES_DEMO.filter((c) => !estado[c.id]).slice(0, novosRestantesHoje);
    return espera({ cartoes: [...devidos, ...novos], vencidos: devidos.length, novosRestantesHoje, total: CARTOES_DEMO.length });
  },

  async avaliarCartao(id, nota) {
    const e = ler();
    e.cartoes ??= {};
    const atual = e.cartoes[id];
    const novo = agendar(atual ?? ESTADO_INICIAL, nota);
    const proxima = nota === 1 ? Date.now() + 10 * 60_000 : Date.now() + novo.intervaloDias * 86_400_000;
    e.cartoes[id] = { ...novo, proxima: new Date(proxima).toISOString(), desde: atual?.desde ?? new Date().toISOString() };
    gravar(e);
    return espera({ proximaRevisaoDias: nota === 1 ? 0 : novo.intervaloDias });
  },

  // Diagnóstico do erro (mesma regra do servidor); no demo a resposta marcada sai das tentativas
  async motivoErro(questaoId, motivo) {
    const e = ler();
    const q = porId.get(questaoId);
    const t = [...e.tentativas].reverse().find((x) => x.questaoId === questaoId && !x.acertou && x.modo !== "simulado");
    if (!q || !t) throw new Error("Não achei um erro recente nessa questão.");
    t.motivoErro = motivo;
    const acao: AcaoMotivoDTO = { motivo, mensagem: MENSAGEM_MOTIVO[motivo], topicoId: topicoDe(q) };
    const rev = e.revisoes[questaoId];
    if (motivo === "chutei" && rev) {
      rev.proxima = new Date(Date.now() + REVISAO_CHUTE_MIN * 60_000).toISOString();
      acao.revisaoEmMin = REVISAO_CHUTE_MIN;
    } else if (motivo === "desatencao") {
      if (rev) rev.comTempo = true;
      const certa = q.alternativas.find((a) => a.letra === q.gabarito)?.texto ?? "";
      const marcada = q.alternativas.find((a) => a.letra === t.resposta)?.texto ?? "";
      acao.palavrasChave = palavrasDecisivas(certa, marcada);
    } else if (motivo === "confundi") {
      const vistas = new Set(e.tentativas.map((x) => x.questaoId));
      const irmas = QUESTOES_DEMO.filter((x) => x.id !== questaoId && topicoDe(x) === topicoDe(q) && !e.contestadas.includes(x.id));
      const par = irmas.find((x) => !vistas.has(x.id)) ?? irmas[0];
      if (par) acao.proximaQuestaoId = par.id;
      else acao.mensagem = "Anotado. Ainda não há outra questão desse tópico para comparar; ela volta na revisão.";
    }
    gravar(e);
    return espera(acao);
  },

  // sem oficiais no demo: mistura estimada (20/50/30), igual à regra do servidor
  misturaSimulado: () => espera(MISTURA_SIMULADO),

  async simulado(n, opcoes) {
    const e = ler();
    // v1.1: "Prova completa" (padrão) sem restrição; "Só o que estudei" = temas concluídos (ou em andamento);
    // o Raio-X (diagnóstico) olha tudo (igual ao servidor)
    const mistura = !opcoes?.diagnostico && opcoes?.modo === "estudado" ? misturaDemo(e) : null;
    const ativas = QUESTOES_DEMO.filter((q) => !e.contestadas.includes(q.id) && questaoAtiva(q) && (!mistura || mistura.has(subDe(q))));
    const comQuestao = TOPICOS.filter((t) => ativas.some((q) => topicoDe(q) === t.id));
    const cotas = cotasPorDisciplina(Math.min(n, ativas.length), comQuestao);
    const mistura = opcoes?.diagnostico ? MISTURA_DIAGNOSTICO : MISTURA_SIMULADO;
    const escolhidas: QuestaoDemo[] = [];
    for (const [d, k] of cotas) {
      const daDisc = ativas.filter((q) => q.disciplina === d).sort(() => Math.random() - 0.5);
      const pegas: QuestaoDemo[] = [];
      for (const [faixa, q] of cotasPorFaixa(k, mistura)) pegas.push(...daDisc.filter((x) => faixaDe(x.dificuldade) === faixa).slice(0, q));
      pegas.push(...daDisc.filter((x) => !pegas.includes(x)).slice(0, k - pegas.length));
      escolhidas.push(...pegas);
    }
    // completa só com disciplinas da prova (igual ao servidor)
    const resto = ativas.filter((q) => !escolhidas.includes(q) && (COTAS_PROVA[q.disciplina] ?? 0) > 0).sort(() => Math.random() - 0.5);
    while (escolhidas.length < Math.min(n, ativas.length) && resto.length) escolhidas.push(resto.pop()!);
    return espera(escolhidas.map(paraDTO));
  },

  async corrigirSimulado(respostas, opcoes) {
    const e = ler();
    const simuladoId = `${opcoes?.diagnostico ? PREFIXO_DIAGNOSTICO : "sim-"}${Date.now()}`;
    let acertos = 0;
    let xpTotal = 0;
    const porDisc = new Map<Disciplina, { total: number; acertos: number }>();
    const correcoes = respostas.map((r) => {
      const q = porId.get(r.questaoId)!;
      const acertou = r.resposta === q.gabarito;
      const xp = xpDaTentativa({ acertou, dificuldade: q.dificuldade, confianca: 2, modo: "simulado" });
      const dias = registrar(e, q, acertou, notaSM2(acertou, 2), xp, "simulado", simuladoId);
      e.tentativas[e.tentativas.length - 1].tempoSeg = r.tempoSeg;
      e.tentativas[e.tentativas.length - 1].resposta = r.resposta; // null = em branco (evolução dos simulados)
      if (acertou) acertos++;
      xpTotal += xp;
      const d = porDisc.get(q.disciplina) ?? { total: 0, acertos: 0 };
      d.total++;
      if (acertou) d.acertos++;
      porDisc.set(q.disciplina, d);
      return { ...correcao(q, r.resposta, xp, dias), questaoId: q.id, enunciado: q.enunciado, resposta: r.resposta };
    });
    gravar(e);
    return espera({
      simuladoId,
      total: respostas.length,
      acertos,
      xpGanho: xpTotal,
      porDisciplina: [...porDisc].map(([disciplina, v]) => ({ disciplina, ...v })),
      correcoes,
    });
  },

  async erros() {
    const e = ler();
    const porQ = new Map<string, TentativaBruta[]>();
    for (const t of e.tentativas) porQ.set(t.questaoId, [...(porQ.get(t.questaoId) ?? []), t]);
    const lista = [...porQ]
      .filter(([id, ts]) => !ts[ts.length - 1].acertou && !!porId.get(id) && questaoAtiva(porId.get(id)!))
      .map(([id, ts]) => {
        const q = porId.get(id)!;
        return {
          questaoId: id,
          disciplina: q.disciplina,
          assunto: q.assunto,
          enunciado: q.enunciado,
          explicacao: q.explicacaoGeral,
          vezesErrada: ts.filter((t) => !t.acertou).length,
          ultimaData: ts[ts.length - 1].data,
        };
      })
      .sort((a, b) => b.ultimaData.localeCompare(a.ultimaData));
    return espera(lista);
  },

  async contestar(questaoId: string, _motivo: MotivoContestacao) {
    const e = ler();
    if (!e.contestadas.includes(questaoId)) e.contestadas.push(questaoId);
    gravar(e);
    return espera(undefined);
  },

  temasRedacao: () => espera([TEMA_REDACAO_DEMO]),
  pedirTemaRedacao: () => espera({ status: "demo" as const }),
  async corrigirRedacao(_r): Promise<RedacaoDTO> {
    throw new Error("A correção de redação precisa do servidor. Seu rascunho continua salvo neste navegador.");
  },
  redacoes: () => espera([] as RedacaoDTO[]),
  marcarRedacoesVistas: async () => espera(undefined),

  // Espaço da Lo no demo: mesmas regras (shared/espacoLo.ts); conteúdo = aulas e pontos do demo; posição no aparelho
  espacoLo: async () => {
    const t = await apiDemo.trilha();
    const est = lerEspacoLo();
    const itens = TRILHA.flatMap((x) => {
      const s = SUBTOPICO_POR_ID.get(x.subtopico);
      if (!s) return [];
      const aulas = TOPICOS.filter((tp) => s.topicos.includes(tp.assunto)).map((tp) => AULAS_DEMO[tp.id]).filter((a) => !!a);
      const c = CONTEUDO_TEMAS[x.subtopico] ?? {};
      return itensDoTema({
        subtopico: x.subtopico, nome: s.nome, disciplina: discDoSubDemo(x.subtopico),
        ficha: c.ficha ? [c.ficha.texto] : null,
        aulas: aulas.map((a) => ({ topicoId: a.topicoId, assunto: a.assunto, texto: textoDaAula(a) })),
        pontos: c.pontos?.length ? c.pontos : aulas.flatMap((a) => a.pontosChave),
      });
    }).map((i) => ({ ...i, posicao: est.audios[i.id] ?? null }));
    const hoje = t.hoje;
    const playlist = hoje ? itens.filter((i) => i.subtopico === hoje.subtopico) : [];
    const selosAgora = Object.fromEntries(t.temas.map((x) => [x.subtopico, x.estado])) as Record<string, EstadoTema>;
    const visita = rolarVisita(est.visita, selosAgora);
    gravarEspacoLo({ ...est, visita });
    return {
      seuDia: resumirDia({
        modo: t.modo, tema: hoje ? { nome: hoje.nome, novas: Math.max(0, hoje.tamanho - hoje.novasFeitasHoje) } : null,
        fichaPronta: playlist.some((i) => i.tipo === "ficha"), aulaPronta: playlist.some((i) => i.tipo === "aula"), audioPronto: false,
        revisoesVencidas: t.revisoesVencidas, janelas: [], inicioJanelaB: "18:00", demo: true,
      }),
      temaDoDia: hoje ? { subtopico: hoje.subtopico, nome: hoje.nome } : null,
      playlist,
      biblioteca: unicos(itens), // no demo tudo sai na hora, com a voz do navegador
      recados: montarRecados({
        visita, selosAgora, nomes: Object.fromEntries(t.temas.map((x) => [x.subtopico, x.nome])),
        temasDoAluno: [...t.temas.filter((x) => x.estado !== "novo").map((x) => x.subtopico), ...(hoje ? [hoje.subtopico] : [])],
        conflitos: [], novidades: [],
      }),
    };
  },
  salvarPosicaoAudio: async (id, p) => {
    const est = lerEspacoLo();
    const nova = registrarPosicao(est.audios[id] ?? null, p);
    gravarEspacoLo({ ...est, audios: { ...est.audios, [id]: nova } });
    return nova;
  },
};
