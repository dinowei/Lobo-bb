// API de conferência do dono (só no modo servidor): tela Figuras
import type {
  AdminBenchmarkDTO,
  AdminFontesAtuaisDTO,
  AdminFilaDTO,
  AdminIADTO,
  AmostraFiguraDTO,
  PendenciaDTO,
  QuestaoComFigurasDTO,
  RegiaoPdf,
} from "../../../shared/tipos";
import { EVENTO_SESSAO } from "./conta";

const BASE = import.meta.env.VITE_API_URL ?? "";

async function req<T>(caminho: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${BASE}/api/admin${caminho}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!r.ok) {
    const corpo = (await r.json().catch(() => ({}))) as { erro?: string; codigo?: string };
    if (r.status === 401 && corpo.codigo === "sessao_expirada") window.dispatchEvent(new Event(EVENTO_SESSAO));
    throw new Error(corpo.erro ?? `Erro ${r.status}`);
  }
  return r.json();
}

// Tela Admin: abas IA, Fila, Benchmark e Pendências
export const adminTelas = {
  ia: () => req<AdminIADTO>("/ia"),
  fila: () => req<AdminFilaDTO>("/fila"),
  tentarDeNovo: (id: string) => req<{ ok: boolean }>(`/fila/${id}/tentar`, { method: "POST" }),
  benchmark: () => req<AdminBenchmarkDTO>("/benchmark"),
  aprovarCorrentes: (correntes: Record<string, string[]>) =>
    req<{ ok: boolean; avisos: string[] }>("/correntes/aprovar", { method: "POST", body: JSON.stringify({ correntes }) }),
  desfazerCorrentes: () => req<{ modo: string }>("/correntes/desfazer", { method: "POST" }),
  pendencias: () => req<PendenciaDTO[]>("/pendencias"),
  fontesAtuais: () => req<AdminFontesAtuaisDTO>("/fontes-atuais"),
  aprovarMudancas: (ids: string[]) => req<{ aprovadas: number }>("/fontes-atuais/aprovar", { method: "POST", body: JSON.stringify({ ids }) }),
  manterQuestoes: (ids: string[], motivo: string) => req<{ mantidas: number }>("/fontes-atuais/manter", { method: "POST", body: JSON.stringify({ ids, motivo }) }),
  doc: (nome: string) => req<{ nome: string; markdown: string }>(`/doc?nome=${encodeURIComponent(nome)}`),
};

export const adminFiguras = {
  listar: () => req<QuestaoComFigurasDTO[]>("/figuras"),
  amostras: () => req<AmostraFiguraDTO[]>("/figuras/amostras"),
  contexto: (q: string, f: string) => req<{ png: string; regiao: RegiaoPdf; atual: RegiaoPdf }>(`/figuras/${q}/${f}/contexto`),
  ok: (q: string, f: string) => req<{ status: string }>(`/figuras/${q}/${f}`, { method: "POST", body: JSON.stringify({ acao: "ok" }) }),
  fora: (q: string, f: string) => req<{ status: string }>(`/figuras/${q}/${f}`, { method: "POST", body: JSON.stringify({ acao: "fora" }) }),
  recorte: (q: string, f: string, recorte: Omit<RegiaoPdf, "pagina">) =>
    req<{ status: string }>(`/figuras/${q}/${f}`, { method: "POST", body: JSON.stringify({ acao: "recorte", recorte }) }),
};
