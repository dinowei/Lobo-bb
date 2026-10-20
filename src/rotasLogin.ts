// Rotas de login e da conta (PLANO-MESTRE 5.7): entrar, cadastrar com convite, sair, minha conta
import type { Express, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { User, Sessao, Convite } from "./models.js";
import {
  conferirSenha,
  criarSessao,
  encerrarSessao,
  lerCookie,
  esquecerModoLogin,
  gravarCookie,
  hashSenha,
  limparTentativas,
  loginAtivo,
  normalizarConvite,
  podeTentar,
  registrarTentativa,
  situacaoDoConvite,
  usuarioAtual,
} from "./auth.js";
import { forcaSenha, NOTA_MINIMA, emailValido, normalizarEmail } from "../shared/senha.js";

type Handler = (req: Request, res: Response) => Promise<unknown>;
const rota = (fn: Handler) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);
const ip = (req: Request) => req.ip ?? req.socket.remoteAddress ?? "?";

// erro com o campo, para a tela mostrar a mensagem no lugar certo
const falha = (res: Response, status: number, erro: string, campo?: string) => res.status(status).json({ erro, campo });

const EntrarZ = z.object({ email: z.string(), senha: z.string(), lembrar: z.boolean().optional() });
const CadastroZ = z.object({ nome: z.string(), email: z.string(), senha: z.string(), convite: z.string(), lembrar: z.boolean().optional() });

export function registrarRotasDeLogin(app: Express) {
  app.get(
    "/api/auth/eu",
    rota(async (_req, res) => {
      const u = usuarioAtual();
      res.json({ login: await loginAtivo(), usuario: u ? { nome: u.nome, email: u.email, papel: u.papel } : null });
    })
  );

  app.post(
    "/api/auth/entrar",
    rota(async (req, res) => {
      const lim = podeTentar(ip(req));
      if (!lim.ok) return falha(res, 429, `Muitas tentativas. Tente de novo em ${lim.esperarMin} min.`);
      const p = EntrarZ.safeParse(req.body);
      if (!p.success) return falha(res, 400, "Preencha e-mail e senha.");
      const email = normalizarEmail(p.data.email);
      if (!emailValido(email)) return falha(res, 400, "Esse e-mail não parece certo.", "email");
      if (!p.data.senha) return falha(res, 400, "Digite a senha.", "senha");
      registrarTentativa(ip(req));
      const u = await User.findOne({ email }).select("+senhaHash");
      // mesma mensagem para e-mail inexistente e senha errada (não revela quem tem conta)
      if (!u || !(await conferirSenha(p.data.senha, u.senhaHash))) return falha(res, 401, "E-mail ou senha não conferem.", "senha");
      limparTentativas(ip(req));
      u.ultimoLogin = new Date();
      await u.save();
      gravarCookie(res, req, await criarSessao(u._id, !!p.data.lembrar));
      res.json({ nome: u.nome, email: u.email, papel: u.papel });
    })
  );

  app.get(
    "/api/auth/convite/:codigo",
    rota(async (req, res) => {
      const lim = podeTentar(ip(req));
      if (!lim.ok) return falha(res, 429, `Muitas tentativas. Tente de novo em ${lim.esperarMin} min.`);
      const codigo = String(req.params.codigo);
      if (normalizarConvite(codigo).length < 9) return res.json({ valido: false, motivo: "O código tem 8 letras e números." });
      const s = await situacaoDoConvite(codigo);
      if (!s.valido) registrarTentativa(ip(req)); // chute de código conta como tentativa
      res.json(s);
    })
  );

  app.post(
    "/api/auth/cadastro",
    rota(async (req, res) => {
      const lim = podeTentar(ip(req));
      if (!lim.ok) return falha(res, 429, `Muitas tentativas. Tente de novo em ${lim.esperarMin} min.`);
      const p = CadastroZ.safeParse(req.body);
      if (!p.success) return falha(res, 400, "Preencha todos os campos.");
      const { nome, senha, lembrar } = p.data;
      const email = normalizarEmail(p.data.email);
      if (nome.trim().length < 2) return falha(res, 400, "Diga como quer ser chamado.", "nome");
      if (!emailValido(email)) return falha(res, 400, "Esse e-mail não parece certo.", "email");
      if (forcaSenha(senha).nota < NOTA_MINIMA) return falha(res, 400, forcaSenha(senha).dica ?? "Senha fraca demais.", "senha");
      const conv = await situacaoDoConvite(p.data.convite);
      if (!conv.valido) {
        registrarTentativa(ip(req));
        return falha(res, 400, conv.motivo ?? "Convite inválido.", "convite");
      }
      if (await User.exists({ email })) return falha(res, 409, "Já existe conta com esse e-mail. Tente entrar.", "email");
      // o convite é gasto antes de criar a conta (uso único, mesmo com dois cadastros ao mesmo tempo)
      const gasto = await Convite.findOneAndUpdate({ codigo: normalizarConvite(p.data.convite), usadoEm: null, canceladoEm: null, expiraEm: { $gt: new Date() } }, { usadoEm: new Date() });
      if (!gasto) return falha(res, 400, "Esse convite acabou de ser usado.", "convite");
      const u = await User.create({ nome: nome.trim(), email, senhaHash: await hashSenha(senha), papel: "aluno", ultimoLogin: new Date() });
      await Convite.updateOne({ _id: gasto._id }, { usadoPor: u._id });
      esquecerModoLogin();
      gravarCookie(res, req, await criarSessao(u._id, !!lembrar));
      res.status(201).json({ nome: u.nome, email: u.email, papel: u.papel });
    })
  );

  app.post(
    "/api/auth/sair",
    rota(async (req, res) => {
      const token = lerCookie(req);
      if (token) await encerrarSessao(token);
      gravarCookie(res, req, null);
      res.status(204).end();
    })
  );

  // ---------- Minha conta ----------
  app.patch(
    "/api/conta",
    rota(async (req, res) => {
      const u = usuarioAtual();
      if (!u) return falha(res, 401, "Entre para mudar sua conta.");
      const nome = String(req.body?.nome ?? "").trim();
      if (nome.length < 2) return falha(res, 400, "Diga como quer ser chamado.", "nome");
      await User.updateOne({ _id: u.id }, { nome });
      res.json({ nome });
    })
  );

  app.post(
    "/api/conta/senha",
    rota(async (req, res) => {
      const u = usuarioAtual();
      if (!u) return falha(res, 401, "Entre para trocar a senha.");
      const atual = String(req.body?.atual ?? "");
      const nova = String(req.body?.nova ?? "");
      const doc = await User.findById(u.id).select("+senhaHash");
      if (!doc || !(await conferirSenha(atual, doc.senhaHash))) return falha(res, 400, "A senha atual não confere.", "atual");
      if (forcaSenha(nova).nota < NOTA_MINIMA) return falha(res, 400, forcaSenha(nova).dica ?? "Senha fraca demais.", "nova");
      if (nova === atual) return falha(res, 400, "A nova senha precisa ser diferente da atual.", "nova");
      doc.senhaHash = await hashSenha(nova);
      await doc.save();
      res.status(204).end();
    })
  );

  // sai de todos os aparelhos (inclusive este: a tela volta para o login)
  app.post(
    "/api/conta/sair-de-todos",
    rota(async (req, res) => {
      const u = usuarioAtual();
      if (!u) return falha(res, 401, "Entre primeiro.");
      const r = await Sessao.deleteMany({ userId: u.id });
      gravarCookie(res, req, null);
      res.json({ sessoes: r.deletedCount });
    })
  );
}
