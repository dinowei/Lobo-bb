import assert from "node:assert/strict";
import test from "node:test";
import { decidirAfirmacao, decidirEstado, type Afirmacao, type Contrato } from "./contratos.js";

const c = (o: Partial<Contrato>): Contrato => ({
  tarefa: { id: "t1", tipo: "questao" }, modeloOrigem: "openai/gpt-oss-20b", familia: "openai", funcao: "gerador",
  fontes: [], resultado: {}, confianca: "media", pendencias: [], evidencias: [], proximoRevisor: "auditor", status: "proposto", ...o,
});
const gerador = c({});
const auditorMeta = c({ modeloOrigem: "meta/muse-glimmer-30b", familia: "meta", funcao: "auditor", status: "aprovado", proximoRevisor: "codigo" });
const ok = { deterministicas: [{ nome: "mathjs", ok: true }] };

test("aprovada só com auditor de outra família e checagens do código ok", () => {
  assert.deepEqual(decidirEstado([gerador, auditorMeta], ok), { estado: "aprovada", motivos: [] });
});

test("sem auditor independente → aguardando, nunca aprovação silenciosa", () => {
  const mesmaFamilia = c({ modeloOrigem: "openai/outro", familia: "openai", funcao: "auditor", status: "aprovado" });
  assert.equal(decidirEstado([gerador, mesmaFamilia], ok).estado, "aguardando_auditoria_independente");
  assert.equal(decidirEstado([gerador], ok).estado, "aguardando_auditoria_independente");
});

test("o código manda: checagem determinística reprovada ou contrato inválido → rejeitada, mesmo com auditor aprovando", () => {
  assert.equal(decidirEstado([gerador, auditorMeta], { deterministicas: [{ nome: "mathjs", ok: false }] }).estado, "rejeitada");
  assert.equal(decidirEstado([gerador, { ...auditorMeta, confianca: "talvez" }], ok).estado, "rejeitada");
});

test("trecho citado que não está na fonte → aguardando_fonte; revisor reprovou → rejeitada; pendência → pendente", () => {
  assert.equal(decidirEstado([gerador, auditorMeta], { ...ok, trechosLiterais: [{ trecho: "art. 9º", achado: false }] }).estado, "aguardando_fonte");
  assert.equal(decidirEstado([gerador, auditorMeta, c({ familia: "zai", funcao: "juiz_pt", status: "reprovado" })], ok).estado, "rejeitada");
  assert.equal(decidirEstado([gerador, { ...auditorMeta, pendencias: ["conferir vigência"] }], ok).estado, "pendente");
});

test("afirmação: fato só com trecho achado e fonte vigente; exemplo marcado não vira fato; conflito vai para auditoria", () => {
  const a: Afirmacao = { afirmacao: "Crase é a contração de a + a", classe: "conceito", fonteId: "f1", pagina: 54, trechoLiteral: "A crase é a contração", vigente: true, confianca: "alta", conflito: false, origem: "didatica", status: "pendente" };
  assert.equal(decidirAfirmacao(a, true), "aprovada");
  assert.equal(decidirAfirmacao(a, false), "rejeitada");
  assert.equal(decidirAfirmacao({ ...a, vigente: false }, true), "rejeitada");
  assert.equal(decidirAfirmacao({ ...a, vigente: null }, true), "pendente");
  assert.equal(decidirAfirmacao({ ...a, conflito: true }, true), "pendente");
  assert.equal(decidirAfirmacao({ ...a, classe: "exemplo", fonteId: null, trechoLiteral: null }, false), "aprovada");
  assert.equal(decidirAfirmacao({ ...a, classe: "hipotese", fonteId: null, trechoLiteral: null }, false), "pendente");
});
