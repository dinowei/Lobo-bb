// ============================================================
// BB Estudos — Português por construção, além da Crase (regra 14: explicações vêm do banco de regras)
// Concordância, Regência e Pontuação no mesmo molde da Crase: o CÓDIGO sorteia 1 regra de
// uso CORRETO e 4 regras de ERRO diferentes e a letra do gabarito; a IA (escritor de Português)
// só escreve as frases e aponta o trecho; a trava de posição confere o trecho; explicação,
// pegadinha, correção e explicação geral vêm deste banco (regra 14). Nada facultativo: cada
// regra tem UM uso correto, e construções com duas formas aceitas são proibidas nas frases.
// ============================================================
import type { Letra } from "../shared/tipos.js";
import {
  REGRAS_CRASE,
  construirCrase,
  conferirFrase as conferirCrase,
  explicarAlternativa as explicarCrase,
  explicacaoGeralCrase,
  DICA_CRASE,
  ESTRUTURA_CRASE_PADRAO,
  type HistoricoCrase,
} from "./portugues.js";
import { CRASE_ESCRITOR_SYSTEM, AUDITOR_FRASE_SYSTEM } from "./prompts.js";
import { carregarVariacoes } from "./variacao.js";

export type RegraPT = {
  id: string;
  nome: string;
  explicacao: string; // é o que o aluno lê na explicação da alternativa
  correta: boolean;
  instrucao: string; // como a IA deve escrever a frase ("Trecho = ...")
  trecho: RegExp; // forma exata do trecho (trava de posição)
  pegadinha?: string;
  corrigir?: (trecho: string) => string;
  exemplo?: { frase: string; trecho: string }; // referência (e teste) da regra
};
export type FraseMontadaPT = { letra: Letra; regra: RegraPT };
export type MontagemPT = { gabarito: Letra; frases: FraseMontadaPT[]; enunciado: string; dificuldade: number };

export interface AreaPT {
  tipo: string; // tipo da variação (data/variacoes.json)
  regras: RegraPT[];
  escritorSystem: string;
  juizSystem: string;
  construir: (gabarito: Letra, contexto: string, historico: HistoricoCrase) => MontagemPT;
  conferir: (frase: string, trecho: string, regra: RegraPT) => string | null;
  explicar: (regra: RegraPT, trecho: string, frase?: string) => { explicacao: string; pegadinha: string | null };
  explicacaoGeral: (certa: RegraPT) => string;
  dica: string;
}

// ---------- montagem e conferência genéricas ----------
const embaralhar = <T>(xs: readonly T[]): T[] => xs.map((x) => [Math.random(), x] as const).sort((a, b) => a[0] - b[0]).map(([, x]) => x);
const norm = (t: string) => t.replace(/[\s ]+/g, " ").trim();

function menosUsadas(regras: RegraPT[], n: number, h: HistoricoCrase): RegraPT[] {
  const livres = regras.filter((r) => !h.anterior.has(r.id));
  const pool = livres.length >= n ? livres : regras;
  return embaralhar(pool).sort((a, b) => (h.uso.get(a.id) ?? 0) - (h.uso.get(b.id) ?? 0)).slice(0, n);
}

function construirPorRegras(regras: RegraPT[], gabarito: Letra, enunciado: string, h: HistoricoCrase): MontagemPT {
  const [certa] = menosUsadas(regras.filter((r) => r.correta), 1, h);
  const erros = embaralhar(menosUsadas(regras.filter((r) => !r.correta), 4, h));
  const frases = (["A", "B", "C", "D", "E"] as Letra[]).map((letra) => ({ letra, regra: letra === gabarito ? certa : erros.shift()! }));
  return { gabarito, frases, dificuldade: 3, enunciado };
}

// trecho literal na frase + forma exigida pela regra + checagens próprias da área
function conferirPorRegras(extra: (frase: string, trecho: string, regra: RegraPT) => string | null) {
  return (frase: string, trecho: string, regra: RegraPT): string | null => {
    const f = norm(frase);
    const t = norm(trecho).replace(/[.;:!?]+$/, "");
    if (!t || !f.toLowerCase().includes(t.toLowerCase())) return `o trecho "${trecho}" não aparece literalmente na frase`;
    if (!regra.trecho.test(t)) return `o trecho "${t}" não tem a forma que a regra "${regra.nome}" exige`;
    return extra(f, t, regra);
  };
}

// A correção vale para a frase INTEIRA quando ela vem: corrigir só o trecho ("lojista foram") parecia
// chamar "lojista" de sujeito (reprovação real do revisor na Etapa 7)
function explicarPorRegras(regra: RegraPT, trecho: string, frase?: string) {
  const t = norm(trecho).replace(/[.;:!?]+$/, "");
  const certo = regra.corrigir?.(t);
  const f = frase ? norm(frase) : "";
  const fraseCerta = certo && certo !== t && f.includes(t) ? f.replace(t, certo) : null;
  const correcao = fraseCerta ? ` O certo seria: "${fraseCerta}"` : certo && certo !== t ? ` O certo seria "${certo}".` : "";
  return {
    explicacao: `${regra.correta ? "Correta" : "Errada"}. Em "${t}": ${regra.explicacao}${correcao}`,
    pegadinha: regra.correta ? null : regra.pegadinha ?? null,
  };
}

// E4: a introdução sai de uma das estruturas de data/variacoes.json ("estruturasPortugues", com "{contexto}"),
// sorteada pelo código; a padrão fica quando a lista não existe
export const estruturasPT = () => {
  const lista = carregarVariacoes().estruturasPortugues;
  return lista?.length ? lista : [ESTRUTURA_CRASE_PADRAO];
};
const intro = (contexto: string) => {
  const lista = estruturasPT();
  return lista[Math.floor(Math.random() * lista.length)].replace("{contexto}", contexto);
};

