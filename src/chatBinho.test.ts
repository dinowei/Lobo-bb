import assert from "node:assert/strict";
import test from "node:test";
import { conferirCitacoes, escolherTrechos, hashPergunta, prepararCitacoesDaResposta, trechosSustentamPergunta, validarCitacoesNaResposta } from "./chatBinho.js";
import { RespostaBinhoZ } from "./prompts.js";
import { artigosDaPergunta } from "./chatBinho.js";

test("chat: artigo citado na pergunta traz o trecho dele primeiro, da norma pedida", () => {
  const fontes = [
    { titulo: "Res. CMN 3.919/2010", texto: "Art. 1º A cobrança de tarifas pela prestação de serviços por parte das instituições financeiras deve estar prevista no contrato." },
    { titulo: "Res. CMN 3.919/2010", texto: "Art. 12. As instituições devem divulgar a tabela de serviços." },
    { titulo: "Res. CMN 3.919/2010", texto: "Art. 2º É vedada às instituições a cobrança de tarifas pela prestação de serviços essenciais a pessoas naturais." },
    { titulo: "Lei 4.595/1964", texto: "Art. 2º Fica extinto o Conselho da atual Superintendência da Moeda e do Crédito." },
  ];
  assert.deepEqual(artigosDaPergunta("Segundo o art. 2º da Resolução CMN 3.919/2010"), ["2"]);
  assert.deepEqual(artigosDaPergunta("pelo artigo 7, inciso X, da LGPD"), ["7"]);
  const r = escolherTrechos("Segundo o art. 2º da Resolução CMN 3.919/2010, que serviços essenciais não podem ser tarifados?", fontes, 2);
  assert.match(r[0].texto, /^Art\. 2º É vedada/); // o art. 2º da 3.919, não o da 4.595 nem o art. 12
});

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
  // Uma citação só vale quando o índice aponta para o trecho que contém o texto.
  const outro = conferirCitacoes([{ indice: 9, trecho: "O Conselho Monetário Nacional formula" }], trechos);
  assert.equal(outro.invalida, true);
  // paráfrase próxima é ancorada na frase da fonte
  const ancorada = conferirCitacoes([{ indice: 1, trecho: "o Conselho Monetário Nacional formula a política de moeda e crédito" }], trechos);
  assert.equal(ancorada.invalida, false);
});

test("chat: cada afirmação legal precisa de [n] existente no trecho citado", () => {
  const citacoes = [{ indice: 1, trecho: "O Conselho Monetário Nacional formula a política da moeda e do crédito" }];
  assert.deepEqual(
    validarCitacoesNaResposta("O CMN formula a política da moeda e do crédito [1].", citacoes, trechos, true),
    { ok: true },
  );
  assert.equal(
    validarCitacoesNaResposta("O CMN formula a política da moeda e do crédito.", citacoes, trechos, true).ok,
    false,
  );
  assert.equal(
    validarCitacoesNaResposta("O CMN formula a política da moeda e do crédito [9].", citacoes, trechos, true).ok,
    false,
  );
  assert.equal(
    validarCitacoesNaResposta("O CMN formula a política da moeda e do crédito [1].", [{ indice: 9, trecho: "O Conselho Monetário Nacional formula a política da moeda e do crédito" }], trechos, true).ok,
    false,
  );
});

test("chat: código ancora afirmação no melhor trecho literal e bloqueia afirmação sem apoio", () => {
  const frase = "O Conselho Monetário Nacional formula a política da moeda e do crédito.";
  const preparada = prepararCitacoesDaResposta(frase, [], trechos, true);
  assert.ok(preparada);
  assert.match(preparada.resposta, /\[1\]\.$/);
  assert.equal(validarCitacoesNaResposta(preparada.resposta, preparada.fontes, trechos, true).ok, true);
  assert.equal(preparada.fontes[0].trecho, trechos[0].texto.split(".")[0] + ".");
  assert.equal(prepararCitacoesDaResposta("Um seguro de celular gratuito é garantido a quem usa Pix.", [], trechos, true), null);
  // citação única do tutor que não tem termos em comum com a afirmação também é recusada
  assert.equal(
    prepararCitacoesDaResposta(
      "Um seguro de celular gratuito é garantido a quem usa Pix.",
      [{ indice: 1, trecho: "O Conselho Monetário Nacional formula a política da moeda e do crédito." }],
      trechos,
      true,
    ),
    null,
  );
  const tutorSemMarcador = prepararCitacoesDaResposta(
    frase,
    [{ indice: 1, trecho: "O Conselho Monetário Nacional formula a política da moeda e do crédito" }],
    trechos,
    true,
  );
  assert.ok(tutorSemMarcador);
  assert.match(tutorSemMarcador.resposta, /\[1\]\.$/);
});

test("chat: trechosSustentamPergunta exige termos específicos do tema na base", () => {
  assert.equal(trechosSustentamPergunta("qual o prazo de resposta da ouvidoria?", trechos), true);
  assert.equal(trechosSustentamPergunta("Qual artigo garante seguro de celular gratuito para toda pessoa que faz um Pix?", trechos), false);
  assert.equal(trechosSustentamPergunta("qualquer coisa", []), false);
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
