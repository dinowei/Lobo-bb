// Espaço da Lo (assistente e voz do Binho): regras puras, usadas pelo servidor e pelo modo demo.
// "Seu dia" e "Recados" são montados POR CÓDIGO a partir de dados que já existem (relatórios das janelas A/B,
// trilha, fichas, provas); a posição de cada áudio fica salva por aluno ("continuar de onde parei").
import type { Disciplina } from "./tipos.js";

export type TipoAudio = "ficha" | "aula" | "pontos";
export type EstadoTema = "novo" | "reforco" | "concluido" | "retomada";

export interface PosicaoAudio {
  fracao: number; // 0–1 do áudio (ou das frases, na voz do navegador)
  frase: number; // índice da frase (voz do navegador)
  segundos: number; // posição no MP3 (voz da NVIDIA)
  ouvido: boolean; // passou de LIMIAR_OUVIDO uma vez: fica ouvido
  em: string;
}
export interface ItemAudioDTO {
  id: string; // estável: tipo-referência (só [a-z0-9_-], vira chave no banco)
  tipo: TipoAudio;
  titulo: string;
  subtopico: string;
  tema: string;
  disciplina: Disciplina | null;
  texto: string; // a transcrição é este texto (o que a Lo lê)
  pronto: boolean; // MP3 da voz da NVIDIA já no cache (senão: sob demanda, ou a voz do navegador)
  posicao: PosicaoAudio | null;
}
export interface LinhaDiaDTO { tipo: "tema" | "material" | "revisoes" | "janela" | "alerta"; texto: string }
export interface RecadoDTO { tipo: "conflito" | "selo" | "prova" | "ficha"; texto: string; subtopico?: string; em?: string }
export interface EspacoLoDTO {
  seuDia: LinhaDiaDTO[];
  temaDoDia: { subtopico: string; nome: string } | null;
  playlist: ItemAudioDTO[]; // "Ouvir no almoço": o tema do dia
  biblioteca: ItemAudioDTO[]; // "Áudios da Lo": tudo que já foi gerado (ou já ouvido)
  recados: RecadoDTO[];
}

export const LIMIAR_OUVIDO = 0.9;
export const TERMINOU = 0.98;

export const idAudio = (tipo: TipoAudio, ref: string) => `${tipo}-${ref.toLowerCase().replace(/[^a-z0-9_-]/g, "_")}`;

// ---------- itens de áudio de um tema (só conteúdo aprovado chega aqui) ----------
export function textoFicha(nome: string, afirmacoes: string[]) {
  return [`Ficha: ${nome}.`, ...afirmacoes.map((a) => a.trim()).filter(Boolean)].join("\n");
}
export function textoPontos(nome: string, pontos: string[]) {
  return [`Pontos-chave: ${nome}.`, ...pontos.map((p) => p.trim().replace(/\.?$/, "."))].join("\n");
}

export function itensDoTema(t: {
  subtopico: string; nome: string; disciplina: Disciplina | null;
  ficha: string[] | null; aulas: { topicoId: string; assunto: string; texto: string }[]; pontos: string[];
}): ItemAudioDTO[] {
  const base = { subtopico: t.subtopico, tema: t.nome, disciplina: t.disciplina, pronto: false, posicao: null };
  const itens: ItemAudioDTO[] = [];
  if (t.ficha?.length) itens.push({ ...base, id: idAudio("ficha", t.subtopico), tipo: "ficha", titulo: `Ficha: ${t.nome}`, texto: textoFicha(t.nome, t.ficha) });
  for (const a of t.aulas) itens.push({ ...base, id: idAudio("aula", a.topicoId), tipo: "aula", titulo: `Aula: ${a.assunto}`, texto: a.texto });
  if (t.pontos.length) itens.push({ ...base, id: idAudio("pontos", t.subtopico), tipo: "pontos", titulo: `Pontos-chave: ${t.nome}`, texto: textoPontos(t.nome, t.pontos) });
  return itens;
}

// uma aula pode servir a dois temas (Crase e Regência usam o mesmo tópico): na biblioteca, entra uma vez só
export function unicos(itens: ItemAudioDTO[]) {
  const vistos = new Set<string>();
  return itens.filter((i) => !vistos.has(i.id) && !!vistos.add(i.id));
}

// ---------- posição salva ("continuar de onde parei") ----------
const limitar = (n: number, min: number, max: number) => (Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min);

