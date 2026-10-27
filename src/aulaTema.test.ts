import assert from "node:assert/strict";
import test from "node:test";
import { camadaDoTipo, origemDaSecao, PROVA_AULA_TEMA, validarSecao, type FonteSecao } from "./aulaTema.js";

const fontes: FonteSecao[] = [
  { indice: 1, titulo: "Lei X", camada: "A", texto: "O verbo concorda com o núcleo do sujeito em número e pessoa." },
  { indice: 2, titulo: "Apostila", camada: "C", texto: "Com sujeito composto anteposto, o verbo vai para o plural." },
];
const secao = (conteudo: string, f: { indice: number; trecho: string }[] = []) => ({
  conteudo, exemplos: ["Os meninos chegaram.", "Ele e ela saíram."], contraexemplos: ["Chegou os meninos (errado)."], pegadinhas: ["Sujeito posposto."], resumo: "O verbo concorda com o sujeito.", fontes: f,
});

test("aula completa: citação [N] literal, fonte listada precisa ser citada, disciplina com fonte obrigatória", () => {
  assert.equal(validarSecao(secao("O verbo concorda com o núcleo [1]."), "lingua_portuguesa", fontes), undefined);
  assert.equal(validarSecao(secao("Texto [1].", [{ indice: 1, trecho: "concorda com o núcleo do sujeito em número" }]), "lingua_portuguesa", fontes), undefined);
  assert.match(validarSecao(secao("Texto [3].") , "lingua_portuguesa", fontes)!, /índice de fonte inexistente/);
  assert.match(validarSecao(secao("Texto [1].", [{ indice: 1, trecho: "o verbo sempre vai para o plural no caso" }]), "lingua_portuguesa", fontes)!, /não existe literalmente/);
  assert.match(validarSecao(secao("Sem citação.", [{ indice: 2, trecho: "Com sujeito composto anteposto, o verbo" }]), "lingua_portuguesa", fontes)!, /listada mas não é citada/);
  assert.match(validarSecao(secao("Sem citação nenhuma."), "conhecimentos_bancarios", fontes)!, /exige fonte/);
});

test("aula completa: origem = melhor camada citada (A > B > C); sem citação, conceito; tipo da fonte → camada", () => {
  assert.equal(origemDaSecao([{ camada: "C" }, { camada: "A" }]), "A");
  assert.equal(origemDaSecao([{ camada: "C" }, { camada: "B" }]), "B");
  assert.equal(origemDaSecao([]), "conceito");
  assert.equal(camadaDoTipo("lei"), "A");
  assert.equal(camadaDoTipo("prova_oficial"), "A");
  assert.equal(camadaDoTipo("material_proprio"), "B");
  assert.equal(camadaDoTipo("material_cursinho"), "C");
  assert.deepEqual([...PROVA_AULA_TEMA], ["concordancia", "porcentagem"], "a prova é só nesses 2 temas até o OK do dono");
});
