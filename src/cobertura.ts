// ============================================================
// Cobertura da trilha (esteira de conteúdo, decisão do dono 26/10/2026): busca no banco, por tema da trilha,
// as novas para o dono, a ficha aprovada, o áudio da ficha e o que bloqueia; as regras são puras
// (shared/cobertura.ts). Admin → Cobertura e a etapa da noite leem daqui.
// ============================================================
import { Attempt, Audio, Chunk, DISCIPLINAS_COM_FONTE_OBRIGATORIA, Ficha, Question, Topic } from "./models.js";
import { ALUNO } from "./estudo.js";
import { trilha } from "./temas.js";
import { hashFala, vozPadrao } from "./voz.js";
import { paraFala } from "../shared/fala.js";
import { textoFicha } from "../shared/espacoLo.js";
import { SUBTOPICO_POR_ID } from "../shared/subtopicos.js";
import { concursosDoTema, TRILHA } from "../shared/trilha.js";
import { coberturaPorConcurso, linhasCobertura, proximoTemaDaEsteira, type LinhaCobertura, type ResumoCobertura, type TemaCobertura } from "../shared/cobertura.js";
import conteudo from "../data/temas.json" with { type: "json" };

const CONTEUDO = conteudo.temas as unknown as Record<string, { ficha?: { texto: string }; materiais?: unknown[]; semMaterial?: string }>;

export type CoberturaDTO = { nHoje: number | null; resumo: ResumoCobertura[]; temas: LinhaCobertura[]; proximo: { n: number; subtopico: string; nome: string; faltas: string[] } | null };

export async function coberturaTrilha(): Promise<CoberturaDTO> {
  const voz = vozPadrao();
  const [t, topicos, questoes, respondidas, fichas] = await Promise.all([
    trilha(),
    Topic.find({ ativo: true }).select("_id assunto disciplina").lean(),
    Question.find({ status: "aprovada", subtopico: { $ne: null } }).select("_id subtopico").lean(),
    Attempt.distinct("questionId", { userId: ALUNO() }),
    Ficha.find({ status: "aprovada" }).sort({ createdAt: -1 }).select("subtopico afirmacoes").lean(),
  ]);
  const feitas = new Set(respondidas.map(String));
  const aprovadas = new Map<string, number>();
  const novas = new Map<string, number>();
  for (const q of questoes) {
    const s = q.subtopico!;
    aprovadas.set(s, (aprovadas.get(s) ?? 0) + 1);
    if (!feitas.has(String(q._id))) novas.set(s, (novas.get(s) ?? 0) + 1);
  }
  const fichaPor = new Map<string, string[]>();
  for (const f of fichas) if (!fichaPor.has(f.subtopico)) fichaPor.set(f.subtopico, (f.afirmacoes ?? []).map((a) => a.texto ?? ""));

  // áudio da ficha = MP3 da Lo já no cache para o mesmo texto que o Espaço da Lo toca
  const textos = new Map<string, string>();
  for (const x of TRILHA) {
    const s = SUBTOPICO_POR_ID.get(x.subtopico);
    const afirmacoes = fichaPor.get(x.subtopico) ?? (CONTEUDO[x.subtopico]?.ficha ? [CONTEUDO[x.subtopico].ficha!.texto] : null);
    if (s && afirmacoes) textos.set(x.subtopico, textoFicha(s.nome, afirmacoes));
  }
  const prontos = new Set((await Audio.find({ voz, hash: { $in: [...textos.values()].map((x) => hashFala(paraFala(x), voz)) } }).select("hash").lean()).map((a) => a.hash));

  // fonte obrigatória: tópicos do tema com algum trecho ativo
  const comFonte = new Set((await Chunk.distinct("topicIds", { revogada: false })).map(String));
  const temas: TemaCobertura[] = [];
  for (const x of TRILHA) {
    const s = SUBTOPICO_POR_ID.get(x.subtopico);
    if (!s) continue;
    const doTema = topicos.filter((tp) => s.topicos.includes(tp.assunto));
    const c = CONTEUDO[x.subtopico] ?? {};
    const temFicha = textos.has(x.subtopico);
    const bloqueios = [
      ...(!doTema.length ? ["sem tópico ativo no banco"] : []),
      ...(doTema.length && doTema.every((tp) => (DISCIPLINAS_COM_FONTE_OBRIGATORIA as readonly string[]).includes(tp.disciplina)) && !doTema.some((tp) => comFonte.has(String(tp._id))) ? ["sem fonte ingerida (regra 3)"] : []),
      ...(!temFicha && !(c.materiais ?? []).length ? [c.semMaterial ? `ficha sem material: ${c.semMaterial}` : "sem material do acervo mapeado para a ficha"] : []),
    ];
    temas.push({
      n: x.n, subtopico: x.subtopico, nome: s.nome, concursos: concursosDoTema(x),
      aprovadas: aprovadas.get(x.subtopico) ?? 0, novas: novas.get(x.subtopico) ?? 0,
      ficha: temFicha, audioFicha: temFicha && prontos.has(hashFala(paraFala(textos.get(x.subtopico)!), voz)), bloqueios,
    });
  }
  const linhas = linhasCobertura(temas);
  const nHoje = t.hoje?.n ?? null;
  const p = proximoTemaDaEsteira(linhas, nHoje);
  return { nHoje, resumo: coberturaPorConcurso(linhas), temas: linhas, proximo: p ? { n: p.n, subtopico: p.subtopico, nome: p.nome, faltas: p.faltas } : null };
}
