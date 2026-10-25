// ============================================================
// BB Estudos — Português por construção (começando por Crase)
// O CÓDIGO sorteia 1 regra de uso CORRETO e 4 regras de ERRO diferentes e a letra
// do gabarito. A IA (ESCRITOR_PT) só escreve as 5 frases e aponta o trecho onde
// a regra se aplica. Explicação, pegadinha, correção e explicação geral vêm DO
// BANCO DE REGRAS, não da IA. Depois, o auditor julga cada frase isoladamente.
// ============================================================
import type { Letra } from "../shared/tipos.js";

export type RegraCrase = {
  id: string;
  nome: string;
  explicacao: string; // texto da regra: é ele que o aluno lê na explicação da alternativa
  correta: boolean; // a frase que aplica esta regra está de acordo com a norma-padrão?
  temCrase: boolean; // a frase PRECISA ter "à/às/àquele"? Cada regra tem UM único uso correto
  instrucao: string; // como a IA deve escrever a frase
  trecho: RegExp; // forma exata do trecho onde a regra se aplica (conferida por código)
  pegadinha?: string; // nas regras de erro: por que o candidato cai
  corrigir?: (trecho: string) => string; // nas regras de erro: o trecho como deveria ser
};

// Casos FACULTATIVOS (com e sem crase, as duas formas estão certas) não entram no sorteio:
// não servem como erro nem como resposta certa neste formato. Ficam só como explicação extra.
export const CRASE_FACULTATIVA =
  "Crase facultativa (com ou sem acento, as duas formas estão corretas): antes de pronome possessivo feminino singular (à/a sua conta), antes de nome próprio feminino (à/a Maria) e depois de 'até' (até à/até a agência).";

// troca o primeiro "à" isolado do trecho por "a"
const tirarAcento = (t: string) => t.replace(/(^|\s)à(?=\s)/iu, "$1a");

