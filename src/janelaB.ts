// ============================================================
// BB Estudos — Janela B (V2/E8): recuperação e enriquecimento fora da madrugada (padrão 18:00–19:00).
// - Janela A (noturno) NÃO rodou nas últimas 20 h (PC desligado): faz o essencial = backup + tema de amanhã
//   da trilha com ≥ 15 aprovadas (o planejador põe a trilha na frente).
// - Rodou: recupera o que ficou pendente (desempate das "aguardando auditoria independente", tarefas
//   aguardando nova tentativa) e enriquece (pistas do tutor = "me explica de outro jeito" pré-geradas).
// Teto de chamadas próprio (telemetria desde o início da janela); horário e teto em Config "janelas".
// ============================================================
import { ChamadaModelo, Config, Relatorio, Tarefa } from "./models.js";
import { etapa, etapaBackup, type EtapaNoite } from "./noiteCompleta.js";
import { desempatarPendentes } from "./desempate.js";
import { planejarNoite, rodarFila } from "./noturno.js";
import { planejarPregeracoes } from "./outroJeito.js";
import { correnteAtiva } from "./corrente.js";
import { noitesSeguidasOk } from "../shared/noites.js";

export interface ConfigJanelas { janelaB: { inicio: string; fim: string; tetoChamadas: number } }
export const JANELAS_PADRAO: ConfigJanelas = { janelaB: { inicio: "18:00", fim: "19:00", tetoChamadas: 80 } };
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
// fora da madrugada da Janela A (00:45–05:30): a B nunca disputa o provedor com a noite
const minutos = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3));

export function validarJanelas(c: ConfigJanelas): string | null {
  const { inicio, fim, tetoChamadas } = c.janelaB;
  if (!HORA.test(inicio) || !HORA.test(fim)) return "Horário no formato HH:MM.";
  if (minutos(fim) <= minutos(inicio)) return "O fim precisa ser depois do início (no mesmo dia).";
  if (minutos(inicio) < minutos("05:30") || minutos(inicio) >= minutos("23:30")) return "A Janela B fica entre 05:30 e 23:30 (a madrugada é da noite).";
  if (!Number.isInteger(tetoChamadas) || tetoChamadas < 10 || tetoChamadas > 500) return "Teto de chamadas entre 10 e 500.";
  return null;
}

export async function lerJanelas(): Promise<ConfigJanelas> {
  const v = (await Config.findById("janelas").lean())?.valor as Partial<ConfigJanelas> | undefined;
  return { janelaB: { ...JANELAS_PADRAO.janelaB, ...(v?.janelaB ?? {}) } };
}
export async function salvarJanelas(c: ConfigJanelas) {
  const erro = validarJanelas(c);
  if (erro) throw new Error(erro);
  await Config.updateOne({ _id: "janelas" }, { $set: { valor: c, em: new Date() } }, { upsert: true });
  return c;
}

// a Janela A (noturno) rodou nas últimas 20 h? (relatórios antigos não têm "janela": contam como A)
export const janelaARodou = async (agora = new Date()) =>
  !!(await Relatorio.exists({ janela: { $ne: "B" }, inicio: { $gte: new Date(+agora - 20 * 3_600_000) } }));

const chamadasDesde = (inicio: Date) => ChamadaModelo.countDocuments({ em: { $gte: inicio } });

