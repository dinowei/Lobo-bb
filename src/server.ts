// ============================================================
// BB Estudos — servidor HTTP (API + site)
// npm run dev → API em :3333 e site em :5173 (com proxy para a API)
// npm start   → tudo em :3333 (depois de "npm run build")
// ============================================================
import "./env.js"; // precisa ser o primeiro import
import express, { type NextFunction, type Request, type Response } from "express";
import mongoose, { Types } from "mongoose";
import helmet from "helmet";
import compression from "compression";
import { listarFiguras, decidirFigura, contextoDaFigura, amostrasDeFiguras, type AcaoFigura } from "./admin.js";
import { painelIA, painelFila, painelBenchmark, pendencias, lerDoc, DOCS_LIBERADOS } from "./adminTelas.js";
import { aprovarCorrentes, desfazerCorrentes } from "./corrente.js";
import { aprovarMudancas, manterQuestoes, relatorioFontesAtuais } from "./fontesAtuais.js";
import { audioDe, audioPronto, marcarOuvida, VOZES_PT, vozPadrao } from "./voz.js";
import { tentarDeNovoAgora } from "./noturno.js";
import { FUNCOES, type Correntes } from "./catalogo.js";
import { autenticar, usuarioAtualId } from "./auth.js";
import { registrarRotasDeLogin } from "./rotasLogin.js";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { apiServidor } from "./estudo.js";
import { DISCIPLINAS, LETRAS, MOTIVOS_ERRO, type Confianca, type Disciplina, type Letra, type Modo, type MotivoContestacao, type MotivoErro, type NotaCartao } from "../shared/tipos.js";

const app = express();
app.set("trust proxy", 1); // atrás do proxy do provedor: IP real no limite de tentativas e cookie Secure
app.disable("x-powered-by");
// cabeçalhos de segurança: o site só carrega o que é dele (+ fontes do Google, se usadas) e imagens data:
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", "data:"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        connectSrc: ["'self'"],
        mediaSrc: ["'self'", "blob:"], // áudio do Binho tocado a partir do MP3 baixado
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);
app.use(compression());
app.use(express.json({ limit: "1mb" }));
// quem está usando (sessão) e quem pode o quê; sem usuário cadastrado, modo dono único
app.use(autenticar());
registrarRotasDeLogin(app);

type Handler = (req: Request, res: Response) => Promise<unknown>;
const rota = (fn: Handler) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);
const texto = (v: unknown) => (typeof v === "string" && v ? v : undefined);
const ehLetra = (v: unknown): v is Letra => (LETRAS as readonly unknown[]).includes(v);

// health check do provedor: 503 enquanto o banco não está conectado
app.get("/api/saude", (_req, res) => {
  const ok = mongoose.connection.readyState === 1;
  res.status(ok ? 200 : 503).json({ ok });
});

app.get("/api/topicos", rota(async (_req, res) => res.json(await apiServidor.topicos())));
app.get("/api/painel", rota(async (_req, res) => res.json(await apiServidor.painel())));
app.get(
  "/api/aula/:topicoId",
  rota(async (req, res) => {
    const topicoId = String(req.params.topicoId);
    if (!Types.ObjectId.isValid(topicoId)) return res.status(400).json({ erro: "Tópico inválido." });
    res.json(await apiServidor.aula(topicoId));
  })
);
app.post(
  "/api/explicar-mais",
  rota(async (req, res) => {
    const { questaoId, duvida } = req.body ?? {};
    if (!texto(questaoId) || !Types.ObjectId.isValid(questaoId) || (duvida !== undefined && (typeof duvida !== "string" || duvida.length > 500)))
      return res.status(400).json({ erro: "Envie questaoId válido e uma dúvida de até 500 caracteres." });
    res.json(await apiServidor.explicarMais(questaoId, typeof duvida === "string" ? duvida : undefined));
  })
);
app.post(
  "/api/binho/perguntar",
  rota(async (req, res) => {
    const { topicoId, pergunta } = req.body ?? {};
    if (!texto(topicoId) || !Types.ObjectId.isValid(topicoId) || typeof pergunta !== "string" || pergunta.trim().length < 3 || pergunta.length > 500)
      return res.status(400).json({ erro: "Envie o tópico e uma pergunta de 3 a 500 caracteres." });
    res.json(await apiServidor.perguntarBinho(topicoId, pergunta));
  })
);

