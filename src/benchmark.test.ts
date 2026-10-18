// Benchmark: estatística, amostra estratificada e prompt às cegas (sem rede e sem banco)
import { test } from "node:test";
import assert from "node:assert/strict";
import { wilson, estratificar, questaoCega, empatados, PausaPorFalhas, MAX_SEGUIDAS, type LinhaRelatorio } from "./benchmark.js";

test("5 falhas seguidas do provedor tiram o modelo da rodada; acerto ou falha de formato zera", () => {
  const p = new PausaPorFalhas();
  for (let i = 0; i < MAX_SEGUIDAS - 1; i++) p.registrar("glm", "timeout");
  assert.equal(p.podeRodar("glm"), true);
  p.registrar("glm", "formato"); // o modelo respondeu (mal): não é falha do provedor
  for (let i = 0; i < MAX_SEGUIDAS - 1; i++) p.registrar("glm", i % 2 ? "429" : "5xx");
  assert.equal(p.podeRodar("glm"), true);
  p.registrar("glm", "timeout");
  assert.equal(p.podeRodar("glm"), false); // 5ª seguida: para aqui, não na 8ª
  assert.equal(p.podeRodar("outro"), true); // por modelo
});
import { AUDITOR_CEGO_SYSTEM, auditorCegoUser } from "./prompts.js";

test("Wilson: intervalo honesto com amostra pequena", () => {
  const [a, b] = wilson(45, 60);
  assert.ok(a > 0.62 && a < 0.64 && b > 0.84 && b < 0.86, `${a} ${b}`);
  assert.deepEqual(wilson(0, 0), [0, 0]);
  const [c, d] = wilson(10, 10);
  assert.ok(c > 0.7 && d === 1);
});

test("amostra estratificada: proporcional, mínimo 2 por disciplina, fixa pela semente", () => {
  const itens = [
    ...Array.from({ length: 50 }, (_, i) => ({ id: `p${i}`, estrato: "portugues" })),
    ...Array.from({ length: 30 }, (_, i) => ({ id: `m${i}`, estrato: "matematica" })),
    ...Array.from({ length: 3 }, (_, i) => ({ id: `i${i}`, estrato: "ingles" })),
  ];
  const a = estratificar(itens, 20, "s1");
  assert.equal(a.length, 20);
  const conta = (e: string) => a.filter((x) => x.estrato === e).length;
  assert.ok(conta("ingles") >= 2, "estrato pequeno tem o mínimo");
  assert.ok(conta("portugues") > conta("matematica"), "proporcional");
  assert.deepEqual(estratificar(itens, 20, "s1"), a, "mesma semente, mesma amostra");
  assert.notDeepEqual(estratificar(itens, 20, "s2").map((x) => x.id), a.map((x) => x.id));
});

test("prompt às cegas: nada de gabarito, correta ou explicação", () => {
  const oficial = {
    enunciado: "Qual é a taxa?",
    textoBase: null,
    gabarito: "C",
    explicacaoGeral: "A correta é a C porque …",
    alternativas: ["A", "B", "C", "D", "E"].map((letra) => ({ letra, texto: `opção ${letra}`, correta: letra === "C", explicacao: `explicação ${letra}` })),
  };
  const cega = questaoCega(oficial);
  assert.deepEqual(Object.keys(cega).sort(), ["alternativas", "enunciado", "textoBase"]);
  assert.ok(cega.alternativas.every((a) => Object.keys(a).sort().join() === "letra,texto"));
  const prompt = AUDITOR_CEGO_SYSTEM + auditorCegoUser(cega, []);
  for (const vaza of ["gabarito\":", "\"correta\"", "explicação C", "A correta é a C"]) assert.ok(!prompt.includes(vaza), `vazou: ${vaza}`);
});

test("sem vencedor quando os intervalos se sobrepõem", () => {
  const linha = (modelo: string, acertos: number, n: number): LinhaRelatorio => ({
    modelo, familia: "x", preview: false, tentativas: n, respondidas: n, acertos, acerto: acertos / n,
    ic: wilson(acertos, n), disponibilidade: 1, medianaS: 1, falhas: {}, porDisciplina: {},
  });
  assert.deepEqual(empatados([linha("a", 50, 60), linha("b", 47, 60), linha("c", 20, 60)]), ["b"]);
});
