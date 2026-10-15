// ============================================================
// API do MODO SERVIDOR — conversa com o Express (src/server.ts)
// ============================================================
import type { Api } from "../../../shared/tipos";

const BASE = import.meta.env.VITE_API_URL ?? "";

async function req<T>(caminho: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${BASE}/api${caminho}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!r.ok) {
    const corpo = await r.json().catch(() => ({}));
    throw new Error((corpo as { erro?: string }).erro ?? `Erro ${r.status} em ${caminho}`);
  }
  return r.status === 204 ? (undefined as T) : r.json();
}
const post = <T,>(caminho: string, corpo: unknown) => req<T>(caminho, { method: "POST", body: JSON.stringify(corpo) });

export const apiHttp: Api = {
  modo: "servidor",
  topicos: () => req("/topicos"),
  painel: () => req("/painel"),
  proxima: (f) => {
    const p = new URLSearchParams();
    if (f.topicoId) p.set("topicoId", f.topicoId);
    if (f.disciplina) p.set("disciplina", f.disciplina);
    if (f.questaoId) p.set("questaoId", f.questaoId);
    if (f.revisao) p.set("revisao", "1");
    return req(`/proxima?${p}`);
  },
  responder: (r) => post("/responder", r),
  simulado: (n) => req(`/simulado?n=${n}`),
  corrigirSimulado: (respostas) => post("/simulado/corrigir", { respostas }),
  erros: () => req("/erros"),
  contestar: (questaoId, motivo, comentario) => post("/contestar", { questaoId, motivo, comentario }),
};

// O servidor está de pé? (no site publicado sem backend, cai no modo demo)
export async function servidorDisponivel(): Promise<boolean> {
  if (import.meta.env.MODE === "demo") return false;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1500);
    const r = await fetch(`${BASE}/api/saude`, { signal: ctrl.signal });
    clearTimeout(t);
    return r.ok && (await r.json()).ok === true;
  } catch {
    return false;
  }
}
