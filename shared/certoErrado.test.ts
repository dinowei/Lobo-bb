import assert from "node:assert/strict";
import test from "node:test";
import { corrigirCE, derivarItens, recomendarBranco } from "./certoErrado.js";

test("nota C/E na Cebraspe: um erro anula um acerto; branco zero; anulado vale para todos", () => {
  const r = corrigirCE([
    { resposta: "C", gabarito: "C" },
    { resposta: "C", gabarito: "C" },
    { resposta: "E", gabarito: "E" },
    { resposta: "C", gabarito: "E" },
    { resposta: null, gabarito: "C" },
    { resposta: "E", gabarito: "anulada" },
  ], "cebraspe");
  assert.deepEqual(r, { acertos: 4, erros: 1, brancos: 1, nota: 3, maxima: 6 });
  // Cesgranrio não desconta: o mesmo erro não tira ponto
  assert.equal(corrigirCE([{ resposta: "C", gabarito: "E" }, { resposta: "C", gabarito: "C" }], "cesgranrio").nota, 1);
});

test("em branco: Cebraspe abaixo de 50% estimado recomenda branco; poucos dados não recomenda; sem penalidade responde", () => {
  assert.equal(recomendarBranco({ acertos: 2, total: 3 }, "cebraspe").recomenda, "sem_dados");
  const fraco = recomendarBranco({ acertos: 4, total: 10 }, "cebraspe"); // (4+1)/12 = 42%
  assert.equal(fraco.recomenda, "branco");
  assert.match(fraco.motivo, /42%.*4 de 10.*50%/);
  assert.equal(recomendarBranco({ acertos: 8, total: 10 }, "cebraspe").recomenda, "responder"); // 75%
  assert.equal(recomendarBranco({ acertos: 5, total: 10 }, "cebraspe").recomenda, "branco"); // 50% não basta
  assert.equal(recomendarBranco({ acertos: 0, total: 10 }, "cesgranrio").recomenda, "responder");
});

test("derivação: a certa vira C, as erradas viram E, com a explicação da alternativa; sem explicação não deriva", () => {
  const q = {
    enunciado: "Sobre o Pix, é correto afirmar que",
    alternativas: [
      { letra: "A", texto: "funciona 24 horas.", correta: true, explicacao: "O Pix funciona todos os dias, 24 h." },
      { letra: "B", texto: "só em dias úteis.", correta: false, explicacao: "Não: funciona também em feriados." },
    ],
  };
  const itens = derivarItens(q);
  assert.deepEqual(itens.map((i) => [i.letraOrigem, i.gabarito]), [["A", "C"], ["B", "E"]]);
  assert.match(itens[1].base, /Pix[\s\S]*dias úteis/);
  assert.throws(() => derivarItens({ ...q, alternativas: [{ ...q.alternativas[0], explicacao: "" }, q.alternativas[1]] }), /regra 5/);
  assert.throws(() => derivarItens({ ...q, alternativas: q.alternativas.map((a) => ({ ...a, correta: true })) }), /exatamente uma/);
});
