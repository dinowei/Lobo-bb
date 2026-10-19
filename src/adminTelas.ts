// ============================================================
// BB Estudos — Tela Admin (só o dono): abas IA, Fila, Benchmark e Pendências
// (PROMPT-RETOMADA R3 + adendo do banco grande, item 7). O aluno nunca vê nada disto.
// ============================================================
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Question, Tarefa, Geracao, ChamadaModelo } from "./models.js";
import { carregarCatalogo, FUNCOES, NOME_FUNCAO, validarCorrentes, type Correntes } from "./catalogo.js";
import { correnteAtiva } from "./corrente.js";
import { bytesDeAudio, resumoVoz, tetoAudioMB } from "./voz.js";
import { alertaDoBanco, medirColecoes, usoBanco } from "./usoBanco.js";
import { estatisticasModelos, atendeuHoje, type EstatisticaModelo } from "./telemetria.js";
import { ultimaVerificacao, alertasDeModelos, type Verificacao } from "./sondagem.js";
import { relatorio, empatados, RODADAS, amostraOficiais } from "./benchmark.js";
import { MOTIVOS_INFRA } from "./pipeline.js";
import { MOTIVOS_REPETICAO } from "./similaridade.js";
import { inicioDaNoite } from "../shared/motor.js";
import type {
  AdminBenchmarkDTO,
  AdminFilaDTO,
  AdminIADTO,
  CorStatus,
  JanelaModeloDTO,
  ModeloIADTO,
  PendenciaDTO,
  PropostaCorrenteDTO,
  RelatorioNoiteDTO,
  StatusTarefa,
} from "../shared/tipos.js";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
export const META_BANCO = Number(process.env.META_BANCO) || 1200;

// ---------- IA ----------
const janela = (e?: EstatisticaModelo): JanelaModeloDTO | null =>
  e ? { chamadas: e.chamadas, taxa: e.taxa, medianaMs: e.medianaMs, p95Ms: e.p95Ms, comoReserva: e.comoReserva, falhas: e.falhas } : null;

// Verde: respondendo bem. Amarelo: instável, fora no catálogo ou descontinuando. Vermelho: caiu.
// Cinza: sem dado ainda. (puro, testado)
export function corDoModelo(
  m: { statusCatalogo: string; descontinuaEm?: string },
  h24: JanelaModeloDTO | null,
  verificado: { ok: boolean } | undefined,
  agora = Date.now()
): { cor: CorStatus; motivo: string } {
  if (m.statusCatalogo === "descontinuado") return { cor: "vermelho", motivo: "descontinuado" };
  if (h24 && h24.chamadas >= 3 && h24.taxa < 0.5) return { cor: "vermelho", motivo: `${Math.round(h24.taxa * 100)}% de sucesso em 24 h` };
  if (!h24?.chamadas && verificado && !verificado.ok) return { cor: "vermelho", motivo: "não respondeu na verificação" };
  if (m.descontinuaEm && Date.parse(m.descontinuaEm) - agora < 30 * 86_400_000) return { cor: "amarelo", motivo: `descontinua em ${m.descontinuaEm}` };
  if (h24?.chamadas && h24.taxa < 0.9) return { cor: "amarelo", motivo: `${Math.round(h24.taxa * 100)}% de sucesso em 24 h` };
  if (!h24?.chamadas && m.statusCatalogo === "fora") return { cor: "amarelo", motivo: "fora na última sondagem" };
  if (h24?.chamadas) return { cor: "verde", motivo: `${Math.round(h24.taxa * 100)}% de sucesso em 24 h` };
  if (verificado?.ok) return { cor: "verde", motivo: "respondeu na verificação" };
  return { cor: "cinza", motivo: "sem chamadas recentes" };
}

export async function painelIA(): Promise<AdminIADTO> {
  const [ativa, verif, h24, d7, hoje, voz] = await Promise.all([
    correnteAtiva(), ultimaVerificacao(), estatisticasModelos(24), estatisticasModelos(24 * 7), atendeuHoje(),
    resumoVoz().catch(() => undefined),
  ]);
  const banco = await espacoDoBanco().catch(() => undefined);
  const cat = carregarCatalogo();
  const por24 = new Map(h24.map((e) => [e.modelo, e]));
  const por7 = new Map(d7.map((e) => [e.modelo, e]));
  const ids = [...new Set([...cat.keys(), ...h24.map((e) => e.modelo)])];
  const modelos: ModeloIADTO[] = ids.map((id) => {
    const m = cat.get(id);
    const base = { statusCatalogo: m?.status ?? "fora do catálogo", descontinuaEm: m?.descontinuaEm };
    const j24 = janela(por24.get(id));
    const { cor, motivo } = corDoModelo(base, j24, verif?.resultados.find((r) => r.modelo === id));
    return {
      id,
      familia: m?.familia ?? id.split("/")[0],
      funcoes: m?.funcoes ?? [],
      preview: m?.preview ?? false,
      cor,
      motivoCor: motivo,
      ...base,
      nota: m?.nota,
      h24: j24,
      d7: janela(por7.get(id)),
      ultimaResposta: por7.get(id)?.ultimaResposta,
      ultimaFalha: por7.get(id)?.ultimaFalha,
    };
  });
  return {
    modo: ativa.modo,
    aprovadaEm: ativa.aprovadaEm,
    correntes: ativa.correntes,
    nomesFuncoes: NOME_FUNCAO,
    alertas: [...alertasDeModelos(ativa, verif), ...(banco && alertaDoBanco(banco) ? [alertaDoBanco(banco)!] : [])],
    modelos,
    hoje,
    verificadoEm: verif?.em,
    voz,
    banco,
  };
}

