// ============================================================
// BB Estudos — Corrente de modelos por função (PROMPT-RETOMADA R2.2)
// Vale, nesta ordem: a corrente aprovada pelo dono (tela Benchmark, salva no banco), a do
// .env (CORRENTE_ATIVA=1) ou o legado (os modelos do .env, como sempre rodou).
// Executa na ordem da corrente, pulando quem está desativado ou descansando, e aplica a
// regra de família: o auditor nunca é da família de quem gerou; o juiz de Português nunca
// é da família do escritor. Sem candidato elegível, a questão espera (não viola a regra).
// ============================================================
import type OpenAI from "openai";
import { ChamadaModelo, Config } from "./models.js";
import { chatJSON, gerador, auditor, escritorPT, SemModeloDisponivel, desativados, ehFalhaDeInfra } from "./llm.js";
import {
  correntesDoEnv,
  correntesLegado,
  elegiveis,
  familiaDe,
  validarCorrentes,
  violacoesDeFamilia,
  type Correntes,
  type Funcao,
} from "./catalogo.js";

export type Modo = "aprovada" | "env" | "legado";
export interface CorrenteAtiva {
  modo: Modo;
  correntes: Correntes;
  aprovadaEm?: string;
  violacoes: string[]; // regra de família ferida (o legado de hoje fere)
}
type ValorConfig = { ativa?: boolean; correntes?: Correntes; aprovadaEm?: string; anterior?: unknown };

export async function correnteAtiva(
  lerConfig: () => Promise<{ valor?: unknown } | null> = () => Config.findById("correntes").lean()
): Promise<CorrenteAtiva> {
  // Approval may be changed by another process (CLI, server or admin panel).
  // Always read it fresh so a long job cannot stay on the legacy chain.
  const doc = await lerConfig();
  const v = doc?.valor as ValorConfig | undefined;
  const [modo, correntes]: [Modo, Correntes] =
    v?.ativa && v.correntes ? ["aprovada", v.correntes] : process.env.CORRENTE_ATIVA === "1" ? ["env", correntesDoEnv()] : ["legado", correntesLegado()];
  const valor: CorrenteAtiva = { modo, correntes, aprovadaEm: modo === "aprovada" ? v?.aprovadaEm : undefined, violacoes: violacoesDeFamilia(correntes) };
  return valor;
}

// ---------- descanso: 3 falhas de infraestrutura seguidas → 10 min fora da corrente ----------
const FALHAS_PARA_DESCANSO = 3;
const DESCANSO_MS = 10 * 60_000;
const falhasSeguidas = new Map<string, number>();
const descansaAte = new Map<string, number>();
export function anotarResultado(modelo: string, ok: boolean, agora = Date.now()) {
  if (ok) {
    falhasSeguidas.delete(modelo);
    descansaAte.delete(modelo);
    return;
  }
  const n = (falhasSeguidas.get(modelo) ?? 0) + 1;
  if (n < FALHAS_PARA_DESCANSO) return void falhasSeguidas.set(modelo, n);
  falhasSeguidas.delete(modelo);
  descansaAte.set(modelo, agora + DESCANSO_MS);
}
export function foraAgora(agora = Date.now()): Set<string> {
  const fora = new Set(desativados);
  for (const [m, ate] of descansaAte) if (ate > agora) fora.add(m);
  for (const [m, ate] of descansoPorTaxa) if (ate > agora) fora.add(m);
  return fora;
}

// ---------- descanso por taxa (decisão do dono, 18/10/2026): < 20% de sucesso em 24 h → 1 h fora ----------
// Evita perder ~3 min por timeout num modelo que quase não responde. Depois da hora de descanso, só as
// chamadas NOVAS contam (senão o histórico ruim o manteria fora o dia inteiro).
const TAXA_MIN = 0.2;
const MIN_CHAMADAS = 5; // amostra mínima para julgar (depois do descanso: 2 chamadas novas)
export const DESCANSO_TAXA_MS = 60 * 60_000;
const descansoPorTaxa = new Map<string, number>();
export function avaliarTaxas(chamadas: { modelo: string; em: number; ok: boolean }[], anterior: Map<string, number>, agora = Date.now()) {
  const novo = new Map<string, number>();
  const porModelo = new Map<string, { em: number; ok: boolean }[]>();
  for (const c of chamadas) porModelo.set(c.modelo, [...(porModelo.get(c.modelo) ?? []), c]);
  for (const [m, cs] of porModelo) {
    const fim = anterior.get(m);
    if (fim && fim > agora) {
      novo.set(m, fim);
      continue;
    }
    const base = fim ? cs.filter((c) => c.em > fim) : cs;
    const minimo = fim ? 2 : MIN_CHAMADAS;
    if (base.length >= minimo && base.filter((c) => c.ok).length / base.length < TAXA_MIN) novo.set(m, agora + DESCANSO_TAXA_MS);
    else if (fim) novo.set(m, fim); // guarda o fim para julgar só o que veio depois
  }
  return novo;
}
let taxasLidasEm = 0;
async function atualizarDescansoPorTaxa(agora = Date.now()) {
  if (agora - taxasLidasEm < 2 * 60_000) return;
  taxasLidasEm = agora;
  try {
    const linhas = await ChamadaModelo.find({ em: { $gte: new Date(agora - 24 * 3_600_000) }, funcao: { $nin: ["voz", "embed", "benchmark"] } }).select("modelo em ok").lean();
    const novo = avaliarTaxas(linhas.map((l) => ({ modelo: l.modelo, em: new Date(l.em).getTime(), ok: l.ok })), descansoPorTaxa, agora);
    for (const [m, ate] of novo) if (ate > agora && (descansoPorTaxa.get(m) ?? 0) <= agora) console.warn(`  ⏸ ${m}: menos de 20% de sucesso em 24 h; fora da corrente por 1 h`);
    descansoPorTaxa.clear();
    for (const [m, ate] of novo) descansoPorTaxa.set(m, ate);
  } catch {
    /* sem telemetria: segue sem o descanso por taxa */
  }
}

