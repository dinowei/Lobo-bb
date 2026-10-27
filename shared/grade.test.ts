import assert from "node:assert/strict";
import test from "node:test";
import { CONCLUIR_ACERTO, CONCLUIR_FIRME, CONCLUIR_ULTIMAS, MATERIAS, filaDaGrade, materiaDa, montarGrade, proximoPasso, statusTema, temaDoDia, type PlacarTema } from "./grade.js";
import { DISCIPLINAS } from "./tipos.js";
import { TRILHA } from "./trilha.js";
import { SUBTOPICO_POR_ID } from "./subtopicos.js";
import { disciplinaDoTema } from "./trilhaUnica.js";

// n respostas, a acertos, as erradas por último (as mais antigas)
const resp = (n: number, a: number) => Array.from({ length: n }, (_, i) => i < a);
const placar = (aprovadas: number, n: number, a: number, respondidas = n): PlacarTema => ({ respondidas, recentes: resp(Math.min(20, n), Math.min(a, 20)), aprovadas });

test("grade: toda disciplina da trilha cai em exatamente uma matéria (12 matérias)", () => {
  assert.equal(MATERIAS.length, 12);
  for (const d of DISCIPLINAS) assert.equal(MATERIAS.filter((m) => m.disciplinas.includes(d)).length, 1, d);
  for (const t of TRILHA) {
    const s = SUBTOPICO_POR_ID.get(t.subtopico)!;
    assert.ok(materiaDa(disciplinaDoTema(s)), `${t.subtopico} sem matéria`);
  }
});

test("tema concluído: ≥ 70% nas últimas 20 (configurável); sem resposta, não iniciado", () => {
  assert.equal(CONCLUIR_ACERTO, 0.7);
  assert.equal(CONCLUIR_ULTIMAS, 20);
  assert.equal(CONCLUIR_FIRME, 15);
  assert.equal(statusTema(placar(30, 0, 0)), "nao_iniciado");
  assert.equal(statusTema(placar(30, 20, 14)), "concluido");
  assert.equal(statusTema(placar(30, 20, 13)), "em_andamento", "65%");
  assert.equal(statusTema(placar(30, 10, 10)), "em_andamento", "ainda faltam respostas");
  assert.equal(proximoPasso("em_andamento", placar(30, 10, 9)), "Mais 10 questões do tema");
  assert.equal(proximoPasso("nao_iniciado", placar(12, 0, 0)), "Começar pela aula");
});

test("concluído provisório: < 15 aprovadas e meta batida; vira concluído com ≥ 15 e ≥ 70% nas últimas 15", () => {
  assert.equal(statusTema(placar(8, 8, 6)), "provisorio", "8 aprovadas, 75% nas 8");
  assert.equal(statusTema(placar(8, 8, 5)), "em_andamento", "62%");
  assert.equal(statusTema(placar(3, 3, 3)), "em_andamento", "mínimo de 5 respostas");
  // chegaram questões: 16 aprovadas; respondeu mais 7 (12 de 15 nas últimas = 80%)
  assert.equal(statusTema(placar(16, 15, 12)), "concluido");
  assert.equal(statusTema(placar(16, 15, 10)), "em_andamento", "67% nas últimas 15");
  assert.equal(statusTema(placar(16, 8, 8)), "em_andamento", "com 16 aprovadas precisa de 15 respostas");
  assert.match(proximoPasso("provisorio", placar(8, 8, 6)), /Fecha de vez quando o tema tiver 15 questões/);
  assert.equal(proximoPasso("provisorio", placar(11, 8, 6)), "3 questões novas chegaram");
});

