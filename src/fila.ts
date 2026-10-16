// ============================================================
// BB Estudos — Fila de jobs de IA: UM por vez (geração, explicar, ingestão)
// Rodar dois ao mesmo tempo sobrecarrega o provedor (timeouts em série).
// A trava fica no MongoDB, então vale entre processos (CLI e servidor).
// ============================================================
import mongoose from "mongoose";
import { hostname } from "node:os";

type Trava = { _id: string; pid: number; host: string; comando: string; desde: Date };
const ID = "job_de_ia";
const VENCE_EM_MS = 12 * 60 * 60 * 1000; // trava esquecida (máquina desligou) vence em 12 h

const colecao = () => mongoose.connection.db!.collection<Trava>("fila_jobs");

function processoVivo(pid: number): boolean {
  try {
    process.kill(pid, 0); // sinal 0 só testa se o processo existe
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
}

// Tenta pegar a vez. Limpa trava de processo morto nesta máquina ou vencida.
async function pegar(comando: string): Promise<{ ok: true } | { ok: false; atual: Trava | null }> {
  const col = colecao();
  const eu: Trava = { _id: ID, pid: process.pid, host: hostname(), comando, desde: new Date() };
  try {
    await col.insertOne(eu);
    return { ok: true };
  } catch (e) {
    if ((e as { code?: number }).code !== 11000) throw e;
  }
  const atual = await col.findOne({ _id: ID });
  const morta = atual && atual.host === hostname() && !processoVivo(atual.pid);
  const vencida = atual && Date.now() - new Date(atual.desde).getTime() > VENCE_EM_MS;
  if (atual && (morta || vencida)) {
    await col.deleteOne({ _id: ID, pid: atual.pid, host: atual.host });
    return pegar(comando);
  }
  return { ok: false, atual };
}

async function soltar() {
  await colecao().deleteOne({ _id: ID, pid: process.pid, host: hostname() }).catch(() => undefined);
}

// CLI: espera a vez (avisando quem está rodando) e solta no fim, mesmo com erro ou Ctrl+C
export async function naFila<T>(comando: string, fn: () => Promise<T>): Promise<T> {
  let avisou = false;
  for (;;) {
    const r = await pegar(comando);
    if (r.ok) break;
    if (!avisou) {
      const a = r.atual;
      console.log(
        `⏳ Na fila: "${a?.comando ?? "?"}" (pid ${a?.pid}) está rodando desde ${a ? new Date(a.desde).toLocaleTimeString("pt-BR") : "?"}. Espero terminar…`
      );
      avisou = true;
    }
    await new Promise((res) => setTimeout(res, 15_000));
  }
  const aoInterromper = () => void soltar().finally(() => process.exit(130));
  process.once("SIGINT", aoInterromper);
  try {
    return await fn();
  } finally {
    process.off("SIGINT", aoInterromper);
    await soltar();
  }
}

// Servidor: só roda se a fila estiver livre (não trava o site esperando)
export async function seFilaLivre(comando: string, fn: () => Promise<void>): Promise<boolean> {
  if (!(await pegar(comando)).ok) return false;
  try {
    await fn();
  } finally {
    await soltar();
  }
  return true;
}
