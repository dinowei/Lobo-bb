// ============================================================
// API do MODO SERVIDOR — conversa com o Express (src/server.ts)
// ============================================================
import type { Api } from "../../../shared/tipos";
import { EVENTO_SESSAO } from "./conta";

const BASE = import.meta.env.VITE_API_URL ?? "";

async function req<T>(caminho: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${BASE}/api${caminho}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!r.ok) {
    const corpo = (await r.json().catch(() => ({}))) as { erro?: string; codigo?: string };
    if (r.status === 401 && corpo.codigo === "sessao_expirada") window.dispatchEvent(new Event(EVENTO_SESSAO));
    throw new Error(corpo.erro ?? `Erro ${r.status} em ${caminho}`);
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
    if (f.misto) p.set("misto", "1");
    if (f.anterior) p.set("anterior", f.anterior);
    return req(`/proxima?${p}`);
  },
  responder: (r) => post("/responder", r),
  aula: (topicoId) => req(`/aula/${encodeURIComponent(topicoId)}`),
  explicarMais: (questaoId, duvida) => post("/explicar-mais", { questaoId, duvida }),
  motivoErro: (questaoId, motivo) => post("/motivo-erro", { questaoId, motivo }),
  simulado: (n) => req(`/simulado?n=${n}`),
  corrigirSimulado: (respostas) => post("/simulado/corrigir", { respostas }),
  misturaSimulado: () => req("/simulado/mistura"),
  erros: () => req("/erros"),
  contestar: (questaoId, motivo, comentario) => post("/contestar", { questaoId, motivo, comentario }),
  temasRedacao: () => req("/redacao/temas"),
  pedirTemaRedacao: () => post("/redacao/tema", {}),
  corrigirRedacao: (r) => post("/redacoes/corrigir", r),
  redacoes: () => req("/redacoes"),
  marcarRedacoesVistas: () => post("/redacoes/vistas", {}),
};

// O servidor está de pé? (no site publicado sem backend, cai no modo demo)
// Espera até 5 s e tenta 2 vezes: rede lenta ou servidor ocupado não pode jogar o site no modo demo
export async function servidorDisponivel(): Promise<boolean> {
  if (import.meta.env.MODE === "demo") return false;
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 5000);
      const r = await fetch(`${BASE}/api/saude`, { signal: ctrl.signal });
      clearTimeout(t);
      if (r.ok) return (await r.json()).ok === true;
      if (r.status === 404) return false; // site estático sem API: modo demo
    } catch {
      /* sem resposta: tenta mais uma vez */
    }
  }
  return false;
}
