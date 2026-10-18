import { test } from "node:test";
import assert from "node:assert/strict";
import { fatorNaoSabia, motivosPorDisciplina, naoSabiaPorTopico, palavrasDecisivas } from "./aprendizado.js";
import type { Disciplina, TentativaBruta } from "./tipos.js";

const t = (p: Partial<TentativaBruta>): TentativaBruta => ({ questaoId: "q", topicoId: "t1", acertou: false, xp: 0, modo: "treino", data: new Date().toISOString(), ...p });

test("palavras decisivas: o que está na certa e falta na marcada", () => {
  assert.deepEqual(palavrasDecisivas("O prazo é de 30 dias úteis", "O prazo é de 30 dias corridos"), ["úteis"]);
  assert.deepEqual(palavrasDecisivas("compete ao Banco Central do Brasil", "compete ao Conselho Monetário Nacional"), ["Banco", "Central", "Brasil"]);
  assert.deepEqual(palavrasDecisivas("R$ 1.200,00", "R$ 1.020,00"), ["1.200,00"]);
  assert.deepEqual(palavrasDecisivas("igual", "igual"), []);
  // mesmas palavras, ordem diferente: mostra onde muda
  assert.deepEqual(palavrasDecisivas("Disseram-me que a agência abriria", "Me disseram que a agência abriria"), ["Disseram-me"]);
  assert.deepEqual(palavrasDecisivas("não se deve", "se não deve"), ["não", "se"]);
  assert.equal(palavrasDecisivas("alfa beta gama delta épsilon zeta", "x").length, 4);
});

test("não sabia sobe o tópico, com teto no dobro", () => {
  assert.equal(fatorNaoSabia(0), 1);
  assert.equal(fatorNaoSabia(1), 1.5);
  assert.equal(fatorNaoSabia(9), 2);
});

test("não sabia conta só na janela recente", () => {
  const velho = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const m = naoSabiaPorTopico([t({ motivoErro: "nao_sabia" }), t({ motivoErro: "nao_sabia", data: velho }), t({ motivoErro: "chutei" })]);
  assert.equal(m.get("t1"), 1);
});

test("motivos por disciplina: só erros fora de simulado", () => {
  const disc = new Map<string, Disciplina>([["t1", "informatica"], ["t2", "lingua_portuguesa"]]);
  const r = motivosPorDisciplina(
    [
      t({ motivoErro: "confundi" }),
      t({}),
      t({ acertou: true }),
      t({ modo: "simulado" }),
      t({ topicoId: "t2", motivoErro: "desatencao" }),
    ],
    disc
  );
  assert.deepEqual(r.map((d) => d.disciplina), ["lingua_portuguesa", "informatica"]);
  const inf = r.find((d) => d.disciplina === "informatica")!;
  assert.equal(inf.erros, 2);
  assert.equal(inf.motivos.confundi, 1);
  assert.equal(inf.motivos.nao_sabia, 0);
});
