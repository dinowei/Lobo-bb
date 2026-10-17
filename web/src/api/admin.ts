// API de conferência do dono (só no modo servidor): tela Figuras
import type { AmostraFiguraDTO, QuestaoComFigurasDTO, RegiaoPdf } from "../../../shared/tipos";

const BASE = import.meta.env.VITE_API_URL ?? "";

async function req<T>(caminho: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${BASE}/api/admin${caminho}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!r.ok) {
    const corpo = await r.json().catch(() => ({}));
    throw new Error((corpo as { erro?: string }).erro ?? `Erro ${r.status}`);
  }
  return r.json();
}

export const adminFiguras = {
  listar: () => req<QuestaoComFigurasDTO[]>("/figuras"),
  amostras: () => req<AmostraFiguraDTO[]>("/figuras/amostras"),
  contexto: (q: string, f: string) => req<{ png: string; regiao: RegiaoPdf; atual: RegiaoPdf }>(`/figuras/${q}/${f}/contexto`),
  ok: (q: string, f: string) => req<{ status: string }>(`/figuras/${q}/${f}`, { method: "POST", body: JSON.stringify({ acao: "ok" }) }),
  fora: (q: string, f: string) => req<{ status: string }>(`/figuras/${q}/${f}`, { method: "POST", body: JSON.stringify({ acao: "fora" }) }),
  recorte: (q: string, f: string, recorte: Omit<RegiaoPdf, "pagina">) =>
    req<{ status: string }>(`/figuras/${q}/${f}`, { method: "POST", body: JSON.stringify({ acao: "recorte", recorte }) }),
};
