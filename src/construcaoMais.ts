// ============================================================
// BB Estudos — Construção em outras matérias (PLANO-MESTRE 5.2, PROMPT-VIAGEM etapa 7)
// Mesmo padrão de Juros compostos e Descontos: o CÓDIGO sorteia os números (redondos, fatores
// tabelados com 4 casas), calcula a resposta e monta os distratores a partir de erros clássicos.
// A IA só escreve o texto. A conferência por mathjs (verificacao.ts) continua como trava final.
// ============================================================
import type { Construida } from "./construcao.js";
import type { Letra } from "../shared/tipos.js";
import {
  sortear, inteiro, r2, brl, num4, pct, taxaTxt, fatorChave, fatorTxt, fator, prazoErrado, arredondouFator,
  fatorial, combinacoes, arranjos, type Distrator,
} from "./construcaoUtil.js";

// ---------- Sistemas de amortização ----------
const TAXAS_FIN = [0.01, 0.015, 0.02, 0.025, 0.03];
function financiamentoSac() {
  const n = sortear([10, 12, 20, 24, 40, 50]);
  const A = sortear([500, 800, 1000, 1200, 1500, 2000, 2500]); // amortização redonda
  return { n, A, PV: n * A, i: sortear(TAXAS_FIN) };
}

function sacParcela(): Construida {
  const { n, A, PV, i } = financiamentoSac();
  const k = inteiro(2, n - 1);
  const J = r2(i * A * (n - k + 1)); // juros sobre o saldo antes da k-ésima
  const P = r2(A + J);
  return {
    tipo: "parcela no SAC",
    etapas: 2,
    pergunta: `o valor da ${k}ª prestação`,
    dados: [brl(PV), `${n} prestações mensais`, `${taxaTxt(i)} ao mês`, `${k}ª prestação`],
    fatoresDados: {},
    expressao: `${PV} / ${n} + ${i} * (${PV} - (${k} - 1) * ${PV} / ${n})`,
    resolucao: `Amortização = ${brl(PV)} / ${n} = ${brl(A)}. Saldo antes da ${k}ª = ${brl(PV)} − ${k - 1} × ${brl(A)} = ${brl(A * (n - k + 1))}. Juros = ${taxaTxt(i)} × ${brl(A * (n - k + 1))} = ${brl(J)}. Prestação = ${brl(A)} + ${brl(J)} = ${brl(P)}.`,
    unidade: "reais",
    correta: P,
    distratores: [
      { valor: A, erro: "respondeu só a amortização, sem os juros" },
      { valor: J, erro: "respondeu só os juros da parcela" },
      { valor: r2(A + i * PV), erro: "calculou os juros sobre o valor financiado inteiro (como na 1ª prestação)" },
      { valor: r2(A + i * A * (n - k)), erro: "usou o saldo depois da parcela (k em vez de k − 1)" },
      { valor: r2(A + i * A * (n - k - 1)), erro: `calculou a ${k + 1}ª prestação` },
      { valor: r2(A + i * A * (n - k + 2)), erro: `calculou a ${k - 1}ª prestação` },
      { valor: r2(A + i * A * (n - k + 3)), erro: `calculou a ${k - 2}ª prestação` },
      { valor: r2(A + i * A * (n - k - 2)), erro: `calculou a ${k + 2}ª prestação` },
      { valor: r2(2 * A + J), erro: "somou a amortização duas vezes" },
    ],
  };
}