export function registrarPosicao(anterior: PosicaoAudio | null, p: { fracao: number; frase: number; segundos: number }, agora = new Date()): PosicaoAudio {
  const fracao = limitar(p.fracao, 0, 1);
  return {
    fracao,
    frase: Math.round(limitar(p.frase, 0, 10_000)),
    segundos: limitar(p.segundos, 0, 36_000),
    ouvido: !!anterior?.ouvido || fracao >= LIMIAR_OUVIDO,
    em: agora.toISOString(),
  };
}

// de onde recomeçar: do início se nunca tocou ou se terminou; senão volta um pouco (3 s ou 1 frase) para dar contexto
export function pontoDeRetomada(p: PosicaoAudio | null): { frase: number; segundos: number } {
  if (!p || p.fracao >= TERMINOU) return { frase: 0, segundos: 0 };
  return { frase: Math.max(0, p.frase - 1), segundos: Math.max(0, p.segundos - 3) };
}

// ---------- "Seu dia" ----------
type Etapa = { etapa: string; status: "ok" | "pulada" | "falhou"; detalhe: string };
export interface EntradaDia {
  modo: "tema" | "sabado" | "domingo" | "prova";
  tema: { nome: string; novas: number } | null;
  fichaPronta: boolean;
  aulaPronta: boolean;
  audioPronto: boolean;
  revisoesVencidas: number;
  janelas: { janela: "A" | "B"; inicio: string; aprovadas: number | null; etapas: Etapa[] }[];
  inicioJanelaB: string; // "18:00"
  demo?: boolean; // modo demo: não há noturno nem Janela B
}

