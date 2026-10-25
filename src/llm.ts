// ============================================================
// BB Estudos — Clientes de IA (qualquer API compatível com OpenAI)
// NVIDIA NIM (Nemotron), OpenRouter, Anthropic via gateway etc.
// ============================================================
import OpenAI from "openai";
import { z } from "zod";
import { carregarCatalogo } from "./catalogo.js";
import { classificarErro, registrarChamada } from "./telemetria.js";

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
// Novas tentativas para erro recuperável do provedor: 429, 5xx e timeout.
// Espera exponencial com variação aleatória (±25%, para não sincronizar com outras chamadas);
// o Retry-After do provedor manda, até 60 s (mais que isso: desiste e deixa a reserva tentar).
// Erro permanente (id inválido, descontinuado, sem acesso) não repete.
// ------------------------------------------------------------
const ESPERAS_MS = [2000, 6000, 18000];
const RETRY_AFTER_MAX_MS = 60_000;

// falha de infraestrutura (o provedor, não a questão): a tarefa volta para a fila
export const ehFalhaDeInfra = (e: unknown) => classificarErro(e).recuperavel || e instanceof SemModeloDisponivel;
export class SemModeloDisponivel extends Error {}

function retryAfterMs(e: unknown): number | null {
  if (!(e instanceof OpenAI.APIError) || !e.headers) return null;
  const h = e.headers as unknown as { get?: (k: string) => string | null } & Record<string, string | null | undefined>;
  const v = typeof h.get === "function" ? h.get("retry-after") : h["retry-after"];
  if (!v) return null;
  const s = Number(v);
  if (Number.isFinite(s)) return s * 1000;
  const quando = Date.parse(v);
  return Number.isFinite(quando) ? Math.max(0, quando - Date.now()) : null;
}

export function esperaAntesDe(tentativa: number, retryAfter: number | null, aleatorio = Math.random()): number | null {
  const base = ESPERAS_MS[Math.min(tentativa, ESPERAS_MS.length - 1)] * (0.75 + aleatorio * 0.5);
  if (retryAfter === null) return Math.round(base);
  return retryAfter > RETRY_AFTER_MAX_MS ? null : Math.round(Math.max(base, retryAfter));
}

// maxNovas: quantas vezes repete (padrão 3). Com modelo de reserva, vale cair cedo para a reserva.
export async function comRetry<T>(rotulo: string, fn: () => Promise<T>, maxNovas = ESPERAS_MS.length): Promise<T> {
  for (let tentativa = 0; ; tentativa++) {
    try {
      return await fn();
    } catch (e) {
      if (!classificarErro(e).recuperavel || tentativa >= Math.min(maxNovas, ESPERAS_MS.length)) throw e;
      const espera = esperaAntesDe(tentativa, retryAfterMs(e));
      if (espera === null) throw e; // o provedor pediu para voltar muito depois
      const motivo = e instanceof OpenAI.APIError && e.status ? `HTTP ${e.status}` : "timeout/conexão";
      console.warn(`  ↻ ${rotulo}: ${motivo}, tentando de novo em ${Math.round(espera / 1000)}s`);
      await new Promise((r) => setTimeout(r, espera));
    }
  }
}

// Modelo com erro permanente sai das correntes até o processo reiniciar
export const desativados = new Set<string>();

// ------------------------------------------------------------
// Limite global de pedidos por minuto (balde de fichas): todos os trabalhadores do noturno
// dividem NVIDIA_RPM_MAX (padrão 30). Cada pedido HTTP gasta 1 ficha; o balde enche aos poucos.
// ------------------------------------------------------------
export class Balde {
  private fichas: number;
  private ultimo: number;
  constructor(readonly porMinuto: number, private relogio: () => number = Date.now) {
    this.fichas = porMinuto;
    this.ultimo = relogio();
  }
  // quanto esperar (ms) pela próxima ficha; 0 = pegou agora
  tentar(): number {
    const agora = this.relogio();
    this.fichas = Math.min(this.porMinuto, this.fichas + ((agora - this.ultimo) * this.porMinuto) / 60_000);
    this.ultimo = agora;
    if (this.fichas >= 1) {
      this.fichas -= 1;
      return 0;
    }
    return Math.ceil(((1 - this.fichas) * 60_000) / this.porMinuto);
  }
  async pegar() {
    for (let espera = this.tentar(); espera > 0; espera = this.tentar()) await new Promise((ok) => setTimeout(ok, espera));
  }
}
const balde = new Balde(Number(process.env.NVIDIA_RPM_MAX) || 30);

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
    else if (c === "}" && --nivel === 0) return parseTolerante(raw.slice(ini, i + 1));
  }
  // objeto não fechou: última chance com o último "}"
  return parseTolerante(raw.slice(ini, raw.lastIndexOf("}") + 1));
}

