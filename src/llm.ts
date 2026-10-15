// ============================================================
// BB Estudos — Clientes de IA (qualquer API compatível com OpenAI)
// NVIDIA NIM (Nemotron), OpenRouter, Anthropic via gateway etc.
// ============================================================
import OpenAI from "openai";

function obrigatoria(nome: string): string {
  const v = process.env[nome];
  if (!v) throw new Error(`Faltou ${nome} no .env`);
  return v;
}

type Prefixo = "GERADOR" | "AUDITOR" | "EMBED";
const clientes = new Map<string, OpenAI>();
const prefixoDo = new WeakMap<OpenAI, Prefixo>();
function cliente(prefixo: Prefixo): OpenAI {
  let c = clientes.get(prefixo);
  if (!c) {
    c = new OpenAI({
      baseURL: process.env[`${prefixo}_BASE_URL`] || undefined,
      apiKey: obrigatoria(`${prefixo}_API_KEY`),
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
export const modelo = (nome: "GERADOR_MODEL" | "AUDITOR_MODEL" | "EMBED_MODEL") => obrigatoria(nome);

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
  const prefixo = prefixoDo.get(client);
  // <PREFIXO>_PENSAR=0 desliga o "pensamento" dos Nemotron (chat_template_kwargs)
  const pensa = !prefixo || process.env[`${prefixo}_PENSAR`] !== "0";
  // modelos de raciocínio gastam tokens pensando antes da resposta: maxTokens é só para o JSON,
  // mas nunca passa do teto (corta raciocínio sem fim)
  const reserva = pensa ? Number(process.env.LLM_RESERVA_RACIOCINIO ?? 16000) || 0 : 0;
  const limite = Math.min(maxTokens + reserva, Number(process.env.LLM_TETO_TOKENS) || 24000);
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const r = await comRetry(model, () =>
      client.chat.completions.create({
        model,
        temperature,
        max_tokens: limite,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        ...(pensa ? {} : { chat_template_kwargs: { enable_thinking: false } }),
      } as OpenAI.ChatCompletionCreateParamsNonStreaming)
    );
    // modelos de raciocínio (Nemotron etc.) podem "pensar alto" em <think>...</think> antes do JSON
    const raw = (r.choices[0]?.message?.content ?? "").replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/^[\s\S]*<\/think>/i, "");
    // tolera modelo que embrulha o JSON em ```json ... ``` ou "pensa alto" antes
    const ini = raw.indexOf("{");
    const fim = raw.lastIndexOf("}");
    try {
      if (ini < 0 || fim <= ini) {
        const motivo = r.choices[0]?.finish_reason;
        throw new Error(
          motivo === "length"
            ? `resposta sem JSON (cortada no limite de ${limite} tokens: o modelo pensou demais)`
            : `resposta sem JSON (finish_reason=${motivo}, ${raw.length} caracteres)`
        );
      }
      return JSON.parse(raw.slice(ini, fim + 1));
    } catch (e) {
      ultimoErro = e;
    }
  }
  throw new Error(`O modelo ${model} não devolveu JSON válido: ${String(ultimoErro)}`);
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
