import { test } from "node:test";
import assert from "node:assert/strict";
import { LINHAS_REDACAO, linhasDaFolha, situacaoDasLinhas, textoAteOLimite } from "./redacaoLinhas.js";

// parágrafo de n linhas cheias de 70 caracteres (10 palavras de 6 letras + espaços = 69)
const linhaCheia = "palavr ".repeat(10).trim();
const paragrafo = (linhas: number) => Array.from({ length: linhas }, () => linhaCheia).join(" ");

test("conta linhas da folha, não quebras de parágrafo", () => {
  assert.equal(linhasDaFolha(""), 0);
  assert.equal(linhasDaFolha("Uma frase curta."), 1);
  // 5 parágrafos longos (o caso do E2E: ~2.073 caracteres) não são "5 linhas"
  const texto = Array.from({ length: 5 }, () => paragrafo(6)).join("\n\n");
  assert.equal(linhasDaFolha(texto), 30);
  // parágrafo novo começa linha nova: 2 parágrafos de meia linha = 2 linhas
  assert.equal(linhasDaFolha("curto um\ncurto dois"), 2);
  // palavra maior que a linha ocupa mais de uma
  assert.equal(linhasDaFolha("x".repeat(150)), 3);
});

test("curto, no limite e normal", () => {
  const curto = [paragrafo(4), paragrafo(4)].join("\n");
  assert.equal(situacaoDasLinhas(linhasDaFolha(curto)), "abaixo");
  const noLimite = Array.from({ length: 5 }, () => paragrafo(5)).join("\n");
  assert.equal(linhasDaFolha(noLimite), LINHAS_REDACAO.minimo);
  assert.equal(situacaoDasLinhas(linhasDaFolha(noLimite)), "ok");
  const normal = Array.from({ length: 4 }, () => paragrafo(7)).join("\n");
  assert.equal(situacaoDasLinhas(linhasDaFolha(normal)), "ok");
  assert.equal(situacaoDasLinhas(31), "acima");
});

test("acima do máximo: só o texto até a linha 30 é lido, e é prefixo literal", () => {
  const longo = Array.from({ length: 4 }, (_, i) => `${paragrafo(9)} fim${i}`).join("\n");
  assert.ok(linhasDaFolha(longo) > LINHAS_REDACAO.maximo);
  const lido = textoAteOLimite(longo);
  assert.ok(longo.startsWith(lido));
  assert.equal(linhasDaFolha(lido), LINHAS_REDACAO.maximo);
  const ok = paragrafo(10);
  assert.equal(textoAteOLimite(ok), ok);
});
