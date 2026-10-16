// ============================================================
// BB Estudos — Clientes de IA (qualquer API compatível com OpenAI)
// NVIDIA NIM (Nemotron), OpenRouter, Anthropic via gateway etc.
// ============================================================
import OpenAI from "openai";
import { z } from "zod";

function obrigatoria(nome: string): string {
  const v = process.env[nome];
  if (!v) throw new Error(`Faltou ${nome} no .env`);
  return v;
}

// ESCRITOR_PT: escreve as frases de Português por construção (modelo diferente do auditor).
// Sem ESCRITOR_PT_BASE_URL/API_KEY, usa os do GERADOR.
type Prefixo = "GERADOR" | "AUDITOR" | "EMBED" | "ESCRITOR_PT";
const clientes = new Map<string, OpenAI>();
const prefixoDo = new WeakMap<OpenAI, Prefixo>();
function cliente(prefixo: Prefixo): OpenAI {
  let c = clientes.get(prefixo);
  if (!c) {
    const herda = prefixo === "ESCRITOR_PT" && !process.env.ESCRITOR_PT_API_KEY ? "GERADOR" : prefixo;
    c = new OpenAI({
      baseURL: process.env[`${herda}_BASE_URL`] || undefined,
      apiKey: obrigatoria(`${herda}_API_KEY`),
      timeout: (Number(process.env.LLM_TIMEOUT_SEG) || 180) * 1000,
      maxRetries: 0, // as novas tentativas ficam com comRetry (espera 2s, 6s, 18s)
    });
    clientes.set(prefixo, c);
    prefixoDo.set(c, prefixo);
  }
  return c;
}

// ------------------------------------------------------------
// Novas tentativas para erro passageiro do provedor: 429, 5xx e timeout
// ------------------------------------------------------------
const ESPERAS_MS = [2000, 6000, 18000];
const STATUS_PASSAGEIRO = new Set([429, 500, 502, 503, 504]);

function ehPassageiro(e: unknown): boolean {
  if (e instanceof OpenAI.APIConnectionTimeoutError || e instanceof OpenAI.APIConnectionError) return true;
  return e instanceof OpenAI.APIError && typeof e.status === "number" && STATUS_PASSAGEIRO.has(e.status);
}

export async function comRetry<T>(rotulo: string, fn: () => Promise<T>): Promise<T> {
  for (let tentativa = 0; ; tentativa++) {
    try {
      return await fn();
    } catch (e) {
      if (!ehPassageiro(e) || tentativa >= ESPERAS_MS.length) throw e;
      const espera = ESPERAS_MS[tentativa];
      const motivo = e instanceof OpenAI.APIError && e.status ? `HTTP ${e.status}` : "timeout/conexão";
      console.warn(`  ↻ ${rotulo}: ${motivo}, tentando de novo em ${espera / 1000}s`);
      await new Promise((r) => setTimeout(r, espera));
    }
  }
}

export const gerador = () => cliente("GERADOR");
export const auditor = () => cliente("AUDITOR");
export const escritorPT = () => cliente("ESCRITOR_PT");
export const modelo = (nome: "GERADOR_MODEL" | "AUDITOR_MODEL" | "EMBED_MODEL" | "ESCRITOR_PT_MODEL") =>
  nome === "ESCRITOR_PT_MODEL" ? process.env.ESCRITOR_PT_MODEL || obrigatoria("GERADOR_MODEL") : obrigatoria(nome);

// ------------------------------------------------------------
// Extrai o primeiro objeto JSON balanceado da resposta
// (tolera texto antes/depois, ```json ... ``` e chaves dentro de strings)
// ------------------------------------------------------------
export function extrairJSON(raw: string): unknown {
  const ini = raw.indexOf("{");
  if (ini < 0) throw new Error("resposta sem JSON");
  let nivel = 0;
  let emString = false;
  for (let i = ini; i < raw.length; i++) {
    const c = raw[i];
    if (emString) {
      if (c === "\\") i++;
      else if (c === '"') emString = false;
    } else if (c === '"') emString = true;
    else if (c === "{") nivel++;
    else if (c === "}" && --nivel === 0) return JSON.parse(raw.slice(ini, i + 1));
  }
  // objeto não fechou: última chance com o último "}"
  return JSON.parse(raw.slice(ini, raw.lastIndexOf("}") + 1));
}

