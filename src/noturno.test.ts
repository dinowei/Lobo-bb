// Noturno com banco grande (adendo, item 10): plano pela meta, trava por tópico, balde de fichas,
// "antes de salvar" pega a parecida que outro trabalhador acabou de salvar (sem banco e sem IA)
import { test } from "node:test";
import assert from "node:assert/strict";
import { planoDaNoite, metaDoTopico, destinoDaTarefa, TravaTopicos, filtroDaMeta, calcularAteFila, planejarEtapasDaNoite, ORDEM_PRE_GERACAO, itensDaTrilha, tipoDoSubtopico, diaDeEstudo, type AlunoPlano } from "./noturno.js";
import { filtrarTopicosParaAula } from "./aulas.js";

test("plano da noite: aulas entram na fila depois das questões e das explicações, antes de temas e áudio", async () => {
  const chamadas: string[] = [];
  const fake = (nome: string, n: number) => async () => (chamadas.push(nome), n);
  const r = await planejarEtapasDaNoite({
    gerar: fake("gerar", 10), explicar_outro_jeito: fake("explicar_outro_jeito", 5), aula: fake("aula", 3),
    cartoes: fake("cartoes", 2), fonte_atual: fake("fonte_atual", 4), tema: fake("tema", 1), voz: fake("voz", 6),
  });
  assert.deepEqual(chamadas, [...ORDEM_PRE_GERACAO]);
  assert.equal(r.aula, 3);
  const pos = (e: (typeof ORDEM_PRE_GERACAO)[number]) => chamadas.indexOf(e);
  assert.ok(pos("gerar") < pos("explicar_outro_jeito") && pos("explicar_outro_jeito") < pos("aula") && pos("aula") < pos("tema") && pos("tema") < pos("voz"));
});

test("aulas da noite (regra 18): Bancários/Atualidades/Vendas só com fonte; aprovada ou aberta não repete", () => {
  const topicos = [
    { _id: "a", disciplina: "matematica" },
    { _id: "b", disciplina: "conhecimentos_bancarios" },
    { _id: "c", disciplina: "conhecimentos_bancarios" },
    { _id: "d", disciplina: "vendas_negociacao" },
    { _id: "e", disciplina: "lingua_portuguesa" },
    { _id: "f", disciplina: "informatica" },
  ];
  const r = filtrarTopicosParaAula(topicos, new Set(["e"]), new Set(["f"]), new Set(["c"]), 10).map((t) => t._id);
  assert.deepEqual(r, ["a", "c"]);
  assert.equal(filtrarTopicosParaAula(topicos, new Set(), new Set(), new Set(["b", "c", "d"]), 2).length, 2);
});

test("calcularAteFila reserva 5 minutos de margem para relatório e backup", () => {
  const inicio = new Date("2026-10-20T01:00:00Z");
  const ate = new Date("2026-10-20T05:30:00Z");
  const filaAte = calcularAteFila(ate, inicio);
  assert.equal(filaAte?.toISOString(), "2026-10-20T05:25:00.000Z");
  assert.equal(calcularAteFila(undefined, inicio), undefined);
});

test("meta de aprovadas para só a geração: explicações, aulas, cartões e temas seguem", () => {
  assert.deepEqual(filtroDaMeta(9, 10), {});
  assert.deepEqual(filtroDaMeta(10, 10), { tipo: { $ne: "gerar" } });
  assert.deepEqual(filtroDaMeta(12, 10), { tipo: { $ne: "gerar" } });
});
import { Balde } from "./llm.js";
import { pior, textoComparavel, type Comparavel } from "./similaridade.js";

const COTAS = { informatica: 15, lingua_inglesa: 5, vendas_negociacao: 15 };
const TOP = [
  { id: "inf1", assunto: "Planilhas", disciplina: "informatica", elegivel: true },
  { id: "inf2", assunto: "Redes", disciplina: "informatica", elegivel: true },
  { id: "ing1", assunto: "Reading", disciplina: "lingua_inglesa", elegivel: true },
  { id: "ven1", assunto: "Técnicas de vendas", disciplina: "vendas_negociacao", elegivel: false }, // espera o glossário
];
const aluno = (p: Partial<AlunoPlano> = {}): AlunoPlano => ({ respondidas: new Map(), dominados: new Set(), recentes: new Set(), ...p });

test("meta do tópico: meta do banco × cota da disciplina ÷ tópicos dela", () => {
  assert.equal(metaDoTopico("informatica", 2, COTAS, 70, 1200), Math.ceil((1200 * 15) / 70 / 2)); // 129
  assert.equal(metaDoTopico("probabilidade_estatistica", 3, COTAS, 70, 1200), 0);
});