function sacJuros(): Construida {
  const { n, A, PV, i } = financiamentoSac();
  const k = inteiro(2, n - 1);
  const J = r2(i * A * (n - k + 1));
  return {
    tipo: "juros de uma parcela no SAC",
    etapas: 1,
    pergunta: `o valor dos juros pagos na ${k}ª prestação`,
    dados: [brl(PV), `${n} prestações mensais`, `${taxaTxt(i)} ao mês`, `${k}ª prestação`],
    fatoresDados: {},
    expressao: `${i} * (${PV} - (${k} - 1) * ${PV} / ${n})`,
    resolucao: `Saldo antes da ${k}ª = ${brl(PV)} − ${k - 1} × ${brl(A)} = ${brl(A * (n - k + 1))}; juros = ${taxaTxt(i)} × esse saldo = ${brl(J)}.`,
    unidade: "reais",
    correta: J,
    distratores: [
      { valor: r2(i * PV), erro: "aplicou a taxa sobre o valor financiado inteiro" },
      { valor: r2(i * A * (n - k)), erro: "usou o saldo depois da parcela" },
      { valor: r2(i * A * (n - k + 2)), erro: `calculou os juros da ${k - 1}ª prestação` },
      { valor: r2(i * A * (n - k - 1)), erro: `calculou os juros da ${k + 1}ª prestação` },
      { valor: r2(i * A * (n - k + 3)), erro: `calculou os juros da ${k - 2}ª prestação` },
      { valor: r2(i * A * (n - k - 2)), erro: `calculou os juros da ${k + 2}ª prestação` },
      { valor: r2(i * A), erro: "aplicou a taxa sobre a amortização" },
      { valor: r2(A + J), erro: "respondeu a prestação inteira (amortização + juros)" },
    ],
  };
}

function sacSaldo(): Construida {
  const { n, A, PV, i } = financiamentoSac();
  const k = inteiro(2, n - 2);
  const S = A * (n - k);
  return {
    tipo: "saldo devedor após k parcelas no SAC",
    etapas: 1,
    pergunta: `o saldo devedor logo após o pagamento da ${k}ª prestação`,
    dados: [brl(PV), `${n} prestações mensais`, `${taxaTxt(i)} ao mês`, `${k}ª prestação`],
    fatoresDados: {},
    expressao: `${PV} - ${k} * ${PV} / ${n}`,
    resolucao: `No SAC a amortização é constante: ${brl(PV)} / ${n} = ${brl(A)}. Depois de ${k} prestações, saldo = ${brl(PV)} − ${k} × ${brl(A)} = ${brl(S)}. A taxa não muda o saldo.`,
    unidade: "reais",
    correta: S,
    distratores: [
      { valor: A * (n - k + 1), erro: `contou só ${k - 1} amortizações` },
      { valor: A * (n - k - 1), erro: `contou ${k + 1} amortizações` },
      { valor: A * (n - k + 2), erro: `contou só ${k - 2} amortizações` },
      { valor: A * (n - k - 2), erro: `contou ${k + 2} amortizações` },
      { valor: A * k, erro: "respondeu o total já amortizado" },
      { valor: r2(S * (1 + i)), erro: "acrescentou um mês de juros ao saldo" },
      { valor: r2(PV - k * (A + i * PV)), erro: "abateu prestações inteiras (com juros) do saldo" },
    ],
  };
}

function pricePrestacao(): Construida {
  const PV = sortear([10000, 12000, 15000, 20000, 24000, 30000, 50000]);
  const i = sortear(TAXAS_FIN);
  const n = sortear([6, 10, 12, 18, 24]);
  const F = fator(i, n);
  const P = r2((PV * i * F) / (F - 1));
  const ch = fatorChave(i, n);
  return {
    tipo: "prestação na Tabela Price (com fator dado)",
    etapas: 2,
    pergunta: "o valor de cada prestação",
    dados: [brl(PV), `${n} prestações mensais`, `${taxaTxt(i)} ao mês`, fatorTxt(i, n, F)],
    fatoresDados: { [ch]: F },
    expressao: `${PV} * ${i} * ${ch} / (${ch} - 1)`,
    resolucao: `P = PV × i × (1 + i)^n / [(1 + i)^n − 1] = ${brl(PV)} × ${taxaTxt(i)} × ${num4(F)} / ${num4(F - 1)} = ${brl(P)}`,
    unidade: "reais",
    correta: P,
    distratores: [
      { valor: r2(PV / n), erro: "dividiu o valor financiado pelo número de prestações, sem juros" },
      { valor: r2(PV / n + i * PV), erro: "calculou a 1ª prestação do SAC" },
      { valor: r2((PV * (1 + i * n)) / n), erro: "usou juros simples sobre o total e dividiu pelas prestações" },
      { valor: r2((PV * F) / n), erro: "capitalizou o total e dividiu pelas prestações" },
      { valor: r2((PV * i) / (F - 1)), erro: "esqueceu o (1 + i)^n do numerador" },
      ...prazoErrado(n, (k) => r2((PV * i * fator(i, k)) / (fator(i, k) - 1))),
      ...arredondouFator(F, (f) => r2((PV * i * f) / (f - 1))),
    ],
  };
}