function escritorSystem(tema: string, foco: string, proibido: string) {
  return `Você é professor de Língua Portuguesa e elaborador de questões da Cesgranrio para o concurso do Banco do Brasil.
Você escreve frases curtas para uma questão de ${tema}. Cada letra recebe UMA regra obrigatória: a frase daquela letra deve aplicar EXATAMENTE essa regra, inclusive quando a regra é um ERRO proposital.

REGRAS
1. Cada frase tem 8 a 25 palavras, contexto bancário (agência, cliente, conta, crédito, atendimento), e UM ÚNICO ponto onde ${foco} importa.
2. PROIBIDO: ${proibido}
3. Fora o ponto da regra, a frase é impecável: ortografia, concordância, regência, crase e pontuação corretas, sem palavra em outro idioma.
4. As frases com regra de ERRO contêm exatamente aquele erro e nenhum outro. As frases com regra CORRETA não têm erro algum.
5. "trecho": copie LITERALMENTE da frase o pedaço onde a regra se aplica, no formato pedido em "Trecho = ..." de cada regra (sem ponto final).

Responda APENAS com JSON.`;
}

function juizSystem(foco: string) {
  return `Você é revisor gramatical especialista na norma-padrão do português brasileiro.
Julgue SOMENTE ${foco} na frase recebida. Ignore qualquer outro aspecto.
Pergunta: ${foco} nesta frase está de acordo com a norma-padrão?
Responda APENAS com JSON: {"correta": true|false, "regra": "a regra aplicada, em uma frase"}`;
}

const trocar = (pares: Record<string, string>) => (t: string) => t.replace(/^(\S+)/u, (p) => pares[p.toLowerCase()] ?? p);

