import assert from "node:assert/strict";
import test from "node:test";
import { AulaZ } from "./prompts.js";
import { contarPalavrasMarkdown, validarAulaGerada } from "./aulas.js";

const trecho = "O Banco Central define regras e supervisiona as instituições financeiras autorizadas.";
const fonte = { indice: 1, sourceId: "0123456789abcdef01234567", titulo: "Norma oficial", texto: trecho };

function montar(conteudo: string, fontes: { indice: number; trecho: string }[] = []) {
  return AulaZ.parse({
    conteudo,
    pontosChave: ["Ponto-chave suficientemente explicado.", "Outro ponto-chave importante.", "Terceiro ponto para revisão."],
    comoABancaCobra: "A banca cobra a compreensão do conceito em uma situação prática.",
    pegadinhasComuns: ["Confundir os termos do conceito.", "Ignorar a condição descrita no enunciado."],
    exemplos: ["Um exemplo prático ajuda a aplicar a regra em uma situação cotidiana."],
    fontes,
  });
}

test("conta palavras do conteúdo Markdown sem contar marcadores", () => {
  assert.equal(contarPalavrasMarkdown("## Juros compostos\n**Saldo** cresce a cada período [1]."), 7);
});

test("reprova aula normativa sem trecho ingerido e citado", () => {
  const aula = montar("Uma explicação normativa com conteúdo suficiente para passar da validação estrutural. ".repeat(3));
  assert.match(validarAulaGerada(aula, "conhecimentos_bancarios", []) ?? "", /exige fonte ingerida/);
});

test("aceita fonte normativa quando a citação está no texto e o trecho é literal", () => {
  const aula = montar(`A instituição segue a norma aplicável [1]. ${"Explicação estável sobre o papel do sistema financeiro. ".repeat(3)}`, [{ indice: 1, trecho }]);
  assert.equal(validarAulaGerada(aula, "conhecimentos_bancarios", [fonte]), undefined);
});

test("reprova índice de fonte inexistente e trecho que não aparece na fonte", () => {
  const semIndice = montar(`A regra consta no material [2]. ${"Contexto conceitual complementar para a aula. ".repeat(3)}`, [{ indice: 2, trecho }]);
  assert.match(validarAulaGerada(semIndice, "matematica", [fonte]) ?? "", /índice de fonte inexistente/);

  const semTrechoLiteral = montar(`A regra consta no material [1]. ${"Contexto conceitual complementar para a aula. ".repeat(3)}`, [{ indice: 1, trecho: "Trecho inventado que não consta no documento original." }]);
  assert.match(validarAulaGerada(semTrechoLiteral, "matematica", [fonte]) ?? "", /não existe literalmente/);
});

test("reprova fonte listada sem citação no conteúdo e citação extensa", () => {
  const semUso = montar(`${"Explicação conceitual suficiente para esta aula. ".repeat(3)}`, [{ indice: 1, trecho }]);
  assert.match(validarAulaGerada(semUso, "matematica", [fonte]) ?? "", /não é citada no conteúdo/);

  const longa = montar(`A regra está na fonte [1]. ${"Contexto conceitual complementar para a aula. ".repeat(3)}`, [{ indice: 1, trecho: trecho.repeat(2) }]);
  assert.match(validarAulaGerada(longa, "matematica", [fonte]) ?? "", /excedeu 120 caracteres/);
});

test("reprova conteúdo acima de 400 palavras", () => {
  const aula = montar(`${"palavra ".repeat(401)} conteúdo suficiente`);
  assert.match(validarAulaGerada(aula, "matematica", []) ?? "", /400 palavras/);
});
