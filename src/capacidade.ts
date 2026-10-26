// ============================================================
// Capacidade real de cada modelo grátis (decisão do dono, 26/10/2026): medida na telemetria (minutos com 429)
// e gravada em Config "capacidade_modelos"; o balde de src/corrente.ts usa esse ritmo. Também dá o
// "chamadas usadas × capacidade" do relatório diário.
// ============================================================
import { ChamadaModelo, Config } from "./models.js";
import { estimarCapacidade, usoDaCapacidade } from "../shared/orcamento.js";

const FORA = ["voz", "embed", "benchmark"]; // TTS e embeddings têm cota própria

export async function medirCapacidade(dias = 7) {
  const desde = new Date(Date.now() - dias * 86_400_000);
  const linhas = await ChamadaModelo.find({ em: { $gte: desde }, funcao: { $nin: FORA } }).select("modelo em ok falha").lean();
  const porModelo = new Map<string, { em: number; ok: boolean; falha?: string | null }[]>();
  for (const l of linhas) porModelo.set(l.modelo, [...(porModelo.get(l.modelo) ?? []), { em: new Date(l.em).getTime(), ok: l.ok, falha: l.falha }]);
  return [...porModelo.entries()].map(([modelo, cs]) => ({ modelo, chamadas: cs.length, recusas429: cs.filter((c) => c.falha === "429").length, ...estimarCapacidade(cs) })).sort((a, b) => b.chamadas - a.chamadas);
}

// só grava limite visto de verdade (minutos com 429). Sem 429, o pico é só um piso: com um job de IA por vez
// as chamadas saem em série e a latência limita antes do provedor (medição de 26/10: nenhum 429 em 7 dias),
// então vale o MODELO_RPM_PADRAO (40/min = limite da conta grátis da NVIDIA).
export async function gravarCapacidade(medidas: Awaited<ReturnType<typeof medirCapacidade>>) {
  const valor = Object.fromEntries(medidas.filter((m) => m.base === "429").map((m) => [m.modelo, { rpm: m.rpm, base: m.base, medidoEm: new Date().toISOString() }]));
  await Config.updateOne({ _id: "capacidade_modelos" }, { $set: { valor, em: new Date() } }, { upsert: true });
  return Object.keys(valor).length;
}

// relatório diário: por modelo, chamadas de hoje × o que o ritmo medido permitiria nos minutos com atividade
export async function usoDeHoje() {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const cap = ((await Config.findById("capacidade_modelos").lean())?.valor ?? {}) as Record<string, { rpm: number }>;
  const linhas = await ChamadaModelo.find({ em: { $gte: hoje }, funcao: { $nin: FORA } }).select("modelo em").lean();
  const porModelo = new Map<string, Set<number>>();
  const total = new Map<string, number>();
  for (const l of linhas) {
    porModelo.set(l.modelo, (porModelo.get(l.modelo) ?? new Set()).add(Math.floor(new Date(l.em).getTime() / 60_000)));
    total.set(l.modelo, (total.get(l.modelo) ?? 0) + 1);
  }
  const padrao = Number(process.env.MODELO_RPM_PADRAO) || 40;
  return [...total.entries()].map(([modelo, n]) => ({ modelo, ...usoDaCapacidade(n, cap[modelo]?.rpm ?? padrao, porModelo.get(modelo)!.size) }));
}
