import assert from "node:assert/strict";
import test from "node:test";
import { contagemVazia, nucleoDoTrecho, temEspelho, registrarAmostra, regrasLigadas, resumoTaxas, vaiParaAmostra } from "./esteiraPT.js";

const vazio = { parada: false, amostra: { frases: 0, concordantes: 0 }, aprovadasTotal: 0 };

test("amostra: 1 em cada 10 aprovadas vai ao juiz de IA", () => {
  assert.deepEqual([1, 9, 10, 11, 20, 30].map(vaiParaAmostra), [false, false, true, false, true, true]);
});

test("amostra: abaixo de 95% de concordância (com ≥ 10 frases) a esteira para e registra", () => {
  const uma = registrarAmostra(vazio, 5, 4); // 80%, mas só 5 frases: ainda não decide
  assert.equal(uma.parada, false);
  const duas = registrarAmostra(uma, 5, 5); // 9/10 = 90%
  assert.equal(duas.parada, true);
  assert.match(duas.motivo!, /90\.0% de concordância/);
  const boa = registrarAmostra(registrarAmostra(registrarAmostra(registrarAmostra(vazio, 5, 5), 5, 5), 5, 5), 5, 5); // 20/20
  assert.equal(boa.parada, false);
  assert.equal(registrarAmostra(boa, 5, 4).parada, false, "24/25 = 96%");
});

test("regras ligadas: só com molde, fora da lista de exclusão e ≥ 95% no benchmark do LanguageTool", () => {
  const bench = { regras: { obrigatoria_regencia: { taxa: 1 }, erro_verbo: { taxa: 0.95 }, erro_repetidas: { taxa: 0.3 }, erro_tratamento: { taxa: 1 } } };
  const l = regrasLigadas(bench);
  assert.ok(l.has("obrigatoria_regencia") && l.has("erro_verbo"));
  assert.ok(!l.has("erro_repetidas"), "o LanguageTool não acerta");
  assert.ok(!l.has("erro_tratamento"), "fora do sorteio por decisão do dono, mesmo com o LanguageTool acertando");
  assert.ok(!l.has("sem_crase_verbo"), "sem benchmark, não liga");
  assert.equal(regrasLigadas(null).size, 0);
});

test("núcleo do trecho: certo e errado com a mesma estrutura não entram na mesma questão", () => {
  assert.equal(nucleoDoTrecho("frente a frente"), nucleoDoTrecho("frente à frente"));
  assert.equal(nucleoDoTrecho("as 10 horas"), nucleoDoTrecho("às 10 horas"));
  assert.notEqual(nucleoDoTrecho("começou a arquivar"), nucleoDoTrecho("começou à assinar"));
  assert.equal(temEspelho(["sem_crase_verbo", "erro_masculino", "erro_verbo"]), true, "certa e o erro espelho juntos");
  assert.equal(temEspelho(["sem_crase_verbo", "erro_masculino", "erro_indefinido"]), false);
});

test("relatório: taxa por filtro (frases e candidatas)", () => {
  const c = { ...contagemVazia(), frases: 100, posicao: 2, languagetool: 18, candidatas: 20, parecida: 3, aprovadas: 15 };
  const r = resumoTaxas(c);
  assert.match(r, /100 frases → posição 2 \(2%\) · LanguageTool 18 \(18%\)/);
  assert.match(r, /20 candidatas → .*parecida 3 \(15% repetição\).*aprovadas 15/);
});