export const REGRAS_CRASE: RegraCrase[] = [
  // ---------- usos CORRETOS ----------
  {
    id: "obrigatoria_regencia",
    nome: "crase obrigatória: termo que exige 'a' + palavra feminina com artigo",
    explicacao: "Quando o verbo ou nome exige a preposição 'a' e a palavra seguinte é feminina e aceita o artigo 'a', ocorre crase (a + a = à). Ex.: referir-se à proposta.",
    correta: true,
    temCrase: true,
    instrucao: "Use um verbo ou nome que exija a preposição 'a' (referir-se a, dirigir-se a, solicitar algo a, obedecer a, atender a) seguido de substantivo COMUM feminino singular, COM o acento de crase. Trecho = o verbo/nome + 'à' + o substantivo (ex.: 'dirigiu-se à gerência').",
    trecho: /^\S.*\sà\s+(?!(ela|elas|uma|esta|essa|vossa)$)\p{L}+$/iu,
  },
  {
    id: "locucao_feminina",
    nome: "crase em locução adverbial ou prepositiva feminina",
    explicacao: "Locuções formadas por palavra feminina levam crase: à vista, às pressas, à medida que, à disposição de.",
    correta: true,
    temCrase: true,
    instrucao: "Use uma locução feminina com crase (à vista, à disposição de, às pressas, à medida que). Trecho = a locução (ex.: 'à vista').",
    trecho: /^(à|às)\s+(vista|disposição|medida|pressas|tarde|noite|direita|esquerda|vontade|frente|procura|espera|beira|custa|toa|parte|risca|revelia|exceção|mercê)(\s.*)?$/iu,
  },
  {
    id: "horas_exatas",
    nome: "crase antes de horas exatas",
    explicacao: "Indicando hora determinada, usa-se crase: às 10 horas, à 1 hora, das 9h às 16h.",
    correta: true,
    temCrase: true,
    instrucao: "Indique um horário determinado com crase, sem usar 'até' (ex.: 'abre às 10 horas'). Trecho = 'às' + o horário (ex.: 'às 10 horas').",
    trecho: /^(à|às)\s+\d{1,2}(\s*h(oras?)?|h\d{0,2}|:\d{2})$/iu,
  },
  {
    id: "aquele",
    nome: "crase com 'aquele(s)/aquela(s)/aquilo' após termo que exige 'a'",
    explicacao: "A preposição 'a' se funde ao 'a' inicial de aquele/aquela/aquilo: referiu-se àquele contrato.",
    correta: true,
    temCrase: true,
    instrucao: "Use um termo que exija a preposição 'a' seguido de aquele/aquela/aquilo, escrito àquele/àquela/àquilo. Trecho = o termo + 'àquele/àquela' + o substantivo (ex.: 'referiu-se àquele contrato').",
    trecho: /^\S.*\s(àquel[ea]s?|àquilo)(\s+\p{L}+)?$/iu,
  },
  {
    id: "sem_crase_verbo",
    nome: "ausência correta de crase antes de verbo",
    explicacao: "Verbo não admite artigo, então não há crase antes de verbo: começou a analisar.",
    correta: true,
    temCrase: false,
    instrucao: "Use 'a' (sem acento) antes de um verbo no infinitivo. Trecho = o verbo anterior + 'a' + o infinitivo (ex.: 'começou a analisar').",
    trecho: /^\S.*\sa\s+\p{L}+(ar|er|ir|or)$/iu,
  },
  {
    id: "sem_crase_masculino",
    nome: "ausência correta de crase antes de palavra masculina",
    explicacao: "Palavra masculina não aceita o artigo 'a', então não há crase: pagamento a prazo.",
    correta: true,
    temCrase: false,
    instrucao: "Use 'a' (sem acento) antes de uma palavra masculina singular terminada em -o (prazo, crédito). Trecho = a palavra anterior + 'a' + a palavra masculina (ex.: 'compra a prazo').",
    trecho: /^\S.*\sa\s+\p{L}+o$/iu,
  },
  {
    id: "sem_crase_repetidas",
    nome: "ausência correta de crase entre palavras repetidas",
    explicacao: "Entre palavras repetidas não há crase: gota a gota, cara a cara.",
    correta: true,
    temCrase: false,
    instrucao: "Use uma expressão com palavras repetidas ligadas por 'a' sem acento. Trecho = a expressão (ex.: 'cara a cara', 'passo a passo').",
    trecho: /^(\p{L}+)\s+a\s+\1$/iu,
  },
  // ---------- ERROS ----------
  {
    id: "erro_verbo",
    nome: "crase antes de verbo (proibida)",
    explicacao: "Verbo não admite artigo; 'à' antes de verbo é erro: começou à analisar.",
    correta: false,
    temCrase: true,
    instrucao: "Coloque, por ERRO, 'à' antes de um verbo no infinitivo. Trecho = o verbo anterior + 'à' + o infinitivo (ex.: 'começou à analisar').",
    trecho: /^\S.*\sà\s+\p{L}+(ar|er|ir|or)$/iu,
    pegadinha: "O 'a' antes do verbo parece pedir acento, mas é só preposição: verbo nunca vem com artigo.",
    // sem "corrigir": o certo depende da regência do verbo anterior (decidiu transferir × começou a contar)
  },
  {
    id: "erro_masculino",
    nome: "crase antes de palavra masculina (proibida)",
    explicacao: "Palavra masculina não aceita o artigo 'a'; 'à prazo' é erro.",
    correta: false,
    temCrase: true,
    instrucao: "Coloque, por ERRO, 'à' antes de uma palavra masculina singular terminada em -o. Trecho = a palavra anterior + 'à' + a palavra masculina (ex.: 'pagamento à prazo').",
    trecho: /^\S.*\sà\s+\p{L}+o$/iu,
    pegadinha: "A expressão soa como as locuções com crase (à vista), mas 'prazo' é masculino e não aceita o artigo 'a'.",
    corrigir: tirarAcento,
  },
  {
    id: "erro_pronome_pessoal",
    nome: "crase antes de pronome pessoal (proibida)",
    explicacao: "Pronome pessoal não aceita artigo; 'à ela' é erro.",
    correta: false,
    temCrase: true,
    instrucao: "Coloque, por ERRO, 'à' antes do pronome pessoal 'ela'. Trecho = o verbo + 'à ela' (ex.: 'entregou o documento à ela').",
    trecho: /^\S.*\sà\s+(ela|elas|você|vocês|mim|ti)$/iu,
    pegadinha: "'Ela' é feminino e o verbo pede 'a', o que leva a pensar em crase; mas pronome pessoal não aceita artigo.",
    // sem "corrigir": depende do verbo (entregou a ela × orientou-a)
  },
  {
    id: "erro_repetidas",
    nome: "crase entre palavras repetidas (proibida)",
    explicacao: "Entre palavras repetidas não há crase; 'cara à cara' é erro.",
    correta: false,
    temCrase: true,
    instrucao: "Coloque, por ERRO, 'à' entre palavras repetidas femininas. Trecho = a expressão (ex.: 'cara à cara').",
    trecho: /^(\p{L}+)\s+à\s+\1$/iu,
    pegadinha: "As palavras são femininas, mas entre palavras repetidas há só a preposição, sem artigo.",
    corrigir: tirarAcento,
  },
  {
    id: "erro_tratamento",
    nome: "crase antes de pronome de tratamento (proibida)",
    explicacao: "Pronomes de tratamento (exceto senhora, senhorita e dona) não aceitam artigo; 'à Vossa Senhoria' é erro.",
    correta: false,
    temCrase: true,
    instrucao: "Coloque, por ERRO, 'à' antes de 'Vossa Senhoria' ou 'Vossa Excelência', depois de um verbo que pede 'a' (encaminhar, enviar, solicitar). Trecho = o verbo + 'à Vossa Senhoria' (ex.: 'encaminhamos à Vossa Senhoria').",
    trecho: /^\S.*\sà\s+vossa\s+(senhoria|excelência|majestade|alteza|santidade|magnificência)$/iu,
    pegadinha: "'Senhoria' e 'Excelência' são femininas, mas os pronomes de tratamento não aceitam artigo.",
    // sem "corrigir": depende do verbo
  },
  {
    id: "erro_indefinido",
    nome: "crase antes do artigo indefinido 'uma' (proibida)",
    explicacao: "Antes do artigo indefinido 'uma' não cabe o artigo definido; 'à uma cliente' é erro (não confundir com 'à uma hora').",
    correta: false,
    temCrase: true,
    instrucao: "Coloque, por ERRO, 'à' antes do artigo indefinido 'uma' seguido de substantivo, sem ser indicação de hora. Trecho = o verbo + 'à uma' + o substantivo (ex.: 'encaminhou à uma cliente').",
    trecho: /^\S.*\sà\s+uma\s+(?!hora)\p{L}+$/iu,
    pegadinha: "'À uma hora' tem crase, o que confunde; mas antes de 'uma' como artigo indefinido não há artigo definido para fundir.",
    // sem "corrigir": depende do verbo
  },
  {
    id: "erro_plural",
    nome: "'à' no singular antes de palavra feminina no plural (proibida)",
    explicacao: "Se a palavra está no plural sem artigo, há só a preposição 'a'; 'à clientes' é erro (o certo é 'a clientes' ou 'às clientes').",
    correta: false,
    temCrase: true,
    instrucao: "Coloque, por ERRO, 'à' (singular) antes de palavra feminina no PLURAL sem artigo. Trecho = o verbo + 'à' + o substantivo plural (ex.: 'enviou o aviso à clientes').",
    trecho: /^\S.*\sà\s+\p{L}+s$/iu,
    pegadinha: "A palavra é feminina, mas o 'à' singular não concorda com o plural: ou é só preposição (a clientes) ou é 'às clientes'.",
    // sem "corrigir": depende do verbo (respondeu a clientes × atendeu clientes)
  },
  {
    id: "erro_demonstrativo",
    nome: "crase antes de 'esta/essa' (proibida)",
    explicacao: "Os demonstrativos esta/essa não aceitam artigo; 'à esta agência' é erro.",
    correta: false,
    temCrase: true,
    instrucao: "Coloque, por ERRO, 'à' antes de 'esta' ou 'essa' + substantivo. Trecho = o verbo + 'à esta' + o substantivo (ex.: 'dirigiu-se à esta agência').",
    trecho: /^\S.*\sà\s+(esta|essa|estas|essas)\s+\p{L}+$/iu,
    pegadinha: "Com 'aquela' há crase (àquela), o que leva a acentuar 'esta/essa'; mas esses demonstrativos não aceitam artigo.",
    // sem "corrigir": depende do verbo (dirigiu-se a esta × assistiu esta)
  },
  {
    id: "erro_falta_obrigatoria",
    nome: "falta da crase obrigatória",
    explicacao: "Termo que exige 'a' + palavra feminina com artigo pede crase; 'referiu-se a proposta' está errado.",
    correta: false,
    temCrase: false,
    instrucao: "Use um termo que exija a preposição 'a' seguido de substantivo COMUM feminino singular terminado em -a, mas, por ERRO, SEM o acento. Trecho = o termo + 'a' + o substantivo (ex.: 'referiu-se a proposta').",
    trecho: /^\S.*\sa\s+\p{L}+a$/iu,
    pegadinha: "Parece só um artigo antes do substantivo, mas o termo anterior exige a preposição 'a': a + a = à.",
    corrigir: (t) => t.replace(/\sa(\s+\p{L}+)$/iu, " à$1"),
  },
  {
    id: "erro_falta_horas",
    nome: "falta da crase antes de horas exatas",
    explicacao: "Hora determinada pede crase; 'abre as 10 horas' está errado.",
    correta: false,
    temCrase: false,
    instrucao: "Indique um horário determinado, sem usar 'até', mas, por ERRO, sem o acento. Trecho = 'as' + o horário (ex.: 'as 10 horas').",
    trecho: /^as\s+\d{1,2}(\s*h(oras?)?|h\d{0,2}|:\d{2})$/iu,
    pegadinha: "Parece só o artigo antes do número, mas indicação de hora exata leva crase.",
    corrigir: (t) => t.replace(/^as(?=\s)/iu, "às"),
  },
];

