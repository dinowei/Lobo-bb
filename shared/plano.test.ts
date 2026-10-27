import { test } from "node:test";
import assert from "node:assert/strict";
import { faseDa, gerarPlano, pesosDoPlano, planoDeHoje, type EntradaPlano } from "./plano.js";

const disciplinas: EntradaPlano["disciplinas"] = [
  { disciplina: "informatica", dominio: 0.2, topicos: 10, topicosVistos: 2 },
  { disciplina: "lingua_inglesa", dominio: 0.8, topicos: 4, topicosVistos: 4 },
  { disciplina: "conhecimentos_bancarios", dominio: 0.5, rating: 1100, topicos: 8, topicosVistos: 3 },
  { disciplina: "probabilidade_estatistica", dominio: 0, topicos: 3, topicosVistos: 0 },
];
const base: EntradaPlano = { hoje: "2026-10-19", horasPorDia: 2, diasSemana: [1, 2, 3, 4, 5, 6], disciplinas }; // 19/10/2026 = segunda

test("peso: cota × fraqueza × rating; fora do edital não entra", () => {
  const p = pesosDoPlano(disciplinas);
  assert.ok(p.get("informatica")! > p.get("lingua_inglesa")!);
  assert.equal(p.has("probabilidade_estatistica"), false);
  // rating baixo pesa mais que o mesmo domínio com rating médio
  const comRating = pesosDoPlano([{ disciplina: "matematica", dominio: 0.5, rating: 1000, topicos: 1, topicosVistos: 1 }]).get("matematica")!;
  const semRating = pesosDoPlano([{ disciplina: "matematica", dominio: 0.5, topicos: 1, topicosVistos: 1 }]).get("matematica")!;
  assert.ok(comRating > semRating);
});

test("fases: base até cobrir, reta final nas 3 últimas semanas, ciclo sem data", () => {
  assert.equal(faseDa(1, null, 3), "ciclo");
  assert.equal(faseDa(2, 10, 3), "base");
  assert.equal(faseDa(5, 10, 3), "aprofundamento");
  assert.equal(faseDa(8, 10, 3), "reta_final");
});

test("sem data: ciclo com revisão diária, 1 redação e 1 simulado por semana, nos dias escolhidos", () => {
  const p = gerarPlano(base);
  assert.equal(p.fase, "ciclo");
  assert.equal(p.totalSemanas, null);
  const s1 = p.semanas[0];
  assert.equal(s1.dias.length, 6); // segunda a sábado
  const itens = s1.dias.flatMap((d) => d.itens);
  assert.equal(itens.filter((i) => i.tipo === "redacao").length, 1);
  assert.equal(itens.filter((i) => i.tipo === "simulado").length, 1);
  assert.ok(s1.dias.every((d) => d.itens.some((i) => i.tipo === "revisao" || i.tipo === "simulado")));
  // tempo do dia respeitado
  for (const d of s1.dias) assert.ok(d.itens.reduce((s, i) => s + i.minutos, 0) <= 120);
  assert.ok(!itens.some((i) => i.tipo === "questoes" && i.disciplina === "probabilidade_estatistica"));
  assert.ok(planoDeHoje(p, "2026-10-19"));
});

test("com data: semana X de Y e reta final só com revisão, erros, redação e 2 simulados", () => {
  const p = gerarPlano({ ...base, dataProva: "2026-11-09", inicio: "2026-10-05" }); // 3 semanas restantes
  assert.equal(p.semanaAtual, 3);
  assert.equal(p.totalSemanas, 5);
  assert.equal(p.semanas.length, 3);
  for (const s of p.semanas) {
    assert.equal(s.fase, "reta_final");
    const itens = s.dias.flatMap((d) => d.itens);
    assert.ok(!itens.some((i) => i.tipo === "questoes"));
    assert.equal(itens.filter((i) => i.tipo === "simulado").length, 2);
  }
  // nada marcado no dia da prova ou depois
  assert.ok(p.semanas.flatMap((s) => s.dias).every((d) => d.data < "2026-11-09"));
});

test("atrasou? o plano recalcula do estado atual (mais tópicos faltando = mais semanas de base)", () => {
  const longe = { ...base, dataProva: "2027-03-01" };
  const poucos = gerarPlano(longe);
  const muitos = gerarPlano({ ...longe, disciplinas: disciplinas.map((d) => ({ ...d, topicosVistos: 0, topicos: d.topicos * 4 })) });
  assert.equal(poucos.semanas[1].fase, "base");
  assert.equal(poucos.semanas[3].fase, "aprofundamento");
  assert.equal(muitos.semanas[3].fase, "base");
});

test("v1.1: com a grade, o plano segue matéria por matéria, tema por tema (sem rodízio), e o plano antigo vale sem ela", () => {
  const grade = [
    { subtopico: "concordancia", nome: "Concordância", disciplina: "lingua_portuguesa" as const, faltam: 20 },
    { subtopico: "regencia", nome: "Regência", disciplina: "lingua_portuguesa" as const, faltam: 20 },
    { subtopico: "porcentagem", nome: "Porcentagem", disciplina: "matematica" as const, faltam: 20 },
  ];
  const p = gerarPlano({ ...base, grade });
  const itens = p.semanas.flatMap((s) => s.dias.flatMap((d) => d.itens));
  const ultimoTema = itens.map((i) => i.tipo).lastIndexOf("tema");
  assert.ok(!itens.slice(0, ultimoTema).some((i) => i.tipo === "questoes"), "enquanto há fila, nada de rodízio");
  const temas = itens.filter((i) => i.tipo === "tema").map((i) => (i.tipo === "tema" ? i.subtopico : ""));
  assert.equal(temas[0], "concordancia", "hoje começa pelo tema da vez");
  // ordem preservada: nunca volta a um tema anterior
  const ordem = [...new Set(temas)];
  assert.deepEqual(ordem.slice(0, 3), ["concordancia", "regencia", "porcentagem"]);
  const soma = (s: string) => itens.reduce((m, i) => m + (i.tipo === "tema" && i.subtopico === s ? i.questoes : 0), 0);
  assert.equal(soma("concordancia"), 20);
  // a entrada não é alterada (a fila é copiada)
  assert.equal(grade[0].faltam, 20);
  // sem grade: o rodízio de antes, igual
  assert.deepEqual(gerarPlano(base), gerarPlano({ ...base, grade: [] }));
});
