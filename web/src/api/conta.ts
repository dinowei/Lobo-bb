// Login e "Minha conta" (só no modo servidor). Erro vem com o campo, para a tela mostrar no lugar certo.
const BASE = import.meta.env.VITE_API_URL ?? "";

export interface UsuarioDTO { nome: string; email: string; papel: "admin" | "aluno" }
export class ErroCampo extends Error {
  constructor(mensagem: string, readonly campo?: string, readonly status?: number) {
    super(mensagem);
  }
}

async function req<T>(caminho: string, init?: RequestInit): Promise<T> {
  let r: Response;
  try {
    r = await fetch(`${BASE}/api${caminho}`, { credentials: "same-origin", ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  } catch {
    throw new ErroCampo("Sem conexão com o servidor. Confira sua internet e tente de novo.");
  }
  if (!r.ok) {
    const c = (await r.json().catch(() => ({}))) as { erro?: string; campo?: string };
    throw new ErroCampo(c.erro ?? `Erro ${r.status}`, c.campo, r.status);
  }
  return r.status === 204 ? (undefined as T) : r.json();
}
const post = <T,>(caminho: string, corpo?: unknown) => req<T>(caminho, { method: "POST", body: corpo === undefined ? undefined : JSON.stringify(corpo) });

export const conta = {
  eu: () => req<{ login: boolean; usuario: UsuarioDTO | null }>("/auth/eu"),
  entrar: (d: { email: string; senha: string; lembrar: boolean }) => post<UsuarioDTO>("/auth/entrar", d),
  cadastrar: (d: { nome: string; email: string; senha: string; convite: string; lembrar: boolean }) => post<UsuarioDTO>("/auth/cadastro", d),
  convite: (codigo: string) => req<{ valido: boolean; motivo?: string }>(`/auth/convite/${encodeURIComponent(codigo)}`),
  sair: () => post<void>("/auth/sair"),
  mudarNome: (nome: string) => req<{ nome: string }>("/conta", { method: "PATCH", body: JSON.stringify({ nome }) }),
  mudarSenha: (atual: string, nova: string) => post<void>("/conta/senha", { atual, nova }),
  sairDeTodos: () => post<{ sessoes: number }>("/conta/sair-de-todos"),
};

// Sessão que acaba no meio do uso: o app mostra o login e, depois, volta para a mesma tela
export const EVENTO_SESSAO = "lobo:sessao-expirada";
