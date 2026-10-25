// ============================================================
// API do MODO SERVIDOR — conversa com o Express (src/server.ts)
// ============================================================
import type { Api } from "../../../shared/tipos";
import { EVENTO_SESSAO } from "./conta";
import { concursoAtivo } from "../concursoAtivo";

const BASE = import.meta.env.VITE_API_URL ?? "";

async function req<T>(caminho: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${BASE}/api${caminho}`, {
    ...init,
    headers: { "Content-Type": "application/json", "X-Concurso": concursoAtivo(), ...(init?.headers ?? {}) },
  });
  if (!r.ok) {
    const corpo = (await r.json().catch(() => ({}))) as { erro?: string; codigo?: string };
    if (r.status === 401 && corpo.codigo === "sessao_expirada") window.dispatchEvent(new Event(EVENTO_SESSAO));
    throw new Error(corpo.erro ?? `Erro ${r.status} em ${caminho}`);
  }
  return r.status === 204 ? (undefined as T) : r.json();
}
const post = <T,>(caminho: string, corpo: unknown) => req<T>(caminho, { method: "POST", body: JSON.stringify(corpo) });

// ---------- respostas offline: ficam na fila e vão sozinhas quando a conexão volta ----------
const CHAVE_FILA = "lobo-fila-offline";
export class RespostaGuardada extends Error {
  constructor() { super("Sem conexão: resposta guardada. Ela é enviada sozinha quando a internet voltar."); }
}
const semRede = (e: unknown) => !navigator.onLine || e instanceof TypeError; // fetch sem rede dá TypeError
const lerFila = (): unknown[] => { try { return JSON.parse(localStorage.getItem(CHAVE_FILA) ?? "[]"); } catch { return []; } };
const gravarFila = (f: unknown[]) => { try { localStorage.setItem(CHAVE_FILA, JSON.stringify(f)); } catch { /* sem armazenamento: perde só a fila */ } };
export const respostasNaFila = () => lerFila().length;
let enviando = false;
export async function enviarFilaOffline() {
  if (enviando || !navigator.onLine) return;
  enviando = true;
  try {
    let fila = lerFila();
    while (fila.length) {
      try {
        await post("/responder", fila[0]);
      } catch (e) {
        if (semRede(e)) break; // caiu de novo: tenta na próxima volta da rede
        // erro do servidor (questão removida etc.): descarta para não travar a fila
      }
      fila = lerFila().slice(1);
      gravarFila(fila);
    }
  } finally {
    enviando = false;
  }
}
if (typeof window !== "undefined") {
  window.addEventListener("online", () => void enviarFilaOffline());
  setTimeout(() => void enviarFilaOffline(), 3000);
}

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
    if (f.subtopico) p.set("subtopico", f.subtopico);
    if (f.excluir?.length) p.set("excluir", f.excluir.slice(-60).join(","));
    return req(`/proxima?${p}`);
  },
  desempenhoTemas: () => req("/temas/desempenho"),
  simulados: () => req("/simulados"),
  concursos: () => req("/concursos"),
  proximoItemCE: (f) => {
    const p = new URLSearchParams();
    if (f.subtopico) p.set("subtopico", f.subtopico);
    if (f.disciplina) p.set("disciplina", f.disciplina);
    if (f.excluir?.length) p.set("excluir", f.excluir.slice(-60).join(","));
    return req(`/ce/proximo?${p}`);
  },
  responderItemCE: (r) => post("/ce/responder", r),
  definirTemaDoDia: (subtopico) => post("/trilha/inicio", { subtopico }),
  trilha: () => req("/trilha"),
  tema: (subtopico) => req(`/tema/${encodeURIComponent(subtopico)}`),
  pedirPrioridadeTema: (subtopico) => post(`/tema/${encodeURIComponent(subtopico)}/prioridade`, {}),
  responder: async (r) => {
    try {
      return await post("/responder", r);
    } catch (e) {
      if (!semRede(e)) throw e;
      gravarFila([...lerFila(), r]);
      throw new RespostaGuardada();
    }
  },
  aula: (topicoId) => req(`/aula/${encodeURIComponent(topicoId)}`),
  explicarMais: (questaoId, duvida) => post("/explicar-mais", { questaoId, duvida }),
  perguntarBinho: (topicoId, pergunta) => post("/binho/perguntar", { topicoId, pergunta }),
  motivoErro: (questaoId, motivo) => post("/motivo-erro", { questaoId, motivo }),
  cartoes: () => req("/cartoes"),
  avaliarCartao: (id, nota) => post(`/cartoes/${encodeURIComponent(id)}`, { nota }),
  simulado: (n, opcoes) => req(`/simulado?n=${n}${opcoes?.diagnostico ? "&diagnostico=1" : ""}`),
  corrigirSimulado: (respostas, opcoes) => post("/simulado/corrigir", { respostas, diagnostico: !!opcoes?.diagnostico }),
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