const CLIENTE: Record<Funcao, () => OpenAI> = {
  gerador,
  tutor: gerador,
  auditor,
  juiz_pt: auditor,
  redacao: auditor,
  escritor_pt: escritorPT,
};

export interface Atendimento {
  json: unknown;
  modelo: string;
  familia: string;
  client: OpenAI; // para o reparo de JSON pelo mesmo modelo
  reserva: boolean;
}

// Chat que devolve JSON pela corrente da função. Com mais candidatos, cada um repete só 1 vez
// em erro passageiro antes de passar a vez (igual ao principal + reserva de antes).
export async function chatJSONFuncao(
  funcao: Funcao,
  system: string,
  user: string,
  temperature: number,
  maxTokens: number,
  opcoes: { pensar?: boolean; excluirFamilias?: string[]; excluirModelos?: string[]; preferir?: string } = {}
): Promise<Atendimento> {
  const { modo, correntes } = await correnteAtiva();
  // "preferir": começa por este modelo da corrente (trabalhadores do noturno espalham a carga)
  const base = correntes[funcao];
  const corrente = opcoes.preferir && base.includes(opcoes.preferir) ? [opcoes.preferir, ...base.filter((m) => m !== opcoes.preferir)] : base;
  // no legado a regra de família ainda não vale (Lightning e Super são Nemotron): decisão pendente do dono
  const excluirFamilias = modo === "legado" ? [] : opcoes.excluirFamilias ?? [];
  await atualizarDescansoPorTaxa();
  const fora = foraAgora();
  for (const m of opcoes.excluirModelos ?? []) fora.add(m);
  let candidatos = elegiveis(corrente, { excluirFamilias, fora });
  // todos descansando só por taxa: tenta assim mesmo (descanso não pode parar a corrente inteira)
  if (!candidatos.length) {
    const semTaxa = new Set([...fora].filter((m) => !((descansoPorTaxa.get(m) ?? 0) > Date.now())));
    candidatos = elegiveis(corrente, { excluirFamilias, fora: semTaxa });
  }
  if (!candidatos.length)
    throw new SemModeloDisponivel(
      `nenhum modelo elegível para ${funcao} (corrente: ${corrente.join(", ") || "vazia"}${excluirFamilias.length ? `; família proibida: ${excluirFamilias.join(", ")}` : ""})`
    );
  const client = CLIENTE[funcao]();
  let ultimo: unknown;
  for (const [i, modelo] of candidatos.entries()) {
    const temProximo = i < candidatos.length - 1;
    const reserva = modelo !== corrente[0];
    try {
      const json = await chatJSON(client, modelo, system, user, temperature, maxTokens, {
        pensar: opcoes.pensar,
        funcao,
        reserva,
        ...(temProximo ? { novasTentativas: 1 } : {}),
      });
      anotarResultado(modelo, true);
      const familiasDiferentes = opcoes.excluirFamilias?.length
        ? `; familia diferente de ${opcoes.excluirFamilias.join(", ")}`
        : "";
      console.info(`[OK] ${funcao}: ${modelo} [familia ${familiaDe(modelo)}${reserva ? ", reserva" : ""}]${familiasDiferentes}`);
      return { json, modelo, familia: familiaDe(modelo), client, reserva };
    } catch (e) {
      ultimo = e;
      if (ehFalhaDeInfra(e)) anotarResultado(modelo, false);
      if (temProximo) console.warn(`  ↪ ${modelo} falhou (${String(e).replace(/\s+/g, " ").slice(0, 100)}); tentando ${candidatos[i + 1]}`);
    }
  }
  throw ultimo;
}

// ---------- aprovação pelo dono (tela Benchmark), com desfazer ----------
export async function aprovarCorrentes(correntes: Correntes) {
  const { erros, avisos } = validarCorrentes(correntes);
  if (erros.length) return { ok: false as const, erros, avisos };
  const atual = await Config.findById("correntes").lean();
  await Config.findByIdAndUpdate(
    "correntes",
    { valor: { ativa: true, correntes, aprovadaEm: new Date().toISOString(), anterior: atual?.valor ?? null }, em: new Date() },
    { upsert: true }
  );
  return { ok: true as const, erros, avisos, ativa: await correnteAtiva() };
}

export async function desfazerCorrentes() {
  const atual = await Config.findById("correntes").lean();
  const anterior = (atual?.valor as ValorConfig | undefined)?.anterior;
  await Config.findByIdAndUpdate("correntes", { valor: anterior ?? { ativa: false }, em: new Date() }, { upsert: true });
  return correnteAtiva();
}
