import { test } from "node:test";
import assert from "node:assert/strict";
import { calibragem, fatorNaoSabia, horasLiquidasSemana, TEMPO_MAX_QUESTAO_SEG, motivosPorDisciplina, naoSabiaPorTopico, palavrasDecisivas } from "./aprendizado.js";
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

test("calibragem: taxa por confiança, geral e por disciplina, sem simulado", () => {
  const disc = new Map<string, Disciplina>([["t1", "informatica"], ["t2", "lingua_portuguesa"]]);
  const r = calibragem(
    [
      t({ confianca: 3, acertou: true }),
      t({ confianca: 3, acertou: false }),
      t({ confianca: 1, acertou: false }),
      t({ topicoId: "t2", confianca: 2, acertou: true }),
      t({ confianca: 3, acertou: false, modo: "simulado" }),
      t({}), // sem confiança (dado antigo)
    ],
    disc
  );
  assert.equal(r[0].disciplina, null);
  assert.deepEqual(r[0].certeza, { n: 2, acertos: 1 });
  assert.deepEqual(r[0].chute, { n: 1, acertos: 0 });
  assert.deepEqual(r[0].duvida, { n: 1, acertos: 1 });
  assert.deepEqual(r.map((c) => c.disciplina), [null, "lingua_portuguesa", "informatica"]);
  assert.equal(r[0].ilusao, false); // amostra pequena não alerta
});

test("ilusão de domínio: certeza abaixo de 85% com 10+ respostas", () => {
  const disc = new Map<string, Disciplina>([["t1", "informatica"]]);
  const certezas = (acertos: number, n: number) => Array.from({ length: n }, (_, i) => t({ confianca: 3, acertou: i < acertos }));
  assert.equal(calibragem(certezas(8, 10), disc)[1].ilusao, true); // 80%
  assert.equal(calibragem(certezas(9, 10), disc)[1].ilusao, false); // 90%
  assert.equal(calibragem(certezas(5, 9), disc)[1].ilusao, false); // só 9 respostas
});

test("horas líquidas: últimos 7 dias, teto de 10 min por questão, por disciplina", () => {
  const disc = new Map<string, Disciplina>([["t1", "informatica"], ["t2", "lingua_portuguesa"]]);
  const velho = new Date(Date.now() - 8 * 86_400_000).toISOString();
  const r = horasLiquidasSemana(
    [t({ tempoSeg: 90 }), t({ tempoSeg: 5000 }), t({ tempoSeg: 60, data: velho }), t({ topicoId: "t2", tempoSeg: 30 }), t({})],
    disc
  );
  assert.deepEqual(r, [
    { disciplina: "lingua_portuguesa", seg: 30 },
    { disciplina: "informatica", seg: 90 + TEMPO_MAX_QUESTAO_SEG },
  ]);
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
