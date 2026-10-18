// Diagnóstico do erro (PLANO-MESTRE 5.3) — funções puras usadas pelo servidor e pelo modo demo
import { DISCIPLINAS, MOTIVOS_ERRO, type Disciplina, type MotivoErro, type MotivosDisciplinaDTO, type TentativaBruta } from "./tipos.js";

export const REVISAO_CHUTE_MIN = 10; // chutei → a questão volta ainda nesta sessão
export const TEMPO_ALVO_SEG = 150; // desatenção → revisão com tempo (≈ ritmo da prova)
export const JANELA_NAO_SABIA_DIAS = 14;

// "não sabia" recente puxa o tópico para cima na fila: +50% por erro, até o dobro
export const fatorNaoSabia = (naoSabiaRecentes: number) => 1 + 0.5 * Math.min(2, Math.max(0, naoSabiaRecentes));

const PALAVRAS_VAZIAS = new Set(
  "a o as os um uma uns umas de do da dos das em no na nos nas por pelo pela pelos pelas para com sem sob sobre entre ate apos e ou mas que se nao sim como quando onde mais menos muito pouco ser sao foi era esta estao ter tem isso esse essa este esta aquele aquela seu sua seus suas ao aos lhe lhes ja so tambem the of to and in is are be for".split(" ")
);
const normalizar = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Desatenção: palavras que estão na alternativa certa e não na marcada (o que decidia a questão)
export function palavrasDecisivas(correta: string, marcada: string, max = 4): string[] {
  const tokens = (s: string) => s.match(/[\p{L}\p{N}%$,.-]+/gu)?.map((t) => t.replace(/[,.-]+$/, "")).filter(Boolean) ?? [];
  const daMarcada = new Set(tokens(marcada).map(normalizar));
  // mesmas palavras em outra ordem (ex.: "Disseram-me" × "Me disseram"): a primeira posição que muda
  const sequencia = tokens(marcada).map(normalizar);
  const vistas = new Set<string>();
  const saida: string[] = [];
  for (const t of tokens(correta)) {
    const n = normalizar(t);
    const relevante = /\d/.test(n) || (n.length >= 3 && !PALAVRAS_VAZIAS.has(n));
    if (!relevante || daMarcada.has(n) || vistas.has(n)) continue;
    vistas.add(n);
    saida.push(t);
    if (saida.length >= max) break;
  }
  if (!saida.length) {
    const certa = tokens(correta);
    const i = certa.findIndex((t, k) => normalizar(t) !== sequencia[k]);
    if (i >= 0) return certa.slice(i, i + 2);
  }
  return saida;
}

// Quantos "não sabia" cada tópico teve nos últimos dias
export function naoSabiaPorTopico(tents: TentativaBruta[], agora = new Date()): Map<string, number> {
  const desde = agora.getTime() - JANELA_NAO_SABIA_DIAS * 86_400_000;
  const m = new Map<string, number>();
  for (const t of tents) if (t.motivoErro === "nao_sabia" && new Date(t.data).getTime() >= desde) m.set(t.topicoId, (m.get(t.topicoId) ?? 0) + 1);
  return m;
}

// Gráfico do painel: erros (fora de simulado) e motivos informados, por disciplina
export function motivosPorDisciplina(tents: TentativaBruta[], disciplinaDo: Map<string, Disciplina>): MotivosDisciplinaDTO[] {
  const porDisc = new Map<Disciplina, MotivosDisciplinaDTO>();
  for (const t of tents) {
    if (t.acertou || t.modo === "simulado") continue;
    const d = disciplinaDo.get(t.topicoId);
    if (!d) continue;
    const linha = porDisc.get(d) ?? { disciplina: d, erros: 0, motivos: Object.fromEntries(MOTIVOS_ERRO.map((m) => [m, 0])) as Record<MotivoErro, number> };
    linha.erros++;
    if (t.motivoErro) linha.motivos[t.motivoErro]++;
    porDisc.set(d, linha);
  }
  return DISCIPLINAS.flatMap((d) => (porDisc.has(d) ? [porDisc.get(d)!] : []));
}

export const MENSAGEM_MOTIVO: Record<MotivoErro, string> = {
  nao_sabia: "Anotado. Esse tópico sobe na sua fila de estudo nas próximas duas semanas.",
  confundi: "Anotado. A próxima questão é parecida, para você separar os dois conceitos.",
  desatencao: "Anotado. Ela volta na revisão com tempo marcado.",
  chutei: `Anotado. Ela volta daqui a ${REVISAO_CHUTE_MIN} minutos, ainda nesta sessão.`,
};
