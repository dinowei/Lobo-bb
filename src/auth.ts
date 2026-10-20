// ============================================================
// BB Estudos — Login (PLANO-MESTRE 5.7, PROMPT-VIAGEM etapa 4)
// Senha com scrypt (node:crypto), sessão em cookie httpOnly (no banco só o hash do token),
// cadastro só com convite de uso único, limite de tentativas por IP.
// Enquanto não existe nenhum usuário, o app segue no modo dono único (ALUNO_ID, sem tela de
// login): o login liga sozinho quando o dono roda "npm run bb -- criar-admin <email>".
// ============================================================
import { AsyncLocalStorage } from "node:async_hooks";
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";
import { User, Sessao, Convite, Attempt, ReviewState, Report } from "./models.js";

const scrypt = promisify(scryptCb) as (s: string, sal: Buffer, n: number) => Promise<Buffer>;

// ---------- senha ----------
export async function hashSenha(senha: string): Promise<string> {
  const sal = randomBytes(16);
  const h = await scrypt(senha.normalize("NFKC"), sal, 64);
  return `scrypt$${sal.toString("base64")}$${h.toString("base64")}`;
}
export async function conferirSenha(senha: string, guardada: string): Promise<boolean> {
  const [alg, sal, h] = guardada.split("$");
  if (alg !== "scrypt" || !sal || !h) return false;
  const esperado = Buffer.from(h, "base64");
  const obtido = await scrypt(senha.normalize("NFKC"), Buffer.from(sal, "base64"), esperado.length);
  return obtido.length === esperado.length && timingSafeEqual(obtido, esperado);
}

// ---------- contexto da requisição (quem está usando) ----------
export interface Usuario { id: Types.ObjectId; nome: string; email: string; papel: "admin" | "aluno" }
const contexto = new AsyncLocalStorage<{ usuario: Usuario | null }>();
const DONO = () => new Types.ObjectId(process.env.ALUNO_ID || "000000000000000000000001");
// userId de quem está usando; fora de requisição (CLI) ou no modo dono único, o ALUNO_ID
export const usuarioAtualId = () => contexto.getStore()?.usuario?.id ?? DONO();
export const usuarioAtual = () => contexto.getStore()?.usuario ?? null;
// roda fn como se fosse a requisição de "usuario" (testes e tarefas)
export const comUsuario = <T>(usuario: Usuario | null, fn: () => T) => contexto.run({ usuario }, fn);

// login liga quando existe o primeiro usuário (consulta guardada por 30 s)
let loginCache: { em: number; ativo: boolean } | null = null;
export async function loginAtivo(): Promise<boolean> {
  if (loginCache && Date.now() - loginCache.em < 30_000) return loginCache.ativo;
  const ativo = !!(await User.exists({}));
  loginCache = { em: Date.now(), ativo };
  return ativo;
}
export const esquecerModoLogin = () => (loginCache = null);

// ---------- sessão ----------
export const COOKIE = "lobo_sessao";
const DIA = 86_400_000;
const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

export async function criarSessao(userId: Types.ObjectId, lembrar: boolean) {
  const token = randomBytes(32).toString("base64url");
  const expiraEm = new Date(Date.now() + (lembrar ? 30 : 1) * DIA);
  await Sessao.create({ userId, tokenHash: hashToken(token), expiraEm });
  return { token, expiraEm, lembrar };
}

export const encerrarSessao = (token: string) => Sessao.deleteOne({ tokenHash: hashToken(token) });

export function lerCookie(req: Request, nome = COOKIE): string | undefined {
  for (const parte of (req.headers.cookie ?? "").split(";")) {
    const [k, ...v] = parte.trim().split("=");
    if (k === nome) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

export function gravarCookie(res: Response, req: Request, s: { token: string; expiraEm: Date; lembrar: boolean } | null) {
  const seguro = process.env.NODE_ENV === "production" || req.secure;
  const partes = [`${COOKIE}=${s ? encodeURIComponent(s.token) : ""}`, "Path=/", "HttpOnly", "SameSite=Lax"];
  if (seguro) partes.push("Secure");
  if (!s) partes.push("Max-Age=0");
  else if (s.lembrar) partes.push(`Max-Age=${Math.floor((+s.expiraEm - Date.now()) / 1000)}`);
  res.setHeader("Set-Cookie", partes.join("; "));
}

async function usuarioDaSessao(token?: string): Promise<Usuario | null> {
  if (!token) return null;
  const s = await Sessao.findOneAndUpdate({ tokenHash: hashToken(token), expiraEm: { $gt: new Date() } }, { ultimoUso: new Date() }).lean();
  if (!s) return null;
  const u = await User.findById(s.userId).select("nome email papel").lean();
  return u ? { id: u._id, nome: u.nome, email: u.email, papel: u.papel as Usuario["papel"] } : null;
}

// Middleware: identifica quem chama e barra quem não pode (rotas livres: saúde e login)
const LIVRES = ["/api/saude", "/api/auth/"];
export function autenticar() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const usuario = await usuarioDaSessao(lerCookie(req));
      // o roteamento do Express ignora maiúsculas: "/API/painel" cai na rota "/api/painel". A trava compara em
      // minúsculas, senão "/API/..." passava sem login (e caía no progresso do dono) e "/Api/admin" sem ser admin.
      const caminho = req.path.toLowerCase();
      if (caminho.startsWith("/api/") && !LIVRES.some((l) => caminho.startsWith(l)) && (await loginAtivo())) {
        if (!usuario) return res.status(401).json({ erro: "Sua sessão acabou. Entre de novo.", codigo: "sessao_expirada" });
        if (caminho.startsWith("/api/admin/") && usuario.papel !== "admin") return res.status(403).json({ erro: "Só o administrador acessa isto." });
      }
      contexto.run({ usuario }, () => next());
    } catch (e) {
      next(e);
    }
  };
}

