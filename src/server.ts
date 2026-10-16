// ============================================================
// BB Estudos — servidor HTTP (API + site)
// npm run dev → API em :3333 e site em :5173 (com proxy para a API)
// npm start   → tudo em :3333 (depois de "npm run build")
// ============================================================
import "./env.js"; // precisa ser o primeiro import
import express, { type NextFunction, type Request, type Response } from "express";
import mongoose, { Types } from "mongoose";
import { listarFiguras, decidirFigura, contextoDaFigura, type AcaoFigura } from "./admin.js";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { apiServidor } from "./estudo.js";
import { DISCIPLINAS, LETRAS, type Confianca, type Disciplina, type Letra, type Modo, type MotivoContestacao } from "../shared/tipos.js";

const app = express();
app.use(express.json({ limit: "1mb" }));

type Handler = (req: Request, res: Response) => Promise<unknown>;
const rota = (fn: Handler) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);
const texto = (v: unknown) => (typeof v === "string" && v ? v : undefined);
const ehLetra = (v: unknown): v is Letra => (LETRAS as readonly unknown[]).includes(v);

app.get("/api/saude", (_req, res) => {
  res.json({ ok: mongoose.connection.readyState === 1 });
});

app.get("/api/topicos", rota(async (_req, res) => res.json(await apiServidor.topicos())));
app.get("/api/painel", rota(async (_req, res) => res.json(await apiServidor.painel())));

app.get(
  "/api/proxima",
  rota(async (req, res) => {
    const disciplina = texto(req.query.disciplina);
    res.json(
      await apiServidor.proxima({
        topicoId: texto(req.query.topicoId),
        questaoId: texto(req.query.questaoId),
        disciplina: disciplina && (DISCIPLINAS as readonly string[]).includes(disciplina) ? (disciplina as Disciplina) : undefined,
        revisao: req.query.revisao === "1",
      })
    );
  })
);

app.post(
  "/api/responder",
  rota(async (req, res) => {
    const { questaoId, resposta, confianca, tempoSeg, modo } = req.body ?? {};
    if (!texto(questaoId) || !ehLetra(resposta) || ![1, 2, 3].includes(confianca))
      return res.status(400).json({ erro: "Envie questaoId, resposta (A–E) e confianca (1–3)." });
    res.json(
      await apiServidor.responder({
        questaoId,
        resposta,
        confianca: confianca as Confianca,
        tempoSeg: Number(tempoSeg) || 0,
        modo: (["treino", "revisao", "simulado"].includes(modo) ? modo : "treino") as Modo,
      })
    );
  })
);

app.get(
  "/api/simulado",
  rota(async (req, res) => res.json(await apiServidor.simulado(Math.min(120, Math.max(1, Number(req.query.n) || 20)))))
);

app.post(
  "/api/simulado/corrigir",
  rota(async (req, res) => {
    const respostas = Array.isArray(req.body?.respostas) ? req.body.respostas : null;
    if (!respostas) return res.status(400).json({ erro: "Envie { respostas: [...] }." });
    res.json(
      await apiServidor.corrigirSimulado(
        respostas.map((r: { questaoId: string; resposta: unknown; tempoSeg: unknown }) => ({
          questaoId: String(r.questaoId),
          resposta: ehLetra(r.resposta) ? r.resposta : null,
          tempoSeg: Number(r.tempoSeg) || 0,
        }))
      )
    );
  })
);

app.get("/api/erros", rota(async (_req, res) => res.json(await apiServidor.erros())));

app.post(
  "/api/contestar",
  rota(async (req, res) => {
    const motivos: MotivoContestacao[] = ["gabarito_errado", "duas_corretas", "desatualizada", "ambigua", "explicacao_ruim"];
    const { questaoId, motivo, comentario } = req.body ?? {};
    if (!texto(questaoId) || !motivos.includes(motivo)) return res.status(400).json({ erro: "Motivo inválido." });
    await apiServidor.contestar(questaoId, motivo, texto(comentario));
    res.status(204).end();
  })
);

// ---------- Conferência do dono (tela Figuras) ----------
app.get("/api/admin/figuras", rota(async (_req, res) => res.json(await listarFiguras())));

app.get(
  "/api/admin/figuras/:questaoId/:figuraId/contexto",
  rota(async (req, res) => {
    const qid = String(req.params.questaoId);
    const fid = String(req.params.figuraId);
    if (!Types.ObjectId.isValid(qid) || !Types.ObjectId.isValid(fid)) return res.status(400).json({ erro: "Id inválido." });
    res.json(await contextoDaFigura(qid, fid));
  })
);

app.post(
  "/api/admin/figuras/:questaoId/:figuraId",
  rota(async (req, res) => {
    const corpo = req.body ?? {};
    const num = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 2000;
    let acao: AcaoFigura;
    if (corpo.acao === "ok" || corpo.acao === "fora") acao = { acao: corpo.acao };
    else if (corpo.acao === "recorte" && ["x", "y", "w", "h"].every((k) => num(corpo.recorte?.[k])) && corpo.recorte.w > 5 && corpo.recorte.h > 5)
      acao = { acao: "recorte", recorte: { x: corpo.recorte.x, y: corpo.recorte.y, w: corpo.recorte.w, h: corpo.recorte.h } };
    else return res.status(400).json({ erro: 'Envie { acao: "ok" | "fora" } ou { acao: "recorte", recorte: { x, y, w, h } }.' });
    const qid = String(req.params.questaoId);
    const fid = String(req.params.figuraId);
    if (!Types.ObjectId.isValid(qid) || !Types.ObjectId.isValid(fid)) return res.status(400).json({ erro: "Id inválido." });
    res.json({ status: await decidirFigura(qid, fid, acao) });
  })
);

// site já compilado (npm run build)
const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const site = join(raiz, "web", "dist");
if (existsSync(site)) {
  app.use(express.static(site));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(join(site, "index.html")));
}

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ erro: err.message });
});

async function iniciar() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Faltou MONGODB_URI no .env");
  await mongoose.connect(uri);
  const porta = Number(process.env.PORT) || 3333;
  app.listen(porta, () => console.log(`✔ API em http://localhost:${porta}${existsSync(site) ? " (site incluído)" : ""}`));
}
iniciar().catch((e) => {
  console.error(`✖ ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