type Mensagem = { role: "system" | "user" | "assistant"; content: string };
const semOrcamento = new Set<string>(); // modelos que recusaram reasoning_budget

// Uma chamada de chat. <PREFIXO>_PENSAR=0 desliga o "pensamento" dos Nemotron;
// <PREFIXO>_RACIOCINIO limita quantos tokens ele pode pensar (reasoning_budget).
async function chamar(client: OpenAI, model: string, mensagens: Mensagem[], temperature: number, maxTokens: number, pensar?: boolean) {
  const prefixo = prefixoDo.get(client);
  const pensa = pensar ?? (!prefixo || process.env[`${prefixo}_PENSAR`] !== "0");
  const orcamento = prefixo ? Number(process.env[`${prefixo}_RACIOCINIO`]) || 0 : 0;
  // maxTokens é só para o JSON; o pensamento ganha uma reserva, sem nunca passar do teto
  const reserva = pensa ? orcamento || Number(process.env.LLM_RESERVA_RACIOCINIO ?? 16000) || 0 : 0;
  const limite = Math.min(maxTokens + reserva, Number(process.env.LLM_TETO_TOKENS) || 24000);
  const pedir = (comOrcamento: boolean) =>
    comRetry(model, () =>
      client.chat.completions.create({
        model,
        temperature,
        max_tokens: limite,
        messages: mensagens,
        ...(pensa ? (comOrcamento ? { reasoning_budget: orcamento } : {}) : { chat_template_kwargs: { enable_thinking: false } }),
      } as OpenAI.ChatCompletionCreateParamsNonStreaming)
    );
  let r: OpenAI.ChatCompletion;
  try {
    r = await pedir(pensa && orcamento > 0 && !semOrcamento.has(model));
  } catch (e) {
    // alguns modelos (ex.: Ultra) recusam reasoning_budget com 400: repete sem e lembra
    if (!(e instanceof OpenAI.APIError && e.status === 400 && /budget/i.test(e.message))) throw e;
    semOrcamento.add(model);
    console.warn(`  ↻ ${model} não aceita limite de pensamento; seguindo sem ele`);
    r = await pedir(false);
  }
  // modelos de raciocínio podem "pensar alto" em <think>...</think> antes do JSON
  const texto = (r.choices[0]?.message?.content ?? "").replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/^[\s\S]*<\/think>/i, "");
  return { texto, motivo: r.choices[0]?.finish_reason, limite };
}

// ------------------------------------------------------------
// Chat que devolve JSON (com 1 nova tentativa se vier JSON quebrado)
// ------------------------------------------------------------
export async function chatJSON(
  client: OpenAI,
  model: string,
  system: string,
  user: string,
  temperature: number,
  maxTokens = 4000
): Promise<unknown> {
  let ultimoErro: unknown;
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const { texto, motivo, limite } = await chamar(client, model, [
      { role: "system", content: system },
      { role: "user", content: user },
    ], temperature, maxTokens);
    try {
      if (!texto.includes("{") && motivo === "length")
        throw new Error(`resposta sem JSON (cortada no limite de ${limite} tokens: o modelo pensou demais)`);
      return extrairJSON(texto);
    } catch (e) {
      ultimoErro = e instanceof Error && e.message === "resposta sem JSON" ? new Error(`resposta sem JSON (finish_reason=${motivo}, ${texto.length} caracteres)`) : e;
    }
  }
  throw new Error(`O modelo ${model} não devolveu JSON válido: ${String(ultimoErro)}`);
}

// ------------------------------------------------------------
// Valida com zod; se falhar, devolve ao MESMO modelo a resposta dele + o erro
// e pede só o JSON corrigido (1 tentativa, sem pensar de novo)
// ------------------------------------------------------------
export async function validarOuReparar<T>(
  schema: z.ZodType<T>,
  bruto: unknown,
  ctx: { client: OpenAI; model: string; system: string; user: string; maxTokens?: number }
): Promise<T> {
  const primeira = schema.safeParse(bruto);
  if (primeira.success) return primeira.data;
  const erro = z.prettifyError(primeira.error);
  const { texto } = await chamar(ctx.client, ctx.model, [
    { role: "system", content: ctx.system },
    { role: "user", content: ctx.user },
    { role: "assistant", content: JSON.stringify(bruto) },
    {
      role: "user",
      content: `O JSON acima não passou na validação:
${erro}

Devolva SOMENTE o JSON corrigido, completo, sem nenhum texto antes ou depois. Corrija apenas o que o erro aponta e não altere o resto do conteúdo.`,
    },
  ], 0, ctx.maxTokens ?? 4000, false);
  const segunda = schema.safeParse(extrairJSON(texto));
  if (segunda.success) return segunda.data;
  throw new Error(`JSON inválido mesmo após o reparo: ${z.prettifyError(segunda.error)}`);
}

