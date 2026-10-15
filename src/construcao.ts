// ============================================================
// BB Estudos — Matemática por construção
// O CÓDIGO sorteia os parâmetros (valores redondos, fatores tabelados com 4 casas),
// calcula a resposta e monta os distratores a partir de erros clássicos.
// A IA só escreve o enunciado, as explicações e as pegadinhas, sem mexer em número.
// A verificação por mathjs (verificacao.ts) continua como trava final.
// Por enquanto: Juros compostos e Descontos.
// ============================================================
import type { Letra } from "../shared/tipos.js";

export type Distrator = { valor: number; erro: string };

export type Construida = {
  tipo: string; // nome do template (vai para a variação salva)
  duasEtapas: boolean;
  pergunta: string; // o que a questão pede, em uma frase
  dados: string[]; // trechos que o enunciado precisa conter LITERALMENTE
  fatoresDados: Record<string, number>; // ex.: {"1.04^8": 1.3686}
  expressao: string; // gera a resposta certa (usa as chaves de fatoresDados)
  resolucao: string; // passo a passo com os números, para a IA explicar
  unidade: "reais" | "percentual" | "meses";
  correta: number;
  distratores: Distrator[]; // candidatos; o código escolhe 4 distintos
};

export type Montada = Construida & {
  gabarito: Letra;
  alternativas: { letra: Letra; texto: string; correta: boolean; erro: string | null }[];
};