// ---------- limite de tentativas de login: 10 a cada 15 min por IP ----------
const JANELA_MS = 15 * 60_000;
const MAX_TENTATIVAS = 10;
const tentativas = new Map<string, number[]>();
export function podeTentar(ip: string, agora = Date.now()): { ok: boolean; esperarMin: number } {
  const lista = (tentativas.get(ip) ?? []).filter((t) => agora - t < JANELA_MS);
  tentativas.set(ip, lista);
  if (lista.length < MAX_TENTATIVAS) return { ok: true, esperarMin: 0 };
  return { ok: false, esperarMin: Math.ceil((JANELA_MS - (agora - lista[0])) / 60_000) };
}
export const registrarTentativa = (ip: string, agora = Date.now()) => tentativas.set(ip, [...(tentativas.get(ip) ?? []), agora]);
export const limparTentativas = (ip: string) => tentativas.delete(ip);

// ---------- convites ----------
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem 0/O e 1/I: fácil de ditar
export async function criarConvite(criadoPor?: Types.ObjectId, dias = 7) {
  const bytes = randomBytes(8);
  const codigo = [...bytes].map((b) => ALFABETO[b % ALFABETO.length]).join("").replace(/(.{4})(.{4})/, "$1-$2");
  const expiraEm = new Date(Date.now() + dias * DIA);
  await Convite.create({ codigo, criadoPor, expiraEm });
  return { codigo, expiraEm };
}
export const normalizarConvite = (c: string) => c.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/(.{4})(.{4})/, "$1-$2");
export async function situacaoDoConvite(codigo: string): Promise<{ valido: boolean; motivo?: string }> {
  const c = await Convite.findOne({ codigo: normalizarConvite(codigo) }).lean();
  if (!c) return { valido: false, motivo: "Esse código não existe. Confira com quem te convidou." };
  if (c.usadoEm) return { valido: false, motivo: "Esse convite já foi usado." };
  if (c.canceladoEm) return { valido: false, motivo: "Esse convite foi cancelado. Peça um novo." };
  if (+c.expiraEm < Date.now()) return { valido: false, motivo: "Esse convite venceu. Peça um novo." };
  return { valido: true };
}

// Esqueci a senha (sem e-mail): senha provisória que o dono repassa; derruba as sessões abertas da conta.
// Usada pela CLI ("bb -- senha") e por Admin → Contas (mostrada uma única vez, nunca guardada em claro).
export async function gerarSenhaProvisoria(userId: Types.ObjectId) {
  const u = await User.findById(userId).select("_id email");
  if (!u) return null;
  const provisoria = `${randomBytes(6).toString("base64url")}-${randomBytes(3).toString("hex")}`;
  await User.updateOne({ _id: u._id }, { $set: { senhaHash: await hashSenha(provisoria) } });
  await Sessao.deleteMany({ userId: u._id });
  return { email: u.email, provisoria };
}

// ---------- migração: o progresso do modo dono único vai para a conta do admin ----------
// "colecoes" é injetável para o teste (coleções falsas em memória)
type Colecao = {
  updateMany: (filtro: { userId: Types.ObjectId }, mudanca: { $set: { userId: Types.ObjectId } }) => Promise<{ modifiedCount: number }>;
};
const COLECOES_DO_ALUNO = { Attempt, ReviewState, Report } as unknown as Record<string, Colecao>;
export async function migrarProgresso(de: Types.ObjectId, para: Types.ObjectId, colecoes: Record<string, Colecao> = COLECOES_DO_ALUNO) {
  const r: Record<string, number> = {};
  for (const [nome, col] of Object.entries(colecoes)) r[nome] = (await col.updateMany({ userId: de }, { $set: { userId: para } })).modifiedCount;
  return r;
}
export const donoAntigoId = DONO;
