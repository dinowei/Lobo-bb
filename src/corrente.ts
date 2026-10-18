// ============================================================
// BB Estudos — Corrente de modelos por função (PROMPT-RETOMADA R2.2)
// Vale, nesta ordem: a corrente aprovada pelo dono (tela Benchmark, salva no banco), a do
// .env (CORRENTE_ATIVA=1) ou o legado (os modelos do .env, como sempre rodou).
// Executa na ordem da corrente, pulando quem está desativado ou descansando, e aplica a
// regra de família: o auditor nunca é da família de quem gerou; o juiz de Português nunca
// é da família do escritor. Sem candidato elegível, a questão espera (não viola a regra).
// ============================================================
import type OpenAI from "openai";
import { Config } from "./models.js";
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

let cache: { em: number; valor: CorrenteAtiva } | null = null;
export async function correnteAtiva(forcar = false): Promise<CorrenteAtiva> {
  if (!forcar && cache && Date.now() - cache.em < 60_000) return cache.valor;
  const doc = await Config.findById("correntes").lean().catch(() => null);
  const v = doc?.valor as ValorConfig | undefined;
  const [modo, correntes]: [Modo, Correntes] =
    v?.ativa && v.correntes ? ["aprovada", v.correntes] : process.env.CORRENTE_ATIVA === "1" ? ["env", correntesDoEnv()] : ["legado", correntesLegado()];
  const valor: CorrenteAtiva = { modo, correntes, aprovadaEm: modo === "aprovada" ? v?.aprovadaEm : undefined, violacoes: violacoesDeFamilia(correntes) };
  cache = { em: Date.now(), valor };
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
  return fora;
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
  const fora = foraAgora();
  for (const m of opcoes.excluirModelos ?? []) fora.add(m);
  const candidatos = elegiveis(corrente, { excluirFamilias, fora });
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
  cache = null;
  return { ok: true as const, erros, avisos, ativa: await correnteAtiva(true) };
}

export async function desfazerCorrentes() {
  const atual = await Config.findById("correntes").lean();
  const anterior = (atual?.valor as ValorConfig | undefined)?.anterior;
  await Config.findByIdAndUpdate("correntes", { valor: anterior ?? { ativa: false }, em: new Date() }, { upsert: true });
  cache = null;
  return correnteAtiva(true);
}
