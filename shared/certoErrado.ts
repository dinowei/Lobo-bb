// Motor Certo/Errado (F10), só código: nota com a penalidade da banca, recomendação de "em branco"
// pela taxa de acerto histórica do aluno no assunto, e derivação de itens a partir da múltipla escolha.
// Servidor e modo demo usam as mesmas funções.
import { BANCAS, notaPelaBanca, type IdBanca } from "./concursos.js";

export type RespostaCE = "C" | "E";
export type GabaritoCE = RespostaCE | "anulada";

// item anulado: a pontuação vai para todos (cláusula padrão dos editais Cebraspe)
export function corrigirCE(respostas: { resposta: RespostaCE | null; gabarito: GabaritoCE }[], banca: IdBanca) {
  let acertos = 0, erros = 0, brancos = 0;
  for (const r of respostas) {
    if (r.gabarito === "anulada") acertos++;
    else if (r.resposta === null) brancos++;
    else if (r.resposta === r.gabarito) acertos++;
    else erros++;
  }
  const nota = notaPelaBanca(banca, { acertos, erros, brancos });
  return { acertos, erros, brancos, nota, maxima: respostas.length * BANCAS[banca].nota.acerto };
}

export const MIN_RESPOSTAS_RECOMENDAR = 5;

export interface RecomendacaoBranco { recomenda: "responder" | "branco" | "sem_dados"; taxa: number | null; motivo: string }

// Vale responder quando o ganho esperado é positivo: p·acerto + (1−p)·erro > branco.
// p = (acertos + 1) / (n + 2) (estimativa com 1 acerto e 1 erro de partida, para não confiar em poucos dados).
export function recomendarBranco(historico: { acertos: number; total: number }, banca: IdBanca): RecomendacaoBranco {
  const { acerto, erro, branco } = BANCAS[banca].nota;
  if (erro >= branco) return { recomenda: "responder", taxa: null, motivo: "Nesta banca errar não tira ponto: responda sempre." };
  if (historico.total < MIN_RESPOSTAS_RECOMENDAR)
    return { recomenda: "sem_dados", taxa: null, motivo: `Ainda são ${historico.total} respostas Certo/Errado neste assunto; a partir de ${MIN_RESPOSTAS_RECOMENDAR} o Binho calcula se vale chutar.` };
  const p = (historico.acertos + 1) / (historico.total + 2);
  const limiar = (branco - erro) / (acerto - erro); // Cebraspe (1, −1, 0): 50%
  const pct = Math.round(p * 100);
  const lim = Math.round(limiar * 100);
  return p > limiar
    ? { recomenda: "responder", taxa: p, motivo: `Você acerta ~${pct}% dos itens deste assunto (${historico.acertos} de ${historico.total}). Acima de ${lim}%, responder dá mais ponto que deixar em branco.` }
    : { recomenda: "branco", taxa: p, motivo: `Você acerta ~${pct}% dos itens deste assunto (${historico.acertos} de ${historico.total}). Abaixo de ${lim}%, cada erro anula um acerto: na dúvida, deixe em branco.` };
}

export interface AlternativaFonte { letra: string; texto: string; correta: boolean; explicacao?: string | null }
export interface ItemDerivado { letraOrigem: string; base: string; gabarito: RespostaCE; explicacao: string }

// A certa vira Certo, as erradas viram Errado, com a explicação já auditada da alternativa.
// O código monta; a IA só reescreve "base" como afirmação autônoma (sem mudar o sentido) e o auditor julga às cegas.
// Diversidade antes de gerar (esteira de conteúdo, decisão do dono 26/10/2026): no máximo 2–3 itens por
// questão. Fica a correta (vira item "C") e as erradas que testam pontos MAIS diferentes entre si, medidas
// pela explicação de cada alternativa (menor sobreposição de palavras com as já escolhidas).
const palavrasDe = (s: string) => new Set(s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").match(/\p{L}{4,}/gu) ?? []);
const sobreposicao = (a: Set<string>, b: Set<string>) => {
  const inter = [...a].filter((x) => b.has(x)).length;
  return inter / Math.max(1, Math.min(a.size, b.size));
};
export function escolherItensDiversos(itens: ItemDerivado[], max = 3): ItemDerivado[] {
  const escolhidos = itens.filter((i) => i.gabarito === "C").slice(0, 1);
  const resto = itens.filter((i) => i.gabarito !== "C");
  while (escolhidos.length < max && resto.length) {
    const ja = escolhidos.map((e) => palavrasDe(e.explicacao));
    // a errada cuja explicação menos se parece com as escolhidas (empate: a primeira, pela letra)
    let melhor = 0;
    let menor = Infinity;
    resto.forEach((r, k) => {
      const p = palavrasDe(r.explicacao);
      const s = ja.length ? Math.max(...ja.map((x) => sobreposicao(p, x))) : 0;
      if (s < menor) { menor = s; melhor = k; }
    });
    escolhidos.push(resto.splice(melhor, 1)[0]);
  }
  return escolhidos.sort((a, b) => a.letraOrigem.localeCompare(b.letraOrigem));
}

export function derivarItens(q: { enunciado: string; alternativas: AlternativaFonte[] }): ItemDerivado[] {
  if (q.alternativas.filter((a) => a.correta).length !== 1) throw new Error("A questão precisa de exatamente uma alternativa correta");
  return q.alternativas.map((a) => {
    if (!a.explicacao?.trim()) throw new Error(`Alternativa ${a.letra} sem explicação: não deriva (regra 5)`);
    return { letraOrigem: a.letra, base: `${q.enunciado.trim()}\n${a.texto.trim()}`, gabarito: a.correta ? "C" : "E", explicacao: a.explicacao.trim() };
  });
}
