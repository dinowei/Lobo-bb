// ============================================================
// Aula completa de Matemática por CONSTRUÇÃO (decisão do dono, 28/10/2026; regras 10 e 12)
// O código sorteia os números, monta exemplos, contraexemplos e pegadinhas e confere cada resultado com mathjs.
// A IA só redige a explicação em volta e não pode trazer número que não esteja aqui. Moeda sempre R$;
// fórmula em texto legível (nada de LaTeX).
// ============================================================
import { calcular } from "./verificacao.js";

export type ExemploMat = { enunciado: string; passos: string[]; resposta: string; expressao: string; valor: number };
export type ContraMat = { texto: string; expressaoErrada: string; valorErrado: number; expressaoCerta: string; valorCerto: number };
export type MaterialMat = { formula: string; exemplos: ExemploMat[]; contraexemplos: ContraMat[]; pegadinhas: string[] };

export const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/ /g, " ");
const num = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const pct = (v: number) => `${num(v)}%`;

// sorteio reprodutível (a prova pode ser refeita com os mesmos números)
function sorteador(semente: number) {
  let s = semente >>> 0 || 1;
  const prox = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  return <T>(xs: readonly T[]): T => xs[Math.floor(prox() * xs.length)];
}

// confere por mathjs: o valor do exemplo tem de ser exatamente o da expressão
function conferido(expressao: string, valor: number): number {
  const v = calcular(expressao);
  if (Math.abs(v - valor) > 1e-9) throw new Error(`conta não confere: ${expressao} = ${v}, não ${valor}`);
  return v;
}

function grandezasProporcionais(sortear: ReturnType<typeof sorteador>): MaterialMat {
  // direta: k caixas atendem c clientes; n caixas atendem?
  const k = sortear([2, 3, 4, 5]), c = k * sortear([30, 40, 45, 60]), n = sortear([6, 8, 10].filter((x) => x !== k));
  const direta = c * n / k;
  // inversa: f funcionários fazem em d dias; g funcionários fazem em?
  const [f, d, g] = sortear([[6, 10, 4], [8, 9, 6], [5, 12, 3], [9, 8, 6]] as const);
  const inversa = f * d / g;
  // direta com valor em R$: preço por quilo constante
  const [kg, preco, kg2] = sortear([[3, 36, 5], [4, 50, 6], [2, 18, 7]] as const);
  const custo = preco * kg2 / kg;
  return {
    formula: "Diretamente proporcionais: a razão fica constante (A ÷ B = constante). Inversamente proporcionais: o produto fica constante (A × B = constante).",
    exemplos: [
      { enunciado: `${k} caixas eletrônicos atendem ${c} clientes por hora. Quantos clientes ${n} caixas atendem no mesmo tempo?`, passos: [`Mais caixas, mais clientes: grandezas diretamente proporcionais.`, `${c} × ${n} ÷ ${k}`], resposta: `${num(direta)} clientes`, expressao: `${c} * ${n} / ${k}`, valor: conferido(`${c} * ${n} / ${k}`, direta) },
      { enunciado: `${f} funcionários conferem um lote de contratos em ${d} dias. Em quantos dias ${g} funcionários conferem o mesmo lote?`, passos: [`Menos funcionários, mais dias: grandezas inversamente proporcionais.`, `${f} × ${d} ÷ ${g}`], resposta: `${num(inversa)} dias`, expressao: `${f} * ${d} / ${g}`, valor: conferido(`${f} * ${d} / ${g}`, inversa) },
      { enunciado: `${kg} kg de um produto custam ${reais(preco)}. Quanto custam ${kg2} kg?`, passos: [`Mais quilos, mais reais: grandezas diretamente proporcionais.`, `${num(preco)} × ${kg2} ÷ ${kg}`], resposta: reais(custo), expressao: `${preco} * ${kg2} / ${kg}`, valor: conferido(`${preco} * ${kg2} / ${kg}`, custo) },
    ],
    contraexemplos: [
      { texto: `Tratar a relação inversa como direta: ${g} funcionários em ${num(d * g / f)} dias está errado; o certo é ${num(inversa)} dias.`, expressaoErrada: `${d} * ${g} / ${f}`, valorErrado: conferido(`${d} * ${g} / ${f}`, d * g / f), expressaoCerta: `${f} * ${d} / ${g}`, valorCerto: inversa },
    ],
    pegadinhas: [
      `Antes de montar a regra de três, pergunte "se uma aumenta, a outra aumenta ou diminui?". Em ${f} funcionários × ${d} dias, mais gente significa menos dias.`,
      `Se ${kg} kg custam ${reais(preco)}, ${kg2} kg custam ${reais(custo)}: o preço por quilo é o mesmo, então a razão entre reais e quilos não muda.`,
    ],
  };
}

