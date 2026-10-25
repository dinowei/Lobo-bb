// ============================================================
// Espaço da Lo no servidor: só busca no banco o que já existe (trilha, fichas e aulas aprovadas, relatórios das
// janelas, provas novas, cache de áudio) e entrega às regras puras de shared/espacoLo.ts.
// Só conteúdo aprovado vira áudio; o MP3 continua sob demanda com cache (/api/voz).
// ============================================================
import { Audio, Aula, DISCIPLINAS_COM_FONTE_OBRIGATORIA, EspacoLo, Ficha, Question, Relatorio, Source, Topic } from "./models.js";
import { ALUNO } from "./estudo.js";
import { trilha } from "./temas.js";
import { lerJanelas } from "./janelaB.js";
import { hashFala, vozPadrao } from "./voz.js";
import { paraFala, textoDaAula } from "../shared/fala.js";
import { SUBTOPICO_POR_ID } from "../shared/subtopicos.js";
import { TRILHA } from "../shared/trilha.js";
import {
  itensDoTema, montarRecados, unicos, registrarPosicao, resumirDia, rolarVisita,
  type EspacoLoDTO, type EstadoTema, type EstadoVisita, type ItemAudioDTO, type PosicaoAudio,
} from "../shared/espacoLo.js";
import type { Disciplina } from "../shared/tipos.js";
import conteudo from "../data/temas.json" with { type: "json" };

const CONTEUDO = conteudo.temas as unknown as Record<string, { pontos?: string[]; ficha?: { texto: string } }>;
export const ID_AUDIO = /^(ficha|aula|pontos)-[a-z0-9_-]{1,80}$/;

// aulas aprovadas com as mesmas travas de aulaDoTopico (fonte obrigatória e nenhuma fonte revogada), em lote
async function aulasValidas() {
  const aulas = await Aula.find({ status: "aprovada" }).select("topicId conteudo pontosChave comoABancaCobra pegadinhasComuns fontes").lean();
  const topicos = new Map((await Topic.find({ _id: { $in: aulas.map((a) => a.topicId) } }).select("assunto disciplina").lean()).map((t) => [String(t._id), t]));
  const revogadas = new Set((await Source.find({ revogada: true }).select("_id").lean()).map((s) => String(s._id)));
  const porAssunto = new Map<string, { topicoId: string; assunto: string; disciplina: string; texto: string; pontosChave: string[] }>();
  for (const a of aulas) {
    const t = topicos.get(String(a.topicId));
    if (!t) continue;
    const fontes = (a.fontes ?? []).map((f) => String(f.sourceId));
    if ((DISCIPLINAS_COM_FONTE_OBRIGATORIA as readonly string[]).includes(t.disciplina) && !fontes.length) continue;
    if (fontes.some((f) => revogadas.has(f))) continue;
    porAssunto.set(t.assunto, {
      topicoId: String(a.topicId), assunto: t.assunto, disciplina: t.disciplina, pontosChave: a.pontosChave ?? [],
      texto: textoDaAula({ assunto: t.assunto, conteudo: a.conteudo, pontosChave: a.pontosChave ?? [], comoABancaCobra: a.comoABancaCobra, pegadinhasComuns: a.pegadinhasComuns ?? [] }),
    });
  }
  return porAssunto;
}

// itens de áudio de todos os temas da trilha (ficha aprovada mais recente, aulas válidas, pontos conferidos)
async function itensDeTodos() {
  const [aulas, fichas] = await Promise.all([aulasValidas(), Ficha.find({ status: "aprovada" }).sort({ createdAt: -1 }).select("subtopico afirmacoes conflitos createdAt").lean()]);
  const fichaPor = new Map<string, (typeof fichas)[number]>();
  for (const f of fichas) if (!fichaPor.has(f.subtopico)) fichaPor.set(f.subtopico, f);
  const itens: ItemAudioDTO[] = [];
  for (const t of TRILHA) {
    const s = SUBTOPICO_POR_ID.get(t.subtopico);
    if (!s) continue;
    const c = CONTEUDO[t.subtopico] ?? {};
    const doTema = s.topicos.map((assunto) => aulas.get(assunto)).filter((a) => !!a);
    const f = fichaPor.get(t.subtopico);
    const ficha = f ? (f.afirmacoes ?? []).map((a) => a.texto ?? "") : c.ficha ? [c.ficha.texto] : null;
    itens.push(...itensDoTema({ subtopico: t.subtopico, nome: s.nome, disciplina: (doTema[0]?.disciplina as Disciplina) ?? null, ficha, aulas: doTema, pontos: c.pontos?.length ? c.pontos : doTema.flatMap((a) => a.pontosChave) }));
  }
  return { itens, fichas: [...fichaPor.values()] };
}

