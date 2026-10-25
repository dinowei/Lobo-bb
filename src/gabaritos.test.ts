import assert from "node:assert/strict";
import test from "node:test";
import { lerGabaritoGrade, lerGabaritoOficial, lerGabaritoPares } from "./extrair.js";
import { escolherGabarito } from "./ingestao.js";

// trechos no layout real do texto extraído dos PDFs oficiais (acervo-indice)
const ZEROS = Array(20).fill("0").join(" ");
const CEBRASPE_CE = [
  "BANCO CENTRAL DO BRASIL (BCB)",
  "Aplicação: 4/8/2024",
  "1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20",
  "C E C E E C E C E E C C E C E E E C C C",
  "21 22 23 24 25 26 27 28 29 30 31 32 33 34 35 36 37 38 39 40",
  "E E E E C E C E C E E C C E C E E C C C",
  "41 42 43 44 45 46 47 48 49 50 0 0 0 0 0 0 0 0 0 0",
  "C E E X E C E C C E 0 0 0 0 0 0 0 0 0 0",
  ZEROS, ZEROS, ZEROS,
  "Obs.: ( X ) item anulado.",
].join("\n");

test("Cebraspe Certo/Errado: grade de itens, X anulado, enchimento de zeros ignorado", () => {
  const [b, ...resto] = lerGabaritoOficial(CEBRASPE_CE, "certo_errado");
  assert.equal(resto.length, 0);
  assert.equal(b.respostas.size, 50);
  assert.equal(b.respostas.get(1), "certo");
  assert.equal(b.respostas.get(2), "errado");
  assert.equal(b.respostas.get(44), "anulada");
  assert.equal(b.respostas.get(50), "errado");
});

test("Cebraspe múltipla escolha (Banrisul 2025) com o mesmo leitor de grade", () => {
  const t = [
    "1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20",
    "D E C A C C E A A C C D E B X C D E C A",
    "21 22 23 24 25 26 27 28 29 30 0 0 0 0 0 0 0 0 0 0",
    "C D B B C D D B A A 0 0 0 0 0 0 0 0 0 0",
    ZEROS, ZEROS,
  ].join("\n");
  const [b] = lerGabaritoOficial(t, "multipla");
  assert.equal(b.respostas.size, 30);
  assert.equal(b.respostas.get(1), "D");
  assert.equal(b.respostas.get(15), "anulada");
  assert.equal(b.respostas.get(30), "A");
  // a mesma grade lida como Certo/Errado é recusada (D não é C/E): formato vem da prova, não se adivinha
  assert.throws(() => lerGabaritoGrade(t, "certo_errado"), /fora do formato/);
});

test("FGV: um bloco por tipo de prova, com o título do caderno", () => {
  const t = [
    "GABARITO DEFINITIVO",
    "Analista CVM - Perfil 4 - Mercado de Capitais - Tipo 1",
    "1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20",
    "A D C B D B E D B C E E A A B C B E B A",
    "21 22 23 24 25 26 27 28 29 30 31 32 33 34 35 36 37 38 39 40",
    "D E E C E E E D B E D B B D A B A C C B",
    "Analista CVM - Perfil 4 - Mercado de Capitais - Tipo 2",
    "1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20",
    "E B B D C D A D C B E A B C B A E A E B",
    "21 22 23 24 25 26 27 28 29 30 31 32 33 34 35 36 37 38 39 40",
    "E D E E E E C B D E D A B B D A B C B C",
  ].join("\n");
  const blocos = lerGabaritoOficial(t, "multipla");
  assert.equal(blocos.length, 2);
  assert.match(blocos[0].titulo, /Tipo 1$/);
  assert.match(blocos[1].titulo, /Tipo 2$/);
  assert.equal(blocos[0].respostas.get(1), "A");
  assert.equal(blocos[1].respostas.get(1), "E");
  assert.equal(blocos[1].respostas.get(40), "C");
});