const FUSO = "America/Sao_Paulo";
const diaBrt = (d: Date | string) => new Date(d).toLocaleDateString("sv-SE", { timeZone: FUSO });
const minutosBrt = (d: Date) => {
  const [h, m] = d.toLocaleTimeString("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).split(":").map(Number);
  return h * 60 + m;
};
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export function resumirDia(e: EntradaDia, agora = new Date()): LinhaDiaDTO[] {
  const linhas: LinhaDiaDTO[] = [];
  if (e.tema) {
    linhas.push({ tipo: "tema", texto: `Tema do dia: ${e.tema.nome}. ${e.tema.novas ? `${plural(e.tema.novas, "questão nova pronta", "questões novas prontas")} para você.` : "Sem questões novas: hoje é revisão do tema."}` });
    const tem = [e.fichaPronta && "ficha", e.aulaPronta && "aula"].filter(Boolean) as string[];
    linhas.push({
      tipo: "material",
      texto: tem.length
        ? `${tem.length === 2 ? "Ficha e aula prontas" : tem[0] === "ficha" ? "Ficha pronta" : "Aula pronta"}${e.audioPronto ? ", com áudio da Lo já gravado" : "; o áudio sai na hora que você der play"}.`
        : "A ficha deste tema ainda não foi aprovada: vale começar pelas questões.",
    });
  } else {
    linhas.push({ tipo: "tema", texto: e.modo === "domingo" ? "Domingo: dia de revisões e do caderno de erros, sem tema novo." : "Sem tema do dia agora: escolha um na trilha." });
  }
  linhas.push({ tipo: "revisoes", texto: e.revisoesVencidas ? `${plural(e.revisoesVencidas, "revisão vencida", "revisões vencidas")} esperando por você.` : "Revisões em dia." });

  if (e.demo) {
    linhas.push({ tipo: "janela", texto: "No modo demo não há noturno: a Lo lê com a voz do navegador." });
    return linhas;
  }
  const hoje = diaBrt(agora);
  const deHoje = (j: "A" | "B") => e.janelas.filter((r) => r.janela === j && diaBrt(r.inicio) === hoje).sort((a, b) => b.inicio.localeCompare(a.inicio))[0];
  const a = deHoje("A");
  const b = deHoje("B");
  const falhas = (r: { etapas: Etapa[] }) => r.etapas.filter((x) => x.status === "falhou");
  const aprovadas = (r: { aprovadas: number | null }) => (r.aprovadas != null ? ` ${plural(r.aprovadas, "questão aprovada", "questões aprovadas")} no banco.` : "");
  if (a) {
    linhas.push({ tipo: "janela", texto: `O noturno rodou.${aprovadas(a)}` });
    const f = falhas(a);
    if (f.length && b) linhas.push({ tipo: "janela", texto: `A Janela B refez o que faltou (${f.map((x) => x.etapa).join(", ")}).` });
    else if (f.length) linhas.push({ tipo: "alerta", texto: `Não fechou esta noite: ${f.map((x) => `${x.etapa}${x.detalhe ? ` (${x.detalhe.slice(0, 60)})` : ""}`).join("; ")}.` });
  } else if (b) {
    linhas.push({ tipo: "janela", texto: `O noturno não rodou e a Janela B recuperou.${aprovadas(b)}` });
  } else if (minutosBrt(agora) < 5 * 60 + 30) {
    linhas.push({ tipo: "janela", texto: "O noturno roda de madrugada; o resumo aparece aqui de manhã." });
  } else {
    const [h, m] = e.inicioJanelaB.split(":").map(Number);
    linhas.push({ tipo: "alerta", texto: minutosBrt(agora) < h * 60 + m ? `O noturno não rodou esta noite. A Janela B tenta recuperar às ${e.inicioJanelaB}.` : "O noturno não rodou esta noite e a Janela B também não." });
  }
  return linhas;
}

// ---------- visita (base dos recados) ----------
export interface EstadoVisita { dia: string; desde: string; ultima: string; selosBase: Record<string, EstadoTema> | null; selosDia: Record<string, EstadoTema> }

// No 1º acesso do dia, a base dos recados vira o que você viu da última vez (selos e hora); no resto do dia, fica.
export function rolarVisita(estado: EstadoVisita | null, selosAgora: Record<string, EstadoTema>, agora = new Date()): EstadoVisita {
  const hoje = diaBrt(agora);
  const iso = agora.toISOString();
  if (!estado) return { dia: hoje, desde: new Date(agora.getTime() - 7 * 86_400_000).toISOString(), ultima: iso, selosBase: null, selosDia: selosAgora };
  if (estado.dia === hoje) return { ...estado, ultima: iso, selosDia: selosAgora };
  return { dia: hoje, desde: estado.ultima, ultima: iso, selosBase: estado.selosDia, selosDia: selosAgora };
}

// ---------- "Recados" ----------
const NOME_SELO: Record<EstadoTema, string> = { novo: "novo", reforco: "reforço", concluido: "concluído", retomada: "retomar" };

export function montarRecados(e: {
  visita: EstadoVisita;
  selosAgora: Record<string, EstadoTema>;
  nomes: Record<string, string>;
  temasDoAluno: string[]; // temas que você já começou ou o tema do dia
  conflitos: { subtopico: string; texto: string }[];
  novidades: { tipo: "prova" | "ficha"; subtopico: string; titulo: string; em: string }[];
}): RecadoDTO[] {
  const nome = (s: string) => e.nomes[s] ?? s;
  const meus = new Set(e.temasDoAluno);
  const selos: RecadoDTO[] = [];
  for (const [s, agora] of Object.entries(e.selosAgora)) {
    const antes = e.visita.selosBase?.[s];
    if (!antes || antes === agora) continue;
    selos.push({
      tipo: "selo", subtopico: s,
      texto: antes === "reforco" && agora === "concluido" ? `${nome(s)} saiu do reforço: concluído!` : `${nome(s)} mudou de ${NOME_SELO[antes]} para ${NOME_SELO[agora]}.`,
    });
  }
  const novidades = e.novidades
    .filter((n) => n.em > e.visita.desde && meus.has(n.subtopico))
    .sort((a, b) => b.em.localeCompare(a.em))
    .map((n): RecadoDTO => ({
      tipo: n.tipo, subtopico: n.subtopico, em: n.em,
      texto: n.tipo === "ficha" ? `Ficha nova de ${nome(n.subtopico)}, já aprovada.` : `Prova nova com questões de ${nome(n.subtopico)}: ${n.titulo}.`,
    }));
  const conflitos = e.conflitos
    .filter((c) => meus.has(c.subtopico))
    .map((c): RecadoDTO => ({ tipo: "conflito", subtopico: c.subtopico, texto: `${nome(c.subtopico)}: a apostila diverge da lei (${c.texto}). Vale a lei.` }));
  return [...selos, ...novidades, ...conflitos];
}

// ---------- biblioteca: busca e filtros da tela ----------
const sem = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
export function filtrarBiblioteca(itens: ItemAudioDTO[], f: { busca?: string; disciplina?: string; situacao?: "todos" | "ouvidos" | "nao_ouvidos" }) {
  const termo = sem(f.busca?.trim() ?? "");
  return itens.filter((i) =>
    (!termo || sem(`${i.titulo} ${i.tema}`).includes(termo)) &&
    (!f.disciplina || i.disciplina === f.disciplina) &&
    (f.situacao === "ouvidos" ? !!i.posicao?.ouvido : f.situacao === "nao_ouvidos" ? !i.posicao?.ouvido : true));
}
