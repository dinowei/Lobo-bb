// ============================================================
// BB Estudos — Verificação determinística de contas (regra 10)
// Em Matemática, Matemática Financeira e Probabilidade e Estatística o número
// da alternativa correta é conferido por código (mathjs), nunca só pela IA.
// ============================================================
import { all, create } from "mathjs";
import { z } from "zod";
import type { Disciplina } from "../shared/tipos.js";

export const DISCIPLINAS_DE_CALCULO: readonly Disciplina[] = [
  "matematica",
  "matematica_financeira",
  "probabilidade_estatistica",
];
export const ehDisciplinaDeCalculo = (d: string) => (DISCIPLINAS_DE_CALCULO as readonly string[]).includes(d);

export const VerificacaoZ = z.object({
  expressao: z.string().min(1),
  fatoresDados: z.record(z.string(), z.coerce.number()).nullish(),
});
export type Verificacao = z.infer<typeof VerificacaoZ>;

// mathjs com as funções perigosas desligadas (nada de eval, import, createUnit…)
const math = create(all);
const avaliar = math.evaluate;
const bloqueada = () => {
  throw new Error("função bloqueada na verificação");
};
math.import(
  { import: bloqueada, createUnit: bloqueada, evaluate: bloqueada, parse: bloqueada, simplify: bloqueada, derivative: bloqueada, resolve: bloqueada, reviver: bloqueada },
  { override: true }
);

function calcular(expressao: string): number {
  const limpa = expressao.replace(/[×·]/g, "*").replace(/÷/g, "/").replace(/−/g, "-");
  const v = avaliar(limpa);
  if (typeof v !== "number" || !Number.isFinite(v)) throw new Error(`a expressão não resultou em um número: ${expressao}`);
  return v;
}

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// "R$ 1.234,56" → 1234.56 · "12,5%" → 12.5 · "3/8" → 0.375
const RE_FRACAO = /(-?\d+)\s*\/\s*(\d+)/g;
// "6050.00" (ponto + 1–2 dígitos no fim) é decimal à inglesa; "6.050" é milhar
const TEM_FRACAO = /\d\s*\/\s*\d/;
const RE_NUMERO = /[-−]?\d+\.\d{1,2}(?![\d.,])|[-−]?\d{1,3}(?:\.\d{3})+(?:,\d+)?|[-−]?\d+(?:,\d+)?/g;
const paraNumero = (s: string) =>
  /^[-−]?\d+\.\d{1,2}$/.test(s)
    ? Number(s.replace(/−/g, "-"))
    : Number(s.replace(/−/g, "-").replace(/\./g, "").replace(",", "."));

export function numerosDoTexto(texto: string): number[] {
  const fracoes = [...texto.matchAll(RE_FRACAO)].map((m) => Number(m[1]) / Number(m[2]));
  const resto = texto.replace(RE_FRACAO, " ");
  return [...fracoes, ...[...resto.matchAll(RE_NUMERO)].map((m) => paraNumero(m[0]))];
}

function bate(valorAlternativa: number, esperado: number, texto: string): boolean {
  if (/R\$/.test(texto)) return Math.abs(valorAlternativa - esperado) <= 0.01 + 1e-9;
  const rel = (a: number, b: number) => (b === 0 ? Math.abs(a) <= 1e-9 : Math.abs(a - b) / Math.abs(b) <= 0.005);
  // "12,5%" pode ter vindo de uma expressão que dá 12.5 ou 0.125
  return rel(valorAlternativa, esperado) || (/%/.test(texto) && rel(valorAlternativa / 100, esperado));
}

