import assert from "node:assert/strict";
import test from "node:test";
import { csvSimulados, evolucao, resumirSimulado, type ItemSimulado } from "./simulados.js";

const it = (disciplina: ItemSimulado["disciplina"], acertou: boolean, branco = false, subtopico = "crase"): ItemSimulado => ({ disciplina, acertou, branco, subtopico, tempoSeg: 60 });

test("resumo: BB em pontos do edital; BACEN C/E com nota líquida (erro anula acerto, branco zero)", () => {
  const bb = resumirSimulado({ id: "s1", data: "2026-10-01T10:00:00Z", concurso: "bb", banca: "cesgranrio", diagnostico: false }, [it("lingua_portuguesa", true), it("lingua_inglesa", true), it("lingua_portuguesa", false)]);
  assert.equal(bb.nota.criterio, "pontos");
  assert.equal(bb.nota.valor, 2.5); // 1,5 (LP) + 1 (inglês)
  assert.equal(bb.nota.maximo, 4);
  assert.equal(bb.completo, false);
  assert.equal(bb.tempoSeg, 180);
  assert.deepEqual(bb.porSubtopico, [{ subtopico: "crase", total: 3, acertos: 2 }]);
  const ce = resumirSimulado({ id: "s2", data: "2026-10-02T10:00:00Z", concurso: "bacen", banca: "cebraspe", diagnostico: false }, [it("lingua_portuguesa", true), it("lingua_portuguesa", true), it("lingua_portuguesa", false), it("lingua_portuguesa", false, true)]);
  assert.equal(ce.nota.criterio, "liquida");
  assert.equal(ce.nota.valor, 1); // 2 − 1 + 0
  assert.equal(ce.brancos, 1);
  assert.equal(ce.erros, 1);
});

test("completo = tamanho da prova (BB 70)", () => {
  const setenta = Array.from({ length: 70 }, (_, i) => it("informatica", i % 2 === 0));
  assert.equal(resumirSimulado({ id: "c", data: "2026-10-03T10:00:00Z", concurso: "bb", banca: "cesgranrio", diagnostico: false }, setenta).completo, true);
});

test("evolução: sem Raio-X, ordem por data, delta contra o anterior do mesmo tipo, melhor e pior matéria", () => {
  const base = { concurso: "bb" as const, banca: "cesgranrio" as const };
  const s1 = resumirSimulado({ ...base, id: "a", data: "2026-10-01T10:00:00Z", diagnostico: false }, [it("lingua_portuguesa", true), it("lingua_portuguesa", false), it("informatica", false)]);
  const rx = resumirSimulado({ ...base, id: "rx", data: "2026-10-02T10:00:00Z", diagnostico: true }, [it("informatica", true)]);
  const s2 = resumirSimulado({ ...base, id: "b", data: "2026-10-03T10:00:00Z", diagnostico: false }, [it("lingua_portuguesa", true), it("lingua_portuguesa", true), it("informatica", false)]);
  const ev = evolucao([s2, rx, s1]);
  assert.deepEqual(ev.map((p) => p.id), ["a", "b"]);
  assert.deepEqual(ev[1].delta, { lingua_portuguesa: 50, informatica: 0 });
  assert.equal(ev[1].melhor, "lingua_portuguesa");
  assert.equal(ev[1].pior, "informatica");
  const csv = csvSimulados([s1, rx], ["lingua_portuguesa", "informatica"]).split("\n");
  assert.equal(csv[0].split(";").at(-1), "informatica");
  assert.match(csv[1], /^2026-10-01;bb;cesgranrio;parcial;3;1;2;0;33;/);
  assert.match(csv[2], /;raio-x;/);
});