// ============================================================
// CONCORDÂNCIA
// ============================================================
export const REGRAS_CONCORDANCIA: RegraPT[] = [
  {
    id: "haver_existir",
    nome: "verbo haver no sentido de existir, no singular",
    explicacao: "Haver com sentido de existir ou acontecer é impessoal: fica no singular mesmo com complemento no plural (houve reclamações).",
    correta: true,
    instrucao: "Use 'houve' ou 'havia' no sentido de existir, seguido de substantivo no PLURAL. Trecho = o verbo + o substantivo (ex.: 'houve reclamações').",
    trecho: /^(houve|havia|há|haverá)\s+(\p{L}+\s+)?\p{L}+s$/iu,
    exemplo: { frase: "Na semana passada, houve reclamações sobre a demora no atendimento da agência.", trecho: "houve reclamações" },
  },
  {
    id: "fazer_tempo",
    nome: "verbo fazer indicando tempo decorrido, no singular",
    explicacao: "Fazer indicando tempo decorrido é impessoal: fica no singular (faz dois anos).",
    correta: true,
    instrucao: "Use 'faz' ou 'fazia' + quantidade de tempo no plural. Trecho = o verbo + a expressão de tempo (ex.: 'faz dois anos').",
    trecho: /^(faz|fazia|fará)\s+\p{L}+\s+(anos|meses|dias|semanas|horas)$/iu,
    exemplo: { frase: "O cliente mantém conta corrente na agência faz dois anos e nunca atrasou pagamentos.", trecho: "faz dois anos" },
  },
  {
    id: "existir_plural",
    nome: "verbo existir concordando com o sujeito no plural",
    explicacao: "Existir não é impessoal: concorda com o sujeito (existem várias opções).",
    correta: true,
    instrucao: "Use 'existem' + sujeito no plural logo depois. Trecho = 'existem' + o sujeito (ex.: 'existem várias opções').",
    trecho: /^existem\s+(\p{L}+\s+){0,2}\p{L}+s$/iu,
    exemplo: { frase: "Para quem quer investir com segurança, existem várias opções na carteira do banco.", trecho: "existem várias opções" },
  },
  {
    id: "sujeito_posposto",
    nome: "verbo no plural concordando com o sujeito posposto",
    explicacao: "O verbo concorda com o sujeito mesmo quando ele vem depois (chegaram os novos cartões).",
    correta: true,
    instrucao: "Comece com um verbo no PLURAL e ponha o sujeito no plural logo DEPOIS dele. Trecho = o verbo + o sujeito (ex.: 'Chegaram os novos cartões').",
    trecho: /^\p{L}+(am|em)\s+(os|as)\s+(\p{L}+\s+)?\p{L}+s$/iu,
    exemplo: { frase: "Chegaram os novos cartões dos clientes que pediram a troca no mês passado.", trecho: "Chegaram os novos cartões" },
  },
  {
    id: "se_apassivador",
    nome: "verbo com 'se' apassivador concordando com o sujeito",
    explicacao: "Com verbo transitivo direto + 'se' (voz passiva sintética), o verbo concorda com o sujeito paciente (alugam-se salas).",
    correta: true,
    instrucao: "Use verbo transitivo direto + '-se' no PLURAL + substantivo no plural. Trecho = o verbo com o 'se' + o substantivo (ex.: 'Alugam-se salas').",
    trecho: /^\p{L}+(am|em)-se\s+(\p{L}+\s+)?\p{L}+s$/iu,
    exemplo: { frase: "No prédio da agência central, alugam-se salas para reuniões com clientes empresariais.", trecho: "alugam-se salas" },
  },
  {
    id: "meio_adverbio",
    nome: "'meio' como advérbio (um pouco), invariável",
    explicacao: "'Meio' com sentido de 'um pouco' é advérbio e não varia (ficou meio preocupada).",
    correta: true,
    instrucao: "Use 'meio' com sentido de 'um pouco' antes de adjetivo FEMININO. Trecho = 'meio' + o adjetivo (ex.: 'meio preocupada').",
    trecho: /^meio\s+\p{L}+as?$/iu,
    exemplo: { frase: "A cliente ficou meio preocupada com a cobrança desconhecida na fatura do cartão.", trecho: "meio preocupada" },
  },
  {
    id: "proibida_com_artigo",
    nome: "adjetivo concordando quando o substantivo tem artigo (é proibida a entrada)",
    explicacao: "Em 'é proibido', 'é necessário' e semelhantes, o adjetivo concorda quando o substantivo vem com artigo (é proibida a entrada); sem artigo, fica no masculino (é proibido entrada).",
    correta: true,
    instrucao: "Use 'é proibida', 'é necessária' ou 'é permitida' + 'a' + substantivo feminino singular. Trecho = 'é' + o adjetivo + 'a' + o substantivo (ex.: 'é necessária a assinatura').",
    trecho: /^é\s+(proibida|necessária|permitida|obrigatória)\s+a\s+\p{L}+$/iu,
    exemplo: { frase: "Para liberar o crédito consignado, é necessária a assinatura do titular da conta.", trecho: "é necessária a assinatura" },
  },
  {
    id: "anexas",
    nome: "'anexo' concordando com o substantivo",
    explicacao: "'Anexo' é adjetivo e concorda com o substantivo (seguem anexas as cópias); a locução 'em anexo' é que não varia.",
    correta: true,
    instrucao: "Use 'seguem anexas' + 'as' + substantivo feminino plural. Trecho = 'anexas as' + o substantivo (ex.: 'anexas as cópias').",
    trecho: /^anexas\s+as\s+\p{L}+s$/iu,
    exemplo: { frase: "Para concluir o cadastro da empresa, seguem anexas as cópias dos documentos solicitados.", trecho: "anexas as cópias" },
  },
  // ---------- erros ----------
  {
    id: "houveram",
    nome: "verbo haver (existir) no plural",
    explicacao: "Haver no sentido de existir é impessoal e não vai para o plural (por exemplo, 'houve reclamações').",
    correta: false,
    instrucao: "ERRO PROPOSITAL: use 'houveram' ou 'haviam' no sentido de existir + substantivo no plural. Trecho = o verbo + o substantivo (ex.: 'houveram reclamações').",
    trecho: /^(houveram|haviam|haverão)\s+(\p{L}+\s+)?\p{L}+s$/iu,
    pegadinha: "O complemento no plural parece sujeito e puxa o verbo, mas haver = existir não tem sujeito.",
    corrigir: trocar({ houveram: "houve", haviam: "havia", haverão: "haverá" }),
    exemplo: { frase: "Na semana passada, houveram reclamações sobre a demora no atendimento da agência.", trecho: "houveram reclamações" },
  },
  {
    id: "fazem_tempo",
    nome: "verbo fazer (tempo decorrido) no plural",
    explicacao: "Fazer indicando tempo decorrido é impessoal e fica no singular (por exemplo, 'faz dois anos').",
    correta: false,
    instrucao: "ERRO PROPOSITAL: use 'fazem' ou 'faziam' + quantidade de tempo no plural. Trecho = o verbo + a expressão de tempo (ex.: 'fazem dois anos').",
    trecho: /^(fazem|faziam|farão)\s+\p{L}+\s+(anos|meses|dias|semanas|horas)$/iu,
    pegadinha: "A expressão de tempo no plural parece sujeito.",
    corrigir: trocar({ fazem: "faz", faziam: "fazia", farão: "fará" }),
    exemplo: { frase: "O cliente mantém conta corrente na agência fazem dois anos e nunca atrasou pagamentos.", trecho: "fazem dois anos" },
  },
  {
    id: "existe_singular",
    nome: "verbo existir no singular com sujeito no plural",
    explicacao: "Existir concorda com o sujeito: com sujeito no plural, vai para o plural (por exemplo, 'existem taxas').",
    correta: false,
    instrucao: "ERRO PROPOSITAL: use 'existe' + sujeito no plural logo depois. Trecho = 'existe' + o sujeito (ex.: 'existe várias opções').",
    trecho: /^existe\s+(\p{L}+\s+){0,2}\p{L}+s$/iu,
    pegadinha: "Confunde com 'haver' (impessoal), que fica no singular; existir não é impessoal.",
    corrigir: trocar({ existe: "existem" }),
    exemplo: { frase: "Para quem quer investir com segurança, existe várias opções na carteira do banco.", trecho: "existe várias opções" },
  },
  {
    id: "posposto_singular",
    nome: "verbo no singular com sujeito posposto no plural",
    explicacao: "O verbo concorda com o sujeito mesmo quando ele vem depois: com sujeito no plural, o verbo vai para o plural (chegaram os cartões).",
    correta: false,
    instrucao: "ERRO PROPOSITAL: comece com um verbo no SINGULAR (pretérito: chegou, venceu, saiu…) e ponha o sujeito no plural logo depois. Trecho = o verbo + o sujeito (ex.: 'Chegou os novos cartões').",
    trecho: /^\p{L}+(ou|eu|iu)\s+(os|as)\s+(\p{L}+\s+)?\p{L}+s$/iu,
    pegadinha: "Com o sujeito depois do verbo, a concordância passa despercebida.",
    exemplo: { frase: "Chegou os novos cartões dos clientes que pediram a troca no mês passado.", trecho: "Chegou os novos cartões" },
  },
  {
    id: "se_singular",
    nome: "verbo com 'se' apassivador no singular com sujeito no plural",
    explicacao: "Na voz passiva sintética o verbo concorda com o sujeito paciente: 'alugam-se salas', não 'aluga-se salas'.",
    correta: false,
    instrucao: "ERRO PROPOSITAL: use verbo transitivo direto + '-se' no SINGULAR + substantivo no plural. Trecho = o verbo com o 'se' + o substantivo (ex.: 'aluga-se salas').",
    trecho: /^\p{L}+(a|e)-se\s+(\p{L}+\s+)?\p{L}+s$/iu,
    pegadinha: "Parece sujeito indeterminado, mas o substantivo é sujeito paciente.",
    corrigir: (t) => t.replace(/^(\p{L}+)-se/iu, "$1m-se"),
    exemplo: { frase: "No prédio da agência central, aluga-se salas para reuniões com clientes empresariais.", trecho: "aluga-se salas" },
  },
  {
    id: "meia_adverbio",
    nome: "'meio' (advérbio) flexionado como 'meia'",
    explicacao: "'Meio' com sentido de 'um pouco' é advérbio e não varia (por exemplo, 'meio preocupada').",
    correta: false,
    instrucao: "ERRO PROPOSITAL: use 'meia' com sentido de 'um pouco' antes de adjetivo feminino. Trecho = 'meia' + o adjetivo (ex.: 'meia preocupada').",
    trecho: /^meia\s+\p{L}+as?$/iu,
    pegadinha: "O adjetivo feminino ao lado puxa o 'meio' para o feminino.",
    corrigir: trocar({ meia: "meio" }),
    exemplo: { frase: "A cliente ficou meia preocupada com a cobrança desconhecida na fatura do cartão.", trecho: "meia preocupada" },
  },
  {
    id: "proibido_com_artigo",
    nome: "adjetivo no masculino com substantivo acompanhado de artigo",
    explicacao: "Com artigo, o adjetivo concorda com o substantivo: 'é necessária a assinatura'. Só sem artigo fica no masculino (é necessário assinatura).",
    correta: false,
    instrucao: "ERRO PROPOSITAL: use 'é proibido', 'é necessário' ou 'é permitido' + 'a' + substantivo feminino singular. Trecho = 'é' + o adjetivo + 'a' + o substantivo (ex.: 'é necessário a assinatura').",
    trecho: /^é\s+(proibido|necessário|permitido|obrigatório)\s+a\s+\p{L}+$/iu,
    pegadinha: "A forma sem artigo (é proibido entrada) está certa e confunde.",
    corrigir: (t) => t.replace(/\b(proibid|necessári|permitid|obrigatóri)o\b/iu, "$1a"),
    exemplo: { frase: "Para liberar o crédito consignado, é necessário a assinatura do titular da conta.", trecho: "é necessário a assinatura" },
  },
  {
    id: "anexo_sem_concordar",
    nome: "'anexo' sem concordar com o substantivo",
    explicacao: "'Anexo' é adjetivo e concorda com o substantivo: 'seguem anexas as cópias'. Invariável é só a locução 'em anexo'.",
    correta: false,
    instrucao: "ERRO PROPOSITAL: use 'seguem anexo' + 'as' + substantivo feminino plural. Trecho = 'anexo as' + o substantivo (ex.: 'anexo as cópias').",
    trecho: /^anexo\s+as\s+\p{L}+s$/iu,
    pegadinha: "Confunde com a locução invariável 'em anexo'.",
    corrigir: trocar({ anexo: "anexas" }),
    exemplo: { frase: "Para concluir o cadastro da empresa, seguem anexo as cópias dos documentos solicitados.", trecho: "anexo as cópias" },
  },
];

