import assert from "node:assert/strict";
import test from "node:test";
import { disciplinaDoTema, ordenarTrilha, pesoDoTemaNoConcurso, pesosDoEdital } from "./trilhaUnica.js";
import { SUBTOPICOS, SUBTOPICO_POR_ID } from "./subtopicos.js";

test("catálogo único: sem tema duplicado, todo tema com matéria e concurso", () => {
  const ids = SUBTOPICOS.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const s of SUBTOPICOS) {
    assert.ok(disciplinaDoTema(s), `tema ${s.id} sem matéria`);
    assert.ok(s.concursos.length, `tema ${s.id} sem concurso`);
  }
  // temas do TJ-SP com os ids do dono
  for (const id of ["penal_geral", "penal_adm_publica", "processo_penal", "processo_civil", "normas_corregedoria", "estatuto_servidor_sp", "atualidades_gerais", "raciocinio_vunesp"])
    assert.deepEqual(SUBTOPICO_POR_ID.get(id)?.concursos, ["tjsp"], id);
  assert.deepEqual(SUBTOPICO_POR_ID.get("crase")?.concursos, ["bb", "bacen", "tjsp", "cvm"]);
});

test("pesos do edital: BB pelas cotas; TJ-SP sem cotas fica igual e marcado a confirmar", () => {
  const bb = pesosDoEdital("bb");
  assert.equal(bb.aConfirmar, false);
  assert.equal(bb.fracoes.lingua_portuguesa, 10 / 70);
  const tj = pesosDoEdital("tjsp");
  assert.equal(tj.aConfirmar, true);
  assert.equal(new Set(Object.values(tj.fracoes)).size, 1);
  assert.equal(pesoDoTemaNoConcurso(SUBTOPICO_POR_ID.get("juros_simples")!, "tjsp"), 0, "TJ-SP não cobra juros");
});

test("ordem: comuns primeiro, pré-requisito respeitado, sem perder nem repetir tema", () => {
  const t = ordenarTrilha({});
  assert.equal(t.length, SUBTOPICOS.length);
  assert.equal(new Set(t.map((x) => x.subtopico)).size, t.length);
  // os primeiros são cobrados pelos 4 concursos; nenhum tema de 1 concurso antes de um de 4
  assert.equal(t[0].concursos.length, 4);
  const ultimoDe4 = Math.max(...t.filter((x) => x.concursos.length === 4).map((x) => x.n));
  const primeiroDe1 = Math.min(...t.filter((x) => x.concursos.length === 1 && !["juros_simples", "juros_compostos"].includes(x.subtopico)).map((x) => x.n));
  assert.ok(ultimoDe4 < primeiroDe1);
  const pos = (id: string) => t.find((x) => x.subtopico === id)!.n;
  for (const [a, b] of [["regencia", "crase"], ["juros_simples", "juros_compostos"], ["penal_geral", "penal_adm_publica"], ["proposicoes", "tabela_verdade"]])
    assert.ok(pos(a) < pos(b), `${a} antes de ${b}`);
});

test("incidência sobe o tema dentro do mesmo grupo", () => {
  const sem = ordenarTrilha({});
  // o último do grupo sem pré-requisito (a Crase não passa da Regência, que é pré-requisito dela)
  const grupo = sem.filter((x) => x.concursos.length === 4 && x.subtopico !== "crase");
  const ultimo = grupo.at(-1)!.subtopico;
  const com = ordenarTrilha({ incidencia: new Map([[ultimo, 1]]) });
  assert.ok(com.find((x) => x.subtopico === ultimo)!.n < sem.find((x) => x.subtopico === ultimo)!.n);
});
