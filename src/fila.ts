// ============================================================
// BB Estudos — Fila de jobs de IA: UM por vez (geração, explicar, ingestão)
// Rodar dois ao mesmo tempo sobrecarrega o provedor (timeouts em série).
// A trava fica no MongoDB, então vale entre processos (CLI e servidor).
// ============================================================
import mongoose from "mongoose";
import { hostname } from "node:os";

type Trava = { _id: string; pid: number; host: string; comando: string; desde: Date };
const ID = "job_de_ia";
// trava esquecida (máquina desligou, processo travou): vence em 6 h; o noturno inteiro dura no máximo 4h30
export const VENCE_EM_MS = 6 * 60 * 60 * 1000;

// Órfã = dono morto nesta máquina, ou trava mais velha que a validade (em qualquer máquina)
export function travaOrfa(atual: { pid: number; host: string; desde: Date | string } | null, agora: number, host: string, vivo: (pid: number) => boolean): string | null {
  if (!atual) return null;
  if (atual.host === host && !vivo(atual.pid)) return `processo ${atual.pid} já terminou`;
  if (agora - new Date(atual.desde).getTime() > VENCE_EM_MS) return `mais velha que ${VENCE_EM_MS / 3_600_000} h`;
  return null;
}

// Fechamento v1.0: dois noturnos ao mesmo tempo → o segundo sai sem fazer nada (não espera na fila)
const ehNoturno = (comando: string) => /^(?:bb\s+)?noturno(?:\s|$)/i.test(comando.trim());
export function outroNoturnoRodando(atual: Trava | null, agora: number, host: string, vivo: (pid: number) => boolean): boolean {
  return !!atual && ehNoturno(atual.comando) && !travaOrfa(atual, agora, host, vivo);
}
export async function noturnoJaRodando(): Promise<boolean> {
  return outroNoturnoRodando(await colecao().findOne({ _id: ID }), Date.now(), hostname(), processoVivo);
}

const colecao = () => mongoose.connection.db!.collection<Trava>("fila_jobs");

function minutosEmBrasilia(agora: Date): number {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(agora);
  const hora = Number(partes.find((p) => p.type === "hour")?.value ?? 0);
  const minuto = Number(partes.find((p) => p.type === "minute")?.value ?? 0);
  return hora * 60 + minuto;
}

export function comandoBloqueadoNaJanelaNoturna(comando: string, agora = new Date()): boolean {
  const minuto = minutosEmBrasilia(agora);
  const dentroDaJanela = minuto >= 60 && minuto < 330;
  const eNoturno = /^(?:bb\s+)?noturno(?:\s|$)/i.test(comando.trim());
  return dentroDaJanela && !eNoturno;
}

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
  const motivo = travaOrfa(atual, Date.now(), hostname(), processoVivo);
  if (atual && motivo) {
    // liberada com registro (o log do noturno guarda esta linha)
    console.warn(`Trava de IA órfã liberada: "${atual.comando}" (PID ${atual.pid}, ${atual.host}, desde ${new Date(atual.desde).toISOString()}): ${motivo}.`);
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
  const verificarJanela = () => {
    if (comandoBloqueadoNaJanelaNoturna(comando)) {
      throw new Error("Janela protegida do noturno (01:00–05:30 BRT): este comando de IA não foi iniciado.");
    }
  };
  let avisou = false;
  for (;;) {
    verificarJanela();
    const r = await pegar(comando);
    if (r.ok) {
      if (comandoBloqueadoNaJanelaNoturna(comando)) {
        await soltar();
        verificarJanela();
      }
      break;
    }
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
  const aoTerminar = () => void soltar().finally(() => process.exit(143));
  const aoQuebrar = () => void soltar().finally(() => process.exit(131));
  process.once("SIGINT", aoInterromper);
  process.once("SIGTERM", aoTerminar);
  process.once("SIGBREAK", aoQuebrar);
  try {
    return await fn();
  } finally {
    process.off("SIGINT", aoInterromper);
    process.off("SIGTERM", aoTerminar);
    process.off("SIGBREAK", aoQuebrar);
    await soltar();
  }
}

// Servidor: só roda se a fila estiver livre (não trava o site esperando)
export async function seFilaLivre(comando: string, fn: () => Promise<void>): Promise<boolean> {
  if (comandoBloqueadoNaJanelaNoturna(comando)) {
    console.warn(`⏰ Janela protegida do noturno: serviço adiou "${comando}".`);
    return false;
  }
  if (!(await pegar(comando)).ok) return false;
  if (comandoBloqueadoNaJanelaNoturna(comando)) {
    await soltar();
    console.warn(`⏰ Janela protegida do noturno: serviço adiou "${comando}".`);
    return false;
  }
  try {
    await fn();
  } finally {
    await soltar();
  }
  return true;
}

// Limpeza operacional após o Agendador encerrar um processo travado. A remoção só ocorre
// para a trava deste host, com o PID informado e já encerrado; nunca apaga job ainda vivo.
export async function limparTravaOrfa(pid: number): Promise<boolean> {
  if (!Number.isSafeInteger(pid) || pid <= 0) throw new Error("PID inválido para liberar a trava.");
  const col = colecao();
  const atual = await col.findOne({ _id: ID, host: hostname(), pid });
  if (!atual || processoVivo(pid)) return false;
  const removida = await col.deleteOne({ _id: ID, host: hostname(), pid });
  return removida.deletedCount === 1;
}