export type FraseMontada = { letra: Letra; regra: RegraCrase };
export type CraseMontada = { gabarito: Letra; frases: FraseMontada[]; enunciado: string; dificuldade: number };

const sortear = <T>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)];
const embaralhar = <T>(xs: readonly T[]): T[] =>
  xs.map((x) => [Math.random(), x] as const).sort((a, b) => a[0] - b[0]).map(([, x]) => x);

// Enunciado conforme as alternativas: "corretamente empregado" só quando TODAS têm "à";
// se alguma não tem acento grave, a pergunta é sobre o uso OU a ausência.
// E4: a estrutura da introdução vem sorteada de data/variacoes.json ("estruturasCrase", com "{contexto}");
// texto fixo igual em toda questão fazia o filtro de similaridade recusar as novas como duplicadas.
export const ESTRUTURA_CRASE_PADRAO = "Ao revisar comunicados de uma agência bancária sobre {contexto}, um escriturário analisou as frases a seguir.";
export function enunciadoCrase(contexto: string, regras: RegraCrase[], estrutura = ESTRUTURA_CRASE_PADRAO): string {
  const intro = estrutura.replace("{contexto}", contexto);
  return regras.every((r) => r.temCrase)
    ? `${intro} O acento grave está corretamente empregado em:`
    : `${intro} O uso ou a ausência do acento grave está de acordo com a norma-padrão em:`;
}