// casos com duas formas aceitas (concordância facultativa): proibidos em qualquer frase
const CONCORDANCIA_FACULTATIVA: [RegExp, string][] = [
  [/\b(a maioria|grande parte|a maior parte|a metade|parte)\s+d(os|as|e)\b/iu, "coletivo partitivo (verbo no singular ou no plural)"],
  [/\bum dos que\b|\bmais de um\b|\bcerca de\b|\bperto de\b/iu, "expressão com concordância variável"],
];

export const AREA_CONCORDANCIA: AreaPT = {
  tipo: "concordância (por construção)",
  regras: REGRAS_CONCORDANCIA,
  escritorSystem: escritorSystem(
    "concordância verbal e nominal",
    "a concordância",
    "concordância facultativa: 'a maioria de', 'grande parte de', 'parte de', 'um dos que', 'mais de um', 'cerca de'. Nenhum outro verbo ou adjetivo da frase pode ter concordância duvidosa."
  ),
  juizSystem: juizSystem("a concordância verbal e nominal"),
  construir: (g, contexto, h) => construirPorRegras(REGRAS_CONCORDANCIA, g, `${intro(contexto)} A concordância está de acordo com a norma-padrão em:`, h),
  conferir: conferirPorRegras((f) => {
    for (const [re, nome] of CONCORDANCIA_FACULTATIVA) if (re.test(f)) return `usa caso de concordância facultativa (${nome}), proibido neste formato`;
    return null;
  }),
  explicar: explicarPorRegras,
  explicacaoGeral: (certa) =>
    `Concordância é a combinação de número e pessoa entre o verbo e o sujeito (verbal) e de gênero e número entre o nome e seus determinantes (nominal). Atenção aos verbos impessoais (haver = existir e fazer = tempo decorrido ficam no singular), ao sujeito depois do verbo e à voz passiva com 'se'. Nesta questão, a frase correta aplica a regra: ${certa.nome}. ${certa.explicacao}`,
  dica: "Ache o sujeito antes de olhar o verbo: se 'houve/faz' puder virar 'existiu/passou', o verbo é impessoal e fica no singular; se o 'se' der para virar voz passiva (salas são alugadas), o verbo concorda.",
};