export async function alertasAdminAgora(): Promise<string[]> {
  const alerta = await usoBanco().then(alertaDoBanco).catch(() => null);
  return [...alertasDeModelos(await correnteAtiva(), await ultimaVerificacao()), ...(alerta ? [alerta] : [])];
}

// uso do banco na aba IA: total, o que pesa (5 maiores coleções) e o cache de áudio contra o teto
async function espacoDoBanco() {
  const [u, cols, audio] = await Promise.all([usoBanco(), medirColecoes(), bytesDeAudio()]);
  return {
    ...u,
    audioMB: Math.round(audio / 104857.6) / 10,
    tetoAudioMB: tetoAudioMB(),
    colecoes: cols.slice(0, 5).map((c) => ({ nome: c.nome, mb: Math.round((Math.max(c.dadosMB, c.discoMB) + c.indicesMB) * 10) / 10 })),
  };
}

// ---------- Fila + relatório da noite ----------
export function grupoDoMotivo(motivo: string): "qualidade" | "similaridade" | "infraestrutura" {
  if (MOTIVOS_REPETICAO.includes(motivo)) return "similaridade";
  if (MOTIVOS_INFRA.includes(motivo) || motivo === "teto_diario") return "infraestrutura";
  return "qualidade";
}

export async function relatorioDaNoite(desde = inicioDaNoite()): Promise<RelatorioNoiteDTO> {
  const [gs, top] = await Promise.all([
    Geracao.find({ em: { $gte: desde } }).select("resultado motivo em").lean(),
    ChamadaModelo.aggregate<{ _id: string; n: number }>([
      { $match: { em: { $gte: desde }, ok: true, funcao: "gerador" } },
      { $group: { _id: "$modelo", n: { $sum: 1 } } },
      { $sort: { n: -1 } },
      { $limit: 1 },
    ]),
  ]);
  const porMotivo = new Map<string, number>();
  const porHora = new Map<string, number>();
  for (const g of gs) {
    if (g.resultado === "aprovada") {
      const h = new Date(g.em).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit" });
      porHora.set(h, (porHora.get(h) ?? 0) + 1);
    } else if (g.motivo) porMotivo.set(g.motivo, (porMotivo.get(g.motivo) ?? 0) + 1);
  }
  return {
    desde: desde.toISOString(),
    tentativas: gs.length,
    aprovadas: gs.filter((g) => g.resultado === "aprovada").length,
    descartes: [...porMotivo.entries()].map(([motivo, n]) => ({ grupo: grupoDoMotivo(motivo), motivo, n })).sort((a, b) => b.n - a.n),
    porHora: [...porHora.entries()].map(([hora, aprovadas]) => ({ hora: `${hora}h`, aprovadas })).sort((a, b) => a.hora.localeCompare(b.hora)),
    modeloQueMaisAtendeu: top[0]?._id,
  };
}

