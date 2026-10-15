// ============================================================
// BB Estudos — Português por construção (começando por Crase)
// O CÓDIGO sorteia 1 regra de uso CORRETO e 4 regras de ERRO diferentes e a letra
// do gabarito. A IA só escreve as 5 frases (cada uma aplicando a regra atribuída)
// e as explicações. Depois, o auditor julga cada frase isoladamente.
// ============================================================
import type { Letra } from "../shared/tipos.js";

export type RegraCrase = {
  id: string;
  nome: string;
  explicacao: string; // explicação curta, vai para o aluno e para a IA
  correta: boolean; // a frase que aplica esta regra está de acordo com a norma-padrão?
  temCrase: boolean; // a frase PRECISA ter "à/às/àquele"? Cada regra tem UM único uso correto
  instrucao: string; // como a IA deve escrever a frase
};

// Casos FACULTATIVOS (com e sem crase, as duas formas estão certas) não entram no sorteio:
// não servem como erro nem como resposta certa neste formato. Ficam só como explicação extra.
export const CRASE_FACULTATIVA =
  "Crase facultativa (com ou sem acento, as duas formas estão corretas): antes de pronome possessivo feminino singular (à/a sua conta), antes de nome próprio feminino (à/a Maria) e depois de 'até' (até à/até a agência).";

export const REGRAS_CRASE: RegraCrase[] = [
  // ---------- usos CORRETOS ----------
  {
    id: "obrigatoria_regencia",
    nome: "crase obrigatória: termo que exige 'a' + palavra feminina com artigo",
    explicacao: "Quando o verbo ou nome exige a preposição 'a' e a palavra seguinte é feminina e aceita o artigo 'a', ocorre crase (a + a = à). Ex.: referir-se à proposta.",
    correta: true,
    temCrase: true,
    instrucao: "Use um verbo ou nome que exija a preposição 'a' (referir-se a, dirigir-se a, solicitar algo a, obedecer a, atender a) seguido de substantivo feminino com artigo, COM o acento de crase.",
  },
  {
    id: "locucao_feminina",
    nome: "crase em locução adverbial ou prepositiva feminina",
    explicacao: "Locuções formadas por palavra feminina levam crase: à vista, às pressas, à medida que, à disposição de.",
    correta: true,
    temCrase: true,
    instrucao: "Use uma locução feminina com crase (à vista, à disposição de, às pressas, à medida que), corretamente acentuada.",
  },
  {
    id: "horas_exatas",
    nome: "crase antes de horas exatas",
    explicacao: "Indicando hora determinada, usa-se crase: às 10 horas, à 1 hora, das 9h às 16h.",
    correta: true,
    temCrase: true,
    instrucao: "Indique um horário determinado com crase (ex.: 'abre às 10 horas', 'das 9h às 15h').",
  },
  {
    id: "aquele",
    nome: "crase com 'aquele(s)/aquela(s)/aquilo' após termo que exige 'a'",
    explicacao: "A preposição 'a' se funde ao 'a' inicial de aquele/aquela/aquilo: referiu-se àquele contrato.",
    correta: true,
    temCrase: true,
    instrucao: "Use um termo que exija a preposição 'a' seguido de aquele/aquela/aquilo, escrito àquele/àquela/àquilo.",
  },
  {
    id: "sem_crase_verbo",
    nome: "ausência correta de crase antes de verbo",
    explicacao: "Verbo não admite artigo, então não há crase antes de verbo: começou a analisar.",
    correta: true,
    temCrase: false,
    instrucao: "Use 'a' (sem acento) antes de um verbo no infinitivo (ex.: 'começou a analisar').",
  },
  {
    id: "sem_crase_masculino",
    nome: "ausência correta de crase antes de palavra masculina",
    explicacao: "Palavra masculina não aceita o artigo 'a', então não há crase: pagamento a prazo.",
    correta: true,
    temCrase: false,
    instrucao: "Use 'a' (sem acento) antes de uma palavra masculina singular (ex.: 'compra a prazo').",
  },
  {
    id: "sem_crase_repetidas",
    nome: "ausência correta de crase entre palavras repetidas",
    explicacao: "Entre palavras repetidas não há crase: gota a gota, cara a cara.",
    correta: true,
    temCrase: false,
    instrucao: "Use uma expressão com palavras repetidas ligadas por 'a' sem acento (ex.: 'cara a cara', 'passo a passo').",
  },
  // ---------- ERROS ----------
  {
    id: "erro_verbo",
    nome: "crase antes de verbo (proibida)",
    explicacao: "Verbo não admite artigo; 'à' antes de verbo é erro: começou à analisar.",
    correta: false,
    temCrase: true,
    instrucao: "Coloque, por ERRO, 'à' antes de um verbo no infinitivo (ex.: 'começou à analisar').",
  },
  {
    id: "erro_masculino",
    nome: "crase antes de palavra masculina (proibida)",
    explicacao: "Palavra masculina não aceita o artigo 'a'; 'à prazo' é erro.",
    correta: false,
    temCrase: true,
    instrucao: "Coloque, por ERRO, 'à' antes de uma palavra masculina singular (ex.: 'pagamento à prazo').",
  },
  {
    id: "erro_pronome_pessoal",
    nome: "crase antes de pronome pessoal (proibida)",
    explicacao: "Pronome pessoal não aceita artigo; 'à ela' é erro.",
    correta: false,
    temCrase: true,
    instrucao: "Coloque, por ERRO, 'à' antes de pronome pessoal (ex.: 'entregou o documento à ela').",
  },
  {
    id: "erro_repetidas",
    nome: "crase entre palavras repetidas (proibida)",
    explicacao: "Entre palavras repetidas não há crase; 'cara à cara' é erro.",
    correta: false,
    temCrase: true,
    instrucao: "Coloque, por ERRO, 'à' entre palavras repetidas (ex.: 'conversaram cara à cara').",
  },
  {
    id: "erro_tratamento",
    nome: "crase antes de pronome de tratamento (proibida)",
    explicacao: "Pronomes de tratamento (exceto senhora, senhorita e dona) não aceitam artigo; 'à Vossa Senhoria' é erro.",
    correta: false,
    temCrase: true,
    instrucao: "Coloque, por ERRO, 'à' antes de 'Vossa Senhoria' ou 'Vossa Excelência'.",
  },
  {
    id: "erro_indefinido",
    nome: "crase antes do artigo indefinido 'uma' (proibida)",
    explicacao: "Antes do artigo indefinido 'uma' não cabe o artigo definido; 'à uma cliente' é erro (não confundir com 'à uma hora').",
    correta: false,
    temCrase: true,
    instrucao: "Coloque, por ERRO, 'à' antes do artigo indefinido 'uma' seguido de substantivo (ex.: 'encaminhou à uma cliente'), sem ser indicação de hora.",
  },
  {
    id: "erro_plural",
    nome: "'à' no singular antes de palavra feminina no plural (proibida)",
    explicacao: "Se a palavra está no plural sem artigo, há só a preposição 'a'; 'à clientes' é erro (o certo é 'a clientes' ou 'às clientes').",
    correta: false,
    temCrase: true,
    instrucao: "Coloque, por ERRO, 'à' (singular) antes de palavra feminina no PLURAL sem artigo (ex.: 'enviou o aviso à clientes').",
  },
  {
    id: "erro_demonstrativo",
    nome: "crase antes de 'esta/essa' (proibida)",
    explicacao: "Os demonstrativos esta/essa não aceitam artigo; 'à esta agência' é erro.",
    correta: false,
    temCrase: true,
    instrucao: "Coloque, por ERRO, 'à' antes de 'esta' ou 'essa' (ex.: 'dirigiu-se à esta agência').",
  },
  {
    id: "erro_falta_obrigatoria",
    nome: "falta da crase obrigatória",
    explicacao: "Termo que exige 'a' + palavra feminina com artigo pede crase; 'referiu-se a proposta' está errado.",
    correta: false,
    temCrase: false,
    instrucao: "Use um termo que exija a preposição 'a' seguido de substantivo feminino com artigo, mas, por ERRO, SEM o acento (ex.: 'referiu-se a proposta').",
  },
  {
    id: "erro_falta_horas",
    nome: "falta da crase antes de horas exatas",
    explicacao: "Hora determinada pede crase; 'abre as 10 horas' está errado.",
    correta: false,
    temCrase: false,
    instrucao: "Indique um horário determinado, mas, por ERRO, sem o acento (ex.: 'a agência abre as 10 horas').",
  },
];

