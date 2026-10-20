import assert from "node:assert/strict";
import test from "node:test";
import { motivosMaisComuns, topicosDeMaiorPeso } from "./evalGerador.js";
import { GERADOR_SYSTEM } from "./prompts.js";

test("gerador (motivo nº 1 do eval, explicação da errada ensinando errado): a regra 8 proíbe fato técnico novo no distrator", () => {
  const regra = GERADOR_SYSTEM.slice(GERADOR_SYSTEM.indexOf("8. \"explicacao\""), GERADOR_SYSTEM.indexOf("9. \"explicacaoGeral\""));
  assert.match(regra, /Nas ERRADAS/);
  assert.match(regra, /Não traga fato técnico NOVO/);
  assert.match(regra, /mudar o distrator/);
});

const e = { totalQuestoes: 70, metaBanco: 1200, cotas: { informatica: 15, vendas_negociacao: 15, conhecimentos_bancarios: 10, lingua_portuguesa: 10, matematica: 5 } };
const t = (disciplina: string, assunto: string) => ({ id: assunto, disciplina, assunto });

test("eval do gerador: maior peso primeiro (cota ÷ tópicos), empate alterna disciplinas, bloqueado fica fora", () => {
  const topicos = [
    t("informatica", "Planilhas"), t("informatica", "Redes"), t("informatica", "SQL"),
    t("vendas_negociacao", "Atendimento"), t("vendas_negociacao", "Técnicas de vendas"),
    t("conhecimentos_bancarios", "SFN"),
    t("lingua_portuguesa", "Crase"), t("lingua_portuguesa", "Concordância"), t("lingua_portuguesa", "Regência"), t("lingua_portuguesa", "Pontuação"),
    t("matematica", "Porcentagem"),
  ];
  const r = topicosDeMaiorPeso(topicos, e, new Set(["Técnicas de vendas"]), 4);
  // Vendas: 15 ÷ 1 tópico liberado = maior peso; depois Bancários 10 ÷ 1; depois Informática 15 ÷ 3 e Matemática 5 ÷ 1 empatados
  assert.deepEqual(r.map((x) => x.assunto), ["Atendimento", "SFN", "Planilhas", "Porcentagem"]);
  assert.ok(r[0].peso > r[1].peso && r[1].peso > r[2].peso);
});

test("eval do gerador: 3 motivos mais comuns, contados", () => {
  assert.deepEqual(motivosMaisComuns(["a", "b", "a", "c", "b", "a", "d"]), [{ motivo: "a", n: 3 }, { motivo: "b", n: 2 }, { motivo: "c", n: 1 }]);
});
