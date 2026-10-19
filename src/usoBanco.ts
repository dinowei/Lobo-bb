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
const mb2 = (n: number) => Math.round(n * 100) / 100;

// Calibração informada pelo dono no Atlas (Project 0 → Overview → Cluster0), em 18/10/2026.
// Na mesma coleta, dbStats marcava 31,6 MB de dados + 2,3 MB de índices (57,6 MB em disco) e havia
// 847 chunks; o restante cobre índice vetorial, oplog e outros bytes que dbStats não mostra. O vetor
// float32 ocupa 8 KiB; +20% estima
// metadados do índice ANN por chunk. Atualize a referência se o Atlas mostrar uma nova medida.
export const ATLAS_REFERENCIA_MB = 165.05;
const ATLAS_REFERENCIA_DB_MB = 33.9;
const ATLAS_REFERENCIA_CHUNKS = 847;
const ATLAS_REFERENCIA_DIM = 2048;
const OVERHEAD_INDICE_VETORIAL = 1.2;
const dimensoesVetor = () => Math.max(1, Number(process.env.EMBED_DIM) || ATLAS_REFERENCIA_DIM);
const bytesPorVetor = (dim: number) => Math.ceil(dim * 4 * OVERHEAD_INDICE_VETORIAL);

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
  const db = mongoose.connection.db!;
  const [s, chunkRows] = await Promise.all([
    db.stats(),
    db.collection("chunks").aggregate<{ storageStats: { count: number; totalIndexSize: number; avgObjSize?: number } }>([{ $collStats: { storageStats: {} } }]).toArray().catch(() => []),
  ]);
  const chunkStats = chunkRows[0]?.storageStats;
  const chunks = chunkStats?.count ?? await db.collection("chunks").estimatedDocumentCount().catch(() => 0);
  const dim = dimensoesVetor();
  const vetorBytes = bytesPorVetor(dim);
  const indiceVetorBytes = chunks * vetorBytes;
  const indiceVetorMB = indiceVetorBytes / MB;
  const indiceBaseMB = (ATLAS_REFERENCIA_CHUNKS * bytesPorVetor(ATLAS_REFERENCIA_DIM)) / MB;
  const externoBaseMB = Math.max(0, ATLAS_REFERENCIA_MB - ATLAS_REFERENCIA_DB_MB - indiceBaseMB);
  const dadosMB = (s.dataSize ?? 0) / MB;
  const discoMB = (s.storageSize ?? 0) / MB;
  const indicesMB = (s.indexSize ?? 0) / MB;
  // O Data Size cresce com os bytes lógicos gravados; `storageSize` permanece como diagnóstico,
  // pois espaço pré-alocado do WiredTiger não representa crescimento por chunk.
  const nativoMB = dadosMB + indicesMB;
  const usadoMB = mb2(Math.max(ATLAS_REFERENCIA_MB, nativoMB + externoBaseMB + indiceVetorMB));
  const mediaChunkKB = (chunkStats?.avgObjSize ?? 0) / 1024;
  const indiceBtreePorChunkKB = chunks ? (chunkStats?.totalIndexSize ?? 0) / chunks / 1024 : 0;
  const vetorKBPorChunk = Math.round((vetorBytes / 1024) * 10) / 10;
  const crescimentoKBPorChunk = Math.round((mediaChunkKB + indiceBtreePorChunkKB + vetorKBPorChunk) * 10) / 10;
  const crescimentoMBPorChunk = crescimentoKBPorChunk / 1024;
  const novosChunksAteAlerta = crescimentoMBPorChunk > 0 ? Math.max(0, Math.floor((LIMITE_ATLAS_MB * ALERTA_USO - usadoMB) / crescimentoMBPorChunk)) : 0;
  const novosChunksAteLimite = crescimentoMBPorChunk > 0 ? Math.max(0, Math.floor((LIMITE_ATLAS_MB - usadoMB) / crescimentoMBPorChunk)) : 0;
  const fracao = usadoMB / LIMITE_ATLAS_MB;
  return {
    usadoMB,
    limiteMB: LIMITE_ATLAS_MB,
    fracao,
    alerta: fracao >= ALERTA_USO,
    dadosMB: mb(s.dataSize ?? 0),
    indicesMB: mb(s.indexSize ?? 0),
    discoMB: mb(s.storageSize ?? 0),
    atlasReferenciaMB: ATLAS_REFERENCIA_MB,
    chunks,
    dimensoesVetor: dim,
    indiceVetorMB: mb2(indiceVetorMB),
    vetorKBPorChunk,
    crescimentoKBPorChunk,
    novosChunksAteAlerta,
    novosChunksAteLimite,
  };
}
export const alertaDoBanco = (u: Pick<UsoBancoDTO, "alerta" | "fracao" | "usadoMB" | "limiteMB"> & Partial<Pick<UsoBancoDTO, "atlasReferenciaMB" | "indiceVetorMB" | "chunks" | "dimensoesVetor">>) =>
  u.alerta
    ? `Banco em ${Math.round(u.fracao * 100)}% do limite do Atlas grátis (${u.usadoMB} de ${u.limiteMB} MB; referência Atlas ${u.atlasReferenciaMB ?? "—"} MB; índice vetorial estimado ${u.indiceVetorMB ?? "—"} MB para ${u.chunks ?? "—"} chunks de ${u.dimensoesVetor ?? "—"} dimensões). Veja "npm run bb -- uso-banco".`
    : null;

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
