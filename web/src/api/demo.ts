// ============================================================
// API do MODO DEMO — roda 100% no navegador, guarda o progresso no localStorage.
// Usa o mesmo motor (shared/motor.ts) que o servidor.
// ============================================================
import topicosJson from "../../../data/topicos.json";
import {
  DISCIPLINAS,
  type AcaoMotivoDTO,
  type Api,
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
import { pesoDoTopico, misturaDasOficiais, cotasPorFaixa, faixaDe, sortearDisciplinaMista } from "../../../shared/estruturaProva";
import { fatorNaoSabia, naoSabiaPorTopico, palavrasDecisivas, MENSAGEM_MOTIVO, REVISAO_CHUTE_MIN, TEMPO_ALVO_SEG } from "../../../shared/aprendizado";

const CHAVE = "lobo-demo-v1";
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

interface Estado {
  tentativas: TentativaBruta[];
  revisoes: Record<string, EstadoRevisao & { proxima: string; comTempo?: boolean }>;
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

export const apiDemo: Api = {
  modo: "demo",

  topicos: () => espera(TOPICOS),

  painel: () => {
    const e = ler();
    const painel = calcularPainel({ topicos: TOPICOS, tentativas: e.tentativas, revisoes: Object.values(e.revisoes).map((r) => r.proxima) });
    // cartão "Banco de questões" com a mesma regra do servidor (no demo nada entra de noite)
    const banco = calcularBanco(
      QUESTOES_DEMO.filter((q) => !e.contestadas.includes(q.id)).map((q) => ({ id: q.id, disciplina: q.disciplina, gerada: false, criadaEm: "2026-01-01T00:00:00Z" })),
      new Set(e.tentativas.map((t) => t.questaoId))
    );
    return espera({ ...painel, banco });
  },

  async proxima(f) {
    const e = ler();
    const ativas = QUESTOES_DEMO.filter((q) => !e.contestadas.includes(q.id));

    if (f.questaoId) {
      const q = porId.get(f.questaoId);
      return espera({ questao: q ? paraDTO(q) : null, modo: "treino" as const });
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
    const q = daqui[Math.floor(Math.random() * daqui.length)];
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
    e.tentativas[e.tentativas.length - 1].resposta = r.resposta;
    gravar(e);
    return espera(correcao(q, r.resposta, xp, dias));
  },

  aula(topicoId) {
    return espera(AULAS_DEMO[topicoId] ?? null);
  },
  explicarMais() {
    return espera({ requerServidor: true, mensagem: "O tutor precisa do servidor. No demo, use a explicação da questão." });
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
  misturaSimulado: () => espera(misturaDasOficiais([])),

  async simulado(n) {
    const e = ler();
    const ativas = QUESTOES_DEMO.filter((q) => !e.contestadas.includes(q.id));
    const comQuestao = TOPICOS.filter((t) => ativas.some((q) => topicoDe(q) === t.id));
    const cotas = cotasPorDisciplina(Math.min(n, ativas.length), comQuestao);
    const mistura = misturaDasOficiais([]);
    const escolhidas: QuestaoDemo[] = [];
    for (const [d, k] of cotas) {
      const daDisc = ativas.filter((q) => q.disciplina === d).sort(() => Math.random() - 0.5);
      const pegas: QuestaoDemo[] = [];
      for (const [faixa, q] of cotasPorFaixa(k, mistura)) pegas.push(...daDisc.filter((x) => faixaDe(x.dificuldade) === faixa).slice(0, q));
      pegas.push(...daDisc.filter((x) => !pegas.includes(x)).slice(0, k - pegas.length));
      escolhidas.push(...pegas);
    }
    const resto = ativas.filter((q) => !escolhidas.includes(q)).sort(() => Math.random() - 0.5);
    while (escolhidas.length < Math.min(n, ativas.length) && resto.length) escolhidas.push(resto.pop()!);
    return espera(escolhidas.map(paraDTO));
  },

  async corrigirSimulado(respostas) {
    const e = ler();
    const simuladoId = `sim-${Date.now()}`;
    let acertos = 0;
    let xpTotal = 0;
    const porDisc = new Map<Disciplina, { total: number; acertos: number }>();
    const correcoes = respostas.map((r) => {
      const q = porId.get(r.questaoId)!;
      const acertou = r.resposta === q.gabarito;
      const xp = xpDaTentativa({ acertou, dificuldade: q.dificuldade, confianca: 2, modo: "simulado" });
      const dias = registrar(e, q, acertou, notaSM2(acertou, 2), xp, "simulado", simuladoId);
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
      .filter(([, ts]) => !ts[ts.length - 1].acertou)
      .map(([id, ts]) => {
        const q = porId.get(id)!;
        return {
          questaoId: id,
          disciplina: q.disciplina,
          assunto: q.assunto,
          enunciado: q.enunciado,
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
