// Diagnóstico do erro (por que errou → ação) — funções puras usadas pelo servidor e pelo modo demo
import { DISCIPLINAS, MOTIVOS_ERRO, type CalibragemDTO, type Disciplina, type MotivoErro, type MotivosDisciplinaDTO, type TentativaBruta } from "./tipos.js";

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

// ---------- Calibragem da confiança (acerto por nível de certeza) ----------
export const CERTEZA_MINIMA = 0.85; // certeza abaixo disso = ilusão de domínio
export const AMOSTRA_ILUSAO = 10; // só alerta com pelo menos 10 respostas "certeza" na disciplina
export const CHUTE_ESPERADO = 0.2; // 1 em 5 alternativas

export function calibragem(tents: TentativaBruta[], disciplinaDo: Map<string, Disciplina>): CalibragemDTO[] {
  const nova = (disciplina: Disciplina | null): CalibragemDTO => ({
    disciplina,
    certeza: { n: 0, acertos: 0 },
    duvida: { n: 0, acertos: 0 },
    chute: { n: 0, acertos: 0 },
    ilusao: false,
  });
  const geral = nova(null);
  const porDisc = new Map<Disciplina, CalibragemDTO>();
  for (const t of tents) {
    if (!t.confianca || t.modo === "simulado") continue;
    const faixa = t.confianca === 3 ? "certeza" : t.confianca === 2 ? "duvida" : "chute";
    const d = disciplinaDo.get(t.topicoId);
    const alvos = [geral];
    if (d) {
      if (!porDisc.has(d)) porDisc.set(d, nova(d));
      alvos.push(porDisc.get(d)!);
    }
    for (const c of alvos) {
      c[faixa].n++;
      if (t.acertou) c[faixa].acertos++;
    }
  }
  const linhas = [geral, ...DISCIPLINAS.flatMap((d) => (porDisc.has(d) ? [porDisc.get(d)!] : []))];
  for (const c of linhas) c.ilusao = c.certeza.n >= AMOSTRA_ILUSAO && c.certeza.acertos / c.certeza.n < CERTEZA_MINIMA;
  return linhas;
}

// ---------- Horas líquidas (só com a aba visível, teto por questão) ----------
// Só o tempo ativo em cada questão (aba visível, contado no site); uma questão vale no máximo 10 min,
// para uma aba esquecida aberta não virar "estudo".
export const TEMPO_MAX_QUESTAO_SEG = 600;
export function horasLiquidasSemana(tents: TentativaBruta[], disciplinaDo: Map<string, Disciplina>, agora = new Date()) {
  const desde = agora.getTime() - 7 * 86_400_000;
  const seg = new Map<Disciplina, number>();
  for (const t of tents) {
    const d = disciplinaDo.get(t.topicoId);
    if (!d || !t.tempoSeg || new Date(t.data).getTime() < desde) continue;
    seg.set(d, (seg.get(d) ?? 0) + Math.min(TEMPO_MAX_QUESTAO_SEG, Math.max(0, t.tempoSeg)));
  }
  return DISCIPLINAS.flatMap((d) => (seg.get(d) ? [{ disciplina: d, seg: Math.round(seg.get(d)!) }] : []));
}

// Ciclos de foco: 25/5 ou 50/10 minutos de foco/pausa
export const CICLOS_FOCO = { "25/5": { foco: 25, pausa: 5 }, "50/10": { foco: 50, pausa: 10 } } as const;
export type CicloFoco = keyof typeof CICLOS_FOCO | "desligado";

export const MENSAGEM_MOTIVO: Record<MotivoErro, string> = {
  nao_sabia: "Anotado. Esse tópico sobe na sua fila de estudo nas próximas duas semanas.",
  confundi: "Anotado. A próxima questão é parecida, para você separar os dois conceitos.",
  desatencao: "Anotado. Ela volta na revisão com tempo marcado.",
  chutei: `Anotado. Ela volta daqui a ${REVISAO_CHUTE_MIN} minutos, ainda nesta sessão.`,
};
