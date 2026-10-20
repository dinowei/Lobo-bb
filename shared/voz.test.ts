import test from "node:test";
import assert from "node:assert/strict";
import { cacheDeVozRemovivel, escolherVozNavegador, preferenciaVozLoSalva, VOZ_LOUISE, vozTtsPadrao } from "./voz.js";

test("TTS usa Louise quando env está ausente, vazio ou inválido", () => {
  assert.equal(vozTtsPadrao(undefined), VOZ_LOUISE);
  assert.equal(vozTtsPadrao(""), VOZ_LOUISE);
  assert.equal(vozTtsPadrao("id-inexistente"), VOZ_LOUISE);
  assert.equal(vozTtsPadrao("Magpie-Multilingual.PT-BR.Diego"), "Magpie-Multilingual.PT-BR.Diego");
});

test("preferência antiga sem marcador migra para Louise; escolha explícita é preservada", () => {
  assert.deepEqual(preferenciaVozLoSalva("Diego", undefined), { vozLo: "Louise", vozLoManual: false });
  assert.deepEqual(preferenciaVozLoSalva("Diego", false), { vozLo: "Louise", vozLoManual: false });
  assert.deepEqual(preferenciaVozLoSalva("Diego", true), { vozLo: "Diego", vozLoManual: true });
  assert.deepEqual(preferenciaVozLoSalva("Louise", true), { vozLo: "Louise", vozLoManual: true });
  assert.deepEqual(preferenciaVozLoSalva("voz inválida", true), { vozLo: "Louise", vozLoManual: false });
});

test("fallback do navegador prefere pt-BR, depois outra pt e por último o padrão do navegador", () => {
  const en = { lang: "en-US", name: "voz qualquer" };
  const pt = { lang: "pt-PT", name: "voz qualquer" };
  const ptBr = { lang: "pt-BR", name: "voz qualquer" };
  assert.equal(escolherVozNavegador([en, pt, ptBr]), ptBr);
  assert.equal(escolherVozNavegador([en, pt]), pt);
  assert.equal(escolherVozNavegador([en]), undefined);

  const preferenciaSalva = { vozLo: "Diego", vozLoManual: true };
  escolherVozNavegador([ptBr]);
  assert.deepEqual(preferenciaSalva, { vozLo: "Diego", vozLoManual: true });
});

test("a limpeza de cache só considera removíveis vozes fora das opções explícitas", () => {
  assert.equal(cacheDeVozRemovivel(VOZ_LOUISE), false);
  assert.equal(cacheDeVozRemovivel("Magpie-Multilingual.PT-BR.Diego"), false);
  assert.equal(cacheDeVozRemovivel("Magpie-Multilingual.PT-BR.Isabela"), false);
  assert.equal(cacheDeVozRemovivel("voz-desconhecida"), true);
});
