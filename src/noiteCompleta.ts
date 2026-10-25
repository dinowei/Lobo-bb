// ============================================================
// BB Estudos — etapas da noite completa (E6/F12) e utilidades da Janela B (E8).
// Ordem (prompt F12): 1) backup; 2) acervo novo; 3) ingestão do próximo item da fila; 4) classificação
// pendente; 5) geração (fila de tarefas); 6) derivação C/E; 7) fichas; 8) explicações e aulas; 9) áudio;
// 10) relatório. Cada etapa vira uma linha no relatório (ok / pulada / falhou + detalhe), sem parar a noite.
// ============================================================
import { existsSync } from "node:fs";
import mongoose from "mongoose";
import { Config, Ficha } from "./models.js";
import { criarBackupAtlas } from "./backup.js";
import { indexarAcervo } from "./acervo.js";
import { classificarBanco } from "./subtopicos.js";
import { derivarCE } from "./certoErrado.js";
import { gerarFicha, fichaAprovada } from "./fichas.js";
import { ingerirProva, ingerirProvaCE } from "./ingestao.js";
import { TRILHA } from "../shared/trilha.js";

export interface EtapaNoite { etapa: string; status: "ok" | "pulada" | "falhou"; detalhe: string; ms: number }

// roda uma etapa sem derrubar a noite; "pulada" quando a função devolve null (nada a fazer ou sem tempo)
export async function etapa(lista: EtapaNoite[], nome: string, fn: () => Promise<string | null>) {
  const t0 = Date.now();
  try {
    const detalhe = await fn();
    lista.push({ etapa: nome, status: detalhe === null ? "pulada" : "ok", detalhe: detalhe ?? "nada a fazer", ms: Date.now() - t0 });
  } catch (e) {
    lista.push({ etapa: nome, status: "falhou", detalhe: (e as Error).message.replace(/\s+/g, " ").slice(0, 300), ms: Date.now() - t0 });
  }
  const u = lista.at(-1)!;
  console.log(`${u.status === "ok" ? "✔" : u.status === "pulada" ? "·" : "✖"} etapa ${nome}: ${u.detalhe}`);
}

export const sobraTempo = (ate: Date | undefined, minutos: number) => !ate || +ate - Date.now() > minutos * 60_000;

export async function etapaBackup(): Promise<string> {
  const b = await criarBackupAtlas(mongoose.connection.db!);
  return `${b.manifesto.colecoes.length} coleções, ${b.manifesto.colecoes.reduce((s, c) => s + c.quantidade, 0)} documentos (verificado)`;
}

export async function etapaAcervo(): Promise<string | null> {
  if (!process.env.ACERVO_DIR || !existsSync(process.env.ACERVO_DIR)) return null;
  const r = await indexarAcervo({ log: () => undefined });
  return `${r.novos} PDF(s) novo(s) indexado(s) de ${r.total}${r.erros.length ? `; ${r.erros.length} erro(s)` : ""}`;
}

// fila de ingestão (Config "fila_ingestao"): um item por noite, na ordem; o item sai da fila só quando entra
export interface ItemIngestao { comando: "prova" | "prova-ce"; prova: string; gabarito: string; nome: string; banca: string; ano?: number; caderno?: string; questoes?: string }
export async function filaIngestao(): Promise<ItemIngestao[]> {
  return (((await Config.findById("fila_ingestao").lean())?.valor ?? []) as ItemIngestao[]);
}
export async function enfileirarIngestao(itens: ItemIngestao[]) {
  const atual = await filaIngestao();
  const novos = itens.filter((i) => !atual.some((a) => a.prova === i.prova && a.nome === i.nome));
  await Config.updateOne({ _id: "fila_ingestao" }, { $set: { valor: [...atual, ...novos], em: new Date() } }, { upsert: true });
  return { antes: atual.length, depois: atual.length + novos.length };
}
export async function etapaIngestao(): Promise<string | null> {
  const fila = await filaIngestao();
  const item = fila[0];
  if (!item) return null;
  const meta = { nome: item.nome, banca: item.banca, ano: item.ano, caderno: item.caderno, questoes: item.questoes };
  try {
    if (item.comando === "prova-ce") await ingerirProvaCE(item.prova, item.gabarito, meta);
    else await ingerirProva(item.prova, item.gabarito, meta);
  } catch (e) {
    // prova que falha sai da frente (senão trava todas as noites seguintes) e fica em "fila_ingestao_falhas" para conferir
    await Config.updateOne({ _id: "fila_ingestao" }, { $set: { valor: fila.slice(1), em: new Date() } });
    await Config.updateOne({ _id: "fila_ingestao_falhas" }, { $push: { valor: { ...item, erro: (e as Error).message.slice(0, 300), em: new Date() } } }, { upsert: true });
    throw e;
  }
  await Config.updateOne({ _id: "fila_ingestao" }, { $set: { valor: fila.slice(1), em: new Date() } });
  return `"${item.nome}" ingerida; ${fila.length - 1} na fila`;
}

export async function etapaClassificacao(): Promise<string | null> {
  const r = await classificarBanco({ ia: true, gravar: true });
  if (!r.total) return null;
  return `${r.gravadas} de ${r.total} questões com subtópico; ${r.ambiguas} ambígua(s); modelo falhou ${r.iaFalhou}`;
}

export async function etapaDerivacao(questoes: number): Promise<string | null> {
  const r = await derivarCE({ questoes });
  if (!r.itens) return null;
  return `${r.aprovados}/${r.itens} itens C/E aprovados de ${r.questoes} questão(ões)`;
}

// fichas na ORDEM da trilha, a partir do tema do dia do dono (sempre um tema à frente); tema com ficha
// tentada nos últimos 3 dias espera (não repete a mesma recusa toda noite)
export async function proximosTemasSemFicha(inicio: string | null, n: number): Promise<string[]> {
  const i = Math.max(0, inicio ? TRILHA.findIndex((t) => t.subtopico === inicio) : 0);
  const ordem = [...TRILHA.slice(i), ...TRILHA.slice(0, i)].map((t) => t.subtopico);
  const recentes = new Set(await Ficha.distinct("subtopico", { createdAt: { $gte: new Date(Date.now() - 3 * 86_400_000) } }));
  const saida: string[] = [];
  for (const s of ordem) {
    if (saida.length >= n) break;
    if (recentes.has(s) || (await fichaAprovada(s))) continue;
    saida.push(s);
  }
  return saida;
}
export async function etapaFichas(inicio: string | null, n: number): Promise<string | null> {
  const alvo = await proximosTemasSemFicha(inicio, n);
  if (!alvo.length) return null;
  const res: string[] = [];
  for (const s of alvo) {
    const r = await gerarFicha(s, () => undefined);
    res.push(`${s}: ${r.status}${r.motivos.length ? ` (${r.motivos[0].slice(0, 80)})` : ""}`);
  }
  return res.join("; ");
}