test("plano: maior peso primeiro, rodízio entre tópicos, tópico sem fonte liberada fica fora", () => {
  const plano = planoDaNoite({ topicos: TOP, aprovadas: new Map(), alunos: [aluno()], cotas: COTAS, totalQuestoes: 70, metaBanco: 1200, max: 6 });
  assert.equal(plano.length, 6);
  assert.ok(!plano.some((i) => i.topicId === "ven1"), "Vendas por doutrina espera o glossário");
  assert.deepEqual(plano.slice(0, 3).map((i) => i.topicId).sort(), ["inf1", "inf2", "ing1"], "uma por tópico na 1ª volta");
  assert.ok(plano.every((i) => i.motivo === "meta"));
});

test("plano: estudado nos últimos 7 dias passa na frente; meta batida só volta com poucas inéditas ou domínio", () => {
  const recente = planoDaNoite({ topicos: TOP, aprovadas: new Map(), alunos: [aluno({ recentes: new Set(["ing1"]) })], cotas: COTAS, totalQuestoes: 70, metaBanco: 1200, max: 1 });
  assert.equal(recente[0].topicId, "ing1");
  const cheio = new Map([["inf1", 200], ["inf2", 200], ["ing1", 200]]);
  assert.equal(planoDaNoite({ topicos: TOP, aprovadas: cheio, alunos: [aluno()], cotas: COTAS, totalQuestoes: 70, metaBanco: 1200, max: 10 }).length, 0);
  const viuQuaseTudo = aluno({ respondidas: new Map([["inf1", 190]]) }); // 10 inéditas < 20% da meta
  const p = planoDaNoite({ topicos: TOP, aprovadas: cheio, alunos: [aluno(), viuQuaseTudo], cotas: COTAS, totalQuestoes: 70, metaBanco: 1200, max: 50 });
  assert.ok(p.length > 0 && p.every((i) => i.topicId === "inf1" && i.motivo === "poucas_ineditas"));
  const dominou = planoDaNoite({ topicos: TOP, aprovadas: cheio, alunos: [aluno({ dominados: new Set(["ing1"]) })], cotas: COTAS, totalQuestoes: 70, metaBanco: 1200, max: 10 });
  assert.ok(dominou.length === 2 && dominou.every((i) => i.motivo === "dominado" && (i.dificuldade ?? 0) >= 4));
});

test("plano: incidência na banca multiplica o peso; sem dado, a ordem antiga fica igual", () => {
  const sem = planoDaNoite({ topicos: TOP, aprovadas: new Map(), alunos: [aluno()], cotas: COTAS, totalQuestoes: 70, metaBanco: 1200, max: 3 });
  const vazio = planoDaNoite({ topicos: TOP, aprovadas: new Map(), alunos: [aluno()], cotas: COTAS, totalQuestoes: 70, metaBanco: 1200, max: 3, incidencia: new Map() });
  assert.deepEqual(vazio, sem);
  // mesmo peso (Informática): o que mais caiu na banca passa na frente
  const segundaInf = sem.filter((i) => i.topicId.startsWith("inf"))[1].topicId;
  const com = planoDaNoite({ topicos: TOP, aprovadas: new Map(), alunos: [aluno()], cotas: COTAS, totalQuestoes: 70, metaBanco: 1200, max: 3, incidencia: new Map([[segundaInf, 0.5]]) });
  assert.equal(com[0].topicId, segundaInf);
  // peso × incidência: Inglês (cota 5) que caiu muito não passa Informática (cota 15) que nunca caiu
  const ing = planoDaNoite({ topicos: TOP, aprovadas: new Map(), alunos: [aluno()], cotas: COTAS, totalQuestoes: 70, metaBanco: 1200, max: 3, incidencia: new Map([["ing1", 1]]) });
  assert.equal(ing.at(-1)!.topicId, "ing1");
});

test("plano: tema pedido pelo aluno (página do tema) vai na frente, mesmo com a meta batida", () => {
  const cheio = new Map([["inf1", 200], ["inf2", 200], ["ing1", 200]]);
  const p = planoDaNoite({ topicos: TOP, aprovadas: cheio, alunos: [aluno()], cotas: COTAS, totalQuestoes: 70, metaBanco: 1200, max: 10, pedidos: new Set(["ing1"]) });
  assert.ok(p.length > 0 && p.every((i) => i.topicId === "ing1"));
  const vazio = planoDaNoite({ topicos: TOP, aprovadas: new Map(), alunos: [aluno()], cotas: COTAS, totalQuestoes: 70, metaBanco: 1200, max: 1, pedidos: new Set(["inf2"]) });
  assert.equal(vazio[0].topicId, "inf2");
});

