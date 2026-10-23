import assert from "node:assert/strict";
import test from "node:test";
import { amanha, situacaoTrilha, TRILHA, veredito, type DiaTema } from "./trilha.js";
import { SUBTOPICO_POR_ID } from "./subtopicos.js";

// 2026-10-19 é segunda-feira
const dia = (data: string, subtopico: string, novas: number, acertos: number): DiaTema => ({ data, subtopico, novas, acertos });

test("trilha: 51 temas na ordem do dono, todos ligados a um subtópico da F3", () => {
  assert.equal(TRILHA.length, 51);
  assert.deepEqual(TRILHA.map((t) => t.n), Array.from({ length: 51 }, (_, i) => i + 1));
  for (const t of TRILHA) assert.ok(SUBTOPICO_POR_ID.has(t.subtopico), t.subtopico);
  assert.equal(TRILHA[21].subtopico, "crase");
});

test("veredito: mínimo de 15 novas; ≥70 conclui, 50–69 reforço, <50 refaz", () => {
  assert.equal(veredito(14, 14), "incompleto");
  assert.equal(veredito(20, 14), "concluido");
  assert.equal(veredito(20, 13), "reforco");
  assert.equal(veredito(20, 10), "reforco");
  assert.equal(veredito(20, 9), "refazer");
});

test("avança com ≥70%; reforço fica no tema; dia de hoje e dia incompleto não contam", () => {
  let s = situacaoTrilha([], "2026-10-19");
  assert.equal(s.tema?.subtopico, "interpretacao");
  s = situacaoTrilha([dia("2026-10-19", "interpretacao", 20, 15)], "2026-10-20");
  assert.equal(s.estados.interpretacao, "concluido");
  assert.equal(s.tema?.subtopico, "estrutura_sfn");
  s = situacaoTrilha([dia("2026-10-19", "interpretacao", 20, 12)], "2026-10-20");
  assert.equal(s.estados.interpretacao, "reforco");
  assert.equal(s.tema?.subtopico, "interpretacao");
  assert.equal(s.refazer, false);
  s = situacaoTrilha([dia("2026-10-19", "interpretacao", 20, 5)], "2026-10-20");
  assert.equal(s.refazer, true);
  assert.equal(situacaoTrilha([dia("2026-10-19", "interpretacao", 10, 10)], "2026-10-20").tema?.subtopico, "interpretacao");
  assert.equal(situacaoTrilha([dia("2026-10-20", "interpretacao", 20, 20)], "2026-10-20").tema?.subtopico, "interpretacao");
  // duas sessões no mesmo dia somam
  s = situacaoTrilha([dia("2026-10-19", "interpretacao", 10, 7), dia("2026-10-19", "interpretacao", 10, 7)], "2026-10-20");
  assert.equal(s.estados.interpretacao, "concluido");
});

test("limite de 2 dias: avança sempre e o tema vai para a fila de retomada; sábado pega 1 da fila", () => {
  const dias = [dia("2026-10-19", "interpretacao", 20, 9), dia("2026-10-20", "interpretacao", 20, 12)];
  const s = situacaoTrilha(dias, "2026-10-21");
  assert.equal(s.estados.interpretacao, "retomada");
  assert.deepEqual(s.filaRetomada, ["interpretacao"]);
  assert.equal(s.tema?.subtopico, "estrutura_sfn");
  assert.equal(s.diasNoTema, 0);
  // sábado 24/10: modo misto + retomada
  const sab = situacaoTrilha(dias, "2026-10-24");
  assert.equal(sab.modo, "sabado");
  assert.equal(sab.tema?.subtopico, "interpretacao");
  // ≥70% no sábado tira da fila e não mexe no tema da trilha
  const depois = situacaoTrilha([...dias, dia("2026-10-24", "interpretacao", 20, 16)], "2026-10-26");
  assert.deepEqual(depois.filaRetomada, []);
  assert.equal(depois.estados.interpretacao, "concluido");
  assert.equal(depois.tema?.subtopico, "estrutura_sfn");
});

test("amanhã: mensagem pela regra (concluído, reforço, refaz, 2º dia, incompleto)", () => {
  const crase = { n: 22, nome: "Crase", diaNoTema: 1 };
  assert.equal(amanha(crase, 20, 15), "Crase concluído! Amanhã: tema 23, Taxas.");
  assert.match(amanha(crase, 20, 12), /reforço de Crase \(28 novas\)/);
  assert.match(amanha(crase, 20, 6), /refaz Crase/);
  assert.match(amanha({ ...crase, diaNoTema: 2 }, 20, 12), /tema 23, Taxas e Crase vai para a fila de retomada/);
  assert.match(amanha(crase, 10, 10), /Faltam 5 questões novas/);
});

test("início escolhido pelo aluno: a trilha começa no tema 22 (Crase) e segue a regra dali", () => {
  const inicio = { n: 22, desde: "2026-10-22" };
  assert.equal(situacaoTrilha([], "2026-10-22", TRILHA, inicio).tema?.subtopico, "crase");
  // dia anterior ao início não move a trilha
  assert.equal(situacaoTrilha([dia("2026-10-21", "interpretacao", 20, 20)], "2026-10-23", TRILHA, inicio).tema?.subtopico, "crase");
  const s = situacaoTrilha([dia("2026-10-22", "crase", 20, 15)], "2026-10-23", TRILHA, inicio);
  assert.equal(s.estados.crase, "concluido");
  assert.equal(s.tema?.subtopico, "taxas");
});

test("domingo: sem tema novo", () => {
  const s = situacaoTrilha([], "2026-10-25");
  assert.equal(s.modo, "domingo");
  assert.equal(s.tema, null);
});

test("fim da Rodada 1 → Rodada 2 com o menor acerto primeiro", () => {
  const temas = TRILHA.slice(0, 3);
  const dias = [dia("2026-10-19", temas[0].subtopico, 20, 18), dia("2026-10-20", temas[1].subtopico, 20, 14), dia("2026-10-21", temas[2].subtopico, 20, 16)];
  const s = situacaoTrilha(dias, "2026-10-22", temas);
  assert.equal(s.rodada, 2);
  assert.equal(s.tema?.subtopico, temas[1].subtopico); // 70% é o menor
});
