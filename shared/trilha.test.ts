import assert from "node:assert/strict";
import test from "node:test";
import { amanha, situacaoTrilha, TRILHA, veredito, type DiaTema, type TemaTrilha } from "./trilha.js";
import { SUBTOPICOS, SUBTOPICO_POR_ID } from "./subtopicos.js";

// 2026-10-19 é segunda-feira
const dia = (data: string, subtopico: string, novas: number, acertos: number): DiaTema => ({ data, subtopico, novas, acertos });
// ordem fixa para testar a REGRA (a ordem real vem de data/trilha.json e pode mudar)
const T: TemaTrilha[] = [
  { n: 1, subtopico: "interpretacao", nome: "Interpretação" },
  { n: 2, subtopico: "estrutura_sfn", nome: "Estrutura do SFN" },
  { n: 3, subtopico: "porcentagem", nome: "Porcentagem" },
  { n: 22, subtopico: "crase", nome: "Crase" },
  { n: 23, subtopico: "taxas", nome: "Taxas" },
];

test("trilha única: todos os temas do catálogo, numerados em ordem, sem repetir", () => {
  assert.equal(TRILHA.length, SUBTOPICOS.length);
  assert.deepEqual(TRILHA.map((t) => t.n), Array.from({ length: TRILHA.length }, (_, i) => i + 1));
  assert.equal(new Set(TRILHA.map((t) => t.subtopico)).size, TRILHA.length);
  for (const t of TRILHA) assert.ok(SUBTOPICO_POR_ID.has(t.subtopico), t.subtopico);
});

test("veredito: mínimo de 15 novas; ≥70 conclui, 50–69 reforço, <50 refaz", () => {
  assert.equal(veredito(14, 14), "incompleto");
  assert.equal(veredito(20, 14), "concluido");
  assert.equal(veredito(20, 13), "reforco");
  assert.equal(veredito(20, 10), "reforco");
  assert.equal(veredito(20, 9), "refazer");
});

test("avança com ≥70%; reforço fica no tema; dia de hoje e dia incompleto não contam", () => {
  let s = situacaoTrilha([], "2026-10-19", T);
  assert.equal(s.tema?.subtopico, "interpretacao");
  s = situacaoTrilha([dia("2026-10-19", "interpretacao", 20, 15)], "2026-10-20", T);
  assert.equal(s.estados.interpretacao, "concluido");
  assert.equal(s.tema?.subtopico, "estrutura_sfn");
  s = situacaoTrilha([dia("2026-10-19", "interpretacao", 20, 12)], "2026-10-20", T);
  assert.equal(s.estados.interpretacao, "reforco");
  assert.equal(s.tema?.subtopico, "interpretacao");
  assert.equal(s.refazer, false);
  assert.equal(s.diasNoTema, 1);
  s = situacaoTrilha([dia("2026-10-19", "interpretacao", 20, 5)], "2026-10-20", T);
  assert.equal(s.refazer, true);
  assert.equal(situacaoTrilha([dia("2026-10-19", "interpretacao", 10, 10)], "2026-10-20", T).tema?.subtopico, "interpretacao");
  assert.equal(situacaoTrilha([dia("2026-10-20", "interpretacao", 20, 20)], "2026-10-20", T).tema?.subtopico, "interpretacao");
  // duas sessões no mesmo dia somam
  s = situacaoTrilha([dia("2026-10-19", "interpretacao", 10, 7), dia("2026-10-19", "interpretacao", 10, 7)], "2026-10-20", T);
  assert.equal(s.estados.interpretacao, "concluido");
});

test("avanço por tema, uma vez só: tema estudado fora da ordem conta e a trilha pula o que já foi feito", () => {
  // estudou Porcentagem (3º) antes de tudo: fica concluído; a trilha segue em Interpretação e depois pula a Porcentagem
  const dias = [dia("2026-10-19", "porcentagem", 20, 16), dia("2026-10-20", "interpretacao", 20, 15), dia("2026-10-21", "estrutura_sfn", 20, 18)];
  const s = situacaoTrilha(dias, "2026-10-22", T);
  assert.equal(s.estados.porcentagem, "concluido");
  assert.equal(s.tema?.subtopico, "crase");
  // a MESMA história com outra ordem (tema novo entrou no meio) dá os mesmos estados: nada se perde
  const outra = [T[3], T[2], { n: 0, subtopico: "penal_geral", nome: "Penal" }, T[0], T[1], T[4]].map((t, i) => ({ ...t, n: i + 1 }));
  const s2 = situacaoTrilha(dias, "2026-10-22", outra);
  for (const id of ["porcentagem", "interpretacao", "estrutura_sfn"]) assert.equal(s2.estados[id], "concluido");
  assert.equal(s2.concluidos, 3);
});