function regraDeTresComposta(sortear: ReturnType<typeof sorteador>): MaterialMat {
  // a atendentes, em h horas, atendem c clientes; b atendentes em j horas atendem?
  const [a, h, c, b, j] = sortear([[3, 5, 90, 5, 6], [4, 6, 120, 6, 5], [2, 8, 64, 3, 6], [5, 4, 100, 4, 5]] as const);
  const certo = c * (b / a) * (j / h);
  // inversa na composta: p pessoas em t dias fazem q relatórios; quantos dias r pessoas levam para s relatórios?
  const [p, t, q, r, s] = sortear([[4, 6, 30, 6, 45], [3, 8, 24, 4, 32], [5, 6, 40, 6, 48]] as const);
  const dias = t * (p / r) * (s / q);
  const errado = c * (a / b) * (j / h);
  return {
    formula: "Regra de três composta: compare cada grandeza com a que se quer achar, uma de cada vez. Diretamente proporcional entra como está; inversamente proporcional entra invertida.",
    exemplos: [
      { enunciado: `${a} atendentes, em ${h} horas, atendem ${c} clientes. Quantos clientes ${b} atendentes atendem em ${j} horas?`, passos: [`Atendentes e clientes: diretas. Horas e clientes: diretas.`, `${c} × (${b} ÷ ${a}) × (${j} ÷ ${h})`], resposta: `${num(certo)} clientes`, expressao: `${c} * (${b} / ${a}) * (${j} / ${h})`, valor: conferido(`${c} * (${b} / ${a}) * (${j} / ${h})`, certo) },
      { enunciado: `${p} analistas fazem ${q} relatórios em ${t} dias. Em quantos dias ${r} analistas fazem ${s} relatórios?`, passos: [`Mais analistas, menos dias: inversa (entra invertida). Mais relatórios, mais dias: direta.`, `${t} × (${p} ÷ ${r}) × (${s} ÷ ${q})`], resposta: `${num(dias)} dias`, expressao: `${t} * (${p} / ${r}) * (${s} / ${q})`, valor: conferido(`${t} * (${p} / ${r}) * (${s} / ${q})`, dias) },
    ],
    contraexemplos: [
      { texto: `Inverter uma grandeza direta: ${c} × (${a} ÷ ${b}) × (${j} ÷ ${h}) dá ${num(errado)} clientes, errado; o certo é ${num(certo)}.`, expressaoErrada: `${c} * (${a} / ${b}) * (${j} / ${h})`, valorErrado: conferido(`${c} * (${a} / ${b}) * (${j} / ${h})`, errado), expressaoCerta: `${c} * (${b} / ${a}) * (${j} / ${h})`, valorCerto: certo },
    ],
    pegadinhas: [
      `A banca mistura uma grandeza inversa no meio das diretas: no exemplo dos analistas, mais gente reduz os dias, então ${p} ÷ ${r} entra invertido em relação ao número de analistas.`,
      `Compare cada grandeza sempre com a que se quer descobrir, nunca uma com a outra.`,
    ],
  };
}