export async function painelFila(): Promise<AdminFilaDTO> {
  const [tarefas, contagens, oficiais, geradas, noite] = await Promise.all([
    Tarefa.find().sort({ updatedAt: -1 }).limit(100).lean(),
    Tarefa.aggregate<{ _id: StatusTarefa; n: number }>([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
    Question.countDocuments({ status: "aprovada", origem: "oficial" }),
    Question.countDocuments({ status: "aprovada", origem: "gerada" }),
    relatorioDaNoite(),
  ]);
  const contagem = { pendente: 0, rodando: 0, aguardando: 0, concluida: 0, descartada: 0, esgotada: 0 } as Record<StatusTarefa, number>;
  for (const c of contagens) contagem[c._id] = c.n;
  return {
    contagem,
    tarefas: tarefas.map((t) => ({
      id: String(t._id),
      tipo: t.tipo,
      assunto: (t.params as { assunto?: string } | undefined)?.assunto,
      status: t.status as StatusTarefa,
      tentativas: t.tentativas ?? 0,
      proximaEm: t.proximaEm ? new Date(t.proximaEm).toISOString() : undefined,
      motivo: t.motivo ?? undefined,
      detalhes: t.detalhes ?? undefined,
      resultadoId: t.resultadoId ? String(t.resultadoId) : undefined,
      lote: t.lote ?? undefined,
      atualizadaEm: new Date((t as { updatedAt?: Date }).updatedAt ?? Date.now()).toISOString(),
    })),
    progresso: { aprovadas: oficiais + geradas, oficiais, geradas, meta: META_BANCO },
    noite,
  };
}

// ---------- Benchmark + propostas de corrente ----------
async function lerPropostas(): Promise<PropostaCorrenteDTO[]> {
  try {
    const bruto = JSON.parse(await readFile(join(RAIZ, "data", "proposta-correntes.json"), "utf8")) as { propostas: Omit<PropostaCorrenteDTO, "erros" | "avisos">[] };
    return bruto.propostas.map((p) => ({ ...p, ...validarCorrentes(p.correntes as Correntes) }));
  } catch {
    return []; // ainda não há proposta (o benchmark não terminou)
  }
}

export async function painelBenchmark(): Promise<AdminBenchmarkDTO> {
  const [aud, juiz, esc, ativa, propostas, amostra] = await Promise.all([
    relatorio(RODADAS.auditor),
    relatorio(RODADAS.juiz),
    relatorio(RODADAS.escritor),
    correnteAtiva(),
    lerPropostas(),
    amostraOficiais(60),
  ]);
  return {
    rodadas: [
      { chave: "auditor", titulo: "Auditor: oficiais às cegas", rotuloAcerto: "acerto", linhas: aud, empatados: empatados(aud) },
      { chave: "juiz", titulo: "Juiz de Português (Crase)", rotuloAcerto: "acerto", linhas: juiz, empatados: empatados(juiz) },
      { chave: "escritor", titulo: "Escritor de Português (Crase)", rotuloAcerto: "5/5 na trava", linhas: esc, empatados: empatados(esc) },
    ],
    disciplinas: [...new Set(amostra.map((a) => a.estrato))].sort(),
    propostas,
    ativa: { modo: ativa.modo, aprovadaEm: ativa.aprovadaEm, correntes: ativa.correntes },
    nomesFuncoes: NOME_FUNCAO,
  };
}

// ---------- Pendências do dono (lista viva do DECISOES-PENDENTES.md) ----------
export const DOCS_LIBERADOS = [
  "DECISOES-PENDENTES.md",
  "CALIBRAGEM-SIMILARIDADE.md",
  "BENCHMARK-MODELOS.md",
  "CATALOGO-MODELOS.md",
  "fontes-vendas/glossario.md",
];

// Divide o markdown nas seções "## …" e acha os atalhos de cada uma (puro, testado)
export function pendenciasDoMarkdown(md: string): PendenciaDTO[] {
  const secoes = md.split(/^## /m).slice(1);
  return secoes
    .map((s) => {
      const [titulo, ...resto] = s.split("\n");
      const corpo = resto.join("\n").split(/^---\s*$/m)[0].trim();
      const t = `${titulo} ${corpo}`.toLowerCase();
      const prioridade: PendenciaDTO["prioridade"] = /prioridade alta|\(alta\)/.test(t) ? "alta" : /\(média\)|\(media\)/.test(t) ? "media" : /\(baixa\)/.test(t) ? "baixa" : null;
      const links: PendenciaDTO["links"] = [];
      if (/figura/.test(t)) links.push({ rotulo: "Figuras", destino: "#figuras" });
      if (/glossário|glossario/.test(t)) links.push({ rotulo: "Glossário de Vendas", destino: "doc:fontes-vendas/glossario.md" });
      if (/benchmark|corrente/.test(t)) links.push({ rotulo: "Benchmark", destino: "#admin?aba=benchmark" });
      if (/calibragem|similaridade/.test(t)) links.push({ rotulo: "Calibragem de similaridade", destino: "doc:CALIBRAGEM-SIMILARIDADE.md" });
      return { titulo: titulo.trim(), prioridade, markdown: corpo, links };
    })
    .filter((p) => p.markdown);
}

export async function pendencias(): Promise<PendenciaDTO[]> {
  return pendenciasDoMarkdown(await readFile(join(RAIZ, "docs", "DECISOES-PENDENTES.md"), "utf8"));
}

export async function lerDoc(nome: string): Promise<string | null> {
  if (!DOCS_LIBERADOS.includes(nome)) return null;
  try {
    return await readFile(join(RAIZ, "docs", nome), "utf8");
  } catch {
    return null;
  }
}

export type { Verificacao };
