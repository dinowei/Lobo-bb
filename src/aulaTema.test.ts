import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { arquivoBancoPT, camadaDoTipo, checarTextoAula, origemDaSecao, PROVA_AULA_TEMA, TENTATIVAS_POR_SECAO, type MaterialSecao } from "./aulaTema.js";
import { materialMatematica, subtemasComConstrucao } from "./aulaMatematica.js";
import { calcular, numerosDoTexto } from "./verificacao.js";
import { PASTA_INDICE } from "./acervo.js";

const pt: MaterialSecao = {
  tipo: "portugues",
  regras: [{ indice: 1, texto: "Verbos impessoais não têm sujeito, ficam no singular.", titulo: "Revisão de Véspera INSS, p. 13", camada: "C" }],
  exemplos: ["“Havia tempos que João não ligava para a mãe.” (Revisão de Véspera INSS, p. 13)"],
  contraexemplos: ["“Com a chegada da pandemia causada pela Covid-19 fazem dois anos que não viajo nas férias escolares.” está errado (BB 2021, alternativa B; o gabarito é C). Fere: Concordância do impessoal."],
  pegadinhas: [],
  descartados: [],
};

test("aula (28/10): checagens por código reprovam moeda, LaTeX, [N] inexistente e exemplo fora do material", () => {
  assert.deepEqual(checarTextoAula("O verbo impessoal fica no singular [1], como em “Havia tempos que João não ligava para a mãe.”", pt), []);
  assert.match(checarTextoAula("Custa 10 € por mês [1].", pt)[0], /moeda/);
  assert.match(checarTextoAula("Use \\frac{A}{B} [1].", pt)[0], /LaTeX/);
  assert.match(checarTextoAula("Como diz a regra [2].", pt)[0], /\[2\]/);
  assert.match(checarTextoAula("Veja: “Fazem três anos que moro aqui no centro.” [1]", pt)[0], /fora do material/, "exemplo inventado pela IA");
});

test("aula (28/10): Matemática por construção — toda conta confere com mathjs, moeda R$, número da IA só do material", () => {
  for (const sub of subtemasComConstrucao()) {
    const m = materialMatematica(sub)!;
    assert.ok(m.exemplos.length >= 2 && m.contraexemplos.length >= 1 && m.pegadinhas.length >= 1, sub);
    for (const e of m.exemplos) assert.ok(Math.abs(calcular(e.expressao) - e.valor) < 1e-9, `${sub}: ${e.expressao}`);
    for (const c of m.contraexemplos) {
      assert.ok(Math.abs(calcular(c.expressaoCerta) - c.valorCerto) < 1e-9);
      assert.notEqual(c.valorErrado, c.valorCerto, "o contraexemplo dá um valor diferente do certo");
    }
    const tudo = JSON.stringify(m);
    assert.doesNotMatch(tudo, /€|US\$|d[oó]lar|\\frac|\\times/, `${sub}: só R$ e texto legível`);
  }
  // reprodutível: mesma semente, mesmos números
  assert.deepEqual(materialMatematica("aumentos e descontos sucessivos", 7), materialMatematica("aumentos e descontos sucessivos", 7));
  const mat: MaterialSecao = { tipo: "matematica", regras: [{ indice: 1, texto: "fórmula", titulo: "Construção", camada: "conceito" }], exemplos: ["R$ 200,00 sobe 10% e cai 10%. Resposta: R$ 198,00."], contraexemplos: [], pegadinhas: [], formula: "x", descartados: [] };
  assert.deepEqual(checarTextoAula("O preço vai a R$ 198,00, não R$ 200,00 [1].", mat), []);
  assert.match(checarTextoAula("Se o preço fosse R$ 350,00 [1]...", mat)[0], /número fora do material: 350/);
  assert.deepEqual(numerosDoTexto("R$ 1.234,56"), [1234.56]);
});

test("aula (28/10): origem pela camada das regras; 2 tentativas; prova só nos 2 temas", () => {
  assert.equal(origemDaSecao([{ camada: "C" }]), "C");
  assert.equal(origemDaSecao([{ camada: "conceito" }]), "conceito");
  assert.equal(camadaDoTipo("material_cursinho"), "C");
  assert.equal(camadaDoTipo("lei"), "A");
  assert.equal(TENTATIVAS_POR_SECAO, 2);
  assert.deepEqual([...PROVA_AULA_TEMA], ["concordancia", "porcentagem"]);
});

test("banco de regras de Concordância: toda regra e exemplo do acervo existe LITERALMENTE na página (quando o índice local existe)", { skip: !existsSync(PASTA_INDICE) }, async () => {
  const { conferirBancoNoAcervo } = await import("./aulaTema.js");
  const banco = JSON.parse(readFileSync(arquivoBancoPT("concordancia"), "utf8")) as { semMaterial: Record<string, string> };
  assert.ok(banco.semMaterial["concordância ideológica"], "subtema sem material fica declarado");
  assert.deepEqual(conferirBancoNoAcervo("concordancia"), [], "nada fora do acervo");
});
