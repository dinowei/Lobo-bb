import assert from "node:assert/strict";
import test from "node:test";
import {
  filtrarBiblioteca, idAudio, unicos, itensDoTema, montarRecados, pontoDeRetomada, registrarPosicao, resumirDia, rolarVisita,
  type EntradaDia, type EstadoVisita,
} from "./espacoLo.js";

// 25/10/2026 em Brasília (UTC−3)
const brt = (hhmm: string, dia = "2026-10-25") => new Date(`${dia}T${hhmm}:00-03:00`);

const base: EntradaDia = {
  modo: "tema", tema: { nome: "Crase", novas: 12 }, fichaPronta: true, aulaPronta: true, audioPronto: true,
  revisoesVencidas: 3, janelas: [], inicioJanelaB: "18:00",
};

test("seu dia: tema, material, revisões e o noturno que rodou", () => {
  const linhas = resumirDia({ ...base, janelas: [{ janela: "A", inicio: brt("01:00").toISOString(), aprovadas: 310, etapas: [{ etapa: "fichas", status: "ok", detalhe: "" }] }] }, brt("12:10"));
  assert.deepEqual(linhas.map((l) => l.tipo), ["tema", "material", "revisoes", "janela"]);
  assert.match(linhas[0].texto, /Crase\. 12 questões novas prontas/);
  assert.match(linhas[1].texto, /Ficha e aula prontas, com áudio/);
  assert.match(linhas[2].texto, /3 revisões vencidas/);
  assert.match(linhas[3].texto, /O noturno rodou\. 310 questões aprovadas/);
});

test("seu dia: o noturno não rodou e a Janela B recuperou (relatório de ontem não conta)", () => {
  const janelas = [
    { janela: "A" as const, inicio: brt("01:00", "2026-10-24").toISOString(), aprovadas: 300, etapas: [] },
    { janela: "B" as const, inicio: brt("18:00").toISOString(), aprovadas: 305, etapas: [] },
  ];
  const l = resumirDia({ ...base, janelas }, brt("19:30"));
  assert.match(l.at(-1)!.texto, /O noturno não rodou e a Janela B recuperou\. 305 questões aprovadas/);
});

test("seu dia: sem noturno, avisa a hora da Janela B; de madrugada, espera; etapa que falhou vira alerta", () => {
  assert.match(resumirDia(base, brt("10:00")).at(-1)!.texto, /Janela B tenta recuperar às 18:00/);
  assert.match(resumirDia(base, brt("20:00")).at(-1)!.texto, /a Janela B também não/);
  assert.match(resumirDia(base, brt("03:00")).at(-1)!.texto, /roda de madrugada/);
  const falhou = resumirDia({ ...base, janelas: [{ janela: "A", inicio: brt("01:00").toISOString(), aprovadas: null, etapas: [{ etapa: "fichas", status: "falhou", detalhe: "provedor fora" }] }] }, brt("09:00"));
  assert.deepEqual(falhou.slice(-2).map((l) => l.tipo), ["janela", "alerta"]);
  assert.match(falhou.at(-1)!.texto, /fichas \(provedor fora\)/);
});

test("seu dia: sem ficha aprovada, domingo e revisões em dia", () => {
  assert.match(resumirDia({ ...base, fichaPronta: false, aulaPronta: false }, brt("10:00"))[1].texto, /ainda não foi aprovada/);
  const dom = resumirDia({ ...base, modo: "domingo", tema: null, revisoesVencidas: 0 }, brt("10:00"));
  assert.match(dom[0].texto, /Domingo/);
  assert.equal(dom[1].texto, "Revisões em dia.");
  assert.match(resumirDia({ ...base, demo: true }, brt("10:00")).at(-1)!.texto, /modo demo não há noturno/);
});

test("itens do tema: ficha, aulas e pontos, com id estável e só [a-z0-9_-]", () => {
  const itens = itensDoTema({ subtopico: "crase", nome: "Crase", disciplina: "lingua_portuguesa", ficha: ["Antes de palavra masculina não há crase."], aulas: [{ topicoId: "65AB", assunto: "Regência", texto: "Aula: Regência." }], pontos: ["Craseia antes de feminina"] });
  assert.deepEqual(itens.map((i) => i.id), ["ficha-crase", "aula-65ab", "pontos-crase"]);
  assert.match(itens[0].texto, /^Ficha: Crase\.\nAntes de palavra masculina/);
  assert.match(itens[2].texto, /Craseia antes de feminina\.$/);
  assert.equal(idAudio("aula", "a.b$c"), "aula-a_b_c");
  assert.deepEqual(itensDoTema({ subtopico: "x", nome: "X", disciplina: null, ficha: null, aulas: [], pontos: [] }), []);
  const outro = itensDoTema({ subtopico: "regencia", nome: "Regência", disciplina: "lingua_portuguesa", ficha: null, aulas: [{ topicoId: "65AB", assunto: "Regência", texto: "Aula: Regência." }], pontos: [] });
  assert.deepEqual(unicos([...itens, ...outro]).map((i) => i.id), ["ficha-crase", "aula-65ab", "pontos-crase"]);
});

