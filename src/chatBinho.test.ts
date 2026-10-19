import assert from "node:assert/strict";
import test from "node:test";
import { conferirCitacoes, escolherTrechos, hashPergunta } from "./chatBinho.js";
import { RespostaBinhoZ } from "./prompts.js";

const trechos = [
  { indice: 1, titulo: "Lei 4.595", texto: "O Conselho Monetário Nacional formula a política da moeda e do crédito. Compete ao CMN fixar as diretrizes." },
  { indice: 2, titulo: "Resolução CMN", texto: "A instituição financeira deve manter ouvidoria. O prazo de resposta é de dez dias úteis." },
  { indice: 3, titulo: "Glossário", texto: "Cheque é ordem de pagamento à vista." },
];

test("chat: escolhe os trechos com mais termos da pergunta", () => {
  assert.deepEqual(escolherTrechos("qual o prazo de resposta da ouvidoria?", trechos, 2).map((t) => t.indice), [2]);
  assert.equal(escolherTrechos("Conselho Monetário formula a política?", trechos)[0].indice, 1);
  // nenhum termo em comum: os primeiros, na ordem da fonte
  assert.deepEqual(escolherTrechos("zzz yyy", trechos, 2).map((t) => t.indice), [1, 2]);
});

test("chat: citação literal passa; inventada ou de fonte inexistente derruba a resposta", () => {
  const ok = conferirCitacoes([{ indice: 2, trecho: "O prazo de resposta é de dez dias úteis" }], trechos);
  assert.equal(ok.invalida, false);
  assert.equal(ok.invalida === false && ok.citacoes[0].titulo, "Resolução CMN");
  assert.equal(conferirCitacoes([{ indice: 2, trecho: "O prazo de resposta é de cinco dias corridos para o cliente" }], trechos).invalida, true);
  // número do trecho errado (ou inexistente), mas a frase existe em outro: vale, com o título de onde está
  const outro = conferirCitacoes([{ indice: 9, trecho: "O Conselho Monetário Nacional formula" }], trechos);
  assert.equal(outro.invalida === false && outro.citacoes[0].titulo, "Lei 4.595");
  // paráfrase próxima é ancorada na frase da fonte
  const ancorada = conferirCitacoes([{ indice: 1, trecho: "o Conselho Monetário Nacional formula a política de moeda e crédito" }], trechos);
  assert.equal(ancorada.invalida, false);
});

test("chat: a mesma pergunta com caixa, acento e pontuação diferentes cai no mesmo cache", () => {
  assert.equal(hashPergunta("O que é o CMN?"), hashPergunta("  o que e o cmn  "));
  assert.notEqual(hashPergunta("O que é o CMN?"), hashPergunta("O que é o Copom?"));
});

test("chat: schema aceita resposta mínima e completa os padrões", () => {
  const r = RespostaBinhoZ.parse({ resposta: "Só ajudo com a prova." });
  assert.equal(r.foraDoEdital, false);
  assert.equal(r.semBase, false);
  assert.deepEqual(r.fontes, []);
});
