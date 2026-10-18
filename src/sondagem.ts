// ============================================================
// BB Estudos — Sondagem de modelos (catálogo e verificação semanal)
// Poucas chamadas curtas e espaçadas: uma conta trivial pedindo JSON, com e sem cada
// parâmetro de raciocínio, para saber o que o endpoint grátis aceita. Nada de texto
// de questão nem chave nos registros.
// ============================================================
import OpenAI from "openai";
import { gerador, extrairJSON } from "./llm.js";
import { Config } from "./models.js";
import { registrarChamada } from "./telemetria.js";
import { carregarCatalogo, FUNCOES, NOME_FUNCAO } from "./catalogo.js";
import type { CorrenteAtiva } from "./corrente.js";

export const SONDAS = ["basico", "reasoning_budget", "reasoning_effort", "sem_pensar"] as const;
export type Sonda = (typeof SONDAS)[number];
export interface ResultadoSonda {
  modelo: string;
  sonda: Sonda;
  http: number | null; // null = timeout/conexão
  ms: number;
  json: boolean; // devolveu JSON válido
  certo: boolean; // e a conta certa (42)
  tokens?: number; // tokens de saída (raciocínio incluso), para ver se o parâmetro teve efeito
  erro?: string;
}

const EXTRA: Record<Sonda, Record<string, unknown>> = {
  basico: {},
  reasoning_budget: { reasoning_budget: 256 },
  reasoning_effort: { reasoning_effort: "low" },
  sem_pensar: { chat_template_kwargs: { enable_thinking: false } },
};

export async function sondar(modelo: string, sonda: Sonda, timeoutMs = 120_000): Promise<ResultadoSonda> {
  const t0 = Date.now();
  try {
    const r = await gerador().chat.completions.create(
      {
        model: modelo,
        temperature: 0,
        max_tokens: 3000,
        messages: [
          { role: "system", content: "Você responde só com JSON." },
          { role: "user", content: 'Quanto é 17 + 25? Responda SOMENTE com o JSON {"resposta": <número>}.' },
        ],
        ...EXTRA[sonda],
      } as OpenAI.ChatCompletionCreateParamsNonStreaming,
      { timeout: timeoutMs, maxRetries: 0 }
    );
    const texto = (r.choices[0]?.message?.content ?? "").replace(/<think>[\s\S]*?<\/think>/gi, "");
    let json = false;
    let certo = false;
    try {
      const j = extrairJSON(texto) as { resposta?: unknown };
      json = true;
      certo = Number(j.resposta) === 42;
    } catch {
      /* sem JSON */
    }
    return { modelo, sonda, http: 200, ms: Date.now() - t0, json, certo, tokens: r.usage?.completion_tokens };
  } catch (e) {
    const http = e instanceof OpenAI.APIError && typeof e.status === "number" ? e.status : null;
    return { modelo, sonda, http, ms: Date.now() - t0, json: false, certo: false, erro: String(e instanceof Error ? e.message : e).replace(/\s+/g, " ").slice(0, 160) };
  }
}

// ---------- verificação semanal (no noturno), com alerta no painel ----------
const falhaDoHttp = (h: number | null) =>
  h === null ? ("timeout" as const) : h === 429 ? ("429" as const) : h >= 500 ? ("5xx" as const) : [401, 403, 404, 410].includes(h) ? ("permanente" as const) : ("outro" as const);
export interface Verificacao { em: string; resultados: { modelo: string; ok: boolean; http: number | null; ms: number }[] }

export async function verificarModelos(): Promise<ResultadoSonda[]> {
  const alvos = [...carregarCatalogo().values()].filter((m) => m.status !== "descontinuado" && !m.funcoes.includes("embed")).map((m) => m.id);
  const res: ResultadoSonda[] = [];
  for (const id of alvos) {
    const r = await sondar(id, "basico");
    const ok = r.http === 200 && r.json;
    const falha = ok ? undefined : r.http === 200 ? ("formato" as const) : falhaDoHttp(r.http);
    registrarChamada({ modelo: id, funcao: "verificacao", ok, falha, http: r.http ?? undefined, ms: r.ms });
    res.push(r);
    await new Promise((ok2) => setTimeout(ok2, 4000));
  }
  const valor: Verificacao = { em: new Date().toISOString(), resultados: res.map((r) => ({ modelo: r.modelo, ok: r.http === 200 && r.json, http: r.http, ms: r.ms })) };
  await Config.findByIdAndUpdate("verificacao_modelos", { valor, em: new Date() }, { upsert: true });
  return res;
}

export async function ultimaVerificacao(): Promise<Verificacao | null> {
  return ((await Config.findById("verificacao_modelos").lean())?.valor as Verificacao | undefined) ?? null;
}
export async function verificacaoVencida(dias = 7) {
  const v = await ultimaVerificacao();
  return !v || Date.now() - Date.parse(v.em) > dias * 86_400_000;
}

// Alertas para o dono (painel e tela IA): modelo da corrente que caiu na verificação,
// descontinuação chegando, regra de família pendente, verificação atrasada
export function alertasDeModelos(ativa: CorrenteAtiva, verif: Verificacao | null, agora = Date.now()): string[] {
  const cat = carregarCatalogo();
  const usados = new Set(FUNCOES.flatMap((f) => ativa.correntes[f]));
  const alertas: string[] = [];
  for (const id of usados) {
    const m = cat.get(id);
    if (m?.descontinuaEm) {
      const dias = Math.ceil((Date.parse(m.descontinuaEm) - agora) / 86_400_000);
      alertas.push(dias > 0 ? `${id} será descontinuado em ${dias} dia(s)` : `${id} foi descontinuado`);
    }
    const r = verif?.resultados.find((x) => x.modelo === id);
    if (r && !r.ok) alertas.push(`${id} não respondeu na última verificação (${r.http ?? "timeout"})`);
  }
  for (const f of FUNCOES) {
    const principal = ativa.correntes[f][0];
    if (principal && cat.get(principal)?.preview) alertas.push(`${NOME_FUNCAO[f]}: o principal (${principal}) é preview`);
  }
  if (ativa.violacoes.length) alertas.push(`Regra de família ferida: ${ativa.violacoes.join("; ")} (decisão sua em Pendências)`);
  if (!verif) alertas.push("Os modelos ainda não foram verificados (roda no noturno, uma vez por semana)");
  else if (agora - Date.parse(verif.em) > 8 * 86_400_000) alertas.push("A verificação semanal dos modelos está atrasada");
  return alertas;
}

// Todas as sondas de uma lista de modelos, uma por vez, com pausa entre chamadas (sem gerar carga)
export async function sondarModelos(modelos: string[], sondas: readonly Sonda[] = SONDAS, pausaMs = 4000): Promise<ResultadoSonda[]> {
  const saida: ResultadoSonda[] = [];
  for (const m of modelos)
    for (const s of sondas) {
      const r = await sondar(m, s);
      saida.push(r);
      console.log(`${r.http ?? "---"} ${String(r.ms).padStart(6)}ms json=${r.json ? "sim" : "não"} certo=${r.certo ? "sim" : "não"} tokens=${r.tokens ?? "-"}  ${m} · ${s}${r.erro ? `  (${r.erro})` : ""}`);
      await new Promise((ok) => setTimeout(ok, pausaMs));
    }
  return saida;
}
