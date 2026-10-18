import { test } from "node:test";
import assert from "node:assert/strict";
import {
  atualizarRatings, dificuldadeDoRating, dificuldadeExibida, esperado, pesoPorProximidade, placar, ratingInicialQuestao, reprocessar, RATING_ALUNO_INICIAL,
} from "./rating.js";

test("rating inicial da questão sai da dificuldade rotulada", () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(ratingInicialQuestao), [1000, 1150, 1300, 1450, 1600]);
  assert.equal(ratingInicialQuestao(0), 1300); // sem rótulo: média
});

test("Elo: acerto sobe o aluno e desce a questão; K 32 × 16", () => {
  const r = atualizarRatings(1200, 1200, true, 3);
  assert.equal(r.aluno, 1216);
  assert.equal(r.questao, 1192);
  const e = atualizarRatings(1200, 1200, false, 3);
  assert.equal(e.aluno, 1184);
  assert.equal(e.questao, 1208);
  // chute certo vale meio acerto: em jogo equilibrado não mexe
  assert.deepEqual(atualizarRatings(1200, 1200, true, 1), { aluno: 1200, questao: 1200 });
  assert.equal(placar(true, 2), 1);
  // acertar questão bem mais difícil rende mais
  assert.ok(atualizarRatings(1200, 1600, true).aluno - 1200 > 16);
  assert.ok(esperado(1200, 1600) < 0.1);
});

test("dificuldade exibida só vem do rating com 5+ respostas", () => {
  assert.deepEqual([1000, 1150, 1300, 1450, 1600, 900, 1800].map(dificuldadeDoRating), [1, 2, 3, 4, 5, 1, 5]);
  assert.equal(dificuldadeExibida(2, 1600, 4), 2);
  assert.equal(dificuldadeExibida(2, 1600, 5), 5);
  assert.equal(dificuldadeExibida(3, null, 10), 3);
});

test("proximidade: perto do alvo pesa mais", () => {
  assert.ok(pesoPorProximidade(1250, 1250) > pesoPorProximidade(1400, 1250));
  assert.ok(pesoPorProximidade(2000, 1250) > 0);
});

test("reprocessar: migração por disciplina, na ordem", () => {
  const r = reprocessar(
    [
      { questaoId: "q1", disciplina: "informatica", acertou: true },
      { questaoId: "q1", disciplina: "informatica", acertou: true },
      { questaoId: "q2", disciplina: "matematica", acertou: false },
    ],
    () => 3
  );
  assert.equal(r.alunos.get("informatica")!.n, 2);
  assert.ok(r.alunos.get("informatica")!.rating > RATING_ALUNO_INICIAL);
  assert.ok(r.alunos.get("matematica")!.rating < RATING_ALUNO_INICIAL);
  assert.ok(r.questoes.get("q1")!.rating < 1300);
  // diagnóstico fixa o nível naquele ponto; o que vem depois parte dele
  const f = reprocessar([{ fixar: 1500, disciplina: "matematica" }, { questaoId: "q2", disciplina: "matematica", acertou: true }], () => 3);
  assert.ok(f.alunos.get("matematica")!.rating > 1500 && f.alunos.get("matematica")!.rating < 1510);
});