// ------------------------------------------------------------
// Auditor com reserva: se AUDITOR_MODEL falhar (fora do ar, timeout, sem JSON),
// tenta AUDITOR_MODEL_RESERVA. Devolve qual modelo respondeu.
// ------------------------------------------------------------
export async function chatJSONAuditor(
  system: string,
  user: string,
  temperature: number,
  maxTokens: number
): Promise<{ json: unknown; modelo: string }> {
  const principal = modelo("AUDITOR_MODEL");
  try {
    return { json: await chatJSON(auditor(), principal, system, user, temperature, maxTokens), modelo: principal };
  } catch (e) {
    const reserva = process.env.AUDITOR_MODEL_RESERVA;
    if (!reserva || reserva === principal) throw e;
    console.warn(`  ↪ auditor ${principal} falhou (${String(e).slice(0, 120)}); usando a reserva ${reserva}`);
    return { json: await chatJSON(auditor(), reserva, system, user, temperature, maxTokens), modelo: reserva };
  }
}

// ------------------------------------------------------------
// Embeddings em lote
// "query" = o que se busca (tópico, pergunta) · "passage" = o que é buscado (trechos)
// Modelos assimétricos da NVIDIA exigem isso: ligue EMBED_INPUT_TYPE=1
// ------------------------------------------------------------
export async function embedLote(textos: string[], tipo: "query" | "passage"): Promise<number[][]> {
  const out: number[][] = [];
  const dimEsperada = Number(process.env.EMBED_DIM) || 0;
  const LOTE = 32;
  for (let i = 0; i < textos.length; i += LOTE) {
    const lote = textos.slice(i, i + LOTE).map((t) => t.slice(0, 6000));
    const extra: Record<string, unknown> = process.env.EMBED_INPUT_TYPE === "1" ? { input_type: tipo, truncate: "END" } : {};
    if (Number(process.env.EMBED_DIMENSOES)) extra.dimensions = Number(process.env.EMBED_DIMENSOES); // ex.: 1024 (modelos que aceitam)
    const r = await comRetry("embeddings", () =>
      cliente("EMBED").embeddings.create({
        model: modelo("EMBED_MODEL"),
        input: lote,
        encoding_format: "float", // alguns provedores não aceitam base64 (padrão do SDK)
        ...extra,
      } as OpenAI.EmbeddingCreateParams)
    );
    const vetores = [...r.data].sort((a, b) => a.index - b.index).map((d) => d.embedding as number[]);
    if (dimEsperada && vetores[0] && vetores[0].length !== dimEsperada) {
      throw new Error(
        `O modelo devolveu vetores de ${vetores[0].length} dimensões, mas EMBED_DIM=${dimEsperada}. Ajuste o .env (e recrie o índice).`
      );
    }
    out.push(...vetores);
    if (textos.length > LOTE) process.stdout.write(`  embeddings ${Math.min(i + LOTE, textos.length)}/${textos.length}\r`);
  }
  if (textos.length > LOTE) process.stdout.write("\n");
  return out;
}

export const embed = async (texto: string, tipo: "query" | "passage" = "query") =>
  (await embedLote([texto], tipo))[0];

export function cosseno(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

// Lista os modelos que a chave enxerga (ajuda a escolher GERADOR_MODEL / AUDITOR_MODEL / EMBED_MODEL)
export async function listarModelos(prefixo: "GERADOR" | "AUDITOR" | "EMBED" = "GERADOR"): Promise<string[]> {
  const ids: string[] = [];
  for await (const m of cliente(prefixo).models.list()) ids.push(m.id);
  return ids.sort();
}
