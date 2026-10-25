import assert from "node:assert/strict";
import test from "node:test";
import { prontidaoDeTodos, prontidaoDo } from "./prontidao.js";
import { SUBTOPICO_POR_ID } from "./subtopicos.js";

test("domínio de Crase sobe a prontidão de TODOS os concursos que cobram Crase (um domínio só)", () => {
  const antes = prontidaoDeTodos(new Map());
  const depois = prontidaoDeTodos(new Map([["crase", 1]]));
  const cobram = SUBTOPICO_POR_ID.get("crase")!.concursos;
  assert.ok(cobram.length >= 2);
  for (const p of depois) {
    const a = antes.find((x) => x.concurso === p.concurso)!;
    if (cobram.includes(p.concurso)) assert.ok(p.prontidao > a.prontidao, `${p.concurso} sobe`);
    else assert.equal(p.prontidao, a.prontidao);
  }
});

test("tema que só um concurso cobra mexe só nele; aba mostra só as matérias do concurso", () => {
  const antes = prontidaoDeTodos(new Map());
  const depois = prontidaoDeTodos(new Map([["juros_compostos", 1]]));
  for (const p of depois) {
    const a = antes.find((x) => x.concurso === p.concurso)!;
    assert.equal(p.prontidao > a.prontidao, p.concurso === "bb", p.concurso);
  }
  const tj = prontidaoDo("tjsp", new Map());
  const materias = tj.materias.map((m) => m.disciplina);
  assert.ok(materias.includes("direito_penal") && materias.includes("lingua_portuguesa"));
  assert.ok(!materias.includes("matematica_financeira") && !materias.includes("vendas_negociacao"), "TJ-SP não mostra matéria do BB");
  assert.equal(tj.aConfirmar, true);
  assert.equal(prontidaoDo("bb", new Map()).aConfirmar, false);
});

test("prontidão 100% com tudo dominado; fracos = maior peso × falta de domínio", () => {
  const todos = new Map([...SUBTOPICO_POR_ID.keys()].map((k) => [k, 1]));
  assert.equal(prontidaoDo("bacen", todos).prontidao, 1);
  const p = prontidaoDo("bb", new Map());
  assert.equal(p.fracos.length, 5);
  assert.ok(p.fracos[0].peso >= p.fracos[4].peso);
});
