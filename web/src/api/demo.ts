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
import { BANCAS, CONCURSOS } from "../../../shared/concursos";
import { concursoAtivo } from "../concursoAtivo";
import { concursosDoTema, linkYoutube, MINIMO_NOVAS, MISTAS_FIM, situacaoTrilha, tamanhoSessao, TRILHA, type InicioTrilha } from "../../../shared/trilha";
import { desempenhoPorTema, diaLocal, diasDaTrilha, type TentativaTema } from "../../../shared/desempenhoTema";
import { resumirSimulado } from "../../../shared/simulados";

const CHAVE = "lobo-demo-v1";
const CHAVE_INICIO = "lobo-demo-trilha-inicio";
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
// F5: só os tópicos do concurso ativo (igual ao servidor; tópico sem subtópico mapeado = BB)
const doConcurso = (assunto: string) => {
  const c = concursosDoTopico(assunto);
  return c.length ? c.includes(concursoAtivo()) : concursoAtivo() === "bb";
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
}
const vazio = (): Estado => ({ tentativas: [], revisoes: {}, contestadas: [] });

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

export const apiDemo: Api = {
  modo: "demo",

  topicos: () => espera(topicosAtivos()),

  concursos: () => espera((["bb", "bacen"] as const).map((id) => {
    const j = CONCURSOS[id] as { nome: string; cargo?: string; bancaPadrao: string; bancaReferencia?: string; areas?: { id: string; nome: string }[] };
    const aDefinir = j.bancaPadrao === "a_definir";
    const emUso = aDefinir ? j.bancaReferencia ?? "cebraspe" : j.bancaPadrao;
    return { id, nome: j.nome, cargo: j.cargo ?? null, banca: j.bancaPadrao, aDefinir, bancaEmUso: emUso, nomeBanca: (BANCAS as Record<string, { nome: string }>)[emUso]?.nome ?? emUso, areas: j.areas ?? [], area: j.areas?.[0]?.id ?? null };
  })),

  desempenhoTemas: () => {
    const e = ler();
    return espera(desempenhoPorTema(tentativasTema(e), aprovadasDemo(e), discDoSubDemo).filter((d) => d.concursos.includes(concursoAtivo())));
  },

  trilha: () => {
    const e = ler();
    const ts = tentativasTema(e);
    const ap = aprovadasDemo(e);
    const temas = TRILHA.filter((t) => concursosDoTema(t).includes(concursoAtivo()));
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
      estudo: { tempoMin: 45, objetivo: null, pontos: [], lei: null, ficha: null, materiais: [], youtube: linkYoutube(s.nome, concursoAtivo()), oficiaisNoAcervo: [] },
      pratica: { novas: qs.filter((q) => !vistas.has(q.id)).length, revisoes: 0, erradas: qs.filter((q) => erradas.has(q.id)).length, oficiais: 0, geradas: qs.length, derivadas: 0, cursinho: 0 },
    });
  },

  pedirPrioridadeTema: () => espera(undefined),

  definirTemaDoDia: (subtopico) => {
    const t = TRILHA.find((x) => x.subtopico === subtopico);
    if (t) try { localStorage.setItem(CHAVE_INICIO, JSON.stringify({ n: t.n, desde: diaLocal(new Date()) })); } catch { /* sem storage: fica no tema 1 */ }
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
    }));
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

    // praticar por tema: só o subtópico, novas primeiro (igual ao servidor)
    if (f.subtopico) {
      const doTema = ativas.filter((q) => subDe(q) === f.subtopico && !(f.excluir ?? []).includes(q.id));
      const vistas = new Set(e.tentativas.map((t) => t.questaoId));
      const nova = doTema.find((q) => !vistas.has(q.id));
      const q = nova ?? doTema[0];
      if (!q) return espera({ questao: null, modo: "treino" as const, aviso: "Este tema ainda não tem questões no modo demo." });
      return espera({ questao: paraDTO(q), modo: "treino" as const, aviso: nova ? undefined : "Acabaram as novas deste tema; repetindo uma.", repetida: !nova });
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
      const vencidas = ativas
        .filter((q) => e.revisoes[q.id] && new Date(e.revisoes[q.id].proxima).getTime() <= agora)
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
    const ativas = QUESTOES_DEMO.filter((q) => !e.contestadas.includes(q.id) && questaoAtiva(q));
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
};
