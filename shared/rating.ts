// Dificuldade calibrada por rating Elo — puro, usado pelo servidor e pelo demo.
// Aluno: um rating por disciplina (começa em 1200). Questão: começa pela dificuldade rotulada e se
// ajusta com as respostas. Chute certo conta meio acerto.
import type { Confianca } from "./tipos.js";

export const RATING_ALUNO_INICIAL = 1200;
export const K_ALUNO = 32;
export const K_QUESTAO = 16;
export const RESPOSTAS_PARA_CALIBRAR = 5; // a partir daqui a dificuldade exibida vem do rating
export const ALVO_ACIMA = 50; // o treino puxa levemente para cima

export const ratingInicialQuestao = (dificuldade: number) => 1000 + 150 * (Math.min(5, Math.max(1, Math.round(dificuldade || 3))) - 1);

// probabilidade de o aluno acertar a questão
export const esperado = (aluno: number, questao: number) => 1 / (1 + 10 ** ((questao - aluno) / 400));

// placar da resposta: acerto 1, chute certo 0,5, erro 0
export const placar = (acertou: boolean, confianca?: Confianca) => (!acertou ? 0 : confianca === 1 ? 0.5 : 1);

export function atualizarRatings(aluno: number, questao: number, acertou: boolean, confianca?: Confianca) {
  const e = esperado(aluno, questao);
  const s = placar(acertou, confianca);
  return { aluno: aluno + K_ALUNO * (s - e), questao: questao - K_QUESTAO * (s - e) };
}

// 1–5 a partir do rating (faixas centradas nos valores iniciais 1000, 1150, 1300, 1450, 1600)
export function dificuldadeDoRating(rating: number): number {
  return rating < 1075 ? 1 : rating < 1225 ? 2 : rating < 1375 ? 3 : rating < 1525 ? 4 : 5;
}
export const dificuldadeExibida = (rotulada: number, rating?: number | null, respostas?: number | null) =>
  rating != null && (respostas ?? 0) >= RESPOSTAS_PARA_CALIBRAR ? dificuldadeDoRating(rating) : rotulada;

// Peso de sorteio: quanto mais perto do alvo (aluno + 50), mais chance; ninguém fica com zero
export const pesoPorProximidade = (ratingQuestao: number, alvo: number) => Math.exp(-Math.abs(ratingQuestao - alvo) / 150);

// Reprocessa um histórico (migração e modo demo): tentativas em ordem de data
// ("fixar": o diagnóstico define o nível da disciplina naquele ponto do histórico)
export type EventoRating = { questaoId: string; disciplina: string; acertou: boolean; confianca?: Confianca } | { fixar: number; disciplina: string };
export function reprocessar(tentativas: EventoRating[], dificuldadeDe: (questaoId: string) => number) {
  const alunos = new Map<string, { rating: number; n: number }>();
  const questoes = new Map<string, { rating: number; n: number }>();
  for (const t of tentativas) {
    if ("fixar" in t) {
      alunos.set(t.disciplina, { rating: t.fixar, n: alunos.get(t.disciplina)?.n ?? 0 });
      continue;
    }
    const a = alunos.get(t.disciplina) ?? { rating: RATING_ALUNO_INICIAL, n: 0 };
    const q = questoes.get(t.questaoId) ?? { rating: ratingInicialQuestao(dificuldadeDe(t.questaoId)), n: 0 };
    const r = atualizarRatings(a.rating, q.rating, t.acertou, t.confianca);
    alunos.set(t.disciplina, { rating: r.aluno, n: a.n + 1 });
    questoes.set(t.questaoId, { rating: r.questao, n: q.n + 1 });
  }
  return { alunos, questoes };
}
