// Grade curricular (v1.1, estudo sequencial): Matéria → Tema → Subtema, a partir da trilha única.
// Grade LIVRE com ordem sugerida: qualquer tema abre a qualquer hora; o app destaca o próximo da sequência.
// A regra de "tema concluído" mora aqui (motor puro, servidor e demo). Configurável pelas constantes.
import type { Placar } from "./desempenhoTema.js";
import type { Disciplina } from "./tipos.js";

export const CONCLUIR_ACERTO = 0.7; // ≥ 70%…
export const CONCLUIR_ULTIMAS = 20; // …nas últimas 20 questões do tema
export const CONCLUIR_MINIMO = 5; // tema com poucas aprovadas: pelo menos 5 respostas

export type IdMateria = "portugues" | "matematica" | "raciocinio" | "informatica" | "bancarios" | "atualidades" | "vendas" | "direito" | "ingles" | "tjsp" | "cvm" | "bacen";
export const MATERIAS: { id: IdMateria; nome: string; disciplinas: Disciplina[] }[] = [
  { id: "portugues", nome: "Português", disciplinas: ["lingua_portuguesa"] },
  { id: "matematica", nome: "Matemática e Financeira", disciplinas: ["matematica", "matematica_financeira", "probabilidade_estatistica"] },
  { id: "raciocinio", nome: "Raciocínio Lógico", disciplinas: ["raciocinio_logico"] },
  { id: "informatica", nome: "Informática", disciplinas: ["informatica", "fluencia_dados"] },
  { id: "bancarios", nome: "Conhecimentos Bancários", disciplinas: ["conhecimentos_bancarios"] },
  { id: "atualidades", nome: "Atualidades", disciplinas: ["atualidades_mercado_financeiro", "atualidades"] },
  { id: "vendas", nome: "Vendas e Negociação", disciplinas: ["vendas_negociacao"] },
  { id: "direito", nome: "Direito", disciplinas: ["direito_constitucional", "direito_administrativo", "direito_penal", "direito_processual_civil", "direito_processual_penal", "fundamentos_direito"] },
  { id: "ingles", nome: "Inglês", disciplinas: ["lingua_inglesa"] },
  { id: "tjsp", nome: "Específicas TJ-SP", disciplinas: ["normas_corregedoria"] },
  { id: "cvm", nome: "Específicas CVM", disciplinas: ["mercado_valores_mobiliarios"] },
  { id: "bacen", nome: "Específicas BACEN", disciplinas: ["gestao_publica", "suporte_tecnico_administrativo"] },
];
export const materiaDa = (d: Disciplina | null): IdMateria | null => (d ? MATERIAS.find((m) => m.disciplinas.includes(d))?.id ?? null : null);

export type StatusTema = "nao_iniciado" | "em_andamento" | "concluido";
export const NOME_STATUS: Record<StatusTema, string> = { nao_iniciado: "não iniciado", em_andamento: "em andamento", concluido: "concluído" };

// concluído = ≥ 70% nas últimas 20 respostas do tema; tema com menos de 20 aprovadas fecha com todas elas
// respondidas (mínimo 5). Sem resposta nenhuma: não iniciado.
export function statusTema(t: { respondidas: number; ultimas: Placar; aprovadas: number }): StatusTema {
  if (!t.respondidas || !t.ultimas.n) return "nao_iniciado";
  const precisa = Math.max(CONCLUIR_MINIMO, Math.min(CONCLUIR_ULTIMAS, t.aprovadas));
  return t.ultimas.n >= precisa && t.ultimas.a / t.ultimas.n >= CONCLUIR_ACERTO ? "concluido" : "em_andamento";
}

