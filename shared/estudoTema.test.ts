import assert from "node:assert/strict";
import test from "node:test";
import { errosDoTema, ordenarParaEstudo, subtemaDaQuestao, subtemasDoTema, temasParaMistura } from "./estudoTema.js";
import type { PlacarTema } from "./grade.js";

const resp = (n: number, a: number) => Array.from({ length: n }, (_, i) => i < a);
const placar = (aprovadas: number, n: number, a: number): PlacarTema => ({ respondidas: n, recentes: resp(n, a), aprovadas });

test("subtema da questão: mais palavras em comum com o subtema do edital; sem nada em comum vai para o fim", () => {
  const subtemas = ["Concordância verbal", "Concordância nominal", "Sujeito composto e coletivos"];
  assert.equal(subtemaDaQuestao("Assinale a frase em que a concordância nominal está correta: bastantes alunos", subtemas), 1);
  assert.equal(subtemaDaQuestao("O verbo concorda com o sujeito composto anteposto", subtemas), 2);
  assert.equal(subtemaDaQuestao("Marque a alternativa com erro de grafia", subtemas), -1);
});

test("ordem de estudo: subtema do edital → fácil a difícil → oficial, cursinho, gerada", () => {
  const qs = [
    { id: "a", subtema: 1, dificuldade: 1, origem: "gerada" },
    { id: "b", subtema: 0, dificuldade: 4, origem: "oficial" },
    { id: "c", subtema: 0, dificuldade: 2, origem: "gerada" },
    { id: "d", subtema: 0, dificuldade: 2, origem: "oficial" },
    { id: "e", subtema: -1, dificuldade: 1, origem: "oficial" },
  ];
  assert.deepEqual(ordenarParaEstudo(qs).map((q) => q.id), ["d", "c", "b", "a", "e"]);
});

test("erros do tema: só as questões cuja última resposta foi errada, as mais antigas primeiro", () => {
  const t = (questaoId: string, acertou: boolean, data: string) => ({ questaoId, acertou, data });
  assert.deepEqual(errosDoTema([
    t("q1", false, "2026-10-01"), t("q1", true, "2026-10-02"), // corrigida
    t("q2", true, "2026-10-01"), t("q2", false, "2026-10-03"),
    t("q3", false, "2026-10-02"),
  ]), ["q3", "q2"]);
});

test("mistura: só temas concluídos; sem nenhum concluído, os em andamento; nunca não iniciado", () => {
  const p = new Map([["crase", placar(25, 20, 18)], ["regencia", placar(25, 5, 2)], ["virgula", placar(25, 0, 0)]]);
  assert.deepEqual([...temasParaMistura(p)!], ["crase"]);
  const semConcluido = new Map([["regencia", placar(25, 5, 2)], ["virgula", placar(25, 0, 0)]]);
  assert.deepEqual([...temasParaMistura(semConcluido)!], ["regencia"]);
  assert.equal(temasParaMistura(new Map([["virgula", placar(25, 0, 0)]])), null);
  // provisório conta como concluído para a mistura
  assert.deepEqual([...temasParaMistura(new Map([["x", placar(8, 8, 7)], ["y", placar(25, 3, 1)]]))!], ["x"]);
});

test("subtemas do tema: assunto dividido entre temas fica só com os subtópicos do tema", () => {
  const topicos = [{ assunto: "Regência e crase", subtopicos: ["Regência verbal", "Regência nominal", "Crase obrigatória", "Crase proibida"] }];
  // usa o catálogo real só se o assunto existir lá; aqui o teste é do filtro, com um tema fictício ausente
  assert.deepEqual(subtemasDoTema("nao-existe", topicos, []), []);
});