// Distrator "igual" à resposta: na precisão em que a CORRETA está escrita
// (com a correta "2,01%", o distrator "2,00%" é diferente; frações comparam exato)
function coincide(valorAlternativa: number, esperado: number, texto: string, textoCorreta: string): boolean {
  if (/R\$/.test(texto)) return Math.abs(valorAlternativa - esperado) <= 0.01 + 1e-9;
  const alvos = /%/.test(texto) ? [esperado, esperado * 100] : [esperado];
  if (TEM_FRACAO.test(texto) || TEM_FRACAO.test(textoCorreta)) {
    return alvos.some((e) => Math.abs(valorAlternativa - e) <= 1e-9 * Math.max(1, Math.abs(e)));
  }
  const casas = textoCorreta.match(/,(\d+)/)?.[1].length ?? 0;
  const arred = (x: number) => Math.round(x * 10 ** casas) / 10 ** casas;
  return alvos.some((e) => arred(valorAlternativa) === arred(e));
}

export type ResultadoVerificacao =
  | { ok: true; valorEsperado: number | null }
  | { ok: false; motivo: string; detalhes: string[] };

type QuestaoParaVerificar = {
  enunciado: string;
  textoBase?: string | null;
  gabarito: string;
  alternativas: { letra: string; texto: string }[];
  verificacao?: Verificacao | null;
};

export function verificarConta(q: QuestaoParaVerificar): ResultadoVerificacao {
  const correta = q.alternativas.find((a) => a.letra === q.gabarito);
  if (!correta) return { ok: false, motivo: "conta_nao_confere", detalhes: ["alternativa do gabarito não encontrada"] };
  const nums = numerosDoTexto(correta.texto);

  // resposta sem número (ex.: "o SAC tem parcelas decrescentes"): não há conta a conferir
  if (!q.verificacao) {
    return nums.length
      ? { ok: false, motivo: "sem_verificacao", detalhes: ["questão de cálculo sem o campo verificacao"] }
      : { ok: true, valorEsperado: null };
  }
  if (nums.length !== 1)
    return {
      ok: false,
      motivo: "conta_nao_verificavel",
      detalhes: [`a alternativa ${correta.letra} precisa ter exatamente um número ("${correta.texto}")`],
    };

  // fatores dados no enunciado (ex.: 1,04^8 = 1,3686): a conta usa O FATOR DADO
  let expressao = q.verificacao.expressao;
  const numerosEnunciado = numerosDoTexto(`${q.textoBase ?? ""}\n${q.enunciado}`);
  try {
    for (const [chave, valor] of Object.entries(q.verificacao.fatoresDados ?? {})) {
      if (!numerosEnunciado.some((n) => Math.abs(n - valor) < 1e-9))
        return { ok: false, motivo: "conta_nao_confere", detalhes: [`fator ${chave} = ${valor} não aparece no enunciado`] };
      const real = calcular(chave);
      if (Math.abs(real - valor) / Math.abs(real) > 0.005)
        return { ok: false, motivo: "conta_nao_confere", detalhes: [`fator dado errado: ${chave} vale ${real}, não ${valor}`] };
      expressao = expressao.replace(new RegExp(escapar(chave).replace(/\s+/g, "\\s*"), "g"), `(${valor})`);
    }
  } catch (e) {
    return { ok: false, motivo: "conta_nao_confere", detalhes: [`fator inválido: ${String(e)}`] };
  }

  let esperado: number;
  try {
    esperado = calcular(expressao);
  } catch (e) {
    return { ok: false, motivo: "conta_nao_confere", detalhes: [`expressão inválida "${q.verificacao.expressao}": ${String(e)}`] };
  }

  if (!bate(nums[0], esperado, correta.texto))
    return {
      ok: false,
      motivo: "conta_nao_confere",
      detalhes: [`${q.verificacao.expressao} = ${esperado}, mas a alternativa ${correta.letra} diz "${correta.texto}"`],
    };

  for (const a of q.alternativas) {
    if (a.letra === correta.letra) continue;
    if (numerosDoTexto(a.texto).some((n) => coincide(n, esperado, a.texto, correta.texto)))
      return {
        ok: false,
        motivo: "conta_nao_confere",
        detalhes: [`a alternativa errada ${a.letra} ("${a.texto}") também dá o valor certo ${esperado}`],
      };
  }
  return { ok: true, valorEsperado: esperado };
}