// ============================================================
// REGÊNCIA
// ============================================================
export const REGRAS_REGENCIA: RegraPT[] = [
  {
    id: "assistir_a",
    nome: "assistir (ver, presenciar) com a preposição 'a'",
    explicacao: "No sentido de ver ou presenciar, 'assistir' é transitivo indireto e pede a preposição 'a' (assistir ao treinamento).",
    correta: true,
    instrucao: "Use 'assistir' no sentido de ver + 'ao' + um destes substantivos masculinos: treinamento, vídeo, seminário, jogo. Trecho = o verbo + 'ao' + o substantivo (ex.: 'assistiram ao treinamento').",
    trecho: /^assist\p{L}*\s+(ao|aos)\s+(treinamento|vídeo|seminário|jogo)s?$/iu,
    exemplo: { frase: "Os novos escriturários assistiram ao treinamento sobre prevenção à lavagem de dinheiro.", trecho: "assistiram ao treinamento" },
  },
  {
    id: "obedecer_a",
    nome: "obedecer com a preposição 'a'",
    explicacao: "'Obedecer' é transitivo indireto: pede a preposição 'a' (obedecer ao regulamento).",
    correta: true,
    instrucao: "Use 'obedecer' + 'ao' ou 'aos' + substantivo masculino. Trecho = o verbo + 'ao/aos' + o substantivo (ex.: 'obedece ao regulamento').",
    trecho: /^obedec\p{L}*\s+(ao|aos)\s+\p{L}+$/iu,
    exemplo: { frase: "Todo atendimento de abertura de conta obedece ao regulamento interno do banco.", trecho: "obedece ao regulamento" },
  },
  {
    id: "preferir_a",
    nome: "preferir uma coisa a outra",
    explicacao: "'Preferir' pede um complemento sem preposição e outro com 'a': prefere-se uma coisa A outra, sem 'mais' e sem 'do que'.",
    correta: true,
    instrucao: "Use 'preferir' + o que se prefere + 'ao' + a outra opção, sem 'mais' e sem 'do que'. Trecho = do verbo até a segunda opção (ex.: 'prefere o aplicativo ao telefone').",
    trecho: /^prefer\p{L}*\s+(?!.*\b(mais|do que)\b)(o|a|os|as)\s+\p{L}+\s+(ao|aos)\s+\p{L}+$/iu,
    exemplo: { frase: "Grande número de correntistas jovens prefere o aplicativo ao telefone para pagar contas.", trecho: "prefere o aplicativo ao telefone" },
  },
  {
    id: "implicar_td",
    nome: "implicar (acarretar) sem preposição",
    explicacao: "No sentido de acarretar, 'implicar' é transitivo direto: implica multa, e não 'implica em multa'.",
    correta: true,
    instrucao: "Use 'implicar' no sentido de acarretar + o complemento SEM preposição. Trecho = o verbo + o complemento (ex.: 'implica cobrança de multa').",
    trecho: /^implic\p{L}*\s+(?!(em|no|na|nos|nas)\s)\p{L}+(\s+\p{L}+){0,2}$/iu,
    exemplo: { frase: "O atraso no pagamento da fatura implica cobrança de multa e de juros de mora.", trecho: "implica cobrança de multa" },
  },
  {
    id: "chegar_a",
    nome: "chegar com a preposição 'a'",
    explicacao: "Verbos de movimento como 'chegar' pedem a preposição 'a' para indicar destino (chegou ao banco).",
    correta: true,
    instrucao: "Use 'chegar' + 'ao' + lugar masculino (banco, escritório, caixa eletrônico, posto). Trecho = o verbo + 'ao' + o lugar (ex.: 'chegou ao banco').",
    trecho: /^cheg\p{L}*\s+(ao|aos)\s+\p{L}+$/iu,
    exemplo: { frase: "O gerente chegou ao escritório antes das oito para preparar a reunião com os clientes.", trecho: "chegou ao escritório" },
  },
  {
    id: "esquecer_se_de",
    nome: "esquecer-se de (forma pronominal com 'de')",
    explicacao: "'Esquecer' pronominal pede 'de' (esqueceu-se do prazo); sem o pronome, não leva preposição (esqueceu o prazo).",
    correta: true,
    instrucao: "Use 'esqueceu-se' + 'do' + substantivo masculino. Trecho = o verbo com o pronome + 'do' + o substantivo (ex.: 'esqueceu-se do prazo').",
    trecho: /^esquec\p{L}*-se\s+(do|dos)\s+\p{L}+$/iu,
    exemplo: { frase: "O cliente esqueceu-se do prazo de renovação do seguro e precisou contratar outro.", trecho: "esqueceu-se do prazo" },
  },
  {
    id: "aspirar_a",
    nome: "aspirar (desejar) com a preposição 'a'",
    explicacao: "No sentido de desejar, almejar, 'aspirar' pede a preposição 'a' (aspira ao cargo).",
    correta: true,
    instrucao: "Use 'aspirar' no sentido de desejar + 'ao' + cargo ou posto. Trecho = o verbo + 'ao' + o substantivo (ex.: 'aspira ao cargo').",
    trecho: /^aspir\p{L}*\s+ao\s+(cargo|posto)$/iu,
    exemplo: { frase: "A escriturária aspira ao cargo de gerente de relacionamento da agência central.", trecho: "aspira ao cargo" },
  },
  // ---------- erros ----------
  {
    id: "assistir_sem_a",
    nome: "assistir (ver) sem a preposição 'a'",
    explicacao: "No sentido de ver, 'assistir' pede a preposição 'a' (por exemplo, 'assistiram ao treinamento').",
    correta: false,
    instrucao: "ERRO PROPOSITAL: use 'assistir' no sentido de ver + 'o' + treinamento, vídeo, seminário ou jogo (sem a preposição). Trecho = o verbo + 'o' + o substantivo (ex.: 'assistiram o treinamento').",
    trecho: /^assist\p{L}*\s+(o|os)\s+(treinamento|vídeo|seminário|jogo)s?$/iu,
    pegadinha: "Na fala, 'assistir o jogo' é comum; na norma-padrão, assistir = ver pede 'a'.",
    corrigir: (t) => t.replace(/\s(o|os)\s/iu, (_m, a: string) => ` a${a} `),
    exemplo: { frase: "Os novos escriturários assistiram o treinamento sobre prevenção à lavagem de dinheiro.", trecho: "assistiram o treinamento" },
  },
  {
    id: "obedecer_sem_a",
    nome: "obedecer sem a preposição 'a'",
    explicacao: "'Obedecer' pede a preposição 'a' (por exemplo, 'obedece ao regulamento').",
    correta: false,
    instrucao: "ERRO PROPOSITAL: use 'obedecer' + 'o' ou 'os' + substantivo masculino, sem a preposição. Trecho = o verbo + 'o/os' + o substantivo (ex.: 'obedece o regulamento').",
    trecho: /^obedec\p{L}*\s+(o|os)\s+\p{L}+$/iu,
    pegadinha: "Como 'cumprir' é transitivo direto, parece que 'obedecer' também seria.",
    corrigir: (t) => t.replace(/\s(o|os)\s/iu, (_m, a: string) => ` a${a} `),
    exemplo: { frase: "Todo atendimento de abertura de conta obedece o regulamento interno do banco.", trecho: "obedece o regulamento" },
  },
  {
    id: "preferir_do_que",
    nome: "preferir com 'mais' e 'do que'",
    explicacao: "'Preferir' já indica escolha: a norma pede 'preferir uma coisa a outra', sem 'mais' e sem 'do que'.",
    correta: false,
    instrucao: "ERRO PROPOSITAL: use 'prefere mais' + uma opção + 'do que' + a outra. Trecho = do verbo até a segunda opção (ex.: 'prefere mais o aplicativo do que o telefone').",
    trecho: /^prefer\p{L}*\s+mais\s+.+\s+do que\s+.+$/iu,
    pegadinha: "É a forma da fala, por analogia com 'gostar mais de… do que de…'.",
    exemplo: { frase: "Grande número de correntistas jovens prefere mais o aplicativo do que o telefone para pagar contas.", trecho: "prefere mais o aplicativo do que o telefone" },
  },
  {
    id: "implicar_em",
    nome: "implicar (acarretar) com a preposição 'em'",
    explicacao: "No sentido de acarretar, 'implicar' é transitivo direto, sem 'em' (por exemplo, 'implica cobrança').",
    correta: false,
    instrucao: "ERRO PROPOSITAL: use 'implica em' + o complemento SEM artigo. Trecho = o verbo + 'em' + o complemento (ex.: 'implica em cobrança de multa').",
    trecho: /^implic\p{L}*\s+em\s+\p{L}+(\s+\p{L}+){0,2}$/iu,
    pegadinha: "Por influência de 'resultar em' e 'acarretar em', o 'em' parece natural.",
    corrigir: (t) => t.replace(/\sem\s/iu, " "),
    exemplo: { frase: "O atraso no pagamento da fatura implica em cobrança de multa e de juros de mora.", trecho: "implica em cobrança de multa" },
  },
  {
    id: "chegar_em",
    nome: "chegar com a preposição 'em'",
    explicacao: "'Chegar' indica destino com a preposição 'a', não 'em' (por exemplo, 'chegou ao escritório').",
    correta: false,
    instrucao: "ERRO PROPOSITAL: use 'chegar' + 'no' + lugar masculino. Trecho = o verbo + 'no' + o lugar (ex.: 'chegou no escritório').",
    trecho: /^cheg\p{L}*\s+(no|nos)\s+\p{L}+$/iu,
    pegadinha: "Na fala é comum 'chegar no'; a norma pede 'chegar a'.",
    corrigir: (t) => t.replace(/\s(no|nos)\s/iu, (_m, a: string) => ` a${a.slice(1)} `),
    exemplo: { frase: "O gerente chegou no escritório antes das oito para preparar a reunião com os clientes.", trecho: "chegou no escritório" },
  },
  {
    id: "esquecer_de",
    nome: "esquecer (sem pronome) com a preposição 'de'",
    explicacao: "Sem o pronome, 'esquecer' é transitivo direto: 'esqueceu o prazo'; com 'de', precisa do pronome: 'esqueceu-se do prazo'.",
    correta: false,
    instrucao: "ERRO PROPOSITAL: use 'esqueceu' (SEM o pronome 'se') + 'do' + substantivo masculino. Trecho = o verbo + 'do' + o substantivo (ex.: 'esqueceu do prazo').",
    trecho: /^esquec\p{L}*\s+(do|dos)\s+\p{L}+$/iu,
    pegadinha: "Mistura as duas construções certas: 'esquecer algo' e 'esquecer-se de algo'.",
    corrigir: (t) => t.replace(/^(\p{L}+)\s/u, "$1-se "),
    exemplo: { frase: "O cliente esqueceu do prazo de renovação do seguro e precisou contratar outro.", trecho: "esqueceu do prazo" },
  },
  {
    id: "aspirar_sem_a",
    nome: "aspirar (desejar) sem a preposição 'a'",
    explicacao: "No sentido de desejar, 'aspirar' pede 'a' (por exemplo, 'aspira ao cargo'). Sem preposição, significa sorver (aspirar o ar).",
    correta: false,
    instrucao: "ERRO PROPOSITAL: use 'aspirar' no sentido de desejar + 'o' + cargo ou posto. Trecho = o verbo + 'o' + o substantivo (ex.: 'aspira o cargo').",
    trecho: /^aspir\p{L}*\s+o\s+(cargo|posto)$/iu,
    pegadinha: "O sentido de 'desejar' parece pedir objeto direto, como 'desejar o cargo'.",
    corrigir: (t) => t.replace(/\so\s/iu, " ao "),
    exemplo: { frase: "A escriturária aspira o cargo de gerente de relacionamento da agência central.", trecho: "aspira o cargo" },
  },
];