// Reparo de JSON (E2): texto copiado de PDF traz barra invertida solta ("R\$", "C:\pasta", fórmula),
// que o JSON.parse recusa ("Bad escaped character"). A barra que não começa um escape válido vira "\\".
export function parseTolerante(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch (e) {
    const reparado = s.replace(/\\(?!["\\/bfnrtu])/g, "\\\\").replace(/\\u(?![0-9a-fA-F]{4})/g, "\\\\u");
    if (reparado === s) throw e;
    return JSON.parse(reparado);
  }
}

type Mensagem = { role: "system" | "user" | "assistant"; content: string };
const semOrcamento = new Set<string>(); // modelos que recusaram reasoning_budget
const recusaDeOrcamento = (e: unknown) => e instanceof OpenAI.APIError && e.status === 400 && /budget/i.test(e.message);

// quem chama, para a telemetria (a corrente informa a função e se atendeu como reserva)
export type MetaChamada = { funcao?: string; reserva?: boolean };
const FUNCAO_DO_PREFIXO: Record<Prefixo, string> = { GERADOR: "gerador", AUDITOR: "auditor", EMBED: "embed", ESCRITOR_PT: "escritor_pt" };

// Parâmetro de raciocínio que cada modelo aceita (catálogo, data/modelos.json).
// Fora do catálogo: o comportamento antigo (reasoning_budget, que cai sozinho se recusado).
// esforco: <PREFIXO>_ESFORCO; sem ele, o modelo pensa no padrão dele (como sempre foi)
export function extrasDeRaciocinio(model: string, pensa: boolean, orcamento: number, esforco?: string): Record<string, unknown> {
  const m = carregarCatalogo().get(model);
  const aceita = (p: "reasoning_budget" | "reasoning_effort" | "enable_thinking") => (m ? m.parametros.includes(p) : p !== "reasoning_effort");
  if (pensa) {
    if (orcamento > 0 && aceita("reasoning_budget") && !semOrcamento.has(model)) return { reasoning_budget: orcamento };
    if (esforco && aceita("reasoning_effort")) return { reasoning_effort: esforco };
    return {};
  }
  if (aceita("enable_thinking")) return { chat_template_kwargs: { enable_thinking: false } };
  if (aceita("reasoning_effort")) return { reasoning_effort: "low" };
  return {};
}

// Uma chamada de chat. <PREFIXO>_PENSAR=0 desliga o "pensamento";
// <PREFIXO>_RACIOCINIO limita quantos tokens ele pode pensar (reasoning_budget) e
// <PREFIXO>_ESFORCO (low|medium|high) vale para quem usa reasoning_effort.
async function chamar(
  client: OpenAI,
  model: string,
  mensagens: Mensagem[],
  temperature: number,
  maxTokens: number,
  pensar?: boolean,
  novasTentativas?: number,
  meta: MetaChamada = {}
) {
  if (desativados.has(model)) throw new SemModeloDisponivel(`${model} está desativado nesta execução (erro permanente antes)`);
  const prefixo = prefixoDo.get(client);
  const funcao = meta.funcao ?? (prefixo ? FUNCAO_DO_PREFIXO[prefixo] : undefined);
  const pensa = pensar ?? (!prefixo || process.env[`${prefixo}_PENSAR`] !== "0");
  const orcamento = prefixo ? Number(process.env[`${prefixo}_RACIOCINIO`]) || 0 : 0;
  const esforco = (prefixo && process.env[`${prefixo}_ESFORCO`]) || undefined;
  // maxTokens é só para o JSON; o pensamento ganha uma reserva, sem nunca passar do teto
  const reserva = pensa ? orcamento || Number(process.env.LLM_RESERVA_RACIOCINIO ?? 16000) || 0 : 0;
  const limite = Math.min(maxTokens + reserva, Number(process.env.LLM_TETO_TOKENS) || 24000);
  const pedir = () =>
    comRetry(
      model,
      async () => {
        await balde.pegar();
        const t0 = Date.now();
        try {
          const r = await client.chat.completions.create({
            model,
            temperature,
            max_tokens: limite,
            messages: mensagens,
            ...extrasDeRaciocinio(model, pensa, orcamento, esforco),
          } as OpenAI.ChatCompletionCreateParamsNonStreaming);
          registrarChamada({ modelo: model, funcao, ok: true, ms: Date.now() - t0, reserva: meta.reserva });
          return r;
        } catch (e) {
          // recusa de reasoning_budget não é falha do modelo: repete sem o parâmetro
          if (!recusaDeOrcamento(e)) {
            const c = classificarErro(e);
            registrarChamada({ modelo: model, funcao, ok: false, falha: c.falha, http: c.http, ms: Date.now() - t0, reserva: meta.reserva });
            if (c.falha === "permanente") desativados.add(model);
          }
          throw e;
        }
      },
      novasTentativas
    );
  let r: OpenAI.ChatCompletion;
  try {
    r = await pedir();
  } catch (e) {
    // alguns modelos (ex.: Ultra) recusam reasoning_budget com 400: repete sem e lembra
    if (!recusaDeOrcamento(e)) throw e;
    semOrcamento.add(model);
    console.warn(`  ↻ ${model} não aceita limite de pensamento; seguindo sem ele`);
    r = await pedir(); // semOrcamento agora tem o modelo: vai sem reasoning_budget
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
  maxTokens = 4000,
  // pensar: false = sem raciocínio (tarefas de cópia) · novasTentativas: repetições em erro passageiro
  opcoes: { pensar?: boolean; novasTentativas?: number } & MetaChamada = {}
): Promise<unknown> {
  let ultimoErro: unknown;
  const meta = { funcao: opcoes.funcao, reserva: opcoes.reserva };
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const { texto, motivo, limite } = await chamar(client, model, [
      { role: "system", content: system },
      { role: "user", content: user },
    ], temperature, maxTokens, opcoes.pensar, opcoes.novasTentativas, meta);
    try {
      if (!texto.includes("{") && motivo === "length")
        throw new Error(`resposta sem JSON (cortada no limite de ${limite} tokens: o modelo pensou demais)`);
      return extrairJSON(texto);
    } catch (e) {
      ultimoErro = e instanceof Error && e.message === "resposta sem JSON" ? new Error(`resposta sem JSON (finish_reason=${motivo}, ${texto.length} caracteres)`) : e;
      // HTTP ok, mas sem JSON: falha de formato na telemetria
      registrarChamada({ modelo: model, funcao: meta.funcao ?? (prefixoDo.get(client) ? FUNCAO_DO_PREFIXO[prefixoDo.get(client)!] : undefined), ok: false, falha: "formato", ms: 0, reserva: meta.reserva });
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
  maxTokens: number,
  opcoes: { pensar?: boolean } = {}
): Promise<{ json: unknown; modelo: string }> {
  return chatJSONComReserva(auditor(), modelo("AUDITOR_MODEL"), process.env.AUDITOR_MODEL_RESERVA, system, user, temperature, maxTokens, opcoes);
}

// Principal com reserva (mesmo provedor): se o principal falhar (fora do ar, timeout, sem JSON),
// usa a reserva. Com reserva configurada, o principal repete só 1 vez antes de passar a vez.
export async function chatJSONComReserva(
  client: OpenAI,
  principal: string,
  reserva: string | undefined,
  system: string,
  user: string,
  temperature: number,
  maxTokens: number,
  opcoes: { pensar?: boolean; funcao?: string } = {}
): Promise<{ json: unknown; modelo: string }> {
  const temReserva = !!reserva && reserva !== principal;
  try {
    const json = await chatJSON(client, principal, system, user, temperature, maxTokens, {
      ...opcoes,
      ...(temReserva ? { novasTentativas: 1 } : {}),
    });
    return { json, modelo: principal };
  } catch (e) {
    if (!temReserva) throw e;
    console.warn(`  ↪ ${principal} falhou (${String(e).replace(/\s+/g, " ").slice(0, 100)}); usando a reserva ${reserva}`);
    return { json: await chatJSON(client, reserva!, system, user, temperature, maxTokens, { ...opcoes, reserva: true }), modelo: reserva! };
  }
}

// Escritor de Português (frases da Crase) com reserva ESCRITOR_PT_MODEL_RESERVA
export const chatJSONEscritorPT = (system: string, user: string, temperature: number, maxTokens: number) =>
  chatJSONComReserva(escritorPT(), modelo("ESCRITOR_PT_MODEL"), process.env.ESCRITOR_PT_MODEL_RESERVA, system, user, temperature, maxTokens);

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
    const r = await comRetry("embeddings", async () => {
      await balde.pegar();
      const t0 = Date.now();
      try {
        const resp = await cliente("EMBED").embeddings.create({
          model: modelo("EMBED_MODEL"),
          input: lote,
          encoding_format: "float", // alguns provedores não aceitam base64 (padrão do SDK)
          ...extra,
        } as OpenAI.EmbeddingCreateParams);
        registrarChamada({ modelo: modelo("EMBED_MODEL"), funcao: "embed", ok: true, ms: Date.now() - t0 });
        return resp;
      } catch (e) {
        const c = classificarErro(e);
        registrarChamada({ modelo: modelo("EMBED_MODEL"), funcao: "embed", ok: false, falha: c.falha, http: c.http, ms: Date.now() - t0 });
        throw e;
      }
    });
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
