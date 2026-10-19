// ============================================================
// BB Estudos — espaço no Atlas grátis (512 MB): quanto cada coleção ocupa e a projeção para o banco cheio.
// Só LÊ estatísticas do banco ($collStats / dbStats); nada é gravado aqui.
// ============================================================
import mongoose from "mongoose";
import type { UsoBancoDTO } from "../shared/tipos.js";
import { TTL_TELEMETRIA_SEG } from "./models.js";

export const LIMITE_ATLAS_MB = Number(process.env.ATLAS_LIMITE_MB) || 512;
export const ALERTA_USO = 0.8;
const MB = 1_048_576;
const mb = (b: number) => Math.round((b / MB) * 10) / 10;

export interface ColecaoUso { nome: string; docs: number; dadosMB: number; discoMB: number; indicesMB: number; mediaKB: number }

export async function medirColecoes(): Promise<ColecaoUso[]> {
  const db = mongoose.connection.db!;
  const nomes = (await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name).filter((n) => !n.startsWith("system."));
  const linhas: ColecaoUso[] = [];
  for (const nome of nomes) {
    try {
      const [s] = await db.collection(nome).aggregate<{ storageStats: { count: number; size: number; storageSize: number; totalIndexSize: number; avgObjSize?: number } }>([{ $collStats: { storageStats: {} } }]).toArray();
      const st = s.storageStats;
      linhas.push({ nome, docs: st.count, dadosMB: mb(st.size), discoMB: mb(st.storageSize), indicesMB: mb(st.totalIndexSize), mediaKB: Math.round(((st.avgObjSize ?? 0) / 1024) * 10) / 10 });
    } catch {
      linhas.push({ nome, docs: await db.collection(nome).estimatedDocumentCount(), dadosMB: 0, discoMB: 0, indicesMB: 0, mediaKB: 0 });
    }
  }
  return linhas.sort((a, b) => b.dadosMB + b.indicesMB - (a.dadosMB + a.indicesMB));
}

// Outros bancos no mesmo cluster também ocupam a cota do M0 (ex.: o sample_mflix de exemplo do Atlas)
export async function bancosDoCluster() {
  try {
    const r = await mongoose.connection.db!.admin().listDatabases();
    const client = mongoose.connection.getClient();
    const linhas: { nome: string; dadosMB: number; indicesMB: number; app: boolean }[] = [];
    for (const d of r.databases) {
      if (["admin", "local", "config"].includes(d.name)) continue;
      const s = await client.db(d.name).stats().catch(() => null);
      linhas.push({ nome: d.name, dadosMB: mb(s?.dataSize ?? 0), indicesMB: mb(s?.indexSize ?? 0), app: d.name === mongoose.connection.db!.databaseName });
    }
    return linhas;
  } catch {
    return null; // usuário sem permissão de listar bancos
  }
}

// Conservador: o maior entre dados + índices e disco + índices (o disco inclui espaço de documentos
// apagados que o WiredTiger ainda não devolveu). Medido em 18/10/2026: 33,9 MB e 59,9 MB.
export async function usoBanco(): Promise<UsoBancoDTO> {
  const s = await mongoose.connection.db!.stats();
  const usadoMB = mb(Math.max(s.dataSize ?? 0, s.storageSize ?? 0) + (s.indexSize ?? 0));
  return { usadoMB, limiteMB: LIMITE_ATLAS_MB, fracao: usadoMB / LIMITE_ATLAS_MB, alerta: usadoMB / LIMITE_ATLAS_MB >= ALERTA_USO, dadosMB: mb(s.dataSize ?? 0), indicesMB: mb(s.indexSize ?? 0), discoMB: mb(s.storageSize ?? 0) };
}
export const alertaDoBanco = (u: UsoBancoDTO) =>
  u.alerta ? `Banco em ${Math.round(u.fracao * 100)}% do limite do Atlas grátis (${u.usadoMB} de ${u.limiteMB} MB). Veja "npm run bb -- uso-banco".` : null;

// Telemetria some em 30 dias. Índice TTL que já existia (35 dias) não muda sozinho: collMod ajusta no lugar.
export async function ajustarTTLTelemetria() {
  const db = mongoose.connection.db!;
  const idx = (await db.collection("chamadas_modelo").indexes()).find((i) => i.key?.em === 1 && Object.keys(i.key).length === 1);
  if (idx?.expireAfterSeconds === TTL_TELEMETRIA_SEG) return false;
  if (!idx) {
    await db.collection("chamadas_modelo").createIndex({ em: 1 }, { expireAfterSeconds: TTL_TELEMETRIA_SEG });
    return true;
  }
  try {
    await db.command({ collMod: "chamadas_modelo", index: { keyPattern: { em: 1 }, expireAfterSeconds: TTL_TELEMETRIA_SEG } });
  } catch {
    // o usuário do Atlas (readWrite) não pode collMod: recria o índice TTL (só ele; nenhum dado é apagado aqui)
    await db.collection("chamadas_modelo").dropIndex(idx.name!);
    await db.collection("chamadas_modelo").createIndex({ em: 1 }, { expireAfterSeconds: TTL_TELEMETRIA_SEG });
  }
  return true;
}