function sacVsPrice(): Construida {
  const PV = sortear([12000, 15000, 20000, 24000, 30000, 60000]);
  const i = sortear(TAXAS_FIN);
  const n = sortear([10, 12, 20, 24]);
  const F = fator(i, n);
  const ch = fatorChave(i, n);
  const sac1 = r2(PV / n + i * PV);
  const price = r2((PV * i * F) / (F - 1));
  const dif = r2(sac1 - price);
  return {
    tipo: "comparar SAC e Price",
    etapas: 3,
    pergunta: "quanto a 1ª prestação no SAC supera a prestação da Tabela Price",
    dados: [brl(PV), `${n} prestações mensais`, `${taxaTxt(i)} ao mês`, fatorTxt(i, n, F)],
    fatoresDados: { [ch]: F },
    expressao: `(${PV} / ${n} + ${i} * ${PV}) - ${PV} * ${i} * ${ch} / (${ch} - 1)`,
    resolucao: `SAC: 1ª = ${brl(PV)} / ${n} + ${taxaTxt(i)} × ${brl(PV)} = ${brl(sac1)}. Price: ${brl(PV)} × ${taxaTxt(i)} × ${num4(F)} / ${num4(F - 1)} = ${brl(price)}. Diferença = ${brl(dif)}.`,
    unidade: "reais",
    correta: dif,
    distratores: [
      { valor: r2(i * PV), erro: "respondeu só os juros da 1ª prestação do SAC" },
      { valor: r2(price - PV / n), erro: "comparou a Price com a amortização do SAC (sem juros)" },
      { valor: r2(2 * dif), erro: "contou a diferença duas vezes" },
      { valor: r2(sac1 - (PV * i) / (F - 1)), erro: "errou a Price (esqueceu o (1 + i)^n do numerador)" },
      { valor: r2(sac1 - PV / n), erro: "comparou o SAC com a prestação sem juros" },
      { valor: r2(dif / 2), erro: "dividiu a diferença por 2" },
      ...prazoErrado(n, (k) => r2(PV / n + i * PV - (PV * i * fator(i, k)) / (fator(i, k) - 1))),
      ...arredondouFator(F, (f) => r2(sac1 - (PV * i * f) / (f - 1))),
    ],
  };
}

// ---------- Taxas de juros ----------
function taxaEfetivaDaNominal(): Construida {
  const anual = sortear([12, 18, 24, 30, 36]);
  const i = anual / 1200;
  const F = fator(i, 12);
  const ef = r2((F - 1) * 100);
  const ch = fatorChave(i, 12);
  return {
    tipo: "taxa efetiva a partir da nominal",
    etapas: 2,
    pergunta: "a taxa efetiva anual",
    dados: [`${anual}% ao ano`, "capitalizada mensalmente", fatorTxt(i, 12, F)],
    fatoresDados: { [ch]: F },
    expressao: `(${ch} - 1) * 100`,
    resolucao: `Taxa mensal = ${anual}% / 12 = ${taxaTxt(i)}. Efetiva anual = (1 + ${taxaTxt(i)})^12 − 1 = ${num4(F)} − 1 → ${pct(ef)}.`,
    unidade: "percentual",
    correta: ef,
    distratores: [
      { valor: anual, erro: "respondeu a própria taxa nominal" },
      { valor: r2(F * 100), erro: "esqueceu de subtrair 1 do fator" },
      { valor: r2(i * 100), erro: "respondeu a taxa mensal" },
      { valor: r2((fator(i, 11) - 1) * 100), erro: "elevou a 11 em vez de 12" },
      { valor: r2((fator(i, 13) - 1) * 100), erro: "elevou a 13 em vez de 12" },
      { valor: r2(anual * 1.5), erro: "somou metade da nominal (achismo)" },
      ...arredondouFator(F, (f) => r2((f - 1) * 100)),
    ],
  };
}

