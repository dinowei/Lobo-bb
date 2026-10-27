// Estudo do tema (v1.1, item 3): Aula → questões por subtema (fácil → difícil) → revisão dos erros do tema → concluído.
// E a mistura (Revisões e Simulados) só com temas já abertos. Puro: servidor e demo.
import { SUBTOPICO_POR_ID } from "./subtopicos.js";
import { statusTema, type PlacarTema } from "./grade.js";

const normalizar = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const PARADAS = new Set(["como", "para", "pelo", "pela", "entre", "sobre", "com", "das", "dos", "uma", "suas", "seus", "outros", "outras", "demais", "geral", "nocoes", "conceitos", "conceito"]);
const palavras = (s: string) => new Set(normalizar(s).split(/[^\p{L}\p{N}]+/u).filter((p) => p.length >= 4 && !PARADAS.has(p)));

// subtemas = subtópicos do edital dos assuntos do tema; assunto dividido entre temas (Regência × Crase)
// fica só com os subtópicos que falam do tema
export function subtemasDoTema(subtopico: string, topicos: { assunto: string; subtopicos: string[] }[], temas: string[]): string[] {
  const s = SUBTOPICO_POR_ID.get(subtopico);
  if (!s) return [];
  const chaves = [s.nome, ...(s.palavras ?? [])].map(normalizar);
  return s.topicos.flatMap((assunto) => {
    const lista = topicos.find((t) => t.assunto === assunto)?.subtopicos ?? [];
    const dividido = temas.filter((id) => SUBTOPICO_POR_ID.get(id)?.topicos.includes(assunto)).length > 1;
    return dividido ? lista.filter((x) => chaves.some((c) => normalizar(x).includes(c))) : lista;
  });
}

// subtema de uma questão (sem IA): o subtema do edital com mais palavras em comum com o enunciado e as
// alternativas; empate fica com o primeiro na ordem do edital; nenhuma palavra em comum = -1 (vai para o fim)
export function subtemaDaQuestao(texto: string, subtemas: string[]): number {
  const doTexto = palavras(texto);
  let melhor = -1;
  let pontos = 0;
  subtemas.forEach((s, i) => {
    const p = [...palavras(s)].filter((w) => doTexto.has(w)).length;
    if (p > pontos) { pontos = p; melhor = i; }
  });
  return melhor;
}

// ordem de estudo das NOVAS do tema: subtema na ordem do edital (sem subtema por último) → dificuldade
// crescente → fonte (oficial, cursinho, gerada: decisão do dono, 26/10/2026)
export const FAIXA_FONTE: Record<string, number> = { oficial: 0, cursinho: 1 };
export function ordenarParaEstudo<T extends { subtema: number; dificuldade: number; origem?: string }>(qs: T[]): T[] {
  const sub = (x: T) => (x.subtema < 0 ? Number.MAX_SAFE_INTEGER : x.subtema);
  const fonte = (x: T) => FAIXA_FONTE[x.origem ?? ""] ?? 2;
  return [...qs].sort((a, b) => sub(a) - sub(b) || a.dificuldade - b.dificuldade || fonte(a) - fonte(b));
}

// revisão dos erros do tema: as questões cuja ÚLTIMA resposta foi errada (no máximo ERROS_POR_SESSAO por sessão)
export const ERROS_POR_SESSAO = 10;
export function errosDoTema(tentativas: { questaoId: string; acertou: boolean; data: string }[]): string[] {
  const ultima = new Map<string, { acertou: boolean; data: string }>();
  for (const t of tentativas) {
    const u = ultima.get(t.questaoId);
    if (!u || t.data > u.data) ultima.set(t.questaoId, t);
  }
  return [...ultima].filter(([, u]) => !u.acertou).sort((a, b) => a[1].data.localeCompare(b[1].data)).map(([id]) => id);
}

// mistura (Revisões e Simulados): só temas já concluídos (inclui o provisório); se nenhum concluído, os em
// andamento. Nunca tema não iniciado. null = nada iniciado ainda (sem restrição: não há o que misturar)
export function temasParaMistura(placares: Map<string, PlacarTema>): Set<string> | null {
  const fechados = new Set<string>();
  const andamento = new Set<string>();
  for (const [sub, p] of placares) {
    const s = statusTema(p);
    if (s === "concluido" || s === "provisorio") fechados.add(sub);
    else if (s === "em_andamento") andamento.add(sub);
  }
  return fechados.size ? fechados : andamento.size ? andamento : null;
}