export const AREA_REGENCIA: AreaPT = {
  tipo: "regência (por construção)",
  regras: REGRAS_REGENCIA,
  escritorSystem: escritorSystem(
    "regência verbal",
    "a regência do verbo",
    "construções em que as duas regências são aceitas (ex.: 'assistir o paciente' no sentido de ajudar, 'visar o lucro', 'namorar alguém'). Use substantivo masculino no ponto da regra, para não entrar crase."
  ),
  juizSystem: juizSystem("a regência verbal e nominal (a preposição exigida pelo verbo ou pelo nome)"),
  construir: (g, contexto, h) => construirPorRegras(REGRAS_REGENCIA, g, `${intro(contexto)} A regência está de acordo com a norma-padrão em:`, h),
  conferir: conferirPorRegras(() => null),
  explicar: explicarPorRegras,
  explicacaoGeral: (certa) =>
    `Regência é a relação entre um verbo (ou nome) e o termo que ele pede: com ou sem preposição, e qual preposição. Os verbos mais cobrados mudam de sentido conforme a regência (assistir, aspirar, visar) ou têm uso popular diferente da norma (preferir, implicar, chegar, esquecer). Nesta questão, a frase correta aplica a regra: ${certa.nome}. ${certa.explicacao}`,
  dica: "Pergunte ao verbo: quem assiste, assiste A algo; quem obedece, obedece A algo; quem prefere, prefere algo A outra coisa; quem chega, chega A um lugar.",
};