function aumentosEDescontos(sortear: ReturnType<typeof sorteador>): MaterialMat {
  const preco = sortear([200, 500, 800, 1000]), i = sortear([10, 20, 25]);
  const aumentaDesconta = preco * (1 + i / 100) * (1 - i / 100);
  const [x, y] = sortear([[10, 20], [20, 30], [10, 30]] as const);
  const fator = (1 + x / 100) * (1 + y / 100);
  const equivalente = (fator - 1) * 100;
  const [d1, d2] = sortear([[10, 20], [20, 25], [10, 10]] as const);
  const fatorD = (1 - d1 / 100) * (1 - d2 / 100);
  const descontoEq = (1 - fatorD) * 100;
  return {
    formula: "Aumento de i%: multiplique por (1 + i ÷ 100). Desconto de d%: multiplique por (1 − d ÷ 100). Sucessivos: multiplique os fatores; o percentual equivalente é (produto − 1) × 100.",
    exemplos: [
      { enunciado: `Um produto de ${reais(preco)} sobe ${pct(i)} e depois cai ${pct(i)}. Qual o preço final?`, passos: [`Fatores: ${num(1 + i / 100)} e ${num(1 - i / 100)}.`, `${num(preco)} × ${num(1 + i / 100)} × ${num(1 - i / 100)}`], resposta: reais(aumentaDesconta), expressao: `${preco} * (1 + ${i}/100) * (1 - ${i}/100)`, valor: conferido(`${preco} * (1 + ${i}/100) * (1 - ${i}/100)`, aumentaDesconta) },
      { enunciado: `Uma tarifa sobe ${pct(x)} e, no mês seguinte, mais ${pct(y)}. Qual o aumento total?`, passos: [`Produto dos fatores: ${num(1 + x / 100)} × ${num(1 + y / 100)} = ${num(fator)}.`, `(${num(fator)} − 1) × 100`], resposta: pct(equivalente), expressao: `((1 + ${x}/100) * (1 + ${y}/100) - 1) * 100`, valor: conferido(`((1 + ${x}/100) * (1 + ${y}/100) - 1) * 100`, equivalente) },
      { enunciado: `Dois descontos sucessivos de ${pct(d1)} e ${pct(d2)} equivalem a um desconto único de quanto?`, passos: [`Produto dos fatores: ${num(1 - d1 / 100)} × ${num(1 - d2 / 100)} = ${num(fatorD)}.`, `(1 − ${num(fatorD)}) × 100`], resposta: pct(descontoEq), expressao: `(1 - (1 - ${d1}/100) * (1 - ${d2}/100)) * 100`, valor: conferido(`(1 - (1 - ${d1}/100) * (1 - ${d2}/100)) * 100`, descontoEq) },
    ],
    contraexemplos: [
      { texto: `Somar os percentuais: ${pct(x)} + ${pct(y)} = ${pct(x + y)} está errado; o aumento total é ${pct(equivalente)}.`, expressaoErrada: `${x} + ${y}`, valorErrado: conferido(`${x} + ${y}`, x + y), expressaoCerta: `((1 + ${x}/100) * (1 + ${y}/100) - 1) * 100`, valorCerto: equivalente },
      { texto: `Achar que subir ${pct(i)} e cair ${pct(i)} volta ao preço inicial: o preço final é ${reais(aumentaDesconta)}, não ${reais(preco)}.`, expressaoErrada: `${preco}`, valorErrado: preco, expressaoCerta: `${preco} * (1 + ${i}/100) * (1 - ${i}/100)`, valorCerto: aumentaDesconta },
    ],
    pegadinhas: [
      `Aumento e desconto de mesma taxa nunca se anulam: o desconto incide sobre um valor maior que o original.`,
      `Descontos de ${pct(d1)} e ${pct(d2)} não somam ${pct(d1 + d2)}: o desconto único é ${pct(descontoEq)}.`,
    ],
  };
}

const POR_SUBTEMA: Record<string, (s: ReturnType<typeof sorteador>) => MaterialMat> = {
  "grandezas proporcionais": grandezasProporcionais,
  "regra de três composta": regraDeTresComposta,
  "aumentos e descontos sucessivos": aumentosEDescontos,
};
export const subtemasComConstrucao = () => Object.keys(POR_SUBTEMA);
export function materialMatematica(subtema: string, semente = 2810): MaterialMat | null {
  const f = POR_SUBTEMA[subtema];
  return f ? f(sorteador(semente)) : null;
}