function taxasEquivalentes(): Construida {
  const i = sortear([0.01, 0.015, 0.02, 0.025, 0.03]);
  const n = sortear([2, 3, 4, 6]);
  const F = fator(i, n);
  const eq = r2((F - 1) * 100);
  const nome = { 2: "bimestral", 3: "trimestral", 4: "quadrimestral", 6: "semestral" }[n]!;
  const ch = fatorChave(i, n);
  return {
    tipo: "taxas equivalentes entre períodos",
    etapas: 1,
    pergunta: `a taxa ${nome} equivalente`,
    dados: [`${taxaTxt(i)} ao mês`, fatorTxt(i, n, F)],
    fatoresDados: { [ch]: F },
    expressao: `(${ch} - 1) * 100`,
    resolucao: `(1 + i)^${n} − 1 = ${num4(F)} − 1 → ${pct(eq)} ${nome}.`,
    unidade: "percentual",
    correta: eq,
    distratores: [
      { valor: r2(i * n * 100), erro: `usou a taxa proporcional (${taxaTxt(i)} × ${n})` },
      { valor: r2(F * 100), erro: "esqueceu de subtrair 1" },
      { valor: r2(i * 100), erro: "repetiu a taxa mensal" },
      ...prazoErrado(n, (k) => r2((fator(i, k) - 1) * 100)).map((d) => ({ ...d, erro: d.erro.replace("usou n", "elevou a") })),
      ...arredondouFator(F, (f) => r2((f - 1) * 100)),
    ],
  };
}

function taxasProporcionais(): Construida {
  const i = sortear([1, 1.5, 2, 2.5, 3, 4]);
  const k = sortear([2, 3, 6, 12]);
  const nome = { 2: "bimestral", 3: "trimestral", 6: "semestral", 12: "anual" }[k]!;
  const prop = r2(i * k);
  return {
    tipo: "taxas proporcionais",
    etapas: 1,
    pergunta: `a taxa ${nome} proporcional, no regime de juros simples`,
    dados: [`${i.toLocaleString("pt-BR")}% ao mês`],
    fatoresDados: {},
    expressao: `${i} * ${k}`,
    resolucao: `Taxas proporcionais (juros simples): ${i.toLocaleString("pt-BR")}% × ${k} = ${pct(prop)} ${nome}.`,
    unidade: "percentual",
    correta: prop,
    distratores: [
      { valor: r2(((1 + i / 100) ** k - 1) * 100), erro: "calculou a taxa equivalente (juros compostos)" },
      { valor: r2(i / k), erro: `dividiu por ${k} em vez de multiplicar` },
      { valor: r2(i * (k - 1)), erro: `multiplicou por ${k - 1}` },
      { valor: r2(i * (k + 1)), erro: `multiplicou por ${k + 1}` },
      { valor: r2(i * (k + 2)), erro: `multiplicou por ${k + 2}` },
      { valor: i, erro: "repetiu a taxa mensal" },
      { valor: r2(i * k * 2), erro: "dobrou a taxa proporcional" },
      { valor: r2((i * k) / 2), erro: "dividiu o resultado por 2" },
      ...(k > 2 ? [{ valor: r2(i * (k - 2)), erro: `multiplicou por ${k - 2}` }] : []),
    ],
  };
}