// ============================================================
// PONTUAÇÃO (vírgula)
// ============================================================
export const REGRAS_PONTUACAO: RegraPT[] = [
  {
    id: "aposto_entre_virgulas",
    nome: "aposto explicativo entre vírgulas",
    explicacao: "O aposto explicativo fica entre vírgulas (o gerente, responsável pela carteira, aprovou…).",
    correta: true,
    instrucao: "Ponha um aposto explicativo entre vírgulas logo depois do sujeito. A frase só tem essas duas vírgulas. Trecho = a vírgula, o aposto e a vírgula (ex.: ', responsável pela carteira,').",
    trecho: /^,\s*[^,]{3,60},$/u,
    exemplo: { frase: "O gerente, responsável pela carteira de empresas, aprovou o novo limite de crédito.", trecho: ", responsável pela carteira de empresas," },
  },
  {
    id: "vocativo",
    nome: "vocativo separado por vírgula",
    explicacao: "O vocativo (o chamamento) é sempre separado por vírgula (Prezado cliente, confira…).",
    correta: true,
    instrucao: "Comece a frase chamando alguém (vocativo) seguido de vírgula; a frase só tem essa vírgula. Trecho = o vocativo + a vírgula (ex.: 'Prezado cliente,').",
    trecho: /^[\p{L}][\p{L} ]{2,40},$/u,
    exemplo: { frase: "Prezado cliente, confira os dados do boleto antes de confirmar o pagamento.", trecho: "Prezado cliente," },
  },
  {
    id: "enumeracao",
    nome: "vírgula entre os itens de uma enumeração, sem vírgula antes do 'e'",
    explicacao: "Itens de uma enumeração são separados por vírgula; antes do 'e' que liga os dois últimos, não se usa vírgula.",
    correta: true,
    instrucao: "Liste três itens separados por vírgula, com 'e' antes do último e sem vírgula antes do 'e'; a frase só tem essa vírgula. Trecho = a lista (ex.: 'cartões, seguros e consórcios').",
    trecho: /^[\p{L} ]+,\s[\p{L} ]+\se\s[\p{L} ]+$/u,
    exemplo: { frase: "A agência oferece aos novos clientes cartões, seguros e consórcios com condições especiais.", trecho: "cartões, seguros e consórcios" },
  },
  {
    id: "expressao_explicativa",
    nome: "expressão explicativa (ou seja, isto é) entre vírgulas",
    explicacao: "Expressões explicativas como 'ou seja' e 'isto é' ficam entre vírgulas.",
    correta: true,
    instrucao: "Use 'ou seja' ou 'isto é' entre vírgulas no meio da frase; a frase só tem essas duas vírgulas. Trecho = a vírgula, a expressão e a vírgula (ex.: ', ou seja,').",
    trecho: /^,\s*(isto é|ou seja),$/iu,
    exemplo: { frase: "A taxa será cobrada no próximo ciclo, ou seja, na fatura de março do cartão.", trecho: ", ou seja," },
  },
  // ---------- erros ----------
  {
    id: "virgula_sujeito_verbo",
    nome: "vírgula separando o sujeito do verbo",
    explicacao: "Não se separa o sujeito do verbo por vírgula, por mais longo que o sujeito seja.",
    correta: false,
    instrucao: "ERRO PROPOSITAL: ponha uma vírgula entre o sujeito e o verbo, sem aposto nem termo intercalado; a frase só tem essa vírgula. Trecho = a última palavra do sujeito + a vírgula + o verbo (ex.: 'agência, aprovou').",
    trecho: /^\p{L}+,\s\p{L}+$/u,
    pegadinha: "Sujeito longo dá vontade de fazer uma pausa, mas pausa na fala não é vírgula.",
    corrigir: (t) => t.replace(",", ""),
    exemplo: { frase: "O gerente de relacionamento da agência, aprovou o novo limite de crédito da empresa.", trecho: "agência, aprovou" },
  },
  {
    id: "virgula_verbo_complemento",
    nome: "vírgula separando o verbo do complemento",
    explicacao: "Não se separa o verbo do seu complemento (objeto) por vírgula.",
    correta: false,
    instrucao: "ERRO PROPOSITAL: ponha uma vírgula entre o verbo e o objeto; a frase só tem essa vírgula. Trecho = o verbo + a vírgula + a primeira palavra do complemento (ex.: 'ofereceu, novas').",
    trecho: /^\p{L}+,\s\p{L}+$/u,
    pegadinha: "Complemento longo parece pedir pausa.",
    corrigir: (t) => t.replace(",", ""),
    exemplo: { frase: "O banco ofereceu, novas condições de renegociação aos clientes com parcelas em atraso.", trecho: "ofereceu, novas" },
  },
  {
    id: "aposto_sem_fechar",
    nome: "aposto explicativo aberto e não fechado",
    explicacao: "O aposto explicativo precisa das duas vírgulas: abrir sem fechar separa o sujeito do verbo.",
    correta: false,
    instrucao: "ERRO PROPOSITAL: abra um aposto explicativo com vírgula depois do sujeito e NÃO o feche; a frase só tem essa vírgula. Trecho = a vírgula + o aposto + o verbo (ex.: ', responsável pela carteira aprovou').",
    trecho: /^,\s*[^,]{3,60}\s\p{L}+$/u,
    pegadinha: "A primeira vírgula está certa e dá a impressão de que a frase está pontuada.",
    exemplo: { frase: "O gerente, responsável pela carteira de empresas aprovou o novo limite de crédito.", trecho: ", responsável pela carteira de empresas aprovou" },
  },
  {
    id: "vocativo_sem_virgula",
    nome: "vocativo sem vírgula",
    explicacao: "O vocativo precisa ser separado por vírgula: 'Prezado cliente, confira…'.",
    correta: false,
    instrucao: "ERRO PROPOSITAL: comece chamando alguém (vocativo) SEM vírgula depois; a frase não tem nenhuma vírgula. Trecho = o vocativo + a palavra seguinte (ex.: 'Prezado cliente confira').",
    trecho: /^[\p{L}][\p{L} ]{2,40}\s\p{L}+$/u,
    pegadinha: "Sem a vírgula, o vocativo se confunde com o sujeito.",
    exemplo: { frase: "Prezado cliente confira os dados do boleto antes de confirmar o pagamento.", trecho: "Prezado cliente confira" },
  },
  {
    id: "virgula_antes_do_e",
    nome: "vírgula antes do 'e' final de uma enumeração simples",
    explicacao: "Na enumeração simples, não se usa vírgula antes do 'e' que liga os dois últimos itens.",
    correta: false,
    instrucao: "ERRO PROPOSITAL: liste três itens com vírgula também antes do 'e' final; a frase só tem essas duas vírgulas. Trecho = a lista (ex.: 'cartões, seguros, e consórcios').",
    trecho: /^[\p{L} ]+,\s[\p{L} ]+,\se\s[\p{L} ]+$/u,
    pegadinha: "Em inglês essa vírgula é comum (vírgula serial); em português, não.",
    corrigir: (t) => t.replace(/,\se\s/u, " e "),
    exemplo: { frase: "A agência oferece aos novos clientes cartões, seguros, e consórcios com condições especiais.", trecho: "cartões, seguros, e consórcios" },
  },
];

