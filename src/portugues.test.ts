import assert from "node:assert/strict";
import test from "node:test";
import { construirCrase, FORA_DO_SORTEIO, REGRAS_CRASE } from "./portugues.js";
import { carregarVariacoes, contextosPermitidos } from "./variacao.js";

test("crase: a introdução sai das estruturas dadas, com o contexto; sem lista, a padrão", () => {
  const estruturas = ["Em um e-mail interno sobre {contexto}, foram redigidas as frases abaixo.", "Leia as frases a seguir, escritas em um documento sobre {contexto}."];
  const vistos = new Set<string>();
  for (let i = 0; i < 60; i++) {
    const q = construirCrase("B", "ofício de um cartório judicial", { uso: new Map(), anterior: new Set() }, estruturas);
    assert.ok(estruturas.some((e) => q.enunciado.startsWith(e.replace("{contexto}", "ofício de um cartório judicial"))), q.enunciado);
    vistos.add(q.enunciado.slice(0, 20));
  }
  assert.equal(vistos.size, 2, "as duas estruturas aparecem");
  assert.match(construirCrase("B", "Pix").enunciado, /^Ao revisar comunicados de uma agência bancária sobre Pix/);
});

test("variações: 'escrita' = contextos principais + de escrita, só nos tipos marcados; 'todos' não muda", () => {
  const c = carregarVariacoes();
  const crase = contextosPermitidos(c, "Regência verbal e nominal e crase", "crase (por construção)");
  assert.ok(crase.includes("ofício de um cartório judicial") && crase.includes("aplicação em CDB"));
  const planilha = contextosPermitidos(c, "Planilhas eletrônicas", "fórmulas");
  assert.ok(!planilha.includes("ofício de um cartório judicial"), "situação de escrita não vaza para Informática");
  assert.deepEqual(planilha, c.contextos);
  assert.ok((c.estruturasPortugues ?? []).length >= 6);
});

test("crase: regra fora do sorteio nunca entra, mesmo sendo a menos usada; continua no banco de regras", () => {
  assert.ok(REGRAS_CRASE.some((r) => r.id === "erro_tratamento"), "a regra continua no banco");
  // todas as outras já usadas muitas vezes: antes, a de tratamento (uso 0) entrava sempre
  const uso = new Map(REGRAS_CRASE.map((r) => [r.id, FORA_DO_SORTEIO.has(r.id) ? 0 : 50]));
  for (let i = 0; i < 200; i++) {
    const q = construirCrase("C", "abertura de conta", { uso, anterior: new Set() });
    assert.ok(q.frases.every((f) => !FORA_DO_SORTEIO.has(f.regra.id)));
    assert.equal(q.frases.filter((f) => f.regra.correta).length, 1);
    assert.equal(new Set(q.frases.map((f) => f.regra.id)).size, 5, "5 regras diferentes");
  }
});
