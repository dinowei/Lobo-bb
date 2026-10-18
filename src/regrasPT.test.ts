// Português por construção (Concordância, Regência, Pontuação e Crase): banco de regras e montagem
import { test } from "node:test";
import assert from "node:assert/strict";
import { AREAS_PT, AREA_CONCORDANCIA, AREA_REGENCIA, AREA_PONTUACAO, type AreaPT } from "./regrasPT.js";
import type { Letra } from "../shared/tipos.js";

const NOVAS: AreaPT[] = [AREA_CONCORDANCIA, AREA_REGENCIA, AREA_PONTUACAO];

for (const area of NOVAS) {
  test(`${area.tipo}: cada exemplo passa na trava da própria regra`, () => {
    for (const r of area.regras) {
      assert.ok(r.exemplo, `${r.id} sem exemplo`);
      assert.equal(area.conferir(r.exemplo!.frase, r.exemplo!.trecho, r), null, `${r.id}: ${area.conferir(r.exemplo!.frase, r.exemplo!.trecho, r)}`);
    }
  });

  test(`${area.tipo}: o exemplo de uma regra de erro não passa na regra certa correspondente (e vice-versa)`, () => {
    const certas = area.regras.filter((r) => r.correta);
    const erros = area.regras.filter((r) => !r.correta);
    for (const e of erros)
      for (const c of certas) {
        // mesmo ponto gramatical com a forma trocada: a trava separa as duas
        if (e.exemplo!.trecho.split(" ")[0].toLowerCase() === c.exemplo!.trecho.split(" ")[0].toLowerCase())
          assert.notEqual(area.conferir(e.exemplo!.frase, e.exemplo!.trecho, c), null, `${e.id} passou como ${c.id}`);
      }
  });

  test(`${area.tipo}: a correção do banco transforma o erro no uso certo`, () => {
    for (const e of area.regras.filter((r) => !r.correta && r.corrigir)) {
      const corrigido = e.corrigir!(e.exemplo!.trecho);
      assert.notEqual(corrigido, e.exemplo!.trecho, `${e.id} não corrigiu`);
      assert.ok(!e.trecho.test(corrigido), `${e.id}: "${corrigido}" ainda tem a forma do erro`);
    }
  });

  test(`${area.tipo}: 1.000 montagens com 1 regra certa na letra sorteada e 4 erros diferentes`, () => {
    for (let k = 0; k < 1000; k++) {
      const g = "ABCDE"[k % 5] as Letra;
      const m = area.construir(g, "abertura de conta", { uso: new Map(), anterior: new Set() });
      assert.equal(m.frases.length, 5);
      assert.equal(new Set(m.frases.map((f) => f.regra.id)).size, 5, "regras repetidas");
      assert.deepEqual(m.frases.filter((f) => f.regra.correta).map((f) => f.letra), [g]);
      assert.ok(m.enunciado.includes("abertura de conta"));
    }
  });
}

test("variedade: não repete as regras da última aprovada quando dá", () => {
  const ultima = new Set(AREA_CONCORDANCIA.regras.slice(0, 5).map((r) => r.id));
  for (let k = 0; k < 200; k++) {
    const m = AREA_CONCORDANCIA.construir("C", "crédito", { uso: new Map(), anterior: ultima });
    const certa = m.frases.find((f) => f.letra === "C")!.regra;
    assert.ok(!ultima.has(certa.id), "repetiu a regra certa da última");
  }
});

test("explicação e pegadinha vêm do banco (regra 14)", () => {
  const r = AREA_REGENCIA.regras.find((x) => x.id === "chegar_em")!;
  const e = AREA_REGENCIA.explicar(r, "chegou no escritório");
  assert.match(e.explicacao, /^Errada\. Em "chegou no escritório": .* O certo seria "chegou ao escritório"\.$/);
  assert.equal(e.pegadinha, r.pegadinha);
});

test("correção vale para a frase inteira e nunca traz exemplo fixo como se fosse a correção (casos reais da Etapa 7)", () => {
  // regência: a frase é "chegou no banco"; antes a explicação dizia "o certo é 'chegou ao escritório'"
  const chegar = AREA_REGENCIA.regras.find((x) => x.id === "chegar_em")!;
  const frase = "O dono da distribuidora chegou no banco às dez horas para discutir o limite de crédito com o gerente.";
  const e = AREA_REGENCIA.explicar(chegar, "chegou no banco", frase);
  assert.ok(e.explicacao.includes('O certo seria: "O dono da distribuidora chegou ao banco às dez horas'));
  assert.ok(!/o certo é/i.test(e.explicacao));
  // pontuação: corrigir só o trecho ("lojista foram") parecia chamar "lojista" de sujeito
  const virgula = AREA_PONTUACAO.regras.find((x) => x.id === "virgula_sujeito_verbo")!;
  const p = AREA_PONTUACAO.explicar(virgula, "lojista, foram", "As duplicatas negociadas pelo lojista, foram antecipadas com desconto na agência.");
  assert.ok(p.explicacao.includes('O certo seria: "As duplicatas negociadas pelo lojista foram antecipadas com desconto na agência."'));
  // nenhuma regra de erro afirma uma correção fixa
  for (const area of [AREA_CONCORDANCIA, AREA_REGENCIA, AREA_PONTUACAO]) for (const r of area.regras) assert.ok(!/o certo é '/i.test(r.explicacao), `${r.id} ainda tem "o certo é"`);
});

test("pontuação: vírgula a mais fora do trecho é barrada", () => {
  const r = AREA_PONTUACAO.regras.find((x) => x.id === "virgula_sujeito_verbo")!;
  assert.match(AREA_PONTUACAO.conferir("Hoje, o gerente da agência, aprovou o limite.", "agência, aprovou", r) ?? "", /só pode ter/);
});

test("concordância facultativa é proibida nas frases", () => {
  const r = AREA_CONCORDANCIA.regras.find((x) => x.id === "houveram")!;
  assert.match(AREA_CONCORDANCIA.conferir("A maioria dos clientes reclamou e houveram reclamações novas.", "houveram reclamações", r) ?? "", /facultativa/);
});

test("todas as áreas estão registradas, Crase inclusive", () => {
  assert.deepEqual(Object.keys(AREAS_PT).sort(), ["concordância (por construção)", "crase (por construção)", "pontuação (por construção)", "regência (por construção)"]);
});
