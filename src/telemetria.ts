// ============================================================
// BB Estudos — Telemetria por modelo (uma linha por chamada, sem texto nem chave)
// Chamadas, sucesso, falhas por tipo (429, 5xx, timeout, formato, permanente), latência
// mediana e p95, uso como reserva. Registra só números: nada de texto nem de chave.
// ============================================================
import OpenAI from "openai";
import mongoose from "mongoose";
import { ChamadaModelo, TIPOS_FALHA } from "./models.js";
import { familiaDe } from "./catalogo.js";

export type TipoFalha = (typeof TIPOS_FALHA)[number];

// Recuperável (429, 5xx, timeout): espera e tenta de novo ou passa para a reserva.
// Permanente (id inválido, descontinuado, sem acesso): o modelo sai da corrente nesta execução.
export function classificarErro(e: unknown): { falha: TipoFalha; http?: number; recuperavel: boolean } {
  if (e instanceof OpenAI.APIConnectionTimeoutError || e instanceof OpenAI.APIConnectionError) return { falha: "timeout", recuperavel: true };
  if (e instanceof OpenAI.APIError && typeof e.status === "number") {
    const s = e.status;
    if (s === 429) return { falha: "429", http: s, recuperavel: true };
    if (s >= 500) return { falha: "5xx", http: s, recuperavel: true };
    if ([401, 403, 404, 410].includes(s)) return { falha: "permanente", http: s, recuperavel: false };
    if (s === 400 && /model|deprecat|not found|does not exist|unknown/i.test(e.message)) return { falha: "permanente", http: s, recuperavel: false };
    return { falha: "outro", http: s, recuperavel: false };
  }
  return { falha: "outro", recuperavel: false };
}

// Grava sem atrasar a chamada; a CLI espera as pendentes antes de desconectar
const pendentes = new Set<Promise<unknown>>();
export function registrarChamada(r: { modelo: string; funcao?: string; ok: boolean; falha?: TipoFalha; http?: number; ms: number; reserva?: boolean }) {
  if (mongoose.connection.readyState !== 1) return;
  const p: Promise<unknown> = ChamadaModelo.create({ ...r, familia: familiaDe(r.modelo) })
    .catch(() => undefined)
    .finally(() => pendentes.delete(p));
  pendentes.add(p);
}
export const telemetriaPendente = () => Promise.all([...pendentes]);

export function percentil(xs: number[], p: number): number {
  if (!xs.length) return 0;
  const o = [...xs].sort((a, b) => a - b);
  return o[Math.min(o.length - 1, Math.max(0, Math.ceil((p / 100) * o.length) - 1))];
}

export interface EstatisticaModelo {
  modelo: string;
  familia: string;
  chamadas: number;
  sucessos: number; // HTTP ok e JSON válido
  taxa: number; // sucessos / chamadas
  falhas: Record<TipoFalha, number>;
  medianaMs: number;
  p95Ms: number;
  comoReserva: number;
  ultimaResposta?: string; // ISO
  ultimaFalha?: string;
}

type Linha = { modelo: string; ok: boolean; falha?: string | null; ms?: number | null; reserva?: boolean | null; em: Date };

// Agrega as linhas de chamada (puro, para testes). "formato" chega como uma linha extra de
// falha depois de um HTTP ok: desconta do sucesso, sem contar a chamada duas vezes.
export function agregar(linhas: Linha[]): EstatisticaModelo[] {
  const por = new Map<string, Linha[]>();
  for (const l of linhas) por.set(l.modelo, [...(por.get(l.modelo) ?? []), l]);
  return [...por.entries()]
    .map(([modelo, ls]) => {
      const falhas = Object.fromEntries(TIPOS_FALHA.map((t) => [t, 0])) as Record<TipoFalha, number>;
      for (const l of ls) if (!l.ok && l.falha) falhas[l.falha as TipoFalha]++;
      const http = ls.filter((l) => l.falha !== "formato");
      const okHttp = http.filter((l) => l.ok);
      const sucessos = Math.max(0, okHttp.length - falhas.formato);
      const ultimo = (xs: Linha[]) => (xs.length ? new Date(Math.max(...xs.map((l) => +l.em))).toISOString() : undefined);
      const ms = okHttp.map((l) => l.ms ?? 0);
      return {
        modelo,
        familia: familiaDe(modelo),
        chamadas: http.length,
        sucessos,
        taxa: http.length ? sucessos / http.length : 0,
        falhas,
        medianaMs: percentil(ms, 50),
        p95Ms: percentil(ms, 95),
        comoReserva: okHttp.filter((l) => l.reserva).length,
        ultimaResposta: ultimo(okHttp),
        ultimaFalha: ultimo(ls.filter((l) => !l.ok)),
      };
    })
    .sort((a, b) => b.chamadas - a.chamadas);
}

export async function estatisticasModelos(horas: number): Promise<EstatisticaModelo[]> {
  const linhas = await ChamadaModelo.find({ em: { $gte: new Date(Date.now() - horas * 3_600_000) } })
    .select("modelo ok falha ms reserva em")
    .lean();
  return agregar(linhas);
}

// Quem atendeu cada função hoje (chamadas bem-sucedidas desde a meia-noite)
export async function atendeuHoje(): Promise<Record<string, { modelo: string; n: number }[]>> {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const g = await ChamadaModelo.aggregate<{ _id: { f: string; m: string }; n: number }>([
    { $match: { em: { $gte: hoje }, ok: true, funcao: { $exists: true } } },
    { $group: { _id: { f: "$funcao", m: "$modelo" }, n: { $sum: 1 } } },
    { $sort: { n: -1 } },
  ]);
  const saida: Record<string, { modelo: string; n: number }[]> = {};
  for (const x of g) (saida[x._id.f] ??= []).push({ modelo: x._id.m, n: x.n });
  return saida;
}