test("limite de 2 dias: avança sempre e o tema vai para a fila de retomada; sábado pega 1 da fila", () => {
  const dias = [dia("2026-10-19", "interpretacao", 20, 9), dia("2026-10-20", "interpretacao", 20, 12)];
  const s = situacaoTrilha(dias, "2026-10-21", T);
  assert.equal(s.estados.interpretacao, "retomada");
  assert.deepEqual(s.filaRetomada, ["interpretacao"]);
  assert.equal(s.tema?.subtopico, "estrutura_sfn");
  assert.equal(s.diasNoTema, 0);
  // sábado 24/10: modo misto + retomada
  const sab = situacaoTrilha(dias, "2026-10-24", T);
  assert.equal(sab.modo, "sabado");
  assert.equal(sab.tema?.subtopico, "interpretacao");
  // ≥70% no sábado tira da fila e não mexe no tema da trilha
  const depois = situacaoTrilha([...dias, dia("2026-10-24", "interpretacao", 20, 16)], "2026-10-26", T);
  assert.deepEqual(depois.filaRetomada, []);
  assert.equal(depois.estados.interpretacao, "concluido");
  assert.equal(depois.tema?.subtopico, "estrutura_sfn");
});

test("amanhã: mensagem pela regra (concluído, reforço, refaz, 2º dia, incompleto)", () => {
  const crase = { n: 22, nome: "Crase", diaNoTema: 1 };
  assert.equal(amanha(crase, 20, 15, T), "Crase concluído! Amanhã: tema 23, Taxas.");
  assert.match(amanha(crase, 20, 12, T), /reforço de Crase \(28 novas\)/);
  assert.match(amanha(crase, 20, 6, T), /refaz Crase/);
  assert.match(amanha({ ...crase, diaNoTema: 2 }, 20, 12, T), /tema 23, Taxas e Crase vai para a fila de retomada/);
  assert.match(amanha(crase, 10, 10, T), /Faltam 5 questões novas/);
});

test("início escolhido pelo aluno: a trilha começa no tema 22 (Crase) e segue a regra dali", () => {
  const inicio = { n: 22, desde: "2026-10-22" };
  assert.equal(situacaoTrilha([], "2026-10-22", T, inicio).tema?.subtopico, "crase");
  // dia anterior ao início conta para o tema (progresso não se perde), mas não tira a trilha da Crase
  const antes = situacaoTrilha([dia("2026-10-21", "interpretacao", 20, 20)], "2026-10-23", T, inicio);
  assert.equal(antes.tema?.subtopico, "crase");
  assert.equal(antes.estados.interpretacao, "concluido");
  const s = situacaoTrilha([dia("2026-10-22", "crase", 20, 15)], "2026-10-23", T, inicio);
  assert.equal(s.estados.crase, "concluido");
  assert.equal(s.tema?.subtopico, "taxas");
  // depois do último, volta ao começo pelos que faltam
  const fim = situacaoTrilha([dia("2026-10-22", "crase", 20, 15), dia("2026-10-23", "taxas", 20, 15)], "2026-10-26", T, inicio);
  assert.equal(fim.tema?.subtopico, "interpretacao");
  // pelo subtópico (como fica gravado depois da migração): vale mesmo se a ordem mudar
  assert.equal(situacaoTrilha([], "2026-10-22", T, { subtopico: "crase", desde: "2026-10-22" }).tema?.subtopico, "crase");
  const reordenada = [T[3], T[0], T[1], T[2], T[4]].map((t, i) => ({ ...t, n: i + 1 }));
  assert.equal(situacaoTrilha([], "2026-10-22", reordenada, { subtopico: "taxas", desde: "2026-10-22" }).tema?.subtopico, "taxas");
});

test("domingo: sem tema novo", () => {
  const s = situacaoTrilha([], "2026-10-25", T);
  assert.equal(s.modo, "domingo");
  assert.equal(s.tema, null);
});

test("fim da Rodada 1 → Rodada 2 com o menor acerto primeiro", () => {
  const temas = T.slice(0, 3);
  const dias = [dia("2026-10-19", temas[0].subtopico, 20, 18), dia("2026-10-20", temas[1].subtopico, 20, 14), dia("2026-10-21", temas[2].subtopico, 20, 16)];
  const s = situacaoTrilha(dias, "2026-10-22", temas);
  assert.equal(s.rodada, 2);
  assert.equal(s.tema?.subtopico, temas[1].subtopico); // 70% é o menor
});