export function proximoPasso(status: StatusTema, t: { ultimas: Placar; aprovadas: number }): string {
  if (status === "concluido") return "Revisar quando a Lo chamar";
  if (status === "nao_iniciado") return t.aprovadas ? "Começar pela aula" : "Aula em preparo; questões chegando";
  const precisa = Math.max(CONCLUIR_MINIMO, Math.min(CONCLUIR_ULTIMAS, t.aprovadas));
  const faltam = Math.max(0, precisa - t.ultimas.n);
  return faltam ? `Mais ${faltam} questões do tema` : "Acertar 70% nas últimas questões";
}

export interface TemaGrade {
  n: number;
  subtopico: string;
  nome: string;
  status: StatusTema;
  acerto: number | null; // % nas últimas respostas
  proximo: string;
  subtemas: string[];
  proximoDaSequencia: boolean;
  disciplina: Disciplina | null;
  faltam: number; // respostas que ainda faltam para poder fechar o tema (base do cronograma)
}
export interface MateriaGrade { id: IdMateria; nome: string; temas: TemaGrade[]; concluidos: number }

// monta a grade: matérias na ordem em que aparecem na trilha; temas na ordem da trilha; o próximo da sequência
// é o primeiro tema não concluído (o da matéria em que o dono está). Lente de concurso filtra antes.
export function montarGrade(
  temas: { n: number; subtopico: string; nome: string; disciplina: Disciplina | null; subtemas: string[] }[],
  desempenho: Map<string, { respondidas: number; ultimas: Placar; aprovadas: number }>
): MateriaGrade[] {
  const ordenados = [...temas].sort((a, b) => a.n - b.n);
  const vazio = { respondidas: 0, ultimas: { n: 0, a: 0 }, aprovadas: 0 };
  const linhas = ordenados.map((t) => {
    const d = desempenho.get(t.subtopico) ?? vazio;
    const status = statusTema(d);
    // tema sem aprovadas ainda: conta a meta cheia (as questões chegam pela esteira); em andamento: pelo menos 5
    const precisa = d.aprovadas ? Math.max(CONCLUIR_MINIMO, Math.min(CONCLUIR_ULTIMAS, d.aprovadas)) : CONCLUIR_ULTIMAS;
    const faltam = status === "concluido" ? 0 : Math.max(CONCLUIR_MINIMO, precisa - d.ultimas.n);
    return { materia: materiaDa(t.disciplina), linha: { n: t.n, subtopico: t.subtopico, nome: t.nome, status, acerto: d.ultimas.n ? Math.round((d.ultimas.a / d.ultimas.n) * 100) : null, proximo: proximoPasso(status, d), subtemas: t.subtemas, proximoDaSequencia: false, disciplina: t.disciplina, faltam } as TemaGrade };
  });
  const proximo = linhas.find((l) => l.materia && l.linha.status !== "concluido");
  if (proximo) proximo.linha.proximoDaSequencia = true;
  const ordemMaterias = [...new Set(linhas.map((l) => l.materia).filter((m): m is IdMateria => !!m))];
  return ordemMaterias.map((id) => {
    const ts = linhas.filter((l) => l.materia === id).map((l) => l.linha);
    return { id, nome: MATERIAS.find((m) => m.id === id)!.nome, temas: ts, concluidos: ts.filter((x) => x.status === "concluido").length };
  });
}

// fila do cronograma: a partir do próximo da sequência, os temas não concluídos na ordem da trilha
// (matéria por matéria, tema por tema); temas que ficaram para trás vêm depois
export function filaDaGrade(grade: MateriaGrade[]): { subtopico: string; nome: string; disciplina: Disciplina; faltam: number }[] {
  const todos = grade.flatMap((m) => m.temas).sort((a, b) => a.n - b.n);
  const i = Math.max(0, todos.findIndex((t) => t.proximoDaSequencia));
  return [...todos.slice(i), ...todos.slice(0, i)]
    .filter((t): t is TemaGrade & { disciplina: Disciplina } => t.status !== "concluido" && !!t.disciplina && t.faltam > 0)
    .map((t) => ({ subtopico: t.subtopico, nome: t.nome, disciplina: t.disciplina, faltam: t.faltam }));
}
