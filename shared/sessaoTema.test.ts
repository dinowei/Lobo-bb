import assert from "node:assert/strict";
import test from "node:test";
import { ETAPAS_SESSAO_TEMA, pedidoDaEtapa } from "./sessaoTema.js";

// v1.1, item 1 (defeito): praticando Concordância, veio uma questão de Matemática (revisões de todas as
// matérias no começo da sessão e "+N da matéria" virando treino misturado no fim)
test("sessão do tema: toda etapa pede SÓ o tema (nada de misto, disciplina ou revisão de outra matéria)", () => {
  const s = { subtopico: "concordancia", banca: "cesgranrio" };
  assert.deepEqual(ETAPAS_SESSAO_TEMA, ["revisoes", "tema", "erros"], "sem a etapa de mistas; erros do tema no fim (item 3)");
  for (const etapa of ETAPAS_SESSAO_TEMA) {
    const p = pedidoDaEtapa(etapa, s, ["x1"]);
    assert.equal(p.subtopico, "concordancia", `${etapa}: sempre o tema`);
    assert.equal("misto" in p, false, `${etapa}: nunca misto`);
    assert.equal("disciplina" in p, false, `${etapa}: nunca a matéria inteira`);
    assert.deepEqual(p.excluir, ["x1"]);
  }
  assert.deepEqual(pedidoDaEtapa("revisoes", s, []), { revisao: true, subtopico: "concordancia", excluir: [] });
  assert.deepEqual(pedidoDaEtapa("erros", s, []), { erros: true, subtopico: "concordancia", excluir: [] });
  assert.deepEqual(pedidoDaEtapa("tema", s, []), { subtopico: "concordancia", excluir: [], banca: "cesgranrio" });
});
