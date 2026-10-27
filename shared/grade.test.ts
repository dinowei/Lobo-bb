import assert from "node:assert/strict";
import test from "node:test";
import { CONCLUIR_ACERTO, CONCLUIR_ULTIMAS, MATERIAS, filaDaGrade, materiaDa, montarGrade, proximoPasso, statusTema } from "./grade.js";
import { DISCIPLINAS } from "./tipos.js";
import { TRILHA } from "./trilha.js";
import { SUBTOPICO_POR_ID } from "./subtopicos.js";
import { disciplinaDoTema } from "./trilhaUnica.js";

test("grade: toda disciplina da trilha cai em exatamente uma matéria (12 matérias)", () => {
  assert.equal(MATERIAS.length, 12);
  for (const d of DISCIPLINAS) assert.equal(MATERIAS.filter((m) => m.disciplinas.includes(d)).length, 1, d);
  for (const t of TRILHA) {
    const s = SUBTOPICO_POR_ID.get(t.subtopico)!;
    assert.ok(materiaDa(disciplinaDoTema(s)), `${t.subtopico} sem matéria`);
  }
});

test("tema concluído: ≥ 70% nas últimas 20 (configurável); tema pequeno fecha com todas; sem resposta, não iniciado", () => {
  assert.equal(CONCLUIR_ACERTO, 0.7);
  assert.equal(CONCLUIR_ULTIMAS, 20);
  assert.equal(statusTema({ respondidas: 0, ultimas: { n: 0, a: 0 }, aprovadas: 30 }), "nao_iniciado");
  assert.equal(statusTema({ respondidas: 20, ultimas: { n: 20, a: 14 }, aprovadas: 30 }), "concluido");
  assert.equal(statusTema({ respondidas: 20, ultimas: { n: 20, a: 13 }, aprovadas: 30 }), "em_andamento", "65%");
  assert.equal(statusTema({ respondidas: 10, ultimas: { n: 10, a: 10 }, aprovadas: 30 }), "em_andamento", "ainda faltam respostas");
  assert.equal(statusTema({ respondidas: 8, ultimas: { n: 8, a: 6 }, aprovadas: 8 }), "concluido", "tema com 8 aprovadas fecha com as 8");
  assert.equal(proximoPasso("em_andamento", { ultimas: { n: 10, a: 9 }, aprovadas: 30 }), "Mais 10 questões do tema");
  assert.equal(proximoPasso("nao_iniciado", { ultimas: { n: 0, a: 0 }, aprovadas: 12 }), "Começar pela aula");
});

test("montar a grade: matérias e temas na ordem da trilha; o próximo da sequência é o 1º não concluído", () => {
  const temas = [
    { n: 2, subtopico: "b", nome: "B", disciplina: "lingua_portuguesa" as const, subtemas: [] },
    { n: 1, subtopico: "a", nome: "A", disciplina: "lingua_portuguesa" as const, subtemas: ["x", "y"] },
    { n: 3, subtopico: "c", nome: "C", disciplina: "matematica" as const, subtemas: [] },
  ];
  const d = new Map([["a", { respondidas: 20, ultimas: { n: 20, a: 18 }, aprovadas: 25 }], ["b", { respondidas: 3, ultimas: { n: 3, a: 1 }, aprovadas: 25 }]]);
  const g = montarGrade(temas, d);
  assert.deepEqual(g.map((m) => m.id), ["portugues", "matematica"]);
  assert.deepEqual(g[0].temas.map((t) => [t.subtopico, t.status]), [["a", "concluido"], ["b", "em_andamento"]]);
  assert.equal(g[0].concluidos, 1);
  assert.equal(g[0].temas[1].proximoDaSequencia, true);
  assert.equal(g[1].temas[0].status, "nao_iniciado");
  assert.equal(g.flatMap((m) => m.temas).filter((t) => t.proximoDaSequencia).length, 1);
  assert.equal(g[0].temas[0].acerto, 90);
});

test("fila do cronograma: começa no próximo da sequência e pula os concluídos", () => {
  const temas = [
    { n: 1, subtopico: "a", nome: "A", disciplina: "lingua_portuguesa" as const, subtemas: [] },
    { n: 2, subtopico: "b", nome: "B", disciplina: "lingua_portuguesa" as const, subtemas: [] },
    { n: 3, subtopico: "c", nome: "C", disciplina: "matematica" as const, subtemas: [] },
  ];
  const d = new Map([["a", { respondidas: 20, ultimas: { n: 20, a: 18 }, aprovadas: 25 }], ["b", { respondidas: 12, ultimas: { n: 12, a: 6 }, aprovadas: 25 }]]);
  const f = filaDaGrade(montarGrade(temas, d));
  assert.deepEqual(f.map((t) => [t.subtopico, t.faltam]), [["b", 8], ["c", 20]]);
});
