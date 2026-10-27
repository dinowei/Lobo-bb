// Grade curricular (v1.1, estudo sequencial): Matéria → Tema → Subtema, a partir da trilha única.
// Grade LIVRE com ordem sugerida: qualquer tema abre a qualquer hora; o app destaca o próximo da sequência.
// A regra de "tema concluído" mora aqui (motor puro, servidor e demo). Configurável pelas constantes.
import type { Disciplina } from "./tipos.js";

export const CONCLUIR_ACERTO = 0.7; // ≥ 70%…
export const CONCLUIR_ULTIMAS = 20; // …nas últimas 20 questões do tema (tema com 20+ aprovadas)
export const CONCLUIR_FIRME = 15; // abaixo de 15 aprovadas, bater a meta dá só "concluído provisório"; de 15 a 19, janela de 15
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

export type StatusTema = "nao_iniciado" | "em_andamento" | "provisorio" | "concluido";
export const NOME_STATUS: Record<StatusTema, string> = { nao_iniciado: "não iniciado", em_andamento: "em andamento", provisorio: "concluído provisório", concluido: "concluído" };

export interface PlacarTema {
  respondidas: number; // questões distintas já respondidas no tema (fora simulado)
  recentes: boolean[]; // últimas respostas do tema, da mais nova para a mais antiga (até 20)
  aprovadas: number; // questões aprovadas do tema no banco
}

// janela de respostas que o tema precisa: 20+ aprovadas → 20; 15 a 19 → 15; menos → todas (mínimo 5); sem aprovadas → 20
export const janelaDoTema = (aprovadas: number) =>
  aprovadas >= CONCLUIR_ULTIMAS || !aprovadas ? CONCLUIR_ULTIMAS : aprovadas >= CONCLUIR_FIRME ? CONCLUIR_FIRME : Math.max(CONCLUIR_MINIMO, aprovadas);

// concluído = ≥ 70% nas últimas 20 (ou 15, com 15 a 19 aprovadas). Tema com menos de 15 aprovadas que bate a
// meta fica "concluído provisório": vira concluído quando chegar a 15 e mantiver ≥ 70% nas últimas 15.
export function statusTema(t: PlacarTema): StatusTema {
  if (!t.respondidas || !t.recentes.length) return "nao_iniciado";
  const janela = janelaDoTema(t.aprovadas);
  const ultimas = t.recentes.slice(0, janela);
  const bateu = ultimas.length >= janela && ultimas.filter(Boolean).length / janela >= CONCLUIR_ACERTO;
  if (!bateu) return "em_andamento";
  return t.aprovadas >= CONCLUIR_FIRME ? "concluido" : "provisorio";
}

// questões novas do tema ainda não respondidas (provisório "volta" quando chegam)
export const novasDoTema = (t: PlacarTema) => Math.max(0, t.aprovadas - t.respondidas);
// conta para a sequência? concluído não; provisório só enquanto não chegam questões novas
export const fechadoNaSequencia = (status: StatusTema, novas: number) => status === "concluido" || (status === "provisorio" && novas === 0);

export function proximoPasso(status: StatusTema, t: PlacarTema): string {
  if (status === "concluido") return "Revisar quando a Lo chamar";
  if (status === "provisorio") {
    const novas = novasDoTema(t);
    return novas ? `${novas} ${novas === 1 ? "questão nova chegou" : "questões novas chegaram"}` : `Fecha de vez quando o tema tiver ${CONCLUIR_FIRME} questões`;
  }
  if (status === "nao_iniciado") return t.aprovadas ? "Começar pela aula" : "Aula em preparo; questões chegando";
  const faltam = Math.max(0, janelaDoTema(t.aprovadas) - t.recentes.length);
  return faltam ? `Mais ${faltam} questões do tema` : "Acertar 70% nas últimas questões";
}

export interface TemaGrade {
  n: number;
  subtopico: string;
  nome: string;
  status: StatusTema;
  acerto: number | null; // % nas últimas respostas (janela do tema)
  proximo: string;
  subtemas: string[];
  proximoDaSequencia: boolean;
  disciplina: Disciplina | null;
  aprovadas: number;
  novas: number; // aprovadas ainda não respondidas
  faltam: number; // respostas que ainda faltam para poder fechar o tema (base do cronograma)
}
export interface MateriaGrade { id: IdMateria; nome: string; temas: TemaGrade[]; concluidos: number }