app.get(
  "/api/proxima",
  rota(async (req, res) => {
    const ehDisciplina = (v?: string): v is Disciplina => !!v && (DISCIPLINAS as readonly string[]).includes(v);
    const disciplina = texto(req.query.disciplina);
    const anterior = texto(req.query.anterior);
    res.json(
      await apiServidor.proxima({
        topicoId: texto(req.query.topicoId),
        questaoId: texto(req.query.questaoId),
        disciplina: ehDisciplina(disciplina) ? disciplina : undefined,
        revisao: req.query.revisao === "1",
        misto: req.query.misto === "1",
        anterior: ehDisciplina(anterior) ? anterior : undefined,
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

app.post(
  "/api/motivo-erro",
  rota(async (req, res) => {
    const { questaoId, motivo } = req.body ?? {};
    if (!texto(questaoId) || !(MOTIVOS_ERRO as readonly unknown[]).includes(motivo)) return res.status(400).json({ erro: "Envie questaoId e um motivo válido." });
    res.json(await apiServidor.motivoErro(questaoId, motivo as MotivoErro));
  })
);

// Voz do Binho: áudio pronto (pré-gerado de noite) ou, para o chat, gerado na hora dentro da cota.
// 204 = sem áudio agora: o site usa a voz do navegador (sempre com paraFala).
const usoVozHoje = new Map<string, { dia: string; n: number }>();
app.post(
  "/api/voz",
  rota(async (req, res) => {
    const texto = typeof req.body?.texto === "string" ? req.body.texto.slice(0, 4000) : "";
    if (!texto.trim()) return res.status(400).json({ erro: "Envie { texto }." });
    const pedida = VOZES_PT.find((v) => v.endsWith(`.${req.body?.voz}`));
    const voz = pedida ?? vozPadrao();
    let mp3 = await audioPronto(texto, voz);
    if (!mp3 && req.body?.naHora === true) {
      const quem = String(usuarioAtualId());
      const dia = new Date().toISOString().slice(0, 10);
      const uso = usoVozHoje.get(quem)?.dia === dia ? usoVozHoje.get(quem)! : { dia, n: 0 };
      if (uso.n < (Number(process.env.VOZ_NA_HORA_MAX_DIA) || 40)) {
        mp3 = (await audioDe(texto, voz))?.mp3 ?? null;
        if (mp3) usoVozHoje.set(quem, { dia, n: uso.n + 1 });
      }
    }
    if (!mp3) return res.status(204).end();
    void marcarOuvida(texto, voz).catch(() => undefined); // o teto de áudio tira primeiro os menos ouvidos
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "private, max-age=86400");
    res.end(mp3);
  })
);

app.get("/api/cartoes",rota(async (_req, res) => res.json(await apiServidor.cartoes())));
app.post(
  "/api/cartoes/:id",
  rota(async (req, res) => {
    const nota = Number(req.body?.nota);
    if (![1, 3, 4, 5].includes(nota)) return res.status(400).json({ erro: "Nota inválida (1, 3, 4 ou 5)." });
    res.json(await apiServidor.avaliarCartao(String(req.params.id), nota as NotaCartao));
  })
);

app.get(
  "/api/simulado",
  rota(async (req, res) =>
    res.json(await apiServidor.simulado(Math.min(120, Math.max(1, Number(req.query.n) || 20)), { diagnostico: req.query.diagnostico === "1" }))
  )
);
app.get("/api/simulado/mistura", rota(async (_req, res) => res.json(await apiServidor.misturaSimulado())));

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
        })),
        { diagnostico: req.body?.diagnostico === true }
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

app.get("/api/redacao/temas", rota(async (_req, res) => res.json(await apiServidor.temasRedacao())));
app.post("/api/redacao/tema", rota(async (_req, res) => res.json(await apiServidor.pedirTemaRedacao())));
app.get("/api/redacoes", rota(async (_req, res) => res.json(await apiServidor.redacoes())));
app.post(
  "/api/redacoes/corrigir",
  rota(async (req, res) => {
    const { temaId, texto: corpo, linhas, tempoSeg } = req.body ?? {};
    if (!texto(temaId) || typeof corpo !== "string" || !Number.isFinite(Number(linhas)) || !Number.isFinite(Number(tempoSeg)))
      return res.status(400).json({ erro: "Envie temaId, texto, linhas e tempoSeg válidos." });
    res.json(await apiServidor.corrigirRedacao({ temaId, texto: corpo, linhas: Number(linhas), tempoSeg: Number(tempoSeg) }));
  })
);
app.post("/api/redacoes/vistas", rota(async (_req, res) => { await apiServidor.marcarRedacoesVistas(); res.status(204).end(); }));

// ---------- Conferência do dono (tela Figuras) ----------
app.get("/api/admin/figuras", rota(async (_req, res) => res.json(await listarFiguras())));
app.get("/api/admin/figuras/amostras", (_req, res) => res.json(amostrasDeFiguras(5)));

// ---------- Tela Admin (só o dono): IA, Fila, Benchmark, Pendências ----------
app.get("/api/admin/ia", rota(async (_req, res) => res.json(await painelIA())));
app.get("/api/admin/fila", rota(async (_req, res) => res.json(await painelFila())));
app.post(
  "/api/admin/fila/:id/tentar",
  rota(async (req, res) => {
    const id = String(req.params.id);
    if (!Types.ObjectId.isValid(id)) return res.status(400).json({ erro: "Id inválido." });
    if (!(await tentarDeNovoAgora(id))) return res.status(409).json({ erro: "Essa tarefa não está aguardando nem parada." });
    res.json({ ok: true });
  })
);
app.get("/api/admin/benchmark", rota(async (_req, res) => res.json(await painelBenchmark())));
app.post(
  "/api/admin/correntes/aprovar",
  rota(async (req, res) => {
    const c = (req.body ?? {}).correntes as Record<string, unknown> | undefined;
    const ok = c && FUNCOES.every((f) => Array.isArray(c[f]) && (c[f] as unknown[]).every((x) => typeof x === "string"));
    if (!ok) return res.status(400).json({ erro: `Envie { correntes: { ${FUNCOES.join(", ")} } } com listas de ids.` });
    const r = await aprovarCorrentes(c as Correntes);
    if (!r.ok) return res.status(422).json({ erro: r.erros.join(" · ") });
    res.json({ ok: true, avisos: r.avisos });
  })
);
app.post("/api/admin/correntes/desfazer", rota(async (_req, res) => res.json(await desfazerCorrentes())));
app.get("/api/admin/pendencias", rota(async (_req, res) => res.json(await pendencias())));
// ADENDO-FONTES-ATUAIS: relatório e aprovação (em lote) das mudanças de norma antes de irem ao aluno
app.get("/api/admin/fontes-atuais", rota(async (_req, res) => res.json(await relatorioFontesAtuais())));
app.post(
  "/api/admin/fontes-atuais/aprovar",
  rota(async (req, res) => {
    const ids = Array.isArray(req.body?.ids) ? (req.body.ids as unknown[]).filter((x): x is string => typeof x === "string") : [];
    if (!ids.length) return res.status(400).json({ erro: "Envie { ids: [...] }." });
    res.json({ aprovadas: await aprovarMudancas(ids) });
  })
);
app.post(
  "/api/admin/fontes-atuais/manter",
  rota(async (req, res) => {
    const ids = Array.isArray(req.body?.ids) ? (req.body.ids as unknown[]).filter((x): x is string => typeof x === "string") : [];
    const motivo = typeof req.body?.motivo === "string" ? req.body.motivo : "";
    if (!ids.length) return res.status(400).json({ erro: "Envie { ids: [...] }." });
    if (!motivo.trim()) return res.status(400).json({ erro: "Informe o motivo para manter a questão." });
    res.json({ mantidas: await manterQuestoes(ids, motivo) });
  })
);
app.get(
  "/api/admin/doc",
  rota(async (req, res) => {
    const nome = String(req.query.nome ?? "");
    const md = await lerDoc(nome);
    if (md === null) return res.status(404).json({ erro: DOCS_LIBERADOS.includes(nome) ? "Esse documento ainda não foi escrito." : "Documento não liberado." });
    res.json({ nome, markdown: md });
  })
);

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
  // arquivos com hash no nome (assets/) ficam 1 ano em cache; o index.html sempre é conferido
  app.use("/assets", express.static(join(site, "assets"), { immutable: true, maxAge: "365d" }));
  app.use(express.static(site, { index: false, maxAge: "1h" }));
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(join(site, "index.html"));
  });
}

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ erro: err.message });
});

// Escuta em process.env.PORT LOGO na partida (o Render procura a porta aberta nos primeiros segundos) e só
// depois conecta no Mongo: até lá /api/saude responde 503 e o resto das consultas espera a conexão.
async function iniciar() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Faltou MONGODB_URI no .env");
  const porta = Number(process.env.PORT) || 3333;
  await new Promise<void>((pronto) => app.listen(porta, "0.0.0.0", () => pronto()));
  console.log(`✔ API ouvindo na porta ${porta}${existsSync(site) ? " (site incluído)" : ""}; conectando ao banco…`);
  await mongoose.connect(uri);
  console.log("✔ Banco conectado");
}
iniciar().catch((e) => {
  console.error(`✖ ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
