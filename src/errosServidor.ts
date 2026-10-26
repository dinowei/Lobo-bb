// ============================================================
// Erros do servidor (fechamento v1.0): log estruturado em uma linha JSON, SEM dados sensíveis, e os últimos 50
// guardados para a tela Admin → Erros (coleção limitada: o Mongo descarta os mais antigos sozinho).
// ============================================================
import { ErroServidor } from "./models.js";

// tira o que nunca pode ir para log: URI de banco, e-mail, token/chave, cabeçalho de autorização, query string
export function sanitizarErro(texto: string): string {
  return texto
    .replace(/mongodb(\+srv)?:\/\/[^\s"']+/gi, "mongodb://[oculto]")
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, "$1 [oculto]")
    .replace(/\bnvapi-[A-Za-z0-9_-]+/g, "nvapi-[oculto]")
    .replace(/\b(sk|pk|rk)-[A-Za-z0-9_-]{8,}/g, "$1-[oculto]")
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[e-mail]")
    .replace(/((?:senha|password|token|secret|apikey|api_key|key)["']?\s*[:=]\s*["']?)[^\s"',}]+/gi, "$1[oculto]")
    .replace(/(https?:\/\/[^\s?"']+)\?[^\s"']*/gi, "$1?[oculto]")
    .replace(/\b[a-f0-9]{40,}\b/gi, "[hash]")
    .slice(0, 500);
}

export type RegistroErro = { em: string; metodo: string; rota: string; status: number; mensagem: string; origem: string };

export function registroDoErro(err: unknown, req: { method: string; path: string }, status = 500): RegistroErro {
  const e = err instanceof Error ? err : new Error(String(err));
  const origem = (e.stack ?? "").split("\n").slice(1).find((l) => l.includes("src") || l.includes("shared"))?.trim() ?? "";
  return { em: new Date().toISOString(), metodo: req.method, rota: req.path, status, mensagem: sanitizarErro(e.message), origem: sanitizarErro(origem) };
}

export async function guardarErro(r: RegistroErro) {
  console.error(JSON.stringify({ nivel: "erro", ...r }));
  try {
    await ErroServidor.create(r);
  } catch {
    /* sem banco: fica só no log */
  }
}

export async function ultimosErros(n = 50) {
  return ErroServidor.find().sort({ $natural: -1 }).limit(n).select("-_id -__v").lean();
}