const virgulas = (s: string) => (s.match(/,/g) ?? []).length;

export const AREA_PONTUACAO: AreaPT = {
  tipo: "pontuação (por construção)",
  regras: REGRAS_PONTUACAO,
  escritorSystem: escritorSystem(
    "pontuação (emprego da vírgula)",
    "a vírgula",
    "vírgula facultativa: adjunto adverbial curto no início, oração reduzida ou adverbial antes da principal, 'e' com sujeitos diferentes. A frase só tem as vírgulas do ponto da regra, nenhuma outra."
  ),
  juizSystem: juizSystem("o emprego da vírgula"),
  construir: (g, contexto, h) => construirPorRegras(REGRAS_PONTUACAO, g, `${intro(contexto)} O emprego da vírgula está de acordo com a norma-padrão em:`, h),
  // trava extra: a frase só tem as vírgulas do trecho (nenhuma vírgula facultativa por perto);
  // vocativo e o seu erro começam a frase
  conferir: conferirPorRegras((f, t, regra) => {
    if (virgulas(f) !== virgulas(t)) return `a frase tem ${virgulas(f)} vírgula(s), mas só pode ter as ${virgulas(t)} do trecho`;
    if ((regra.id === "vocativo" || regra.id === "vocativo_sem_virgula") && !f.toLowerCase().startsWith(t.toLowerCase())) return "o vocativo precisa abrir a frase";
    return null;
  }),
  explicar: explicarPorRegras,
  explicacaoGeral: (certa) =>
    `A vírgula marca relações sintáticas, não pausas da fala. Ela separa vocativo, aposto explicativo, expressões explicativas e itens de enumeração; nunca separa o sujeito do verbo nem o verbo do complemento. Nesta questão, a frase correta aplica a regra: ${certa.nome}. ${certa.explicacao}`,
  dica: "Ponha a frase na ordem direta (sujeito + verbo + complemento): entre esses termos não entra vírgula; o que estiver intercalado vai entre duas vírgulas.",
};

// ============================================================
// CRASE: a área de sempre, sem mudar nada (portugues.ts e os prompts dela)
// ============================================================
export const TIPO_CRASE = "crase (por construção)";
export const AREA_CRASE: AreaPT = {
  tipo: TIPO_CRASE,
  regras: REGRAS_CRASE,
  escritorSystem: CRASE_ESCRITOR_SYSTEM,
  juizSystem: AUDITOR_FRASE_SYSTEM,
  construir: ((g, contexto, h) => construirCrase(g, contexto, h, estruturasPT())) as AreaPT["construir"],
  conferir: conferirCrase as AreaPT["conferir"],
  explicar: explicarCrase as AreaPT["explicar"],
  explicacaoGeral: explicacaoGeralCrase as AreaPT["explicacaoGeral"],
  dica: DICA_CRASE,
};

export const AREAS_PT: Record<string, AreaPT> = Object.fromEntries(
  [AREA_CRASE, AREA_CONCORDANCIA, AREA_REGENCIA, AREA_PONTUACAO].map((a) => [a.tipo, a])
);

// Sem juiz independente para desempatar (V2): se, valendo a regra nas frases que ficaram sem
// desempate, exatamente a do gabarito for "correta", a questão fecharia — então ela espera
// auditoria ("aguardando_auditoria_independente"), não é aprovada nem descartada.
export function fechaComRegraNasPendentes(porFrase: { letra: Letra; correta: boolean }[], esperado: boolean[], semJuiz: Set<Letra>, gabarito: Letra) {
  const corretas = porFrase.filter((p, k) => (semJuiz.has(p.letra) ? esperado[k] : p.correta));
  return corretas.length === 1 && corretas[0].letra === gabarito;
}
