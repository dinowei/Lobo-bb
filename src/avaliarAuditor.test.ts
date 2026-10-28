import assert from "node:assert/strict";
import test from "node:test";
import { PLANTAS_SECAO, plantarFicha } from "./avaliarAuditor.js";

const secao = {
  tema: "Porcentagem", subtema: "aumentos e descontos sucessivos",
  explicacao: "Para aumentos sucessivos, multiplique os fatores [1]. O verbo fica no singular.",
  resumo: "Multiplique os fatores.",
  regras: [{ indice: 1, texto: "Sucessivos: multiplique os fatores.", titulo: "Construção" }],
  exemplos: ["Um produto de R$ 500,00 sobe 10% e cai 10%. Resposta: R$ 495,00."],
  contraexemplos: ["“Fazem dois anos” está errado (BB 2021, alternativa B; o gabarito é C)."],
  pegadinhas: ["Aumento e desconto de mesma taxa nunca se anulam."],
};

test("avaliar auditor (28/10): cada planta muda a seção com UM erro conhecido", () => {
  for (const [erro, plantar] of Object.entries(PLANTAS_SECAO)) {
    const p = plantar(secao);
    assert.ok(p, `${erro} se aplica a esta seção`);
    assert.notDeepEqual(p, secao, `${erro} mudou algo`);
  }
  assert.match(PLANTAS_SECAO.moeda(secao)!.explicacao, /€/);
  assert.match(PLANTAS_SECAO.ingles(secao)!.explicacao, /the rule always applies/);
  assert.match(PLANTAS_SECAO.regra_invertida(secao)!.explicacao, /plural/);
  assert.match(PLANTAS_SECAO.conta_errada(secao)!.exemplos[0], /R\$ 532,00/, "495 + 37");
  assert.match(PLANTAS_SECAO.contradiz_gabarito(secao)!.explicacao, /alternativa B era a correta/);
});

test("avaliar auditor (28/10): planta em ficha troca só a 1ª afirmação", () => {
  const af = [{ afirmacao: "O BCB tem 4 diretores com mandato.", classe: "fato", trecho: "x" }, { afirmacao: "Outra.", classe: "fato", trecho: "y" }];
  const ing = plantarFicha(af, "ingles")!;
  assert.equal(ing.plantada, 1);
  assert.match(ing.afirmacoes[0].afirmacao, /^The rule/);
  assert.equal(ing.afirmacoes[1].afirmacao, "Outra.");
  assert.match(plantarFicha(af, "numero_trocado")!.afirmacoes[0].afirmacao, /11 diretores/);
  assert.equal(plantarFicha([{ afirmacao: "Sem número.", classe: "fato", trecho: "" }], "numero_trocado"), null);
});
