import test from "node:test";
import assert from "node:assert/strict";
import { extrairHtmlCompiladoBcb, hostOficial, selecionarArtigos } from "./baixar.js";

test("só aceita HTTPS nos hosts oficiais, incluindo normativos e MCR do BCB", () => {
  assert.equal(hostOficial("https://www.planalto.gov.br/lei"), true);
  assert.equal(hostOficial("https://normativos.bcb.gov.br/ato.pdf"), true);
  assert.equal(hostOficial("https://www3.bcb.gov.br/mcr/completo"), true);
  assert.equal(hostOficial("http://www.planalto.gov.br/lei"), false);
  assert.equal(hostOficial("https://planalto.gov.br.exemplo.invalid/lei"), false);
});

test("recorta os artigos indicados, sem trazer os artigos vizinhos", () => {
  const lei = "LEI\nArt. 29. anterior.\n\nArt. 30. CDB um.\n§ 1º detalhe.\nArt. 31º CDB dois.\nArt. 32 CDB três.\nArt. 33. CDB quatro.\nArt. 34. posterior.";
  const trecho = selecionarArtigos(lei, ["30", "31", "32", "33"]);
  assert.match(trecho, /Art\. 30\. CDB um/);
  assert.match(trecho, /Art\. 33\. CDB quatro/);
  assert.doesNotMatch(trecho, /Art\. 29|Art\. 34/);
});

test("recorte falha fechado quando artigo pedido não existe", () => {
  assert.throws(() => selecionarArtigos("Art. 1º único.", ["2"]), /artigo 2 não encontrado/);
});

test("accepts only a compiled dated response from BCB", () => {
  const html = "<p>" + "official text ".repeat(60) + "</p>";
  const doc = { TipoTexto: "Compilado", VersaoNormativo: 43, DataTexto: "2/10/2026", Texto: html };
  assert.deepEqual(extrairHtmlCompiladoBcb(JSON.stringify({ conteudo: [doc] })), { html, versao: "43", data: "2/10/2026" });
  assert.throws(() => extrairHtmlCompiladoBcb(JSON.stringify({ conteudo: [{ ...doc, TipoTexto: "Vigente" }] })), /compilada/);
  assert.throws(() => extrairHtmlCompiladoBcb(JSON.stringify({ conteudo: [{ ...doc, Texto: "short" }] })), /curto/);
});

test("norma do BCB nunca alterada: o original é o texto vigente; alterada, revogada ou cancelada exige compilado", () => {
  const html = "<p>" + "texto oficial ".repeat(60) + "</p>";
  const original = { TipoTexto: "None", VersaoNormativo: "1.0", DataTexto: "13/1/2021 18:01", Texto: html, Atualizacoes: "None", Revogado: "False", Cancelado: "False" };
  assert.deepEqual(extrairHtmlCompiladoBcb(JSON.stringify({ conteudo: [original] })), { html, versao: "1.0", data: "13/1/2021 18:01", original: true });
  assert.throws(() => extrairHtmlCompiladoBcb(JSON.stringify({ conteudo: [{ ...original, Atualizacoes: "Resolução BCB nº 589/2026 - Alteração" }] })), /compilada/);
  assert.throws(() => extrairHtmlCompiladoBcb(JSON.stringify({ conteudo: [{ ...original, Revogado: "True" }] })), /compilada/);
  assert.throws(() => extrairHtmlCompiladoBcb(JSON.stringify({ conteudo: [{ ...original, Cancelado: "True" }] })), /compilada/);
});