test("posição: ouvido a partir de 90% e não volta atrás; retomada recua um pouco; terminou recomeça", () => {
  const p1 = registrarPosicao(null, { fracao: 0.5, frase: 10, segundos: 95 });
  assert.equal(p1.ouvido, false);
  assert.deepEqual(pontoDeRetomada(p1), { frase: 9, segundos: 92 });
  const p2 = registrarPosicao(p1, { fracao: 0.93, frase: 18, segundos: 170 });
  assert.equal(p2.ouvido, true);
  const p3 = registrarPosicao(p2, { fracao: 0.1, frase: 2, segundos: 10 });
  assert.equal(p3.ouvido, true, "ouvido fica");
  assert.deepEqual(pontoDeRetomada(registrarPosicao(p3, { fracao: 1, frase: 20, segundos: 200 })), { frase: 0, segundos: 0 });
  assert.deepEqual(pontoDeRetomada(null), { frase: 0, segundos: 0 });
  const lixo = registrarPosicao(null, { fracao: 7, frase: -3, segundos: Number.NaN });
  assert.deepEqual([lixo.fracao, lixo.frase, lixo.segundos], [1, 0, 0]);
});

test("visita: 1º acesso sem base de selos; no dia seguinte a base vira o último visto", () => {
  const v1 = rolarVisita(null, { crase: "reforco" }, brt("09:00"));
  assert.equal(v1.selosBase, null);
  const v2 = rolarVisita(v1, { crase: "concluido" }, brt("21:00"));
  assert.equal(v2.selosBase, null, "mesmo dia: base não muda");
  assert.deepEqual(v2.selosDia, { crase: "concluido" });
  const v3 = rolarVisita(v2, { crase: "concluido" }, brt("08:00", "2026-10-26"));
  assert.deepEqual(v3.selosBase, { crase: "concluido" });
  assert.equal(v3.desde, brt("21:00").toISOString());
});

test("recados: selo reforço → concluído, ficha/prova nova só nos seus temas e desde a última visita, conflito com a lei", () => {
  const visita: EstadoVisita = { dia: "2026-10-26", desde: brt("21:00").toISOString(), ultima: brt("08:00", "2026-10-26").toISOString(), selosBase: { crase: "reforco", regencia: "novo" }, selosDia: {} };
  const r = montarRecados({
    visita,
    selosAgora: { crase: "concluido", regencia: "reforco", pix: "novo" },
    nomes: { crase: "Crase", regencia: "Regência", pix: "Pix" },
    temasDoAluno: ["crase", "regencia"],
    conflitos: [{ subtopico: "crase", texto: "a apostila diz que há crase antes de horas indeterminadas" }, { subtopico: "pix", texto: "x" }],
    novidades: [
      { tipo: "ficha", subtopico: "regencia", titulo: "", em: brt("02:00", "2026-10-26").toISOString() },
      { tipo: "prova", subtopico: "crase", titulo: "Caixa 2021", em: brt("03:00", "2026-10-26").toISOString() },
      { tipo: "prova", subtopico: "crase", titulo: "Antiga", em: brt("10:00").toISOString() },
      { tipo: "ficha", subtopico: "pix", titulo: "", em: brt("02:00", "2026-10-26").toISOString() },
    ],
  });
  assert.deepEqual(r.map((x) => x.tipo), ["selo", "selo", "prova", "ficha", "conflito"]);
  assert.equal(r[0].texto, "Crase saiu do reforço: concluído!");
  assert.equal(r[1].texto, "Regência mudou de novo para reforço.");
  assert.match(r[2].texto, /Caixa 2021/);
  assert.match(r[4].texto, /Vale a lei\.$/);
});

test("biblioteca: busca sem acento, matéria e ouvido/não ouvido", () => {
  const itens = itensDoTema({ subtopico: "crase", nome: "Crase", disciplina: "lingua_portuguesa", ficha: ["a"], aulas: [], pontos: ["b"] });
  itens[0].posicao = registrarPosicao(null, { fracao: 1, frase: 1, segundos: 1 });
  assert.equal(filtrarBiblioteca(itens, { busca: "CRÁSE" }).length, 2);
  assert.equal(filtrarBiblioteca(itens, { disciplina: "informatica" }).length, 0);
  assert.deepEqual(filtrarBiblioteca(itens, { situacao: "ouvidos" }).map((i) => i.tipo), ["ficha"]);
  assert.deepEqual(filtrarBiblioteca(itens, { situacao: "nao_ouvidos" }).map((i) => i.tipo), ["pontos"]);
});