// monta a grade: matérias na ordem em que aparecem na trilha; temas na ordem da trilha; o próximo da sequência
// é o primeiro tema não fechado (provisório sem questão nova libera o próximo). Lente de concurso filtra antes.
export function montarGrade(
  temas: { n: number; subtopico: string; nome: string; disciplina: Disciplina | null; subtemas: string[] }[],
  desempenho: Map<string, PlacarTema>
): MateriaGrade[] {
  const ordenados = [...temas].sort((a, b) => a.n - b.n);
  const vazio: PlacarTema = { respondidas: 0, recentes: [], aprovadas: 0 };
  const linhas = ordenados.map((t) => {
    const d = desempenho.get(t.subtopico) ?? vazio;
    const status = statusTema(d);
    const novas = novasDoTema(d);
    const janela = janelaDoTema(d.aprovadas);
    const ultimas = d.recentes.slice(0, janela);
    // questões que faltam: o que falta para a janela, pelo menos 5 (ou as novas que existem, se forem menos)
    const faltam = fechadoNaSequencia(status, novas) ? 0 : status === "provisorio" ? novas
      : Math.max(janela - d.recentes.length, novas ? Math.min(CONCLUIR_MINIMO, novas) : CONCLUIR_MINIMO);
    const linha: TemaGrade = {
      n: t.n, subtopico: t.subtopico, nome: t.nome, status,
      acerto: ultimas.length ? Math.round((ultimas.filter(Boolean).length / ultimas.length) * 100) : null,
      proximo: proximoPasso(status, d), subtemas: t.subtemas, proximoDaSequencia: false,
      disciplina: t.disciplina, aprovadas: d.aprovadas, novas, faltam,
    };
    return { materia: materiaDa(t.disciplina), linha };
  });
  const proximo = linhas.find((l) => l.materia && !fechadoNaSequencia(l.linha.status, l.linha.novas));
  if (proximo) proximo.linha.proximoDaSequencia = true;
  const ordemMaterias = [...new Set(linhas.map((l) => l.materia).filter((m): m is IdMateria => !!m))];
  return ordemMaterias.map((id) => {
    const ts = linhas.filter((l) => l.materia === id).map((l) => l.linha);
    return { id, nome: MATERIAS.find((m) => m.id === id)!.nome, temas: ts, concluidos: ts.filter((x) => x.status === "concluido").length };
  });
}

// fila do cronograma: a partir do próximo da sequência, os temas não fechados na ordem da trilha
// (matéria por matéria, tema por tema); temas que ficaram para trás vêm depois
export function filaDaGrade(grade: MateriaGrade[]): { subtopico: string; nome: string; disciplina: Disciplina; faltam: number }[] {
  const todos = grade.flatMap((m) => m.temas).sort((a, b) => a.n - b.n);
  const i = Math.max(0, todos.findIndex((t) => t.proximoDaSequencia));
  return [...todos.slice(i), ...todos.slice(0, i)]
    .filter((t): t is TemaGrade & { disciplina: Disciplina } => !!t.disciplina && t.faltam > 0)
    .map((t) => ({ subtopico: t.subtopico, nome: t.nome, disciplina: t.disciplina, faltam: t.faltam }));
}

// tema do dia (Painel, mesma fonte do Plano): o próximo da sequência da Grade. Se o aluno escolheu outro tema
// à mão ("estudando"), o Painel mostra esse enquanto ele não fechar, sem mexer na sequência.
export function temaDoDia(grade: MateriaGrade[], estudando?: string | null): { tema: TemaGrade; manual: boolean } | null {
  const todos = grade.flatMap((m) => m.temas);
  const proximo = todos.find((t) => t.proximoDaSequencia) ?? null;
  const escolhido = estudando ? todos.find((t) => t.subtopico === estudando) : undefined;
  if (escolhido && escolhido !== proximo && !fechadoNaSequencia(escolhido.status, escolhido.novas)) return { tema: escolhido, manual: true };
  return proximo ? { tema: proximo, manual: false } : null;
}
