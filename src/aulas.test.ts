import assert from "node:assert/strict";
import test from "node:test";
import { AulaZ } from "./prompts.js";
import { ancorarCitacao, desembrulhar, contarPalavrasMarkdown, normalizarFontes, validarAulaGerada } from "./aulas.js";

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

test("normalizarFontes tira as não citadas e repetidas e limita a 8, sem mexer na citação", () => {
  const conteudo = `Regra A [1] e regra B [3]. ${"Contexto conceitual complementar para a aula. ".repeat(3)}`;
  const muitas = Array.from({ length: 14 }, (_, i) => ({ indice: (i % 4) + 1, trecho: `${trecho} ${i < 2 ? "" : i}`.trim() }));
  const n = normalizarFontes(montar(conteudo, [{ indice: 1, trecho }, { indice: 1, trecho }, ...muitas]));
  assert.ok(n.fontes.every((f) => f.indice === 1 || f.indice === 3));
  assert.ok(n.fontes.length <= 8);
  assert.equal(n.fontes.filter((f) => f.indice === 1 && f.trecho === trecho).length, 1);
  // citação longa é cortada numa palavra e continua literal
  const longa = normalizarFontes(montar(`Regra [1]. ${"Explicação conceitual suficiente para esta aula. ".repeat(3)}`, [{ indice: 1, trecho: `${trecho} ${trecho}` }]));
  assert.ok(longa.fontes[0].trecho.length <= 120 && `${trecho} ${trecho}`.startsWith(longa.fontes[0].trecho));
  assert.equal(validarAulaGerada(longa, "matematica", [{ ...fonte, texto: `${trecho} ${trecho}` }]), undefined);
  // a não citada que reprovava antes agora sai, e a aula passa
  const semUso = normalizarFontes(montar(`Regra [1]. ${"Explicação conceitual suficiente para esta aula. ".repeat(3)}`, [{ indice: 1, trecho }, { indice: 2, trecho }]));
  assert.equal(validarAulaGerada(semUso, "matematica", [fonte]), undefined);
});

test("citação parafraseada vira a frase literal da fonte; sem frase parecida, fica como veio", () => {
  const fonteLonga = "Art. 1º Esta lei dispõe sobre o sistema. O Banco Central define regras e supervisiona as instituições financeiras autorizadas. Outras disposições.";
  const ancorada = ancorarCitacao("O Banco Central estabelece regras e supervisiona instituições financeiras autorizadas", fonteLonga);
  assert.equal(ancorada, "O Banco Central define regras e supervisiona as instituições financeiras autorizadas.");
  assert.ok(fonteLonga.includes(ancorada));
  assert.equal(ancorarCitacao("Texto que não tem nada a ver com a norma citada aqui", fonteLonga), "Texto que não tem nada a ver com a norma citada aqui");
  assert.equal(ancorarCitacao("supervisiona as instituições", fonteLonga), "supervisiona as instituições"); // já literal
});

test("desembrulha {aula: {...}} e deixa o resto como está", () => {
  assert.deepEqual(desembrulhar({ aula: { conteudo: "x" } }), { conteudo: "x" });
  assert.deepEqual(desembrulhar({ conteudo: "x" }), { conteudo: "x" });
  assert.deepEqual(desembrulhar({ a: 1, b: { conteudo: "x" } }), { a: 1, b: { conteudo: "x" } });
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