test("trilha: tema de amanhã sem 15 novas vai antes de tudo; desconta abertas; dois alunos → maior falta", () => {
  const alvo = (novasParaAluno: number, abertas = 0) => ({ subtopico: "crase", topicId: "pt-reg", assunto: "Regência verbal e nominal e crase", tipo: "crase (por construção)", novasParaAluno, abertas });
  assert.deepEqual(itensDaTrilha([alvo(15)]), []);
  const [it] = itensDaTrilha([alvo(4, 3), alvo(2)]);
  assert.equal(it.quantas, 13);
  assert.deepEqual(it.item, { topicId: "pt-reg", assunto: "Regência verbal e nominal e crase", motivo: "trilha", subtopico: "crase", tipo: "crase (por construção)" });
  // com a meta batida em tudo, só a trilha entra, e na frente
  const cheio = new Map([["inf1", 200], ["inf2", 200], ["ing1", 200]]);
  const p = planoDaNoite({ topicos: TOP, aprovadas: cheio, alunos: [aluno()], cotas: COTAS, totalQuestoes: 70, metaBanco: 1200, max: 50, trilha: itensDaTrilha([alvo(10)]) });
  assert.equal(p.length, 5);
  assert.ok(p.every((i) => i.motivo === "trilha" && i.tipo === "crase (por construção)"));
});

test("trilha: tipo forçado só quando o tópico mistura subtópicos; dia de estudo pela hora de Brasília", () => {
  const tipos = ["regência (por construção)", "crase (por construção)", "crase"];
  assert.equal(tipoDoSubtopico("Regência verbal e nominal e crase", "crase", tipos), "crase (por construção)");
  assert.equal(tipoDoSubtopico("Pontuação", "pontuacao", ["pontuação (por construção)"]), undefined);
  assert.equal(diaDeEstudo(new Date("2026-10-25T04:00:00Z")), "2026-10-25"); // 01:00 BRT: o dia que começa
  assert.equal(diaDeEstudo(new Date("2026-10-25T01:30:00Z")), "2026-10-25"); // 22:30 BRT do dia 24: o dia seguinte
});

test("trava por tópico: dois trabalhadores nunca no mesmo tópico", () => {
  const t = new TravaTopicos();
  assert.equal(t.pegar("inf1"), true);
  assert.equal(t.pegar("inf1"), false, "o segundo não pega");
  assert.equal(t.pegar("inf2"), true);
  t.soltar("inf1");
  assert.equal(t.pegar("inf1"), true);
});

test("balde de fichas: respeita o limite por minuto e enche com o tempo", () => {
  let agora = 0;
  const b = new Balde(30, () => agora);
  for (let k = 0; k < 30; k++) assert.equal(b.tentar(), 0);
  assert.equal(b.tentar(), 2000, "31º pedido espera 2 s (30 por minuto)");
  agora += 2000;
  assert.equal(b.tentar(), 0);
  agora += 60_000;
  for (let k = 0; k < 30; k++) assert.equal(b.tentar(), 0);
  assert.ok(b.tentar() > 0, "não acumula mais que o limite");
});

test("antes de salvar: a parecida que outro trabalhador acabou de salvar é pega", () => {
  const minha = "Um cliente aplicou R$ 4.000,00 a juros compostos de 4% ao ano por 8 anos. Considerando 1,04^8 = 1,3686, qual o montante final dessa aplicação no fim do prazo?";
  const v = (x: number) => [x, Math.sqrt(1 - x * x)];
  const banco: Comparavel[] = [{ id: "velha", texto: "Questão de outro assunto sem relação nenhuma com esta aqui de juros", oficial: false, embedding: v(0.2) }];
  assert.equal(pior(textoComparavel(minha, "R$ 5.474,40"), [1, 0], banco).classe, "nova", "no começo era nova");
  banco.push({ id: "do-outro", texto: textoComparavel(minha.replace("Um cliente", "Uma cliente"), "R$ 5.474,40"), oficial: false, embedding: v(0.99) });
  assert.equal(pior(textoComparavel(minha, "R$ 5.474,40"), [1, 0], banco).classe, "duplicada");
});

test("correção de redação fica persistente depois do limite comum de falhas de infraestrutura", () => {
  const agora = new Date("2026-10-18T12:00:00.000Z");
  const destino = destinoDaTarefa({ ok: false, motivo: "provedor_falhou" }, 3, agora, [10, 30, 90], true);
  if (destino.status !== "aguardando") assert.fail("a redação deve continuar aguardando nova tentativa");
  assert.equal(destino.tentativas, 4);
  assert.equal(destino.proximaEm.getTime(), agora.getTime() + 90 * 60_000);
  assert.equal(destinoDaTarefa({ ok: false, motivo: "aguardando_modelo" }, 3, agora, [10, 30, 90], true).status, "aguardando");
});
