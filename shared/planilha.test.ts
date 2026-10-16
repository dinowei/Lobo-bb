import { test } from "node:test";
import assert from "node:assert/strict";
import { Planilha, textoDaCelula, paraNumero } from "./planilha.js";
import type { PlanilhaDados } from "./tipos.js";

const q41: PlanilhaDados = {
  colunas: 3,
  linhas: 10,
  celulas: {
    A1: "CODPECA", B1: "VALOR",
    A2: "P101", B2: "5", A3: "P102", B3: "13", A4: "P103", B4: "2",
    A5: "P104", B5: "26", A6: "P105", B6: "7", A7: "P106", B7: "10",
    C10: '=CONT.SE(B2:B6;"<=R$ 10,00")',
  },
  formatos: { B2: "moeda", B3: "moeda", B4: "moeda", B5: "moeda", B6: "moeda", B7: "moeda" },
};

test("questão oficial BB 2023 nº 41: CONT.SE com critério em reais dá 3 (gabarito B)", () => {
  const p = new Planilha(q41);
  assert.equal(p.valor("C10"), 3);
  assert.equal(textoDaCelula(p, q41, "B3"), "R$ 13,00");
});

test("números em pt-BR", () => {
  assert.equal(paraNumero("R$ 1.234,56"), 1234.56);
  assert.equal(paraNumero("12,5%"), 0.125);
  assert.equal(paraNumero("3.5"), 3.5);
  assert.equal(paraNumero("P101"), null);
});

test("funções e operadores", () => {
  const d: PlanilhaDados = {
    colunas: 4,
    linhas: 6,
    celulas: {
      A1: "10", A2: "20", A3: "30", A4: "texto",
      B1: "=SOMA(A1:A3)", B2: "=MÉDIA(A1:A3)", B3: "=MÁXIMO(A1:A3)-MÍNIMO(A1:A3)",
      B4: "=SE(B1>50;\"alto\";\"baixo\")", B5: "=ARRED(10/3;2)", B6: "=2^3*2+1",
      C1: "=CONT.NÚM(A1:A4)", C2: "=CONT.VALORES(A1:A4)", C3: "=SOMASE(A1:A3;\">15\")",
      C4: "=E(A1>5;A2<25)", C5: "=OU(A1>50;A2>50)", C6: "=-A1+ABS(-3)",
      D1: "1", D2: "2", D3: "3", E1: "um", E2: "dois", E3: "três",
    },
  };
  const p = new Planilha({ ...d, colunas: 5 });
  assert.equal(p.valor("B1"), 60);
  assert.equal(p.valor("B2"), 20);
  assert.equal(p.valor("B3"), 20);
  assert.equal(p.valor("B4"), "alto");
  assert.equal(p.valor("B5"), 3.33);
  assert.equal(p.valor("B6"), 17);
  assert.equal(p.valor("C1"), 3);
  assert.equal(p.valor("C2"), 4);
  assert.equal(p.valor("C3"), 50);
  assert.equal(p.valor("C4"), true);
  assert.equal(p.valor("C5"), false);
  assert.equal(p.valor("C6"), -7);
  assert.equal(p.avaliar('=PROCV(2;D1:E3;2;FALSO)'), "dois");
});

test("erros viram mensagem de planilha, sem quebrar", () => {
  const d: PlanilhaDados = { colunas: 2, linhas: 2, celulas: { A1: "=B1", B1: "=A1", A2: "=1/0" } };
  const p = new Planilha(d);
  assert.match(textoDaCelula(p, d, "A1"), /circular/);
  assert.equal(textoDaCelula(p, d, "A2"), "#DIV/0!");
});

test("arredondamentos", () => {
  const p = new Planilha({ colunas: 1, linhas: 1, celulas: {} });
  assert.equal(p.avaliar("=ARREDONDAR.PARA.CIMA(2,341;2)"), 2.35);
  assert.equal(p.avaliar("=ARREDONDAR.PARA.BAIXO(2,349;2)"), 2.34);
  assert.equal(p.avaliar("=ARRED(2,345;2)"), 2.35);
});
