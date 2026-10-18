// Testes em massa dos templates por construção (sem IA): cada tipo montado centenas de vezes
import { test } from "node:test";
import assert from "node:assert/strict";
import { construir, tiposConstruidos } from "./construcao.js";
import { descreverFigura, tirarTabelaCopiada } from "./construcaoFiguras.js";
import { verificarConta, numerosDoTexto, ehDisciplinaDeCalculo } from "./verificacao.js";
import { carregarVariacoes, sortearPar, ehTipoComFigura, contextosPermitidos } from "./variacao.js";
import { Planilha } from "../shared/planilha.js";
import type { Letra } from "../shared/tipos.js";

const ASSUNTOS: [string, string][] = [
  ["Juros compostos", "matematica_financeira"],
  ["Descontos", "matematica_financeira"],
  ["Planilhas eletrônicas", "informatica"],
  ["Funções e equações de 1º e 2º grau", "matematica"],
  ["Técnicas de vendas", "vendas_negociacao"],
  ["Sistemas de amortização", "matematica_financeira"],
  ["Taxas de juros", "matematica_financeira"],
  ["Análise combinatória", "probabilidade_estatistica"],
  ["Probabilidade", "probabilidade_estatistica"],
];
const N = 1000; // por tipo (5 letras × 200), mínimo do PLANO-MESTRE 5.2

for (const [assunto, disciplina] of ASSUNTOS) {
  for (const tipo of tiposConstruidos(assunto)) {
    test(`${assunto} · ${tipo}: ${N} montagens válidas`, () => {
      for (let k = 0; k < N; k++) {
        const g = "ABCDE"[k % 5] as Letra;
        const m = construir(assunto, tipo, g);
        assert.ok(m, "montou");
        // correta na letra sorteada, 5 textos distintos
        assert.equal(m.alternativas.find((a) => a.correta)?.letra, g);
        assert.equal(new Set(m.alternativas.map((a) => a.texto)).size, 5);
        // em ordem crescente (números) ou na ordem dos rótulos (V, W, X…)
        if (m.unidade !== "rotulo") {
          const vals = m.alternativas.map((a) => numerosDoTexto(a.texto)[0]);
          assert.ok(vals.every((v, j) => !j || v > vals[j - 1]), `ordem crescente: ${vals.join(" < ")}`);
        }
        // regra 10: a conta confere por mathjs nas disciplinas de cálculo
        if (ehDisciplinaDeCalculo(disciplina)) {
          const r = verificarConta({ enunciado: m.dados.join(". "), gabarito: m.gabarito, alternativas: m.alternativas, verificacao: { expressao: m.expressao, fatoresDados: m.fatoresDados } });
          assert.ok(r.ok, r.ok ? "" : `${r.motivo}: ${r.detalhes.join(" | ")}`);
        }
        if (m.figura) {
          const desc = descreverFigura(m.figura);
          const certa = m.alternativas.find((a) => a.correta)!.texto;
          // a figura não entrega a resposta (tabela: o valor pedido não aparece; planilha: célula-alvo vazia, abaixo)
          if (m.figura.tipo === "tabela" && m.unidade !== "rotulo" && certa.length >= 4)
            assert.ok(!desc.includes(certa.replace(/^R\$ /, "")), `figura mostra ${certa}`);
          if (m.figura.tipo === "planilha") {
            const p = m.figura.dados;
            assert.ok(p.selecionada && !p.celulas[p.selecionada], "célula-alvo vazia na figura");
            // o código recalcula a fórmula da pergunta e bate com a correta
            const formula = m.dados[1];
            const v = new Planilha({ ...p, celulas: { ...p.celulas, [p.selecionada!]: formula } }).valor(p.selecionada!);
            assert.equal(Math.round(Number(v) * 100) / 100, m.correta);
          }
          if (m.figura.tipo === "tabela" && tipo.startsWith("sistema linear")) {
            assert.ok(m.figura.dados.linhas.at(-1)!.includes("?"), "linha pedida com ?");
          }
        }
      }
    });
  }
}

test("figura copiada como tabela de texto sai do enunciado; módulo |x| fica", () => {
  const copiado = "A planilha a seguir mostra os dados: | Agência | Contas | |---|---| | Praia | 13 | | Vale | 13 | Considerando a fórmula =SOMA(B2:B7), qual o valor em E9?";
  assert.equal(tirarTabelaCopiada(copiado), "A planilha a seguir mostra os dados: Considerando a fórmula =SOMA(B2:B7), qual o valor em E9?");
  const modulo = "Qual o valor de |x − 2| quando x = 5?";
  assert.equal(tirarTabelaCopiada(modulo), modulo);
});

test("sorteio: tipo com figura sai na proporção do inventário (±4 pp) e sempre com contexto permitido", () => {
  const c = carregarVariacoes();
  for (const [assunto, proporcao] of [["Planilhas eletrônicas", 0.05], ["Funções e equações de 1º e 2º grau", 0.2], ["Juros compostos", 0.1]] as const) {
    let comFigura = 0;
    for (let k = 0; k < 2000; k++) {
      const v = sortearPar(c, { assunto, subtopicos: [] }, k % 2 === 0, undefined, proporcao);
      if (ehTipoComFigura(v.tipo)) comFigura++;
      assert.ok(contextosPermitidos(c, assunto, v.tipo).includes(v.contexto));
    }
    assert.ok(Math.abs(comFigura / 2000 - proporcao) < 0.04, `${assunto}: ${comFigura / 2000} vs ${proporcao}`);
  }
});