// Variedade: prioriza as regras MENOS usadas nas aprovadas e nunca repete
// uma regra da questão anterior (nem a correta, nem as de erro).
export type HistoricoCrase = { uso: Map<string, number>; anterior: Set<string> };

function menosUsadas(regras: RegraCrase[], n: number, h: HistoricoCrase): RegraCrase[] {
  const livres = regras.filter((r) => !h.anterior.has(r.id));
  const pool = livres.length >= n ? livres : regras; // banco pequeno demais: aceita repetir
  return embaralhar(pool)
    .sort((a, b) => (h.uso.get(a.id) ?? 0) - (h.uso.get(b.id) ?? 0)) // sort estável: empate fica embaralhado
    .slice(0, n);
}

// Regras certas que ficam no banco mas fora do sorteio enquanto nenhum juiz acerta ≥ 95% delas num
// benchmark próprio (decisão do dono, 25/10/2026). erro_tratamento: auditor e Ultra julgam "à Vossa
// Senhoria" correta; como nunca aprovava, era sempre a "menos usada" e entrava em toda questão (0/20).
export const FORA_DO_SORTEIO = new Set(["erro_tratamento"]);

// 1 regra CORRETA na letra do gabarito + 4 regras de ERRO diferentes nas outras
export function construirCrase(
  gabarito: Letra,
  contexto: string,
  historico: HistoricoCrase = { uso: new Map(), anterior: new Set() },
  estruturas: string[] = [ESTRUTURA_CRASE_PADRAO]
): CraseMontada {
  const sorteaveis = REGRAS_CRASE.filter((r) => !FORA_DO_SORTEIO.has(r.id));
  const [certa] = menosUsadas(sorteaveis.filter((r) => r.correta), 1, historico);
  const erros = embaralhar(menosUsadas(sorteaveis.filter((r) => !r.correta), 4, historico));
  const frases = (["A", "B", "C", "D", "E"] as Letra[]).map((letra) => ({
    letra,
    regra: letra === gabarito ? certa : erros.shift()!,
  }));
  return {
    gabarito,
    frases,
    dificuldade: 3,
    enunciado: enunciadoCrase(contexto, frases.map((f) => f.regra), sortear(estruturas.length ? estruturas : [ESTRUTURA_CRASE_PADRAO])),
  };
}

