// ============================================================
// BB Estudos — Conferência do dono (tela "Figuras")
// Código extrai, o dono confirma: figura só vai ao treino com OK.
// ============================================================
import { Types } from "mongoose";
import { Question } from "./models.js";
import { arquivoDaProva, recortarDeNovo } from "./figuras.js";
import { construir } from "./construcao.js";
import { CATALOGO_FIGURAS } from "./construcaoFiguras.js";

import type { AmostraFiguraDTO, FiguraConferenciaDTO as FiguraConferencia, Letra, PosicaoFigura, QuestaoComFigurasDTO as QuestaoComFiguras, TipoFigura } from "../shared/tipos.js";

// Amostras das figuras que o código gera (sem IA, nada é salvo): n por tipo, uma por letra
export function amostrasDeFiguras(n = 5): AmostraFiguraDTO[] {
  const saida: AmostraFiguraDTO[] = [];
  for (const [assunto, { porTipo }] of Object.entries(CATALOGO_FIGURAS))
    for (const tipo of Object.keys(porTipo))
      for (let k = 0; k < n; k++) {
        const m = construir(assunto, tipo, "ABCDE"[k % 5] as Letra);
        if (!m?.figura) continue;
        const f = m.figura;
        const figura = f.tipo === "tabela"
          ? { tipo: f.tipo, posicao: f.posicao, legenda: f.legenda, tabela: f.dados }
          : { tipo: f.tipo, posicao: f.posicao, legenda: f.legenda, planilha: f.dados };
        saida.push({ assunto, tipo, pergunta: m.pergunta, dados: m.dados, resolucao: m.resolucao, alternativas: m.alternativas, figura });
      }
  return saida;
}

export async function listarFiguras(): Promise<QuestaoComFiguras[]> {
  const qs = await Question.find({ "figuras.0": { $exists: true } })
    .sort({ prova: -1, numeroOriginal: 1 })
    .select("prova numeroOriginal status enunciado figuras")
    .lean();
  return qs.map((q) => ({
    questaoId: String(q._id),
    prova: q.prova ?? undefined,
    numero: q.numeroOriginal ?? undefined,
    status: q.status,
    enunciado: q.enunciado,
    figuras: (q.figuras ?? []).map((f) => ({
      id: String((f as { _id?: Types.ObjectId })._id),
      tipo: f.tipo as TipoFigura,
      posicao: (f.posicao ?? "enunciado") as PosicaoFigura,
      legenda: f.legenda ?? undefined,
      dados: f.dados ?? undefined,
      imagem: f.imagem ?? undefined,
      recortePng: f.recortePng ?? undefined,
      recorte: f.recorte ? { pagina: f.recorte.pagina!, x: f.recorte.x!, y: f.recorte.y!, w: f.recorte.w!, h: f.recorte.h! } : undefined,
      origem: f.origem ?? "pdf",
      status: (f.status ?? "aguardando_conferencia") as FiguraConferencia["status"],
    })),
  }));
}

// Área maior da página em volta da figura (margem de 60 pt), para o dono arrastar um novo recorte
export async function contextoDaFigura(questaoId: string, figuraId: string) {
  const q = await Question.findById(questaoId).select("prova figuras").lean();
  const f = q?.figuras?.find((x) => String((x as { _id?: Types.ObjectId })._id) === figuraId);
  if (!q || !f?.recorte?.pagina) throw new Error("Figura sem recorte de página");
  const arquivo = q.prova ? await arquivoDaProva(q.prova) : null;
  if (!arquivo) throw new Error("Não sei de qual PDF veio essa prova");
  const m = 60;
  const regiao = {
    pagina: f.recorte.pagina,
    x: Math.max(0, f.recorte.x! - m),
    y: Math.max(0, f.recorte.y! - m),
    w: Math.min(595 - Math.max(0, f.recorte.x! - m), f.recorte.w! + 2 * m),
    h: Math.min(842 - Math.max(0, f.recorte.y! - m), f.recorte.h! + 2 * m),
  };
  return { png: await recortarDeNovo(arquivo, regiao), regiao, atual: f.recorte };
}

export type AcaoFigura =
  | { acao: "ok" }
  | { acao: "fora" }
  | { acao: "recorte"; recorte: { x: number; y: number; w: number; h: number } };

// OK: figura conferida; se TODAS as figuras da questão estão OK e ela estava fora do treino só
// por falta de figura, volta ao treino. Fora: tira a questão do treino.
export async function decidirFigura(questaoId: string, figuraId: string, a: AcaoFigura): Promise<FiguraConferencia["status"]> {
  const q = await Question.findById(questaoId);
  if (!q) throw new Error("Questão não encontrada");
  const f = (q.figuras ?? []).find((x) => String((x as { _id?: Types.ObjectId })._id) === figuraId);
  if (!f) throw new Error("Figura não encontrada");

  if (a.acao === "recorte") {
    if (!f.recorte?.pagina) throw new Error("Essa figura não tem recorte de página");
    const arquivo = q.prova ? await arquivoDaProva(q.prova) : null;
    if (!arquivo) throw new Error("Não sei de qual PDF veio essa prova (data/figuras-oficiais.json)");
    const r = { pagina: f.recorte.pagina, ...a.recorte };
    f.recorte = r;
    f.recortePng = await recortarDeNovo(arquivo, r);
    if (f.tipo === "imagem") f.imagem = f.recortePng; // a figura É o recorte
    f.status = "aguardando_conferencia";
  } else if (a.acao === "ok") {
    f.status = "ok";
    const todasOk = (q.figuras ?? []).every((x) => x.status === "ok");
    if (todasOk && q.status === "precisa_imagem") {
      q.status = "aprovada";
      q.precisaImagem = false;
    }
  } else {
    f.status = "fora";
    if (q.status === "aprovada") {
      q.status = "precisa_imagem";
      q.precisaImagem = true;
      q.faltaImagem = q.faltaImagem ?? `Figura recusada na conferência: ${f.legenda ?? f.tipo}`;
    }
  }
  q.markModified("figuras");
  await q.save();
  return f.status as FiguraConferencia["status"];
}
