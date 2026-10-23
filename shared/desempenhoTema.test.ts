import assert from "node:assert/strict";
import test from "node:test";
import { csvDesempenho, desempenhoPorTema, diasDaTrilha, type TentativaTema } from "./desempenhoTema.js";

const t = (questaoId: string, acertou: boolean, data: string, extra: Partial<TentativaTema> = {}): TentativaTema =>
  ({ questaoId, subtopico: "crase", acertou, data, simulado: false, origem: "gerada", ...extra });

test("só a 1ª vez de cada questão conta como nova; simulado à parte; selo pelo % das novas", () => {
  const ts = [
    t("q1", false, "2026-10-21T22:00:00Z"),
    t("q1", true, "2026-10-22T22:00:00Z"), // repetição: não é nova
    t("q2", true, "2026-10-22T22:05:00Z"),
    t("q3", true, "2026-10-22T22:06:00Z", { origem: "oficial" }),
    t("q4", false, "2026-10-22T22:07:00Z", { simulado: true }),
  ];
  const [d] = desempenhoPorTema(ts, new Map([["crase", 18]]), () => "lingua_portuguesa", new Date("2026-10-22T23:00:00Z"));
  assert.deepEqual(d.novasTotal, { n: 3, a: 2 });
  assert.deepEqual(d.novasHoje, { n: 2, a: 2 });
  assert.deepEqual(d.simulado, { n: 1, a: 0 });
  assert.deepEqual(d.porOrigem.oficial, { n: 1, a: 1 });
  assert.equal(d.respondidas, 3);
  assert.equal(d.aprovadas, 18);
  assert.equal(d.selo, "reforco"); // 67%
  assert.match(csvDesempenho([d]), /^tema;disciplina/);
  assert.match(csvDesempenho([d]).split("\n")[1], /^Crase;lingua_portuguesa;bb,bacen;18;100;67;67;3;3;/);
});

test("dias da trilha agrupam as novas por dia local (Brasília)", () => {
  // 02:00Z de 22/10 ainda é 21/10 em Brasília
  const dias = diasDaTrilha([t("q1", true, "2026-10-22T02:00:00Z"), t("q2", false, "2026-10-21T20:00:00Z"), t("q3", true, "2026-10-22T15:00:00Z")]);
  assert.deepEqual(dias.find((d) => d.data === "2026-10-21"), { data: "2026-10-21", subtopico: "crase", novas: 2, acertos: 1 });
  assert.deepEqual(dias.find((d) => d.data === "2026-10-22"), { data: "2026-10-22", subtopico: "crase", novas: 1, acertos: 1 });
});
