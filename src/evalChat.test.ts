import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { ehInvencaoAceita, validarGoldenChat, verificarResultado } from "./evalChat.js";
import { FORA_DO_EDITAL, SEM_BASE } from "./chatBinho.js";

test("golden do Binho: invenção aceita = caso sem base que saiu com resposta de conteúdo", () => {
  const caso = { id: "x", disciplina: "conhecimentos_bancarios", topico: "Pix", pergunta: "?", respostaExisteNasFontes: false, artigoEsperado: null, resultadoEsperado: "nao_achei" } as const;
  assert.equal(ehInvencaoAceita(caso as never, "O art. 9º garante o seguro."), true);
  assert.equal(ehInvencaoAceita(caso as never, SEM_BASE), false);
  assert.equal(ehInvencaoAceita(caso as never, FORA_DO_EDITAL), false);
  assert.equal(ehInvencaoAceita({ ...caso, resultadoEsperado: "resposta_util" } as never, "conceito"), false);
});

const golden = JSON.parse(readFileSync("docs/eval/chat-golden.json", "utf8")) as unknown;

test("golden do Binho: 30 casos, distribuição e campos são determinísticos", () => {
  const casos = validarGoldenChat(golden);
  assert.equal(casos.length, 30);
  assert.deepEqual(
    Object.fromEntries([...new Set(casos.map((c) => c.disciplina))].map((d) => [d, casos.filter((c) => c.disciplina === d).length])),
    {
      conhecimentos_bancarios: 6, vendas_negociacao: 2, informatica: 2, matematica_financeira: 2,
      direito_administrativo: 7, direito_constitucional: 2, direito_penal: 4, direito_processual_penal: 1, direito_processual_civil: 2, mercado_valores_mobiliarios: 2,
    },
  );
  assert.equal(casos.filter((c) => c.resultadoEsperado === "nao_achei").length, 5);
  assert.ok(casos.every((c) => c.id && c.topico && c.pergunta && typeof c.respostaExisteNasFontes === "boolean" && "artigoEsperado" in c && c.resultadoEsperado));
});

test("golden do Binho: impede declarar 'não achei' quando a resposta está na fonte", () => {
  const valor = structuredClone(golden) as { versao: number; casos: Record<string, unknown>[] };
  valor.casos[0] = { ...valor.casos[0], resultadoEsperado: "nao_achei" };
  assert.throws(() => validarGoldenChat(valor), /nao_achei/);
});

test("golden do Binho: mede utilidade por fonte e artigo esperado separadamente", () => {
  const caso = validarGoldenChat(golden)[0];
  const comFonte = verificarResultado(caso, "A regra é esta [1].", [{ titulo: "LC 105/2001", trecho: "Art. 1º As instituições financeiras devem conservar o sigilo." }]);
  assert.equal(comFonte.aprovado, true);
  assert.equal(comFonte.artigoEsperado, true);
  const fonteSemNumeroDoArtigo = verificarResultado(caso, "A regra é esta [1].", [{ titulo: "LC 105/2001", trecho: "As instituições financeiras devem conservar o sigilo." }]);
  assert.equal(fonteSemNumeroDoArtigo.util, true);
  assert.equal(fonteSemNumeroDoArtigo.artigoEsperado, false);
  assert.equal(verificarResultado(caso, "A regra é esta [1].", []).aprovado, false);
  const artigoErrado = verificarResultado(caso, "A regra é esta [1].", [{ titulo: "LC 105/2001", trecho: "Art. 2º Outra regra." }]);
  assert.equal(artigoErrado.util, true);
  assert.equal(artigoErrado.artigoEsperado, false);
});
