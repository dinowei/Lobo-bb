// Filtro anti-repetição e catálogo de cenários (sem banco e sem IA)
import { test } from "node:test";
import assert from "node:assert/strict";
import { trechos, jaccard, classificar, pior, impressaoEstrutural, textoComparavel, type Comparavel } from "./similaridade.js";
import { carregarCenarios, sortearCenario, pessoaDoContexto, N_PROIBIDOS, type Cenario } from "./cenarios.js";

const L = { duplicada: 0.97, parecida: 0.95, oficial: 0.95, jaccard: 0.6 };
const BASE =
  "Um cliente aplicou R$ 5.000,00 em um CDB que rende 2% ao mês no regime de juros compostos, por 8 meses, e quer saber o valor que terá ao final da aplicação para comprar uma moto à vista.";

test("trechos: cópia com 2 palavras trocadas passa do limite; texto curto não conta", () => {
  const copia = BASE.replace("cliente", "correntista").replace("comprar", "adquirir");
  assert.ok(jaccard(trechos(BASE), trechos(copia)) >= L.jaccard, "cópia com palavras trocadas");
  assert.equal(jaccard(trechos(BASE), trechos(BASE)), 1);
  // "De acordo com o texto, …" curto: poucos trechos, não entra na conta
  assert.equal(jaccard(trechos("De acordo com o texto, o autor defende que"), trechos("De acordo com o texto, o autor critica que")), 0);
  const outra =
    "Uma empresa descontou uma duplicata de R$ 12.000,00 três meses antes do vencimento, à taxa de desconto comercial simples de 3% ao mês. Qual o valor líquido recebido pela empresa na operação?";
  assert.ok(jaccard(trechos(BASE), trechos(outra)) < 0.1);
});

test("classificar: limites conservadores, oficial pesa mais", () => {
  assert.equal(classificar(0.99, 0, false, L), "duplicada");
  assert.equal(classificar(0.96, 0, false, L), "parecida");
  assert.equal(classificar(0.9, 0, false, L), "nova");
  assert.equal(classificar(0.9, 0.7, false, L), "duplicada"); // cópia de trechos, mesmo com cosseno baixo
  assert.equal(classificar(0.96, 0, true, L), "parafrase_oficial");
  assert.equal(classificar(0.9, 0.7, true, L), "parafrase_oficial");
});

test("pior: pega o veredito mais grave; sem embedding vale só a checagem de trechos", () => {
  const v = (x: number) => [x, Math.sqrt(1 - x * x)];
  const minha = [1, 0];
  const outras: Comparavel[] = [
    { id: "a", texto: "outra questão qualquer sobre descontos e duplicatas, bem diferente desta aqui mesmo", oficial: false, embedding: v(0.5) },
    { id: "b", texto: "parecida", oficial: false, embedding: v(0.96) },
    { id: "c", texto: "oficial", oficial: true, embedding: v(0.955) },
  ];
  const r = pior(BASE, minha, outras, L);
  assert.equal(r.classe, "parafrase_oficial");
  assert.equal(r.comId, "c");
  assert.equal(pior(BASE, minha, outras.slice(0, 2), L).classe, "parecida");
  const s = pior(BASE, null, [{ id: "d", texto: BASE, oficial: false }], L);
  assert.equal(s.classe, "duplicada");
  assert.equal(s.semEmbedding, true);
});

test("Crase: enunciado fixo + frase correta diferente não vira cópia", () => {
  const enunciado = "Assinale a alternativa em que o acento grave indicativo de crase está empregado de acordo com a norma-padrão.";
  const a = textoComparavel(enunciado, "O gerente entregou o relatório à diretora da agência antes do fim do expediente.");
  const b = textoComparavel(enunciado, "Os clientes chegaram à agência às dez horas para a reunião sobre o novo consórcio.");
  assert.ok(jaccard(trechos(a), trechos(b)) < L.jaccard);
});

test("impressão estrutural: igual para os mesmos parâmetros, diferente se um muda", () => {
  const p = ["juros compostos: montante", "aplicação em CDB", [["R$ 5.000,00", "2% ao mês", "8 meses"], null]] as const;
  assert.equal(impressaoEstrutural(...p), impressaoEstrutural(...p));
  assert.notEqual(impressaoEstrutural(p[0], p[1], [["R$ 5.000,00", "2% ao mês", "9 meses"], null]), impressaoEstrutural(...p));
  assert.notEqual(impressaoEstrutural(p[0], "caderneta de poupança", p[2]), impressaoEstrutural(...p));
});

test("cenários: catálogo válido, sem número; pf/pj casam com o contexto", () => {
  const cat = carregarCenarios();
  assert.ok(Object.keys(cat.grupos).length >= 3);
  assert.equal(pessoaDoContexto("desconto de duplicata por uma empresa (PJ)"), "pj");
  assert.equal(pessoaDoContexto("empréstimo pessoal"), "pf");
  assert.equal(pessoaDoContexto("aplicação em CDB"), "ambas");
  const pj = new Set(cat.grupos.calculo.perfis.pj);
  for (let k = 0; k < 200; k++) {
    const c = sortearCenario(cat, "matematica_financeira", "antecipação de recebíveis de um lojista", []);
    assert.ok(c && pj.has(c.perfil), `perfil PJ: ${c?.perfil}`);
  }
  const inf = sortearCenario(cat, "informatica", "planilha de metas", []);
  assert.ok(inf && cat.grupos.informatica.perfis.func!.includes(inf.perfil));
  assert.equal(sortearCenario(cat, "lingua_portuguesa", "qualquer", []), null);
});

test("cenários: nunca repete um dos 15 últimos e sorteia o menos usado", () => {
  const cat = carregarCenarios();
  const historico: Cenario[] = [];
  const pares = new Map<string, number>();
  for (let k = 0; k < 400; k++) {
    const c = sortearCenario(cat, "matematica", "aplicação em CDB", historico)!;
    assert.ok(c, "sempre há cenário");
    const chave = `${c.perfil}|${c.situacao}`;
    assert.ok(!historico.slice(0, N_PROIBIDOS).some((h) => `${h.perfil}|${h.situacao}` === chave), `repetiu um dos 15 últimos: ${chave}`);
    assert.ok(!historico.slice(0, 5).some((h) => h.perfil === c.perfil), "perfil das 5 últimas");
    pares.set(chave, (pares.get(chave) ?? 0) + 1);
    historico.unshift(c);
  }
  // uso equilibrado: nenhum perfil sai muito mais que os outros
  const porPerfil = new Map<string, number>();
  for (const h of historico) porPerfil.set(h.perfil, (porPerfil.get(h.perfil) ?? 0) + 1);
  const usos = [...porPerfil.values()];
  assert.ok(Math.max(...usos) - Math.min(...usos) <= 2, `perfis desequilibrados: ${usos.join(",")}`);
  // o cenário descartado ("parecida") não volta na nova tentativa
  const evitar = sortearCenario(cat, "matematica", "aplicação em CDB", [])!;
  for (let k = 0; k < 50; k++) {
    const c = sortearCenario(cat, "matematica", "aplicação em CDB", [], [evitar])!;
    assert.notEqual(`${c.perfil}|${c.situacao}`, `${evitar.perfil}|${evitar.situacao}`);
  }
});
