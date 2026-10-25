import assert from "node:assert/strict";
import test from "node:test";
import { lerItensCECursinho } from "./cursinho.js";

// layout real do "100 Questões Inéditas Banco do Brasil" (Estratégia), texto do PDF
const texto = [
  "QUESTÃO 12",
  "ENUNCIADO DA QUESTÃO",
  "Os bancos de investimentos e bancos de desenvolvimento não recebem depósitos à vista.",
  "( X ) CERTO",
  "( ) ERRADO",
  "SOLUÇÃO DA QUESTÃO",
  "CERTO.",
  "As instituições bancárias ou monetárias podem captar depósitos à vista; banco de investimento e de desenvolvimento não.",
  "QUESTÃO 14",
  "ENUNCIADO DA QUESTÃO",
  "O cartão de crédito básico é aquele utilizado apenas para pagamentos e sua concessão é obrigatória.",
  "( ) CERTO",
  "( X ) ERRADO",
  "SOLUÇÃO DA QUESTÃO",
  "ERRADO.",
  "A instituição não é obrigada a conceder cartão de crédito; o básico é só a modalidade mais simples.",
  "QUESTÃO 15",
  "ENUNCIADO DA QUESTÃO",
  "Item cuja marcação discorda da solução do próprio material.",
  "( X ) CERTO",
  "( ) ERRADO",
  "SOLUÇÃO DA QUESTÃO",
  "ERRADO.",
  "A solução diz errado: o item fica de fora em vez de entrar com o gabarito duvidoso.",
].join("\n");

test("cursinho C/E: marcação ( X ) por código; marcação e solução precisam concordar", () => {
  const { itens, recusados } = lerItensCECursinho(`\n${texto}`);
  assert.deepEqual(itens.map((i) => [i.numero, i.gabarito]), [[12, "C"], [14, "E"]]);
  assert.match(itens[0].afirmacao, /^Os bancos de investimentos/);
  assert.match(itens[1].explicacao, /^A instituição não é obrigada/);
  assert.deepEqual(recusados, [{ numero: 15, motivo: "marcação e solução discordam" }]);
});