function taxaReal(): Construida {
  const ap = sortear([8, 10, 12, 14, 15, 18, 20]);
  const inf = sortear([3, 4, 5, 6]);
  const real = r2(((1 + ap / 100) / (1 + inf / 100) - 1) * 100);
  return {
    tipo: "taxa real a partir da aparente e da inflação",
    etapas: 2,
    pergunta: "a taxa real de juros do período",
    dados: [`${ap}%`, `${inf}%`],
    fatoresDados: {},
    expressao: `((1 + ${ap} / 100) / (1 + ${inf} / 100) - 1) * 100`,
    resolucao: `1 + real = (1 + ${ap}%) / (1 + ${inf}%) = ${(1 + ap / 100).toLocaleString("pt-BR")} / ${(1 + inf / 100).toLocaleString("pt-BR")}; real = ${pct(real)}.`,
    unidade: "percentual",
    correta: real,
    distratores: [
      { valor: ap - inf, erro: "subtraiu as taxas (aproximação de Fisher)" },
      { valor: r2(((1 + ap / 100) * (1 + inf / 100) - 1) * 100), erro: "multiplicou em vez de dividir" },
      { valor: ap, erro: "respondeu a taxa aparente" },
      { valor: r2(((ap - inf) / (1 + ap / 100))), erro: "dividiu a diferença pela taxa aparente" },
      { valor: r2(ap / inf), erro: "dividiu uma taxa pela outra" },
      { valor: r2((ap - inf) * (1 - inf / 100)), erro: "descontou a inflação de novo da diferença" },
      { valor: r2((ap - inf) / 2), erro: "dividiu a diferença por 2" },
      { valor: r2(ap + inf), erro: "somou as taxas" },
    ],
  };
}

// ---------- Análise combinatória ----------
// a resposta não pode aparecer nos dados (o pipeline barra resposta no enunciado)
const semVazar = (resposta: number, numeros: number[]) => !numeros.includes(resposta);

function arranjo(): Construida {
  for (;;) {
    const n = inteiro(5, 10);
    const p = sortear([2, 3]);
    const certa = arranjos(n, p);
    if (!semVazar(certa, [n, p])) continue;
    return {
      tipo: "arranjo (a ordem importa)",
      etapas: 1,
      pergunta: `de quantas maneiras distintas é possível escolher ${p} pessoas entre ${n} para ${p} funções diferentes`,
      dados: [String(n), String(p)],
      fatoresDados: {},
      expressao: `permutations(${n}, ${p})`,
      resolucao: `A ordem importa (funções diferentes): A(${n},${p}) = ${n}!/(${n}−${p})! = ${certa}.`,
      unidade: "numero",
      correta: certa,
      distratores: [
        { valor: combinacoes(n, p), erro: "usou combinação (ignorou que as funções são diferentes)" },
        { valor: n ** p, erro: "permitiu repetir a mesma pessoa" },
        { valor: n * p, erro: "multiplicou o total pelo número de funções" },
        { valor: arranjos(n, p - 1), erro: `escolheu ${p - 1} em vez de ${p}` },
        { valor: arranjos(n, p + 1), erro: `escolheu ${p + 1} em vez de ${p}` },
        { valor: arranjos(n - 1, p), erro: `contou ${n - 1} pessoas` },
        { valor: arranjos(n + 1, p), erro: `contou ${n + 1} pessoas` },
        { valor: arranjos(n + 2, p), erro: `contou ${n + 2} pessoas` },
        { valor: p * arranjos(n, p), erro: "multiplicou de novo pelo número de funções" },
        { valor: fatorial(p), erro: "contou só a ordem entre os escolhidos" },
      ],
    };
  }
}