export type FraseMontada = { letra: Letra; regra: RegraCrase };
export type CraseMontada = { gabarito: Letra; frases: FraseMontada[]; enunciado: string; dificuldade: number };

const sortear = <T>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)];
const embaralhar = <T>(xs: readonly T[]): T[] =>
  xs.map((x) => [Math.random(), x] as const).sort((a, b) => a[0] - b[0]).map(([, x]) => x);

// 1 regra CORRETA na letra do gabarito + 4 regras de ERRO diferentes nas outras
export function construirCrase(gabarito: Letra, contexto: string): CraseMontada {
  const certa = sortear(REGRAS_CRASE.filter((r) => r.correta));
  const erros = embaralhar(REGRAS_CRASE.filter((r) => !r.correta)).slice(0, 4);
  const frases = (["A", "B", "C", "D", "E"] as Letra[]).map((letra) => ({
    letra,
    regra: letra === gabarito ? certa : erros.shift()!,
  }));
  return {
    gabarito,
    frases,
    dificuldade: 3,
    enunciado: `Ao revisar mensagens de uma agência bancária (${contexto}), um escriturário analisou as frases a seguir. O uso ou a ausência do acento indicativo de crase está de acordo com a norma-padrão da língua portuguesa em:`,
  };
}

// conferência determinística: a frase tem (ou não) o acento que a regra exige?
const TEM_ACENTO_CRASE = /(^|[^\p{L}])(à|às|àquel[ea]s?|àquilo)(?![\p{L}])/iu;
// contextos facultativos: proibidos em QUALQUER frase (deixariam duas respostas certas)
const CASO_FACULTATIVO: [RegExp, string][] = [
  [/(^|[^\p{L}])(à|a)s?\s+(minha|tua|sua|nossa)s?(?![\p{L}])/iu, "pronome possessivo feminino depois de a/à"], // sem "vossa": "à Vossa Senhoria" é pronome de tratamento
  [/(^|[^\p{L}])até\s+(à|a)s?(?![\p{L}])/iu, "'até a/à'"],
];

export function conferirFrase(frase: string, regra: RegraCrase): string | null {
  for (const [re, nome] of CASO_FACULTATIVO)
    if (re.test(frase)) return `usa caso de crase facultativa (${nome}), proibido neste formato`;
  const tem = TEM_ACENTO_CRASE.test(frase);
  if (regra.temCrase && !tem) return `deveria ter "à/às" (regra: ${regra.nome}), mas não tem`;
  if (!regra.temCrase && tem) return `não deveria ter "à/às" (regra: ${regra.nome}), mas tem`;
  return null;
}
