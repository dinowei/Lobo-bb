import assert from "node:assert/strict";
import test from "node:test";
import { ampliarVocabulario, MOLDES, moldesDaRegra, preencher, validarMoldes, valorNeutroValido, VOCAB_BASE } from "./moldesPT.js";
import { conferirFrase, REGRAS_CRASE } from "./portugues.js";
import { concordaComRegra, dividirMatches, veredictoLT, type MatchLT } from "./languagetool.js";

test("moldes: regra existente, um [trecho] e vocabulário em toda lacuna", () => {
  assert.deepEqual(validarMoldes(), []);
  assert.ok(validarMoldes([{ id: "x", regra: "nao_existe", texto: "{nada} sem trecho." }]).length >= 3);
});

test("moldes: toda frase montada passa na trava de posição da própria regra (30 sorteios cada)", () => {
  for (const m of MOLDES) {
    for (let i = 0; i < 30; i++) {
      const f = preencher(m);
      assert.equal(conferirFrase(f.frase, f.trecho, f.regra), null, `${m.id}: "${f.frase}" [${f.trecho}]`);
      assert.match(f.frase, /^\p{Lu}.*\.$/u, `${m.id}: maiúscula no início e ponto no fim`);
      assert.doesNotMatch(f.frase, /[{}[\]]/);
    }
  }
});

test("moldes: toda regra de uso correto tem molde", () => {
  for (const r of REGRAS_CRASE.filter((x) => x.correta)) assert.ok(moldesDaRegra(r.id).length > 0, r.id);
});

test("vocabulário da IA: só lacunas neutras, sem nada que mexa na crase", () => {
  assert.equal(valorNeutroValido("sujeito", "O tesoureiro"), true);
  assert.equal(valorNeutroValido("sujeito", "o tesoureiro"), false, "sujeito com maiúscula");
  assert.equal(valorNeutroValido("final", "com cuidado redobrado"), true);
  assert.equal(valorNeutroValido("final", "até o fim do dia"), false);
  assert.equal(valorNeutroValido("final", "às pressas"), false);
  assert.equal(valorNeutroValido("final", "a pedido do cliente"), false);
  assert.equal(valorNeutroValido("final", "em 2 dias"), false);
  assert.equal(valorNeutroValido("sujeito", "O gerente de risco"), true);
  assert.equal(valorNeutroValido("sujeito", "Os stakeholders"), false);
  assert.equal(valorNeutroValido("sujeito", "O Auditor"), false);
  const v = ampliarVocabulario(VOCAB_BASE, { sujeito: ["O tesoureiro", "O coach"], final: ["com cuidado redobrado"], lugar_fa: ["sala"] });
  assert.ok(v.neutras.sujeito.includes("O tesoureiro"));
  assert.ok(!v.neutras.final.includes("com cuidado redobrado"), "complemento não vem da IA (lote de prova de 26/10)");
  assert.ok(!v.criticas.lugar_fa.includes("sala"), "lacuna crítica não aceita vocabulário da IA");
});

// respostas reais do LanguageTool 6.6 local (26/10/2026)
const m = (regra: string, categoria: string, inicio: number, fim: number): MatchLT => ({ regra, categoria, inicio, fim, mensagem: "" });
test("veredito do LanguageTool: certo = limpa; erro = apontado no trecho e só nele", () => {
  const erro = "O cliente começou à analisar o contrato.";
  const v1 = veredictoLT(erro, "começou à analisar", [m("CRASE_CONFUSION", "GRAMMAR", 18, 28)]);
  assert.equal(concordaComRegra(false, v1), true);
  assert.equal(concordaComRegra(true, v1), false);
  const certa = "O gerente começou a analisar o contrato.";
  assert.equal(concordaComRegra(true, veredictoLT(certa, "começou a analisar", [])), true);
  assert.equal(concordaComRegra(false, veredictoLT(certa, "começou a analisar", [])), false, "erro que o LT não viu: diverge");
  // erro fora do trecho (ex.: "Ficaram cara" em "cara à cara"): diverge
  const rep = "Ficaram cara à cara no atendimento.";
  assert.equal(concordaComRegra(false, veredictoLT(rep, "cara à cara", [m("NON_IMPERSONAL_VERBS", "GRAMMAR", 0, 12)])), false);
  // tipografia/estilo não conta como erro de língua
  assert.equal(veredictoLT(certa, "começou a analisar", [m("TYPOGRAPHY_X", "TYPOGRAPHY", 0, 1)]).limpa, true);
});

test("lote no LanguageTool: os erros voltam para a frase certa, com o offset da própria frase", () => {
  const frases = ["Vou à agência.", "Ele começou à analisar.", "Pagou à vista."];
  // texto enviado: "Vou à agência.\n\nEle começou à analisar.\n\nPagou à vista." → "à analisar" começa em 16 + 12
  const por = dividirMatches(frases, [m("CRASE_CONFUSION", "GRAMMAR", 28, 38)]);
  assert.deepEqual(por.map((x) => x.length), [0, 1, 0]);
  assert.equal(frases[1].slice(por[1][0].inicio, por[1][0].fim), "à analisar");
});