function combinacao(): Construida {
  for (;;) {
    const n = inteiro(6, 12);
    const p = sortear([2, 3, 4]);
    const certa = combinacoes(n, p);
    if (!semVazar(certa, [n, p])) continue;
    return {
      tipo: "combinação (a ordem não importa)",
      etapas: 1,
      pergunta: `quantos grupos diferentes de ${p} pessoas podem ser formados com ${n} pessoas`,
      dados: [String(n), String(p)],
      fatoresDados: {},
      expressao: `combinations(${n}, ${p})`,
      resolucao: `A ordem não importa: C(${n},${p}) = ${n}!/(${p}!·${n - p}!) = ${certa}.`,
      unidade: "numero",
      correta: certa,
      distratores: [
        { valor: arranjos(n, p), erro: "usou arranjo (contou a ordem)" },
        { valor: combinacoes(n, p - 1), erro: `formou grupos de ${p - 1}` },
        { valor: combinacoes(n, p + 1), erro: `formou grupos de ${p + 1}` },
        { valor: combinacoes(n - 1, p), erro: `contou ${n - 1} pessoas` },
        { valor: combinacoes(n + 1, p), erro: `contou ${n + 1} pessoas` },
        { valor: n * p, erro: "multiplicou as pessoas pelo tamanho do grupo" },
        { valor: 2 ** n, erro: "contou todos os subconjuntos" },
        { valor: combinacoes(n - 2, p), erro: `contou ${n - 2} pessoas` },
        { valor: n + p, erro: "somou as pessoas e o tamanho do grupo" },
        { valor: n, erro: "respondeu o número de pessoas" },
      ],
    };
  }
}

const PALAVRAS: { palavra: string; repeticoes: number[] }[] = [
  { palavra: "CAIXA", repeticoes: [2] },
  { palavra: "TARIFA", repeticoes: [2] },
  { palavra: "AGENDA", repeticoes: [2] },
  { palavra: "CARTEIRA", repeticoes: [2, 2] },
  { palavra: "CADASTRO", repeticoes: [2] },
  { palavra: "PARCELA", repeticoes: [2] },
  { palavra: "BANANA", repeticoes: [3, 2] },
  { palavra: "CONTA", repeticoes: [] },
  { palavra: "SALDO", repeticoes: [] },
  { palavra: "CREDITO", repeticoes: [] },
];
function anagramas(): Construida {
  const { palavra, repeticoes } = sortear(PALAVRAS);
  const n = palavra.length;
  const div = repeticoes.reduce((s, r) => s * fatorial(r), 1);
  const certa = fatorial(n) / div;
  return {
    tipo: "permutação com repetição (anagramas)",
    etapas: repeticoes.length ? 2 : 1,
    pergunta: `quantos anagramas tem a palavra ${palavra}`,
    dados: [palavra],
    fatoresDados: {},
    expressao: `factorial(${n})${repeticoes.map((r) => ` / factorial(${r})`).join("")}`,
    resolucao: repeticoes.length
      ? `${n} letras com repetições (${repeticoes.map((r) => `${r}!`).join(" e ")}): ${n}!/${repeticoes.map((r) => `${r}!`).join("·")} = ${certa}.`
      : `${n} letras distintas: ${n}! = ${certa}.`,
    unidade: "numero",
    correta: certa,
    distratores: [
      ...(repeticoes.length ? [{ valor: fatorial(n), erro: "não descontou as letras repetidas" }] : []),
      { valor: fatorial(n - 1), erro: `usou ${n - 1}! (esqueceu uma letra)` },
      { valor: fatorial(n) / (div * 2), erro: "descontou uma repetição a mais" },
      { valor: fatorial(n + 1) / div, erro: `usou ${n + 1}!` },
      { valor: n ** 2, erro: "elevou o número de letras ao quadrado" },
      { valor: certa * 2, erro: "dobrou o resultado" },
      { valor: fatorial(n) / div - n, erro: "tirou a própria palavra de cada posição" },
      { valor: n ** n, erro: "deixou qualquer letra em qualquer posição (com repetição)" },
      { valor: certa + n, erro: "somou uma posição por letra" },
      { valor: fatorial(new Set(palavra).size), erro: "permutou só as letras diferentes" },
    ].filter((d) => Number.isInteger(d.valor)),
  };
}