export async function espacoLo(): Promise<EspacoLoDTO> {
  const userId = ALUNO();
  const voz = vozPadrao();
  const [t, estado, { itens, fichas }, janelas] = await Promise.all([
    trilha(),
    EspacoLo.findOne({ userId }).lean(),
    itensDeTodos(),
    lerJanelas(),
  ]);
  const posicoes = (estado?.audios ?? {}) as Record<string, PosicaoAudio>;
  const prontos = new Set((await Audio.find({ voz, hash: { $in: itens.map((i) => hashFala(paraFala(i.texto), voz)) } }).select("hash").lean()).map((a) => a.hash));
  for (const i of itens) {
    i.pronto = prontos.has(hashFala(paraFala(i.texto), voz));
    i.posicao = posicoes[i.id] ?? null;
  }
  const hoje = t.hoje;
  const playlist = hoje ? itens.filter((i) => i.subtopico === hoje.subtopico) : [];

  const relatorios = await Relatorio.find({ inicio: { $gte: new Date(Date.now() - 36 * 3_600_000) } }).select("inicio janela etapas progresso").lean();
  const seuDia = resumirDia({
    modo: t.modo,
    tema: hoje ? { nome: hoje.nome, novas: Math.max(0, hoje.tamanho - hoje.novasFeitasHoje) } : null,
    fichaPronta: playlist.some((i) => i.tipo === "ficha"),
    aulaPronta: playlist.some((i) => i.tipo === "aula"),
    audioPronto: playlist.some((i) => i.pronto),
    revisoesVencidas: t.revisoesVencidas,
    janelas: relatorios.map((r) => ({
      janela: (r.janela ?? "A") as "A" | "B", inicio: (r.inicio as Date).toISOString(), aprovadas: r.progresso?.aprovadas ?? null,
      etapas: (r.etapas ?? []).map((e) => ({ etapa: e.etapa ?? "", status: (e.status ?? "ok") as "ok" | "pulada" | "falhou", detalhe: e.detalhe ?? "" })),
    })),
    inicioJanelaB: janelas.janelaB.inicio,
  });

  // recados: base = o que você viu da última vez; a visita rola uma vez por dia
  const selosAgora = Object.fromEntries(t.temas.map((x) => [x.subtopico, x.estado])) as Record<string, EstadoTema>;
  const visita = rolarVisita((estado?.visita as EstadoVisita | undefined) ?? null, selosAgora);
  await EspacoLo.updateOne({ userId }, { $set: { visita } }, { upsert: true });
  const novasOficiais = await Question.aggregate<{ _id: { subtopico: string; prova: string }; em: Date }>([
    { $match: { origem: { $in: ["oficial", "cursinho"] }, status: "aprovada", createdAt: { $gt: new Date(visita.desde) }, subtopico: { $ne: null } } },
    { $group: { _id: { subtopico: "$subtopico", prova: "$prova" }, em: { $max: "$createdAt" } } },
  ]);
  const recados = montarRecados({
    visita,
    selosAgora,
    nomes: Object.fromEntries(t.temas.map((x) => [x.subtopico, x.nome])),
    temasDoAluno: [...t.temas.filter((x) => x.estado !== "novo").map((x) => x.subtopico), ...(hoje ? [hoje.subtopico] : [])],
    conflitos: fichas.flatMap((f) => (f.conflitos ?? []).map((texto) => ({ subtopico: f.subtopico, texto }))),
    novidades: [
      ...fichas.map((f) => ({ tipo: "ficha" as const, subtopico: f.subtopico, titulo: "", em: (f.createdAt as Date).toISOString() })),
      ...novasOficiais.map((n) => ({ tipo: "prova" as const, subtopico: n._id.subtopico, titulo: n._id.prova ?? "prova", em: n.em.toISOString() })),
    ],
  });

  return {
    seuDia,
    temaDoDia: hoje ? { subtopico: hoje.subtopico, nome: hoje.nome } : null,
    playlist,
    biblioteca: unicos(itens.filter((i) => i.pronto || i.posicao)),
    recados,
  };
}

export async function salvarPosicaoAudio(id: string, p: { fracao: number; frase: number; segundos: number }): Promise<PosicaoAudio> {
  if (!ID_AUDIO.test(id)) throw new Error("Áudio desconhecido.");
  const userId = ALUNO();
  const estado = await EspacoLo.findOne({ userId }).select("audios").lean();
  const nova = registrarPosicao(((estado?.audios ?? {}) as Record<string, PosicaoAudio>)[id] ?? null, { fracao: Number(p?.fracao), frase: Number(p?.frase), segundos: Number(p?.segundos) });
  await EspacoLo.updateOne({ userId }, { $set: { [`audios.${id}`]: nova } }, { upsert: true });
  return nova;
}