test("montar a grade: ordem da trilha; próximo = 1º não fechado; provisório libera o próximo e volta com questão nova", () => {
  const temas = [
    { n: 2, subtopico: "b", nome: "B", disciplina: "lingua_portuguesa" as const, subtemas: [] },
    { n: 1, subtopico: "a", nome: "A", disciplina: "lingua_portuguesa" as const, subtemas: ["x", "y"] },
    { n: 3, subtopico: "c", nome: "C", disciplina: "matematica" as const, subtemas: [] },
  ];
  const g = montarGrade(temas, new Map([["a", placar(25, 20, 18)], ["b", placar(25, 3, 1)]]));
  assert.deepEqual(g.map((m) => m.id), ["portugues", "matematica"]);
  assert.deepEqual(g[0].temas.map((t) => [t.subtopico, t.status]), [["a", "concluido"], ["b", "em_andamento"]]);
  assert.equal(g[0].concluidos, 1);
  assert.equal(g[0].temas[1].proximoDaSequencia, true);
  assert.equal(g[1].temas[0].status, "nao_iniciado");
  assert.equal(g.flatMap((m) => m.temas).filter((t) => t.proximoDaSequencia).length, 1);
  assert.equal(g[0].temas[0].acerto, 90);

  // A provisório (8 aprovadas, todas respondidas): libera B
  const prov = montarGrade(temas, new Map([["a", placar(8, 8, 7)]]));
  assert.equal(prov[0].temas[0].status, "provisorio");
  assert.equal(prov[0].temas[0].proximoDaSequencia, false);
  assert.equal(prov[0].temas[1].proximoDaSequencia, true);
  assert.equal(prov[0].concluidos, 0, "provisório não conta como concluído");
  // chegaram 4 questões novas de A: a meta passa a ser as 12, A volta a andamento e a ser o próximo, com 4 no cronograma
  const voltou = montarGrade(temas, new Map([["a", placar(12, 8, 7, 8)]]));
  assert.equal(voltou[0].temas[0].status, "em_andamento");
  assert.equal(voltou[0].temas[0].proximoDaSequencia, true);
  assert.deepEqual(filaDaGrade(voltou)[0], { subtopico: "a", nome: "A", disciplina: "lingua_portuguesa", faltam: 4 });
});

test("fila do cronograma: começa no próximo da sequência e pula os fechados", () => {
  const temas = [
    { n: 1, subtopico: "a", nome: "A", disciplina: "lingua_portuguesa" as const, subtemas: [] },
    { n: 2, subtopico: "b", nome: "B", disciplina: "lingua_portuguesa" as const, subtemas: [] },
    { n: 3, subtopico: "c", nome: "C", disciplina: "matematica" as const, subtemas: [] },
  ];
  const f = filaDaGrade(montarGrade(temas, new Map([["a", placar(25, 20, 18)], ["b", placar(25, 12, 6)]])));
  assert.deepEqual(f.map((t) => [t.subtopico, t.faltam]), [["b", 8], ["c", 20]]);
});

test("tema do dia = próximo da sequência; escolha manual aparece no Painel sem mudar a sequência", () => {
  const temas = [
    { n: 1, subtopico: "a", nome: "A", disciplina: "lingua_portuguesa" as const, subtemas: [] },
    { n: 2, subtopico: "b", nome: "B", disciplina: "lingua_portuguesa" as const, subtemas: [] },
    { n: 3, subtopico: "c", nome: "C", disciplina: "matematica" as const, subtemas: [] },
  ];
  const g = montarGrade(temas, new Map([["a", placar(25, 20, 18)]]));
  assert.equal(temaDoDia(g, null)?.tema.subtopico, "b");
  assert.equal(temaDoDia(g, null)?.manual, false);
  const manual = temaDoDia(g, "c")!;
  assert.equal(manual.tema.subtopico, "c");
  assert.equal(manual.manual, true);
  // a sequência não mudou: o próximo continua B, e a fila do Plano também começa em B
  assert.equal(g.flatMap((m) => m.temas).find((t) => t.proximoDaSequencia)?.subtopico, "b");
  assert.equal(filaDaGrade(g)[0].subtopico, "b");
  // escolher um tema já fechado (ou o próprio próximo) não conta como manual
  assert.deepEqual([temaDoDia(g, "a")?.tema.subtopico, temaDoDia(g, "a")?.manual], ["b", false]);
  assert.equal(temaDoDia(g, "b")?.manual, false);
  assert.equal(temaDoDia(g, "nao-existe")?.tema.subtopico, "b");
});