function senhas(): Construida {
  const k = sortear([3, 4, 5]);
  const certa = arranjos(10, k);
  return {
    tipo: "princípio fundamental da contagem (senhas)",
    etapas: 1,
    pergunta: `quantas senhas de ${k} dígitos, todos diferentes entre si, podem ser formadas com os algarismos de 0 a 9`,
    dados: [`${k} dígitos`],
    fatoresDados: {},
    expressao: `permutations(10, ${k})`,
    resolucao: `Princípio multiplicativo sem repetição: ${Array.from({ length: k }, (_, j) => 10 - j).join(" × ")} = ${certa}.`,
    unidade: "numero",
    correta: certa,
    distratores: [
      { valor: 10 ** k, erro: "permitiu repetir dígitos" },
      { valor: combinacoes(10, k), erro: "usou combinação (a ordem da senha importa)" },
      { valor: arranjos(9, k), erro: "excluiu o zero" },
      { valor: 9 * 10 ** (k - 1), erro: "proibiu o zero só na 1ª posição e permitiu repetir" },
      { valor: arranjos(10, k - 1), erro: `contou ${k - 1} dígitos` },
      { valor: arranjos(10, k + 1), erro: `contou ${k + 1} dígitos` },
      { valor: 10 * k, erro: "multiplicou 10 pelo número de dígitos" },
      { valor: 10 ** k - 10, erro: "tirou só as senhas com todos os dígitos iguais" },
    ],
  };
}

// ---------- Probabilidade ----------
function probCondicional(): Construida {
  for (;;) {
    const a = sortear([40, 50, 80, 100, 120, 160, 200]); // pessoas físicas
    const p = sortear([0.2, 0.25, 0.3, 0.4, 0.6, 0.75]);
    const b = a * p; // PF com seguro
    const c = inteiro(20, 160, 10); // pessoas jurídicas
    const d = inteiro(5, Math.floor(c * 0.8), 5); // PJ com seguro
    const T = a + c;
    const certa = r2(p * 100);
    if (!Number.isInteger(b) || [a, b, c, d, T].includes(certa)) continue;
    return {
      tipo: "probabilidade condicional em tabela de clientes",
      etapas: 2,
      pergunta: "a probabilidade de um cliente sorteado ter seguro, sabendo que ele é pessoa física",
      dados: [String(T), String(a), String(b), String(d)],
      fatoresDados: {},
      expressao: `${b} / ${a} * 100`,
      resolucao: `Condicional: entre as ${a} pessoas físicas, ${b} têm seguro → ${b}/${a} = ${pct(certa)}.`,
      unidade: "percentual",
      correta: certa,
      distratores: [
        { valor: r2((b / T) * 100), erro: "dividiu pelo total de clientes (probabilidade da interseção)" },
        { valor: r2((a / T) * 100), erro: "calculou a chance de ser pessoa física" },
        { valor: r2(((b + d) / T) * 100), erro: "calculou a chance de ter seguro, sem a condição" },
        { valor: r2((b / (b + d)) * 100), erro: "inverteu a condição (PF entre quem tem seguro)" },
        { valor: r2((d / c) * 100), erro: "usou as pessoas jurídicas" },
        { valor: r2(((a - b) / a) * 100), erro: "calculou a chance de NÃO ter seguro" },
      ],
    };
  }
}

function eventosIndependentes(): Construida {
  const pa = sortear([10, 20, 25, 30, 40, 50, 60]);
  const pb = sortear([20, 25, 40, 50, 60, 75, 80]);
  const certa = r2((pa * pb) / 100);
  return {
    tipo: "eventos independentes",
    etapas: 1,
    pergunta: "a probabilidade de os dois eventos independentes acontecerem",
    dados: [`${pa}%`, `${pb}%`],
    fatoresDados: {},
    expressao: `${pa} * ${pb} / 100`,
    resolucao: `Independentes: P(A e B) = ${pa}% × ${pb}% = ${pct(certa)}.`,
    unidade: "percentual",
    correta: certa,
    distratores: [
      { valor: pa + pb, erro: "somou as probabilidades" },
      { valor: r2(pa + pb - (pa * pb) / 100), erro: "calculou P(A ou B)" },
      { valor: r2((pa + pb) / 2), erro: "tirou a média" },
      { valor: r2((pa * (100 - pb)) / 100), erro: "usou o complemento do segundo evento" },
      { valor: r2(((100 - pa) * (100 - pb)) / 100), erro: "calculou a chance de nenhum acontecer" },
      { valor: Math.min(pa, pb), erro: "ficou com a menor probabilidade" },
      { valor: Math.max(pa, pb), erro: "ficou com a maior probabilidade" },
      { valor: r2((pa * pb) / 200), erro: "dividiu o produto por 2" },
      { valor: r2((pa * pb) / 1000), erro: "errou a casa decimal do produto" },
      { valor: r2((pa * pb) / 400), erro: "dividiu o produto por 4" },
    ],
  };
}

