import assert from "node:assert/strict";
import test from "node:test";
import { classificarPorCodigo, concursosDoTopico, SUBTOPICOS, topicosSemSubtopico } from "./subtopicos.js";

test("árvore: ids únicos e os temas mínimos do plano do dono presentes", () => {
  const ids = SUBTOPICOS.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ["interpretacao", "pontuacao", "concordancia", "regencia", "crase", "porcentagem", "juros_simples", "sac_price", "proposicoes", "so_atalhos", "pix", "pld_ft", "copom_selic", "cdc", "art5", "licitacoes_14133", "etica_transparencia", "contabilidade", "gestao_pessoas", "recursos_materiais"]) {
    assert.ok(ids.includes(id), id);
  }
});

test("classificação por código: tópico único, construção e palavras; ambíguo vai para o modelo", () => {
  assert.deepEqual(classificarPorCodigo({ assunto: "Pontuação", texto: "qualquer" }), { subtopico: "pontuacao", metodo: "topico_unico" });
  // "crase só traz crase": a construção sabe o tema mesmo num tópico com regência e crase
  assert.deepEqual(classificarPorCodigo({ assunto: "Regência verbal e nominal e crase", texto: "Assinale", tipo: "crase (por construção)" }), { subtopico: "crase", metodo: "construcao" });
  assert.deepEqual(classificarPorCodigo({ assunto: "Regência verbal e nominal e crase", texto: "Quanto à regência do verbo assistir", tipo: null }), { subtopico: "regencia", metodo: "palavras" });
  assert.deepEqual(classificarPorCodigo({ assunto: "Redes, internet e computação em nuvem", texto: "O serviço SaaS na nuvem" }), { subtopico: "nuvem_redes", metodo: "palavras" });
  const amb = classificarPorCodigo({ assunto: "Redes, internet e computação em nuvem", texto: "Assinale a correta" });
  assert.equal(amb.subtopico, null);
  assert.deepEqual("candidatos" in amb && amb.candidatos, ["internet_email", "nuvem_redes"]);
});

test("concursos do tópico = união dos subtópicos; tópico sem subtópico é detectado", () => {
  assert.deepEqual(concursosDoTopico("Pontuação"), ["bacen", "bb"]);
  assert.deepEqual(concursosDoTopico("Juros compostos"), ["bb"]);
  assert.deepEqual(concursosDoTopico("Agentes públicos (Lei 8.112/1990)"), ["bacen"]);
  assert.deepEqual(topicosSemSubtopico(["Pontuação", "Tópico inventado"]), ["Tópico inventado"]);
});
