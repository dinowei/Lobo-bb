// API de conferência do dono (só no modo servidor): tela Figuras
import type {
  AdminBenchmarkDTO,
  AdminFontesAtuaisDTO,
  AdminFilaDTO,
  AdminIADTO,
  AmostraFiguraDTO,
  ConcursoInfoDTO,
  ContaDTO,
  ConviteDTO,
  PendenciaDTO,
  QuestaoComFigurasDTO,
  RegiaoPdf,
  RegistroConcursoDTO,
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
  // Convites e Contas (só admin logado)
  convites: () => req<ConviteDTO[]>("/convites"),
  gerarConvite: (dias: 7 | 30) => req<{ codigo: string; expiraEm: string }>("/convites", { method: "POST", body: JSON.stringify({ dias }) }),
  cancelarConvite: (id: string) => req<{ cancelado: boolean }>(`/convites/${id}/cancelar`, { method: "POST" }),
  contas: () => req<ContaDTO[]>("/contas"),
  senhaProvisoria: (id: string) => req<{ provisoria: string }>(`/contas/${id}/senha`, { method: "POST" }),
  // Concursos: banca e área de cada um, com motivo e histórico
  concursos: () => req<ConcursosAdminDTO>("/concursos"),
  ajustarConcurso: (concurso: string, campo: "banca" | "area", para: string, motivo: string) =>
    req<ConcursosAdminDTO>("/concursos", { method: "POST", body: JSON.stringify({ concurso, campo, para, motivo }) }),
};
type ConcursosAdminDTO = { concursos: ConcursoInfoDTO[]; historico: RegistroConcursoDTO[] };

// Janelas (E8): A = noite, B = recuperação (horário e teto configuráveis)
export type JanelasDTO = {
  config: { janelaB: { inicio: string; fim: string; tetoChamadas: number } };
  noitesSeguidasOk?: number; // 28/10: "noites seguidas OK: N/5"
  relatorios: { lote: string; inicio: string; fim: string; janela: "A" | "B"; aprovadas: number | null; etapas: { etapa: string; status: "ok" | "pulada" | "falhou"; detalhe: string }[] }[];
};
export const adminJanelas = {
  ler: () => req<JanelasDTO>("/janelas"),
  salvar: (c: JanelasDTO["config"]["janelaB"]) => req<JanelasDTO>("/janelas", { method: "POST", body: JSON.stringify(c) }),
};

// Cobertura da trilha (esteira de conteúdo): meta por tema e o tema em que a esteira trabalha
export type CoberturaDTO = {
  nHoje: number | null;
  resumo: { concurso: string; total: number; prontos: number; faltando: number; bloqueados: number }[];
  temas: { n: number; subtopico: string; nome: string; concursos: string[]; aprovadas: number; novas: number; ficha: boolean; audioFicha: boolean; bloqueios: string[]; situacao: "pronto" | "faltando" | "bloqueado"; faltas: string[] }[];
  proximo: { n: number; subtopico: string; nome: string; faltas: string[] } | null;
};
export const adminCobertura = { ler: () => req<CoberturaDTO>("/cobertura") };

// Erros do servidor (fechamento v1.0): os últimos 50, sem dados sensíveis
export type ErroServidorDTO = { em: string; metodo: string; rota: string; status: number; mensagem: string; origem: string };
export const adminErros = { ler: () => req<ErroServidorDTO[]>("/erros") };

export const adminFiguras = {
  listar: () => req<QuestaoComFigurasDTO[]>("/figuras"),
  amostras: () => req<AmostraFiguraDTO[]>("/figuras/amostras"),
  contexto: (q: string, f: string) => req<{ png: string; regiao: RegiaoPdf; atual: RegiaoPdf }>(`/figuras/${q}/${f}/contexto`),
  ok: (q: string, f: string) => req<{ status: string }>(`/figuras/${q}/${f}`, { method: "POST", body: JSON.stringify({ acao: "ok" }) }),
  fora: (q: string, f: string) => req<{ status: string }>(`/figuras/${q}/${f}`, { method: "POST", body: JSON.stringify({ acao: "fora" }) }),
  recorte: (q: string, f: string, recorte: Omit<RegiaoPdf, "pagina">) =>
    req<{ status: string }>(`/figuras/${q}/${f}`, { method: "POST", body: JSON.stringify({ acao: "recorte", recorte }) }),
};
