// Gera um progresso de demo realista (7 dias de estudo) para prints e testes visuais.
// uso: npx tsx scripts/semente-demo.ts <arquivo.json>  → depois PRINTS_ESTADO=<arquivo.json> npx tsx scripts/prints.ts ...
import { writeFileSync } from "node:fs";
// caminho em variável: o typecheck do servidor (NodeNext) não segue para o código do site (bundler)
const CAMINHO_DEMO = "../web/src/demo/questoes.js";
const { QUESTOES_DEMO } = (await import(CAMINHO_DEMO)) as { QUESTOES_DEMO: { id: string; disciplina: string; assunto: string; dificuldade: number }[] };
import { ESTADO_INICIAL, agendar, notaSM2, xpDaTentativa } from "../shared/motor.js";
import { MOTIVOS_ERRO, type Confianca, type TentativaBruta } from "../shared/tipos.js";

const saida = process.argv[2];
if (!saida) throw new Error("uso: npx tsx scripts/semente-demo.ts <arquivo.json>");

// sorteio determinístico: os prints saem iguais a cada vez
let semente = 7;
const rnd = () => ((semente = (semente * 16807) % 2147483647) / 2147483647);
const slug = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const tentativas: TentativaBruta[] = [];
const revisoes: Record<string, ReturnType<typeof agendar> & { proxima: string }> = {};
const agora = Date.now();
for (let dia = 6; dia >= 0; dia--) {
  for (let k = 0; k < 9; k++) {
    const q = QUESTOES_DEMO[Math.floor(rnd() * QUESTOES_DEMO.length)];
    const facil = q.disciplina === "lingua_portuguesa" || q.disciplina === "matematica" ? 0.75 : q.disciplina === "informatica" ? 0.45 : 0.6;
    const acertou = rnd() < facil;
    const confianca = (rnd() < 0.55 ? 3 : rnd() < 0.6 ? 2 : 1) as Confianca;
    const data = new Date(agora - dia * 86_400_000 - (k + 1) * 7 * 60_000).toISOString();
    tentativas.push({
      questaoId: q.id,
      topicoId: `${q.disciplina}:${slug(q.assunto)}`,
      acertou,
      xp: xpDaTentativa({ acertou, dificuldade: q.dificuldade, confianca, modo: "treino" }),
      modo: "treino",
      data,
      confianca,
      tempoSeg: 40 + Math.round(rnd() * 140),
      ...(acertou ? {} : { motivoErro: rnd() < 0.7 ? MOTIVOS_ERRO[Math.floor(rnd() * 4)] : undefined, resposta: "A" as const }),
    });
    const novo = agendar(revisoes[q.id] ?? ESTADO_INICIAL, notaSM2(acertou, confianca));
    revisoes[q.id] = { ...novo, proxima: new Date(+new Date(data) + novo.intervaloDias * 86_400_000).toISOString() };
  }
}
// um Raio-X há 3 dias
const diag = `diag:${agora - 3 * 86_400_000}`;
for (const q of QUESTOES_DEMO.slice(0, 30)) {
  const acertou = rnd() < 0.55;
  tentativas.push({ questaoId: q.id, topicoId: `${q.disciplina}:${slug(q.assunto)}`, acertou, xp: acertou ? 10 : 2, modo: "simulado", simuladoId: diag, data: new Date(agora - 3 * 86_400_000).toISOString(), tempoSeg: 0 });
}
tentativas.sort((a, b) => a.data.localeCompare(b.data));

const estado = {
  "lobo-demo-v1": JSON.stringify({ tentativas, revisoes, contestadas: [] }),
  "lobo-ajustes": JSON.stringify({ nome: "Dinei", metaDiaria: 20, dataProva: "", horasPorDia: 2, diasSemana: [0, 1, 2, 3, 4, 5, 6], cicloFoco: "25/5" }),
  "lobo-aula-vista:matematica_financeira:juros-compostos": "", // a aula de exemplo aparece no print de Praticar
};
writeFileSync(saida, JSON.stringify(estado));
console.log(`✔ ${tentativas.length} tentativas em ${saida}`);