// ---------- utilidades ----------
const sortear = <T>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)];
const r2 = (x: number) => Math.round(x * 100) / 100;
const r4 = (x: number) => Math.round(x * 10000) / 10000;
const brl = (x: number) => `R$ ${x.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num4 = (x: number) => x.toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
const pct = (x: number) => `${x.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
const taxaTxt = (i: number) => `${(i * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
const base = (i: number) => String(r4(1 + i)); // 1.04
const fatorChave = (i: number, n: number) => `${base(i)}^${n}`; // "1.04^8"
const fatorTxt = (i: number, n: number, f: number) => `${base(i).replace(".", ",")}^${n} = ${num4(f)}`; // "1,04^8 = 1,3686"
const fator = (i: number, n: number) => r4((1 + i) ** n);
// erro clássico "prazo errado", para os dois lados (n ± 1, n ± 2)
const prazoErrado = (n: number, valor: (k: number) => number): Distrator[] =>
  [n - 2, n - 1, n + 1, n + 2].filter((k) => k > 0).map((k) => ({ valor: valor(k), erro: `usou n = ${k} em vez de ${n}` }));
// erro clássico "arredondamento antecipado" do fator, para baixo e para cima
const arredondouFator = (F: number, valor: (f: number) => number): Distrator[] => [
  { valor: valor(Math.floor(F * 100) / 100), erro: `arredondou o fator antes da hora: ${num4(F)} → ${(Math.floor(F * 100) / 100).toLocaleString("pt-BR")}` },
  { valor: valor(Math.ceil(F * 100) / 100), erro: `arredondou o fator para cima antes da hora: ${num4(F)} → ${(Math.ceil(F * 100) / 100).toLocaleString("pt-BR")}` },
];

export function formatar(valor: number, unidade: Construida["unidade"]): string {
  if (unidade === "reais") return brl(valor);
  if (unidade === "percentual") return pct(valor);
  return `${valor} ${valor === 1 ? "mês" : "meses"}`;
}

// ---------- Juros compostos ----------
const TAXAS_MES = [0.01, 0.02, 0.03, 0.04, 0.05];
const capitalRedondo = () => sortear([2000, 2500, 3000, 4000, 5000, 6000, 8000, 10000, 12000, 15000, 20000]);

function jcMontante(): Construida {
  const C = capitalRedondo();
  const i = sortear(TAXAS_MES);
  const n = sortear([4, 5, 6, 8, 10, 12]);
  const F = fator(i, n);
  const M = r2(C * F);
  return {
    tipo: "calcular o montante",
    duasEtapas: false,
    pergunta: "o montante ao final do prazo",
    dados: [brl(C), `${taxaTxt(i)} ao mês`, `${n} meses`, fatorTxt(i, n, F)],
    fatoresDados: { [fatorChave(i, n)]: F },
    expressao: `${C} * ${fatorChave(i, n)}`,
    resolucao: `M = C × (1 + i)^n = ${brl(C)} × ${num4(F)} = ${brl(M)}`,
    unidade: "reais",
    correta: M,
    distratores: [
      { valor: r2(C * (1 + i * n)), erro: `usou juros simples: ${brl(C)} × (1 + ${taxaTxt(i)} × ${n})` },
      { valor: r2(C * F - C), erro: "calculou só os juros (M − C) e respondeu como montante" },
      { valor: r2(M + C * i * n), erro: "somou ainda os juros simples ao montante composto" },
      { valor: r2(2 * M - C), erro: "contou os juros duas vezes (M + juros)" },
      ...prazoErrado(n, (k) => r2(C * fator(i, k))),
      ...arredondouFator(F, (f) => r2(C * f)),
    ],
  };
}

function jcCapital(): Construida {
  const C = capitalRedondo();
  const i = sortear(TAXAS_MES);
  const n = sortear([4, 5, 6, 8, 10, 12]);
  const F = fator(i, n);
  const M = r2(C * F); // C redondo e F com 4 casas → M exato, e M / F volta a C
  return {
    tipo: "calcular o capital (valor presente)",
    duasEtapas: false,
    pergunta: "o capital aplicado hoje (valor presente)",
    dados: [brl(M), `${taxaTxt(i)} ao mês`, `${n} meses`, fatorTxt(i, n, F)],
    fatoresDados: { [fatorChave(i, n)]: F },
    expressao: `${M} / ${fatorChave(i, n)}`,
    resolucao: `C = M / (1 + i)^n = ${brl(M)} / ${num4(F)} = ${brl(C)}`,
    unidade: "reais",
    correta: C,
    distratores: [
      { valor: r2(M * F), erro: "multiplicou pelo fator em vez de dividir" },
      { valor: r2(M / (1 + i * n)), erro: `usou juros simples: ${brl(M)} / (1 + ${taxaTxt(i)} × ${n})` },
      { valor: r2(M - M * i * n), erro: "descontou juros simples do montante (M − M·i·n)" },
      { valor: r2(M - C), erro: "respondeu os juros (M − C) em vez do capital" },
      { valor: M, erro: "respondeu o próprio montante, sem descapitalizar" },
      ...prazoErrado(n, (k) => r2(M / fator(i, k))),
      ...arredondouFator(F, (f) => r2(M / f)),
    ],
  };
}

function jcTaxa(): Construida {
  const C = capitalRedondo();
  const n = sortear([4, 6, 8, 10, 12]);
  const i = sortear(TAXAS_MES);
  const tabela = TAXAS_MES.map((t) => ({ t, f: fator(t, n) }));
  const F = fator(i, n);
  const M = r2(C * F);
  const fatoresDados = Object.fromEntries(tabela.map(({ t, f }) => [fatorChave(t, n), f]));
  const iPct = i * 100;
  return {
    tipo: "calcular a taxa",
    duasEtapas: false,
    pergunta: "a taxa mensal de juros compostos da aplicação",
    dados: [brl(C), brl(M), `${n} meses`, ...tabela.map(({ t, f }) => fatorTxt(t, n, f))],
    fatoresDados,
    expressao: `(nthRoot(${M} / ${C}, ${n}) - 1) * 100`, // taxa que leva C a M em n meses
    resolucao: `M / C = ${brl(M)} / ${brl(C)} = ${num4(F)}, que na tabela corresponde a (1 + ${taxaTxt(i)})^${n}. Logo i = ${taxaTxt(i)} ao mês.`,
    unidade: "percentual",
    correta: iPct,
    distratores: [
      { valor: r2(((M / C - 1) / n) * 100), erro: `dividiu o rendimento total por n, como em juros simples: (${num4(F)} − 1) / ${n}` },
      { valor: r2((M / C - 1) * 100), erro: "deu a taxa do período inteiro, não a mensal" },
      ...TAXAS_MES.filter((t) => t !== i).map((t) => ({ valor: t * 100, erro: `leu a linha errada da tabela (${taxaTxt(t)})` })),
    ],
  };
}

function jcPrazo(): Construida {
  const C = capitalRedondo();
  const i = sortear(TAXAS_MES);
  const n = sortear([4, 5, 6, 8, 10, 12]);
  const prazos = [n - 2, n - 1, n, n + 1, n + 2].filter((k) => k > 0);
  const tabela = prazos.map((k) => ({ k, f: fator(i, k) }));
  const F = fator(i, n);
  const M = r2(C * F);
  const nSimples = Math.round((M / C - 1) / i);
  return {
    tipo: "calcular o prazo",
    duasEtapas: false,
    pergunta: "o prazo da aplicação, em meses",
    dados: [brl(C), brl(M), `${taxaTxt(i)} ao mês`, ...tabela.map(({ k, f }) => fatorTxt(i, k, f))],
    fatoresDados: Object.fromEntries(tabela.map(({ k, f }) => [fatorChave(i, k), f])),
    expressao: `log(${M} / ${C}) / log(${base(i)})`, // prazo que leva C a M à taxa i
    resolucao: `M / C = ${brl(M)} / ${brl(C)} = ${num4(F)}, que na tabela é (1 + ${taxaTxt(i)})^${n}. Logo n = ${n} meses.`,
    unidade: "meses",
    correta: n,
    distratores: [
      { valor: nSimples, erro: `usou juros simples: (M/C − 1) / i ≈ ${nSimples}` },
      ...[n - 4, n - 3, n - 2, n - 1, n + 1, n + 2, n + 3, n + 4].filter((k) => k > 0).map((k) => ({ valor: k, erro: `leu a linha errada da tabela ou contou errado (n = ${k})` })),
    ],
  };
}

function jcTaxaEquivalente(): Construida {
  const i = sortear([0.01, 0.02, 0.03]);
  const n = sortear([2, 3, 6, 12]);
  const F = fator(i, n);
  const periodo = { 2: "bimestral", 3: "trimestral", 6: "semestral", 12: "anual" }[n]!;
  const eq = r2((F - 1) * 100);
  return {
    tipo: "taxa equivalente",
    duasEtapas: false,
    pergunta: `a taxa ${periodo} equivalente a ${taxaTxt(i)} ao mês no regime composto`,
    dados: [`${taxaTxt(i)} ao mês`, fatorTxt(i, n, F)],
    fatoresDados: { [fatorChave(i, n)]: F },
    expressao: `(${fatorChave(i, n)} - 1) * 100`,
    resolucao: `(1 + i)^${n} − 1 = ${num4(F)} − 1 = ${num4(F - 1)} → ${pct(eq)} ${periodo}`,
    unidade: "percentual",
    correta: eq,
    distratores: [
      { valor: r2(i * n * 100), erro: `usou taxa proporcional (${taxaTxt(i)} × ${n}) no lugar da equivalente` },
      { valor: r2(F * 100), erro: "esqueceu de subtrair 1 do fator" },
      { valor: r2(i * 100), erro: "repetiu a taxa mensal, sem converter" },
      ...prazoErrado(n, (k) => r2((fator(i, k) - 1) * 100)).map((d) => ({ ...d, erro: d.erro.replace("usou n", "elevou a") })),
      ...arredondouFator(F, (f) => r2((f - 1) * 100)),
    ],
  };
}

function jcComparar(): Construida {
  const C = capitalRedondo();
  const i = sortear(TAXAS_MES);
  const n = sortear([6, 8, 10, 12]);
  const F = fator(i, n);
  const Mc = r2(C * F);
  const Ms = r2(C * (1 + i * n));
  return {
    tipo: "comparar duas opções de aplicação ou pagamento",
    duasEtapas: true,
    pergunta: `quanto a opção em juros compostos rende a mais que a opção em juros simples, ambas a ${taxaTxt(i)} ao mês por ${n} meses`,
    dados: [brl(C), `${taxaTxt(i)} ao mês`, `${n} meses`, fatorTxt(i, n, F)],
    fatoresDados: { [fatorChave(i, n)]: F },
    expressao: `${C} * ${fatorChave(i, n)} - ${C} * (1 + ${i} * ${n})`,
    resolucao: `Compostos: ${brl(C)} × ${num4(F)} = ${brl(Mc)}. Simples: ${brl(C)} × (1 + ${taxaTxt(i)} × ${n}) = ${brl(Ms)}. Diferença: ${brl(r2(Mc - Ms))}`,
    unidade: "reais",
    correta: r2(Mc - Ms),
    distratores: [
      { valor: r2(Mc - C), erro: "respondeu só os juros compostos, sem comparar" },
      { valor: r2(Ms - C), erro: "respondeu só os juros simples, sem comparar" },
      { valor: r2(Mc + Ms - 2 * C), erro: "somou os juros das duas opções em vez de subtrair" },
      { valor: r2((Mc - Ms) / n), erro: "dividiu a diferença pelo número de meses" },
      ...(i > 0.01 ? [{ valor: r2(C * fator(i - 0.01, n) - C * (1 + (i - 0.01) * n)), erro: `usou ${taxaTxt(i - 0.01)} em vez de ${taxaTxt(i)}` }] : []),
      { valor: r2(C * fator(i + 0.01, n) - C * (1 + (i + 0.01) * n)), erro: `usou ${taxaTxt(i + 0.01)} em vez de ${taxaTxt(i)}` },
      ...[n - 3, n - 4].filter((k) => k > 0).map((k) => ({ valor: r2(C * fator(i, k) - C * (1 + i * k)), erro: `comparou as opções com n = ${k}` })),
      ...prazoErrado(n, (k) => r2(C * fator(i, k) - C * (1 + i * k))).map((d) => ({ ...d, erro: `comparou as opções com ${d.erro.slice(5)}` })),
      ...arredondouFator(F, (f) => r2(C * f - Ms)),
    ],
  };
}

// duas etapas: aplica, depois reaplica o montante em outra condição
function jcReaplicacao(): Construida {
  const C = capitalRedondo();
  const i1 = sortear(TAXAS_MES);
  const i2 = sortear(TAXAS_MES.filter((t) => t !== i1));
  const n1 = sortear([2, 3, 4, 6]);
  const n2 = sortear([2, 3, 4, 6]);
  const F1 = fator(i1, n1);
  const F2 = fator(i2, n2);
  const M1 = r2(C * F1);
  const M2 = r2(M1 * F2);
  return {
    tipo: "duas etapas: aplicação e reaplicação do montante",
    duasEtapas: true,
    pergunta: "o montante final após as duas aplicações",
    dados: [brl(C), `${taxaTxt(i1)} ao mês`, `${n1} meses`, `${taxaTxt(i2)} ao mês`, `${n2} meses`, fatorTxt(i1, n1, F1), fatorTxt(i2, n2, F2)],
    fatoresDados: { [fatorChave(i1, n1)]: F1, [fatorChave(i2, n2)]: F2 },
    expressao: `round(${C} * ${fatorChave(i1, n1)}, 2) * ${fatorChave(i2, n2)}`,
    resolucao: `1ª etapa: ${brl(C)} × ${num4(F1)} = ${brl(M1)}. 2ª etapa: ${brl(M1)} × ${num4(F2)} = ${brl(M2)}`,
    unidade: "reais",
    correta: M2,
    distratores: [
      { valor: M1, erro: "parou na primeira etapa (esqueceu a reaplicação)" },
      { valor: r2(C * F2), erro: "aplicou só a segunda condição sobre o capital inicial" },
      { valor: r2(C * (1 + i1 * n1) * (1 + i2 * n2)), erro: "usou juros simples nas duas etapas" },
      { valor: r2(C * fator((i1 + i2) / 2, n1 + n2)), erro: "usou a média das taxas no prazo total" },
      { valor: r2(Math.round(M1) * F2), erro: `arredondou o montante intermediário para ${brl(Math.round(M1))} antes da 2ª etapa` },
      { valor: r2(C * fator(i1 + i2, n1 + n2)), erro: "somou as duas taxas e aplicou no prazo total" },
      { valor: r2(M1 * fator(i2, n2 + 1)), erro: `usou ${n2 + 1} meses na 2ª etapa` },
      { valor: r2(M1 * F2 + (M1 - C)), erro: "somou de novo os juros da 1ª etapa no final" },
      { valor: r2(C * fator(Math.max(i1, i2), n1 + n2)), erro: "usou a maior taxa no prazo total" },
      { valor: r2(C * fator(Math.min(i1, i2), n1 + n2)), erro: "usou a menor taxa no prazo total" },
    ],
  };
}

// ---------- Descontos (simples) ----------
const nominalRedondo = () => sortear([2000, 3000, 4000, 5000, 6000, 8000, 10000, 12000, 15000, 20000]);
const TAXAS_DESC = [0.01, 0.015, 0.02, 0.025, 0.03, 0.04];

function descComercial(pedeValorAtual: boolean): Construida {
  const N = nominalRedondo();
  const d = sortear(TAXAS_DESC);
  const n = sortear([2, 3, 4, 5, 6]);
  const D = r2(N * d * n);
  const A = r2(N - D);
  const Dr = r2(N - N / (1 + d * n));
  return {
    tipo: pedeValorAtual ? "valor atual de um título" : "desconto comercial simples",
    duasEtapas: false,
    pergunta: pedeValorAtual
      ? `o valor líquido recebido (valor atual) no desconto comercial simples, ${n} meses antes do vencimento`
      : `o valor do desconto comercial (por fora) simples, ${n} meses antes do vencimento`,
    dados: [brl(N), `${taxaTxt(d)} ao mês`, `${n} meses`],
    fatoresDados: {},
    expressao: pedeValorAtual ? `${N} - ${N} * ${d} * ${n}` : `${N} * ${d} * ${n}`,
    resolucao: `D = N × d × n = ${brl(N)} × ${taxaTxt(d)} × ${n} = ${brl(D)}${pedeValorAtual ? `; A = N − D = ${brl(A)}` : ""}`,
    unidade: "reais",
    correta: pedeValorAtual ? A : D,
    distratores: pedeValorAtual
      ? [
          { valor: r2(N / (1 + d * n)), erro: "usou desconto racional (por dentro) no lugar do comercial" },
          { valor: D, erro: "respondeu o desconto em vez do valor líquido" },
          ...prazoErrado(n, (k) => r2(N - N * d * k)),
          { valor: r2(N - N * d), erro: "descontou só um mês" },
          { valor: r2(N - 2 * D), erro: "descontou o desconto duas vezes" },
          { valor: r2(N * (1 - d) ** n), erro: "usou desconto composto" },
        ]
      : [
          { valor: Dr, erro: "usou desconto racional (por dentro) no lugar do comercial" },
          { valor: A, erro: "respondeu o valor líquido em vez do desconto" },
          ...prazoErrado(n, (k) => r2(N * d * k)),
          { valor: r2(N * d), erro: "calculou só um mês de desconto" },
          { valor: r2(N * (1 + d * n) * d * n), erro: "aplicou a taxa sobre o valor futuro (N corrigido) em vez do nominal" },
          { valor: r2(N - N * (1 - d) ** n), erro: "usou desconto composto" },
        ],
  };
}

function descRacional(): Construida {
  const d = sortear(TAXAS_DESC);
  const n = sortear([2, 3, 4, 5, 6]);
  // A redondo → N = A(1 + dn) exato; D = N − A
  const A = sortear([2000, 2500, 4000, 5000, 8000, 10000]);
  const N = r2(A * (1 + d * n));
  const D = r2(N - A);
  return {
    tipo: "desconto racional simples",
    duasEtapas: false,
    pergunta: `o valor do desconto racional (por dentro) simples, ${n} meses antes do vencimento`,
    dados: [brl(N), `${taxaTxt(d)} ao mês`, `${n} meses`],
    fatoresDados: {},
    expressao: `${N} - ${N} / (1 + ${d} * ${n})`,
    resolucao: `A = N / (1 + d × n) = ${brl(N)} / ${(1 + d * n).toLocaleString("pt-BR")} = ${brl(A)}; D = N − A = ${brl(D)}`,
    unidade: "reais",
    correta: D,
    distratores: [
      { valor: r2(N * d * n), erro: "usou desconto comercial (por fora) no lugar do racional" },
      { valor: A, erro: "respondeu o valor atual em vez do desconto" },
      ...prazoErrado(n, (k) => r2(N - N / (1 + d * k))),
      { valor: r2(N - N / (1 + d)), erro: "calculou só um mês" },
      { valor: r2(D / (1 + d * n)), erro: "dividiu o desconto pelo fator mais uma vez" },
      { valor: r2(N - N / (1 + d) ** n), erro: "usou desconto racional composto" },
    ],
  };
}

// duas etapas: acha o valor líquido e depois a taxa efetiva (juros simples) da operação
function descTaxaEfetiva(): Construida {
  const N = nominalRedondo();
  const d = sortear([0.02, 0.025, 0.03, 0.04]);
  const n = sortear([2, 3, 4, 5]);
  const D = r2(N * d * n);
  const A = r2(N - D);
  const ief = r2((D / A / n) * 100);
  return {
    tipo: "taxa efetiva de um desconto comercial",
    duasEtapas: true,
    pergunta: "a taxa efetiva mensal de juros simples paga na operação (sobre o valor líquido recebido)",
    dados: [brl(N), `${taxaTxt(d)} ao mês`, `${n} meses`],
    fatoresDados: {},
    expressao: `(${N} * ${d} * ${n}) / (${N} - ${N} * ${d} * ${n}) / ${n} * 100`,
    resolucao: `D = ${brl(N)} × ${taxaTxt(d)} × ${n} = ${brl(D)}; A = ${brl(A)}; taxa efetiva = D / (A × n) = ${brl(D)} / (${brl(A)} × ${n}) = ${pct(ief)} ao mês`,
    unidade: "percentual",
    correta: ief,
    distratores: [
      { valor: r2(d * 100), erro: "respondeu a própria taxa de desconto (ela incide sobre o nominal, não sobre o líquido)" },
      { valor: r2((D / A) * 100), erro: "deu a taxa do período inteiro, sem dividir por n" },
      { valor: r2((D / N / n) * 100), erro: "dividiu o desconto pelo valor nominal em vez do líquido" },
      { valor: r2(d * n * 100), erro: "somou a taxa de todos os meses" },
      { valor: r2((d / (1 + d)) * 100), erro: "converteu a taxa como se fosse desconto racional de um mês" },
      ...prazoErrado(n, (k) => r2(((N * d * k) / (N - N * d * k) / k) * 100)).filter((x) => x.valor > 0 && x.valor < 100),
    ],
  };
}

// ---------- catálogo ----------
type Template = () => Construida;
const CATALOGO: Record<string, { porTipo: Record<string, Template>; duasEtapas: Template[] }> = {
  "Juros compostos": {
    porTipo: {
      "calcular o montante": jcMontante,
      "calcular o capital (valor presente)": jcCapital,
      "calcular a taxa": jcTaxa,
      "calcular o prazo": jcPrazo,
      "taxa equivalente": jcTaxaEquivalente,
      "comparar duas opções de aplicação ou pagamento": jcComparar,
    },
    duasEtapas: [jcReaplicacao, jcComparar],
  },
  Descontos: {
    porTipo: {
      "desconto racional simples": descRacional,
      "desconto comercial simples": () => descComercial(false),
      "valor atual de um título": () => descComercial(true),
      "taxa efetiva de um desconto comercial": descTaxaEfetiva,
    },
    duasEtapas: [descTaxaEfetiva],
  },
};

export const temConstrucao = (assunto: string) => assunto in CATALOGO;

// Monta a questão: escolhe o template pelo tipo sorteado (ou um de duas etapas),
// fixa a correta na letra do gabarito e escolhe 4 distratores com valores distintos.
export function construir(assunto: string, tipo: string, duasEtapas: boolean, gabarito: Letra): Montada | null {
  const cat = CATALOGO[assunto];
  if (!cat) return null;
  const template = duasEtapas ? sortear(cat.duasEtapas) : cat.porTipo[tipo] ?? sortear(Object.values(cat.porTipo));

  // Alternativas em ordem crescente (como a banca faz) E a correta na letra sorteada:
  // escolhe distratores de modo que exatamente "pos" fiquem abaixo da correta.
  const pos = "ABCDE".indexOf(gabarito);
  const embaralhar = <T>(xs: T[]) => xs.map((x) => [Math.random(), x] as const).sort((a, b) => a[0] - b[0]).map(([, x]) => x);
  for (let tentativa = 0; tentativa < 300; tentativa++) {
    const c = template();
    const vistos = new Set([formatar(c.correta, c.unidade)]);
    const unicos: Distrator[] = [];
    for (const d of embaralhar(c.distratores)) {
      const txt = formatar(d.valor, c.unidade);
      if (!(d.valor > 0) || vistos.has(txt)) continue;
      vistos.add(txt);
      unicos.push(d);
    }
    const abaixo = unicos.filter((d) => d.valor < c.correta).slice(0, pos);
    const acima = unicos.filter((d) => d.valor > c.correta).slice(0, 4 - pos);
    if (abaixo.length !== pos || acima.length !== 4 - pos) continue; // sorteia parâmetros de novo

    const porValor = (a: Distrator, b: Distrator) => a.valor - b.valor;
    const ordem: (Distrator | null)[] = [...abaixo.sort(porValor), null, ...acima.sort(porValor)];
    const alternativas = ordem.map((d, k) => {
      const letra = "ABCDE"[k] as Letra;
      return d
        ? { letra, texto: formatar(d.valor, c.unidade), correta: false, erro: d.erro }
        : { letra, texto: formatar(c.correta, c.unidade), correta: true, erro: null };
    });
    return { ...c, gabarito, alternativas };
  }
  return null;
}