// ------------------------------------------------------------
// Conferência determinística (antes do auditor)
// ------------------------------------------------------------
const ACENTOS_CRASE = /(^|[^\p{L}])(à|às|àquel[ea]s?|àquilo)(?![\p{L}])/giu;
// contextos facultativos: proibidos em QUALQUER frase (deixariam duas respostas certas)
const CASO_FACULTATIVO: [RegExp, string][] = [
  [/(^|[^\p{L}])(à|a)s?\s+(minha|tua|sua|nossa)s?(?![\p{L}])/iu, "pronome possessivo feminino depois de a/à"], // sem "vossa": "à Vossa Senhoria" é pronome de tratamento
  [/(^|[^\p{L}])até\s+(à|a)s?(?![\p{L}])/iu, "'até a/à'"],
];
const norm = (t: string) => t.replace(/[\s ]+/g, " ").trim();

// A frase aplica a regra EXATAMENTE onde ela manda? Devolve o problema ou null.
export function conferirFrase(frase: string, trecho: string, regra: RegraCrase): string | null {
  const f = norm(frase);
  const t = norm(trecho).replace(/[.,;:!?]+$/, "");
  for (const [re, nome] of CASO_FACULTATIVO)
    if (re.test(f)) return `usa caso de crase facultativa (${nome}), proibido neste formato`;
  if (!t || !f.toLowerCase().includes(t.toLowerCase())) return `o trecho "${trecho}" não aparece literalmente na frase`;
  if (!regra.trecho.test(t)) return `o trecho "${t}" não tem a forma que a regra "${regra.nome}" exige`;
  const acentos = [...f.matchAll(ACENTOS_CRASE)].length;
  if (regra.temCrase && acentos !== 1) return `deveria ter exatamente um "à/às", e tem ${acentos}`;
  if (!regra.temCrase && acentos) return `não deveria ter nenhum "à/às", e tem ${acentos}`;
  return null;
}

// ------------------------------------------------------------
// Explicações a partir da REGRA (o aluno lê o banco, não a IA)
// ------------------------------------------------------------
export function explicarAlternativa(regra: RegraCrase, trecho: string): { explicacao: string; pegadinha: string | null } {
  const t = norm(trecho).replace(/[.,;:!?]+$/, "");
  const certo = regra.corrigir?.(t);
  return {
    explicacao: `${regra.correta ? "Correta" : "Errada"}. Em "${t}": ${regra.explicacao}${certo && certo !== t ? ` O certo seria "${certo}".` : ""}`,
    pegadinha: regra.correta ? null : regra.pegadinha ?? null,
  };
}

export function explicacaoGeralCrase(certa: RegraCrase): string {
  return `Crase é a fusão da preposição 'a' (exigida por um verbo ou nome) com o artigo feminino 'a' ou com o 'a' inicial de aquele/aquela/aquilo. Só existe quando os dois 'as' estão presentes; por isso não há crase antes de verbo, de palavra masculina, de pronome pessoal, de pronome de tratamento, de 'uma' indefinido e de 'esta/essa'. Nesta questão, a frase correta aplica a regra: ${certa.nome}. ${certa.explicacao} ${CRASE_FACULTATIVA}`;
}

export const DICA_CRASE =
  "Troque a palavra feminina por uma masculina: se aparecer 'ao', há crase (vou à agência → vou ao banco); se aparecer só 'a' ou 'o', não há.";