test("Cesgranrio: pares 'n - X', seções no meio não quebram o bloco; Gabarito 2 abre outro", () => {
  const t = [
    "Prova A – TÉCNICO BANCÁRIO I – Gabarito 1",
    "CONHECIMENTOS BÁSICOS",
    "Língua Portuguesa I",
    "1 - D 2 - C 3 - E 4 - C 5 - D",
    "6 - A 7 - B 8 - E 9 - B 10 - B",
    "Matemática",
    "11 - A 12 - D 13 - B 14 - D 15 - D",
    "Banco do Estado de Sergipe",
    "Prova A – TÉCNICO BANCÁRIO I – Gabarito 2",
    "CONHECIMENTOS BÁSICOS",
    "Língua Portuguesa I",
    "1 - B 2 - D 3 - A 4 - E 5 - C",
    "6 - X 7 - A 8 - B 9 - C 10 - D",
    "11 - E 12 - A 13 - C 14 - B 15 - A",
  ].join("\n");
  const blocos = lerGabaritoOficial(t, "multipla");
  assert.equal(blocos.length, 2);
  assert.match(blocos[0].titulo, /Gabarito 1$/);
  assert.match(blocos[1].titulo, /Gabarito 2$/);
  assert.equal(blocos[0].respostas.size, 15);
  assert.equal(blocos[0].respostas.get(11), "A");
  assert.equal(blocos[1].respostas.get(1), "B");
  assert.equal(blocos[1].respostas.get(6), "anulada");
});

test("tabela em colunas (BNDES 2024): um caderno por coluna, números repetidos na linha", () => {
  const t = [
    "1 - D 2 - C 3 - D 4 - C 5 - B",
    "CONHECIMENTOS ESPECÍFICOS",
    "Prova 1 Prova 2 Prova 3",
    "ANALISTA / ADMINISTRAÇÃO",
    "36 - B 36 - A 36 - Anulada",
    "37 - C 37 - E 37 - C",
    "38 - C 38 - D 38 - B",
  ].join("\n");
  const blocos = lerGabaritoOficial(t, "multipla");
  assert.equal(blocos.length, 4); // básicos 1–5 + uma coluna por caderno
  assert.deepEqual(blocos.slice(1).map((b) => b.titulo), ["Prova 1", "Prova 2", "Prova 3"]);
  assert.equal(blocos[1].respostas.get(36), "B");
  assert.equal(blocos[3].respostas.get(36), "anulada");
  assert.equal(blocos[2].respostas.get(38), "D");
  assert.equal(blocos[1].respostas.size, 3);
});

test("ingestão: --caderno escolhe o bloco; --questoes corta as matérias comuns; sem --caderno com 2 blocos é erro", () => {
  const t = [
    "Prova A – TÉCNICO – Gabarito 1",
    "1 - D 2 - C 3 - E 4 - C 5 - D",
    "6 - A 7 - B 8 - E 9 - B 10 - B",
    "Prova A – TÉCNICO – Gabarito 2",
    "1 - B 2 - D 3 - A 4 - E 5 - C",
    "6 - X 7 - A 8 - B 9 - C 10 - D",
  ].join("\n");
  assert.throws(() => escolherGabarito(t), /2 cadernos.*--caderno/);
  const g2 = escolherGabarito(t, { caderno: "2" });
  assert.equal(g2.get(1), "B");
  assert.equal(g2.get(6), "anulada");
  const comuns = escolherGabarito(t, { caderno: "1", questoes: "1-5" });
  assert.deepEqual([...comuns.keys()], [1, 2, 3, 4, 5]);
  assert.throws(() => escolherGabarito(t, { caderno: "1", questoes: "1-12" }), /esperava 12/);
  assert.throws(() => escolherGabarito(CEBRASPE_CE), /parece Certo\/Errado/);
});

test("prova incompleta não passa: buraco na numeração, linha de respostas curta, letra estranha", () => {
  assert.throws(() => lerGabaritoPares("1 - A 2 - B 4 - C 5 - D 6 - E"), /buraco.*faltam 3/);
  assert.throws(() => lerGabaritoGrade("1 2 3 4 5\nC E C", "certo_errado"), /não bate/);
  assert.throws(() => lerGabaritoPares("1 - A 2 - B 3 - F 4 - C 5 - D"), /ilegível/);
  // erro de digitação real (BNB 2024): "1 7- B" não vira item 1 nem 7
  assert.throws(() => lerGabaritoPares("11 - C 12 - E 13 - A 14 - D 15 - B\n16 - B 1 7- B 18 - E 19 - D 20 - C"), /ilegível/);
  // traço faltando antes da letra (BASA 2025) é aceito
  assert.equal(lerGabaritoPares("36 - C 37 - E 38 - A 39 - C 40 - E 41 C")[0].respostas.get(41), "C");
  assert.throws(() => lerGabaritoOficial("texto sem gabarito", "multipla"), /Nenhuma resposta/);
  assert.throws(() => lerGabaritoOficial("1 - C 2 - E", "certo_errado"), /sem grade/);
});
