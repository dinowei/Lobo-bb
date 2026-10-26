import assert from "node:assert/strict";
import test from "node:test";
import { coberturaPorConcurso, linhasCobertura, proximoTemaDaEsteira, situacaoTema, type TemaCobertura } from "./cobertura.js";

const tema = (n: number, extra: Partial<TemaCobertura> = {}): TemaCobertura => ({
  n, subtopico: `t${n}`, nome: `Tema ${n}`, concursos: ["bb"], aprovadas: 20, novas: 15, ficha: true, audioFicha: true, bloqueios: [], ...extra,
});

test("meta de pronto: ≥ 15 novas, ficha aprovada e áudio da ficha", () => {
  assert.deepEqual(situacaoTema(tema(1)), { situacao: "pronto", faltas: [] });
  assert.deepEqual(situacaoTema(tema(1, { novas: 9, audioFicha: false })), { situacao: "faltando", faltas: ["6 questões novas", "áudio da ficha"] });
  assert.equal(situacaoTema(tema(1, { ficha: false, bloqueios: ["sem material para a ficha"] })).situacao, "bloqueado");
  assert.equal(situacaoTema(tema(1, { bloqueios: ["x"] })).situacao, "pronto", "bloqueio não importa se já bateu a meta");
});

test("cobertura por concurso: geral + uma linha por concurso", () => {
  const ls = linhasCobertura([tema(1), tema(2, { novas: 3, concursos: ["bb", "tjsp"] }), tema(3, { ficha: false, bloqueios: ["sem material"], concursos: ["cvm"] })]);
  const r = Object.fromEntries(coberturaPorConcurso(ls).map((x) => [x.concurso, x]));
  assert.deepEqual(r.geral, { concurso: "geral", total: 3, prontos: 1, faltando: 1, bloqueados: 1 });
  assert.deepEqual(r.bb, { concurso: "bb", total: 2, prontos: 1, faltando: 1, bloqueados: 0 });
  assert.equal(r.tjsp.total, 1);
  assert.equal(r.cvm.bloqueados, 1);
  assert.equal(r.bacen.total, 0);
});

test("próximo tema da esteira: do tema do dia em diante; volta ao começo; null quando tudo pronto", () => {
  const ls = linhasCobertura([tema(1, { novas: 2 }), tema(2), tema(3, { ficha: false }), tema(4, { novas: 0, bloqueios: ["sem fonte"] }), tema(5)]);
  assert.equal(proximoTemaDaEsteira(ls, 2)?.n, 3);
  assert.equal(proximoTemaDaEsteira(ls, 4)?.n, 1, "depois do dia só há bloqueado e pronto: volta ao começo");
  assert.equal(proximoTemaDaEsteira(ls, null)?.n, 1);
  assert.equal(proximoTemaDaEsteira(linhasCobertura([tema(1), tema(2)]), 1), null, "todos prontos: só manter");
});
