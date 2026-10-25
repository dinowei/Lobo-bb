// ============================================================
// BB Estudos — recuperação das questões de Português por construção que ficaram "pendente /
// aguardando_auditoria_independente" (sem juiz para desempatar). Tarefa da Janela B da V2.
// Para cada frase sem desempate: um juiz de outra família que a do escritor e diferente do 1º juiz
// julga a frase às cegas (só a frase). O CÓDIGO decide: concordou com o banco de regras em todas →
// aprovada; discordou em alguma → rejeitada; ainda sem juiz → continua aguardando.
// ============================================================
import { Question } from "./models.js";
import { chatJSONFuncao } from "./corrente.js";
import { SemModeloDisponivel } from "./llm.js";
import { familiaDe } from "./catalogo.js";
import { AREAS_PT } from "./regrasPT.js";
import { VereditoFraseZ } from "./prompts.js";
import type { Letra } from "../shared/tipos.js";

export async function desempatarPendentes(log: (s: string) => void = console.log) {
  const qs = await Question.find({ "auditoria.pendencia": "aguardando_auditoria_independente" }).lean();
  const r = { total: qs.length, aprovadas: 0, rejeitadas: 0, aguardando: 0 };
  for (const q of qs) {
    const area = AREAS_PT[q.variacao?.tipo ?? ""];
    const desempates = [...(q.auditoria?.desempates ?? [])];
    if (!area || !desempates.some((d) => d.semJuiz)) { r.aguardando++; continue; }
    const familiasEscritor = [...new Set(String(q.geradaPor ?? "").split(" + ").filter(Boolean).map((m) => familiaDe(m)))];
    let discordou = false, semJuiz = false;
    for (const d of desempates) {
      if (!d.semJuiz) continue;
      const frase = q.alternativas.find((a) => a.letra === d.letra)?.texto ?? "";
      const esperado = d.letra === q.gabarito; // banco de regras: só a frase do gabarito está certa
      const primeiro = q.auditoria?.porFrase?.find((p) => p.letra === d.letra)?.juiz;
      try {
        const v = await chatJSONFuncao("juiz_pt", area.juizSystem, `FRASE: ${frase}`, 0, 600, { excluirFamilias: familiasEscritor, excluirModelos: primeiro ? [primeiro] : [] });
        const veredito = VereditoFraseZ.parse(v.json);
        Object.assign(d, { ultra: veredito.correta, regraUltra: `[desempate ${v.modelo}] ${veredito.regra}`, semJuiz: false });
        log(`  ⚖ ${String(q._id)} ${d.letra as Letra}: ${v.modelo} disse ${veredito.correta ? "SIM" : "não"}, regra ${esperado ? "SIM" : "não"}`);
        if (veredito.correta !== esperado) discordou = true;
      } catch (e) {
        if (!(e instanceof SemModeloDisponivel)) throw e;
        semJuiz = true;
      }
    }
    if (discordou) {
      await Question.updateOne({ _id: q._id }, { $set: { status: "rejeitada", "auditoria.desempates": desempates, "auditoria.veredito": "rejeitada" }, $unset: { "auditoria.pendencia": 1 }, $push: { "auditoria.problemas": "desempate independente discordou do banco de regras" } });
      r.rejeitadas++;
    } else if (semJuiz) {
      await Question.updateOne({ _id: q._id }, { $set: { "auditoria.desempates": desempates } });
      r.aguardando++;
    } else {
      // a revisão completa já tinha aprovado (por isso estava "pendente", não "rejeitada")
      await Question.updateOne({ _id: q._id }, { $set: { status: "aprovada", "auditoria.desempates": desempates }, $unset: { "auditoria.pendencia": 1 } });
      r.aprovadas++;
    }
  }
  return r;
}
