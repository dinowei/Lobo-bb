// ============================================================
// BB Estudos — migração para concurso e banca como dado (BB + BACEN), sem mudar o comportamento do BB.
// Só PREENCHE o que falta (filtro $exists: false): rodar de novo não muda nada; nada é apagado.
// Questões: concursos ["bb"], banca da oficial "cesgranrio", formato "multipla", camada A (oficial, ou gerada
// com trecho de lei/norma oficial). Tópicos: concursos ["bb"]. Contas: concurso ativo BB e bancas por concurso.
// Tentativas e Elo do aluno: BB/Cesgranrio. O índice único do Elo passa a ser aluno + concurso + banca + disciplina.
// Rollback: $unset dos campos novos (eles não existiam antes) e o índice antigo { userId, disciplina }.
// ============================================================
import mongoose from "mongoose";
import { Attempt, Question, RatingAluno, Topic, User } from "./models.js";

type Passo = { colecao: string; descricao: string; filtro: Record<string, unknown>; mudanca: Record<string, unknown> };

export const PASSOS: Passo[] = [
  { colecao: "questions", descricao: "concursos = [bb]", filtro: { concursos: { $exists: false } }, mudanca: { $set: { concursos: ["bb"] } } },
  { colecao: "questions", descricao: "banca da oficial = cesgranrio", filtro: { origem: "oficial", banca: { $exists: false } }, mudanca: { $set: { banca: "cesgranrio" } } },
  { colecao: "questions", descricao: "formato = multipla", filtro: { formato: { $exists: false } }, mudanca: { $set: { formato: "multipla" } } },
  { colecao: "questions", descricao: "camada A (oficial)", filtro: { origem: "oficial", camada: { $exists: false } }, mudanca: { $set: { camada: "A" } } },
  // as fontes ingeridas até hoje são todas oficiais (leis e normas): a gerada com trecho dela é camada A
  { colecao: "questions", descricao: "camada A (gerada com trecho de fonte oficial)", filtro: { origem: "gerada", camada: { $exists: false }, "fontes.0": { $exists: true } }, mudanca: { $set: { camada: "A" } } },
  { colecao: "topics", descricao: "concursos = [bb]", filtro: { concursos: { $exists: false } }, mudanca: { $set: { concursos: ["bb"] } } },
  { colecao: "users", descricao: "preferências: BB ativo; BB Cesgranrio, BACEN a definir", filtro: { "preferencias.concursoAtivo": { $exists: false } }, mudanca: { $set: { "preferencias.concursoAtivo": "bb", "preferencias.bancas": { bb: "cesgranrio", bacen: "a_definir" } } } },
  { colecao: "attempts", descricao: "concurso bb / banca cesgranrio", filtro: { concurso: { $exists: false } }, mudanca: { $set: { concurso: "bb", banca: "cesgranrio" } } },
  { colecao: "ratings_aluno", descricao: "concurso bb / banca cesgranrio", filtro: { concurso: { $exists: false } }, mudanca: { $set: { concurso: "bb", banca: "cesgranrio" } } },
];

const COLECOES = [Question, Topic, User, Attempt, RatingAluno].map((m) => m.collection.collectionName);
const INDICE_ANTIGO_ELO = "userId_1_disciplina_1";

export async function contagens() {
  const db = mongoose.connection.db!;
  return Object.fromEntries(await Promise.all(COLECOES.map(async (c) => [c, await db.collection(c).countDocuments()] as const)));
}

export async function simularMigracaoConcursos() {
  const db = mongoose.connection.db!;
  const passos = [];
  for (const p of PASSOS) passos.push({ ...p, afetados: await db.collection(p.colecao).countDocuments(p.filtro) });
  const indices = await db.collection(RatingAluno.collection.collectionName).indexes();
  return { contagens: await contagens(), passos, indiceAntigoElo: indices.some((i) => i.name === INDICE_ANTIGO_ELO) };
}

// O servidor antigo (antes do deploy) recria o índice { userId, disciplina } ao subir: na partida do servidor
// novo, ele sai de novo (senão o mesmo aluno não teria Elo no BB e no BACEN na mesma disciplina)
export async function garantirIndiceElo() {
  const elo = mongoose.connection.db!.collection(RatingAluno.collection.collectionName);
  const existe = (await elo.indexes().catch(() => [])).some((i) => i.name === INDICE_ANTIGO_ELO);
  if (existe) await elo.dropIndex(INDICE_ANTIGO_ELO);
  return existe;
}

export async function migrarConcursos() {
  const db = mongoose.connection.db!;
  const antes = await contagens();
  const feitos = [];
  for (const p of PASSOS) {
    const r = await db.collection(p.colecao).updateMany(p.filtro, p.mudanca);
    feitos.push({ colecao: p.colecao, descricao: p.descricao, alterados: r.modifiedCount });
  }
  // índice do Elo: o antigo (aluno + disciplina) impediria o mesmo aluno ter Elo no BB e no BACEN
  const elo = db.collection(RatingAluno.collection.collectionName);
  if ((await elo.indexes()).some((i) => i.name === INDICE_ANTIGO_ELO)) await elo.dropIndex(INDICE_ANTIGO_ELO);
  await RatingAluno.syncIndexes();
  const depois = await contagens();
  const iguais = COLECOES.every((c) => antes[c] === depois[c]);
  return { antes, depois, iguais, feitos };
}
