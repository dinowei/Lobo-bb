import { test } from "node:test";
import assert from "node:assert/strict";
import { frasesParaFala, ordinal, paraFala, porExtenso, romano } from "./fala.js";

const casos: [string, string][] = [
  // exemplos do adendo
  ["R$ 5.306,04", "cinco mil, trezentos e seis reais e quatro centavos"],
  ["R$ 1,00", "um real"],
  ["R$ 0,50", "cinquenta centavos"],
  ["1.200", "mil e duzentos"],
  ["1,02", "um vírgula zero dois"],
  ["2%", "dois por cento"],
  ["2,5% a.m.", "dois vírgula cinco por cento ao mês"],
  ["12% a.a.", "doze por cento ao ano"],
  ["1,02³", "um vírgula zero dois elevado a três"],
  ["1,02^3", "um vírgula zero dois elevado a três"],
  ["art. 10", "artigo dez"],
  ["inciso X", "inciso dez"],
  ["§ 2º", "parágrafo segundo"],
  ["nº 4.595", "número quatro mil quinhentos e noventa e cinco"],
  ["Lei 4.595/1964", "Lei quatro mil quinhentos e noventa e cinco, de mil novecentos e sessenta e quatro"],
  ["1º", "primeiro"],
  ["2ª", "segunda"],
  ["16/10/2026", "dezesseis de outubro de dois mil e vinte e seis"],
  ["10h", "dez horas"],
  ["letra B", "letra bê"],
  ["(C)", "letra cê"],
  ["CMN", "cê eme ene"],
  ["BCB", "bê cê bê"],
  ["CDC", "cê dê cê"],
  ["LGPD", "éle gê pê dê"],
  ["PLD/FT", "pê éle dê éfe tê"],
  ["Pix", "pix"],
  ["XP", "xis pê"],
  ["SAC", "sac"],
  ["IOF", "í ó éfe"],
  ["C10", "cê dez"],
  ["=SOMA(A1:A3)", "soma de á um até á três"],
  // dinheiro
  ["R$ 2,00", "dois reais"],
  ["R$ 1.000.000,00", "um milhão de reais"],
  ["R$ 2.500.000,00", "dois milhões e quinhentos mil reais"],
  ["R$ 10,01", "dez reais e um centavo"],
  ["R$ 100,00", "cem reais"],
  ["R$ 150", "cento e cinquenta reais"],
  // inteiros e decimais
  ["0", "zero"],
  ["15", "quinze"],
  ["21", "vinte e um"],
  ["100", "cem"],
  ["101", "cento e um"],
  ["999", "novecentos e noventa e nove"],
  ["1.001", "mil e um"],
  ["2.026", "dois mil e vinte e seis"],
  ["10.500", "dez mil e quinhentos"],
  ["1.000.000", "um milhão"],
  ["0,375", "zero vírgula trezentos e setenta e cinco"],
  ["3,14", "três vírgula quatorze"],
  // porcentagens e taxas
  ["0,5% a.d.", "zero vírgula cinco por cento ao dia"],
  ["taxa de 3% a.t.", "taxa de três por cento ao trimestre"],
  ["10 %", "dez por cento"],
  // lei
  ["art. 1º", "artigo primeiro"],
  ["arts. 5", "artigo quinto"],
  ["inciso IV", "inciso quatro"],
  ["inciso XII", "inciso doze"],
  ["§ único", "parágrafo único"],
  ["§ 12", "parágrafo doze"],
  ["Resolução CMN 4.893/2021", "Resolução cê eme ene quatro mil oitocentos e noventa e três, de dois mil e vinte e um"],
  // ordinais e datas
  ["10º", "décimo"],
  ["21ª", "vigésima primeira"],
  ["01/01/2027", "primeiro de janeiro de dois mil e vinte e sete"],
  ["31/12/1999", "trinta e um de dezembro de mil novecentos e noventa e nove"],
  // horas
  ["1h", "uma hora"],
  ["2h", "duas horas"],
  ["10h30", "dez horas e trinta minutos"],
  // símbolos
  ["2 + 2 = 4", "dois mais dois igual a quatro"],
  ["3 × 4", "três vezes quatro"],
  ["10 ÷ 2", "dez dividido por dois"],
  ["8 / 2", "oito dividido por dois"],
  ["x ≥ 5", "x maior ou igual a cinco"],
  ["y ≤ 3", "y menor ou igual a três"],
  ["9 − 4", "nove menos quatro"],
  // frases inteiras
  // variável de uma letra fica como está (a voz lê a letra)
  ["O montante é M = C × (1 + i)³.", "O montante é M igual a C vezes (um mais i)³."],
  ["Pela Lei nº 9.613/1998, o prazo é de 24 horas.", "Pela Lei nove mil seiscentos e treze, de mil novecentos e noventa e oito, o prazo é de vinte e quatro horas."],
  ["O CMN fixa a meta; o Copom define a Selic.", "O cê eme ene fixa a meta; o copom define a selic."],
];

test(`paraFala: ${casos.length} casos (adendo pede 60+)`, () => {
  assert.ok(casos.length >= 60);
  const erros = casos.filter(([e, s]) => paraFala(e) !== s).map(([e, s]) => `"${e}" → "${paraFala(e)}" (esperado "${s}")`);
  assert.deepEqual(erros, []);
});

test("por extenso, ordinal e romano", () => {
  assert.equal(porExtenso(1_000_000_000), "um bilhão");
  assert.equal(porExtenso(200, { fem: true }), "duzentas");
  assert.equal(ordinal(3, true), "terceira");
  assert.equal(romano("XLIV"), 44);
});

test("frases curtas para a voz", () => {
  assert.deepEqual(frasesParaFala("Primeira frase. Segunda frase!"), ["Primeira frase.", "Segunda frase!"]);
  const longa = Array.from({ length: 20 }, (_, i) => `parte ${i}`).join(", ") + ".";
  assert.ok(frasesParaFala(longa, 60).every((f) => f.length <= 60));
});

test("na tela nada muda: paraFala não toca o texto original", () => {
  const original = "R$ 5.306,04";
  paraFala(original);
  assert.equal(original, "R$ 5.306,04");
});
