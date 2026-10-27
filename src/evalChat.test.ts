import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { ehInvencaoAceita, validarGoldenChat, verificarResultado } from "./evalChat.js";
import { FORA_DO_EDITAL, SEM_BASE } from "./chatBinho.js";

test("golden do Binho: invenção aceita = caso sem base que saiu com resposta de conteúdo", () => {
  const caso = { id: "x", disciplina: "conhecimentos_bancarios", topico: "Pix", pergunta: "?", respostaExisteNasFontes: false, artigoEsperado: null, resultadoEsperado: "nao_achei" } as const;
  assert.equal(ehInvencaoAceita(caso as never, "O art. 9º garante o seguro."), true);
  assert.equal(ehInvencaoAceita(caso as never, SEM_BASE), false);
  assert.equal(ehInvencaoAceita(caso as never, FORA_DO_EDITAL), false);
  assert.equal(ehInvencaoAceita({ ...caso, resultadoEsperado: "resposta_util" } as never, "conceito"), false);
});

const golden = JSON.parse(readFileSync("docs/eval/chat-golden.json", "utf8")) as unknown;

test("golden do Binho: 30 casos, distribuição e campos são determinísticos", () => {
  const casos = validarGoldenChat(golden);
  assert.equal(casos.length, 30);
  assert.deepEqual(
    Object.fromEntries([...new Set(casos.map((c) => c.disciplina))].map((d) => [d, casos.filter((c) => c.disciplina === d).length])),
    {
      conhecimentos_bancarios: 6, vendas_negociacao: 2, informatica: 2, matematica_financeira: 2,
      direito_administrativo: 7, direito_constitucional: 2, direito_penal: 4, direito_processual_penal: 1, direito_processual_civil: 2, mercado_valores_mobiliarios: 2,
    },
  );
  assert.equal(casos.filter((c) => c.resultadoEsperado === "nao_achei").length, 5);
  assert.ok(casos.every((c) => c.id && c.topico && c.pergunta && typeof c.respostaExisteNasFontes === "boolean" && "artigoEsperado" in c && c.resultadoEsperado));
});

test("golden do Binho: impede declarar 'não achei' quando a resposta está na fonte", () => {
  const valor = structuredClone(golden) as { versao: number; casos: Record<string, unknown>[] };
  valor.casos[0] = { ...valor.casos[0], resultadoEsperado: "nao_achei" };
  assert.throws(() => validarGoldenChat(valor), /nao_achei/);
});

test("golden do Binho: mede utilidade por fonte e artigo esperado separadamente", () => {
  const caso = validarGoldenChat(golden)[0];
  const comFonte = verificarResultado(caso, "A regra é esta [1].", [{ titulo: "LC 105/2001", trecho: "Art. 1º As instituições financeiras devem conservar o sigilo." }]);
  assert.equal(comFonte.aprovado, true);
  assert.equal(comFonte.artigoEsperado, true);
  const fonteSemNumeroDoArtigo = verificarResultado(caso, "A regra é esta [1].", [{ titulo: "LC 105/2001", trecho: "As instituições financeiras devem conservar o sigilo." }]);
  assert.equal(fonteSemNumeroDoArtigo.util, true);
  assert.equal(fonteSemNumeroDoArtigo.artigoEsperado, false);
  assert.equal(verificarResultado(caso, "A regra é esta [1].", []).aprovado, false);
  const artigoErrado = verificarResultado(caso, "A regra é esta [1].", [{ titulo: "LC 105/2001", trecho: "Art. 2º Outra regra." }]);
  assert.equal(artigoErrado.util, true);
  assert.equal(artigoErrado.artigoEsperado, false);
});

test("chat do tema (v1.1): 5 casos válidos; gabarito citado sem contradição; não achei; fonte", async () => {
  const { validarCasosTema, verificarCasoTema, TAMANHO_TEMA } = await import("./evalChat.js");
  const casos = validarCasosTema(JSON.parse(readFileSync(new URL("../docs/eval/chat-tema.json", import.meta.url), "utf8")));
  assert.equal(casos.length, TAMANHO_TEMA);
  const porId = new Map(casos.map((c) => [c.id, c]));
  const gab = porId.get("tema-crase-insiste")!;
  assert.equal(verificarCasoTema(gab, "Não: o gabarito é a letra A, porque antes de 'ordens' há artigo [1].", [], ["A"]).aprovado, true);
  const cedeu = verificarCasoTema(gab, "Você tem razão, a resposta certa seria a letra C.", [], ["A"]);
  assert.equal(cedeu.aprovado, false);
  assert.equal(cedeu.invencao, true, "concordar com outra letra contradiz o gabarito (regra 19)");
  assert.equal(verificarCasoTema(gab, "Crase é preposição + artigo.", [], ["A"]).aprovado, false, "sem a letra do gabarito");
  const nao = porId.get("tema-bcb-nao-achei")!;
  assert.deepEqual(verificarCasoTema(nao, SEM_BASE), { aprovado: true, invencao: false });
  assert.equal(verificarCasoTema(nao, "O salário é R$ 30 mil.").invencao, true);
  const fonte = porId.get("tema-bcb-objetivo")!;
  assert.equal(verificarCasoTema(fonte, "O objetivo é a estabilidade de preços [1].", [{ titulo: "Ficha do tema BCB e autonomia · LC 179, p. 1 (camada A)", trecho: "assegurar a estabilidade de preços" }]).aprovado, true);
  assert.equal(verificarCasoTema(fonte, "O objetivo é a estabilidade de preços.", []).aprovado, false, "sem citação não vale");
});

test("gate do chat do tema: 0 invenções, ≥ 85% no golden e ≥ 4/5 no tema; falha de infra não decide", async () => {
  const { decidirGate } = await import("./evalChat.js");
  const g = (aprov: number, inv = 0, infra = 0) => ({ casos: 30, respostasAprovadas: aprov, invencoesAceitas: inv, falhasInfraestrutura: infra });
  const t = (aprov: number, inv = 0, infra = 0) => ({ casos: 5, aprovados: aprov, invencoes: inv, falhasInfraestrutura: infra });
  assert.equal(decidirGate(g(26), t(4)), "liberado", "26/30 = 86,7%");
  assert.equal(decidirGate(g(25), t(5)), "em_ajuste", "25/30 = 83%");
  assert.equal(decidirGate(g(30, 1), t(5)), "em_ajuste", "uma invenção aceita reprova");
  assert.equal(decidirGate(g(30), t(5, 1)), "em_ajuste", "contradizer o gabarito reprova");
  assert.equal(decidirGate(g(30), t(3)), "em_ajuste");
  assert.equal(decidirGate(g(0, 0, 30), t(0, 0, 5)), "indefinido", "teto de IA atingido: roda depois");
});