export async function rodarJanelaB(opcoes: { agora?: Date; forcar?: boolean } = {}) {
  const agora = opcoes.agora ?? new Date();
  const { janelaB } = await lerJanelas();
  const hm = `${String(agora.getHours()).padStart(2, "0")}:${String(agora.getMinutes()).padStart(2, "0")}`;
  if (!opcoes.forcar && (minutos(hm) < minutos(janelaB.inicio) || minutos(hm) >= minutos(janelaB.fim)))
    throw new Error(`Fora da Janela B (${janelaB.inicio}–${janelaB.fim}); use --forcar para rodar agora.`);
  const fim = new Date(agora);
  fim.setHours(Number(janelaB.fim.slice(0, 2)), Number(janelaB.fim.slice(3)), 0, 0);
  if (+fim <= +agora) fim.setTime(+agora + 60 * 60_000); // --forcar fora do horário: 1 h
  const inicio = new Date();
  const lote = `janela B ${inicio.toISOString().slice(0, 10)}`;
  const etapas: EtapaNoite[] = [];
  const noTeto = async () => (await chamadasDesde(inicio)) >= janelaB.tetoChamadas;
  const tarefasNoTeto = Math.max(1, Math.floor(janelaB.tetoChamadas / 8)); // ~8 chamadas por tarefa

  const rodou = await janelaARodou(agora);
  await etapa(etapas, "backup", etapaBackup);
  if (!rodou) {
    // essencial: tema de amanhã (a trilha vem primeiro no plano) e o que couber no teto
    await etapa(etapas, "tema de amanhã", async () => {
      const n = await planejarNoite(lote, { max: Math.min(30, tarefasNoTeto) });
      const r = await rodarFila({ ate: new Date(+fim - 2 * 60_000), max: tarefasNoTeto, geradores: (await correnteAtiva()).correntes.gerador });
      return `noite não rodou: ${n} tarefa(s) planejada(s), ${r.aprovadas} aprovada(s), ${r.rodadas} rodada(s)`;
    });
  } else {
    await etapa(etapas, "desempate", async () => {
      if (await noTeto()) return null;
      const r = await desempatarPendentes(() => undefined);
      return r.total ? `${r.aprovadas} aprovada(s), ${r.rejeitadas} rejeitada(s), ${r.aguardando} seguem aguardando` : null;
    });
    await etapa(etapas, "pendentes da noite", async () => {
      if (await noTeto()) return null;
      const abertas = await Tarefa.countDocuments({ status: { $in: ["pendente", "aguardando"] } });
      if (!abertas) return null;
      const r = await rodarFila({ ate: new Date(+fim - 2 * 60_000), max: tarefasNoTeto, geradores: (await correnteAtiva()).correntes.gerador });
      return `${r.rodadas} de ${abertas} tarefa(s): ${r.concluidas} concluída(s), ${r.aprovadas} questão(ões) aprovada(s)`;
    });
    await etapa(etapas, "pistas do tutor", async () => {
      if (await noTeto()) return null;
      const n = await planejarPregeracoes(lote, 10);
      if (!n) return null;
      const r = await rodarFila({ ate: new Date(+fim - 2 * 60_000), max: Math.min(n, tarefasNoTeto) });
      return `${n} explicação(ões) planejada(s), ${r.concluidas} pronta(s)`;
    });
  }
  const chamadas = await chamadasDesde(inicio);
  etapas.push({ etapa: "teto de chamadas", status: "ok", detalhe: `${chamadas} de ${janelaB.tetoChamadas}`, ms: 0 });
  await Relatorio.create({ lote, inicio, fim: new Date(), janela: "B", etapas, resumo: { janelaARodou: rodou, chamadas } });
  return { rodou, etapas, chamadas };
}

// tela Admin → Janelas: horário, teto e os últimos relatórios (A e B) com as etapas
export async function painelJanelas() {
  const relatorios = await Relatorio.find().sort({ inicio: -1 }).limit(8).select("lote inicio fim janela etapas progresso").lean();
  const historico = await Relatorio.find().sort({ inicio: -1 }).limit(40).select("janela etapas.status").lean();
  return {
    config: await lerJanelas(),
    noitesSeguidasOk: noitesSeguidasOk(historico),
    relatorios: relatorios.map((r) => ({
      lote: r.lote, inicio: (r.inicio as Date).toISOString(), fim: (r.fim as Date).toISOString(), janela: (r.janela ?? "A") as "A" | "B",
      etapas: (r.etapas ?? []).map((e) => ({ etapa: e.etapa ?? "", status: (e.status ?? "ok") as "ok" | "pulada" | "falhou", detalhe: e.detalhe ?? "" })),
      aprovadas: r.progresso?.aprovadas ?? null,
    })),
  };
}