function binomial(): Construida {
  for (;;) {
    const n = sortear([3, 4, 5]);
    const p = sortear([0.1, 0.2, 0.4, 0.5]);
    const k = sortear([1, 2]);
    const certa = r2(combinacoes(n, k) * p ** k * (1 - p) ** (n - k) * 100);
    if (!certa) continue;
    const pTxt = `${Math.round(p * 100)}%`;
    return {
      tipo: "distribuição binomial",
      etapas: 2,
      pergunta: `a probabilidade de exatamente ${k} ${k === 1 ? "sucesso" : "sucessos"} em ${n} tentativas independentes`,
      dados: [String(n), pTxt],
      fatoresDados: {},
      expressao: `combinations(${n}, ${k}) * ${p}^${k} * (1 - ${p})^(${n} - ${k}) * 100`,
      resolucao: `Binomial: C(${n},${k}) × ${pTxt}^${k} × (1 − ${pTxt})^${n - k} = ${combinacoes(n, k)} × … = ${pct(certa)}.`,
      unidade: "percentual",
      correta: certa,
      distratores: [
        { valor: r2(p ** k * (1 - p) ** (n - k) * 100), erro: "esqueceu de multiplicar pelas combinações" },
        { valor: r2(p ** k * 100), erro: "considerou só os sucessos" },
        { valor: r2((1 - (1 - p) ** n) * 100), erro: "calculou a chance de pelo menos um sucesso" },
        { valor: r2(combinacoes(n, k) * p ** k * 100), erro: "esqueceu os fracassos" },
        { valor: r2((k / n) * 100), erro: "dividiu os sucessos pelas tentativas" },
        { valor: r2(arranjos(n, k) * p ** k * (1 - p) ** (n - k) * 100), erro: "usou arranjo no lugar de combinação" },
        { valor: r2((1 - p) ** n * 100), erro: "calculou a chance de nenhum sucesso" },
      ],
    };
  }
}

export const CATALOGO_MAIS: Record<string, { porTipo: Record<string, (g: Letra) => Construida> }> = {
  "Sistemas de amortização": {
    porTipo: {
      "parcela no SAC": sacParcela,
      "juros de uma parcela no SAC": sacJuros,
      "saldo devedor após k parcelas no SAC": sacSaldo,
      "prestação na Tabela Price (com fator dado)": pricePrestacao,
      "comparar SAC e Price": sacVsPrice,
    },
  },
  "Taxas de juros": {
    porTipo: {
      "taxa efetiva a partir da nominal": taxaEfetivaDaNominal,
      "taxas equivalentes entre períodos": taxasEquivalentes,
      "taxas proporcionais": taxasProporcionais,
      "taxa real a partir da aparente e da inflação": taxaReal,
    },
  },
  "Análise combinatória": {
    porTipo: {
      "arranjo (a ordem importa)": arranjo,
      "combinação (a ordem não importa)": combinacao,
      "permutação com repetição (anagramas)": anagramas,
      "princípio fundamental da contagem (senhas)": senhas,
    },
  },
  Probabilidade: {
    porTipo: {
      "probabilidade condicional em tabela de clientes": probCondicional,
      "eventos independentes": eventosIndependentes,
      "distribuição binomial": binomial,
    },
  },
};

export type { Distrator };
