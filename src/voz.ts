// ============================================================
// BB Estudos — voz do Binho (ADENDO-BINHO-VOZ): NVIDIA Magpie TTS Multilingual, API hospedada.
// Todo texto passa por paraFala (shared/fala.ts) e é quebrado em frases curtas; WAV → MP3 (ffmpeg);
// cache no Mongo pelo hash do texto falado + voz. Falhou: devolve null e o site usa a voz do navegador.
// ============================================================
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { Audio, Aula, Question, Tarefa, Topic } from "./models.js";
import { registrarChamada } from "./telemetria.js";
import { pregeracoes } from "./noturno.js";
import { frasesParaFala, paraFala, textoDaAula } from "../shared/fala.js";

export const VOZES_PT = ["Magpie-Multilingual.PT-BR.Diego", "Magpie-Multilingual.PT-BR.Isabela", "Magpie-Multilingual.PT-BR.Louise"] as const;
export const vozPadrao = () => process.env.NVIDIA_TTS_VOZ || VOZES_PT[0];
const TAXA_HZ = 22050;

const chave = () => process.env.NVIDIA_TTS_API_KEY || process.env.GERADOR_API_KEY;
const funcao = () => process.env.NVIDIA_TTS_FUNCTION_ID;
export const vozConfigurada = () => !!(chave() && funcao());
// .lean() devolve o campo como Binary do BSON (não Buffer): pega os bytes de verdade
const bytesDe = (d: unknown): Buffer => {
  const b = d as { buffer?: Uint8Array } | Uint8Array;
  return Buffer.from(b instanceof Uint8Array ? b : (b.buffer ?? new Uint8Array()));
};
export const hashFala =(textoFalado: string, voz: string) => createHash("sha256").update(`${voz}\n${textoFalado}`).digest("hex");

// 429/5xx (limite do plano grátis): espera e tenta de novo, até 3 vezes (Retry-After manda, até 60 s)
const ESPERAS_MS = [2000, 6000, 18000];
async function sintetizarFrase(frase: string, voz: string): Promise<Buffer> {
  for (let tentativa = 0; ; tentativa++) {
    try {
      return await sintetizarUmaVez(frase, voz);
    } catch (e) {
      const status = (e as { status?: number }).status ?? 0;
      if (!(status === 429 || status >= 500) || tentativa >= ESPERAS_MS.length) throw e;
      const pedido = Number((e as { retryAfter?: string }).retryAfter) * 1000;
      const espera = Number.isFinite(pedido) && pedido > 0 ? Math.min(60_000, pedido) : ESPERAS_MS[tentativa] * (0.75 + Math.random() * 0.5);
      await new Promise((ok) => setTimeout(ok, espera));
    }
  }
}

// Uma frase → PCM 16-bit mono (WAV com cabeçalho)
async function sintetizarUmaVez(frase: string, voz: string): Promise<Buffer> {
  const corpo = new FormData();
  corpo.set("text", frase);
  corpo.set("language", "pt-BR");
  corpo.set("voice", voz);
  corpo.set("encoding", "LINEAR_PCM");
  corpo.set("sample_rate_hz", String(TAXA_HZ));
  const t0 = Date.now();
  const r = await fetch(`https://${funcao()}.invocation.api.nvcf.nvidia.com/v1/audio/synthesize`, {
    method: "POST",
    headers: { Authorization: `Bearer ${chave()}` },
    body: corpo,
    signal: AbortSignal.timeout(60_000),
  });
  registrarChamada({ modelo: "nvidia/magpie-tts-multilingual", funcao: "voz", ok: r.ok, http: r.status, ms: Date.now() - t0, ...(r.ok ? {} : { falha: r.status === 429 ? "429" : r.status >= 500 ? "5xx" : "outro" }) });
  if (!r.ok) throw Object.assign(new Error(`TTS HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`), { status: r.status, retryAfter: r.headers.get("retry-after") ?? undefined });
  return Buffer.from(await r.arrayBuffer());
}

// PCM cru (sem cabeçalho) de um WAV; se não for WAV, assume que já é PCM
function pcmDe(wav: Buffer): Buffer {
  if (wav.subarray(0, 4).toString() !== "RIFF") return wav;
  const i = wav.indexOf("data", 12);
  return i >= 0 ? wav.subarray(i + 8) : wav;
}

// Junta as frases (com 250 ms de pausa) e comprime para MP3 mono 48 kbps
function paraMp3(pcm: Buffer): Promise<Buffer> {
  return new Promise((ok, falhou) => {
    const ff = spawn(process.env.FFMPEG_PATH || "ffmpeg", ["-hide_banner", "-loglevel", "error", "-f", "s16le", "-ar", String(TAXA_HZ), "-ac", "1", "-i", "pipe:0", "-codec:a", "libmp3lame", "-b:a", "48k", "-f", "mp3", "pipe:1"]);
    const saida: Buffer[] = [];
    ff.stdout.on("data", (d: Buffer) => saida.push(d));
    ff.on("error", falhou);
    ff.on("close", (codigo) => (codigo === 0 ? ok(Buffer.concat(saida)) : falhou(new Error(`ffmpeg saiu com ${codigo}`))));
    ff.stdin.end(pcm);
  });
}

// Texto da tela → áudio (cache primeiro). null = sem voz agora (o site cai na voz do navegador)
export async function audioDe(textoTela: string, voz = vozPadrao()): Promise<{ hash: string; mp3: Buffer } | null> {
  const falado = paraFala(textoTela);
  if (!falado.trim()) return null;
  const hash = hashFala(falado, voz);
  const pronto = await Audio.findOne({ hash, voz }).select("dados").lean();
  if (pronto) return { hash, mp3: bytesDe(pronto.dados) };
  if (!vozConfigurada()) return null;
  try {
    const pausa = Buffer.alloc(Math.round(TAXA_HZ * 0.25) * 2);
    const partes: Buffer[] = [];
    for (const frase of frasesParaFala(falado)) partes.push(pcmDe(await sintetizarFrase(frase, voz)), pausa);
    const pcm = Buffer.concat(partes);
    const mp3 = await paraMp3(pcm);
    await Audio.updateOne({ hash, voz }, { $setOnInsert: { hash, voz, dados: mp3, bytes: mp3.length, segundos: pcm.length / 2 / TAXA_HZ } }, { upsert: true });
    return { hash, mp3 };
  } catch (e) {
    console.warn(`[voz] ${String(e instanceof Error ? e.message : e).slice(0, 200)}`);
    return null;
  }
}

// ---------- pré-geração noturna: áudio das aulas e das explicações (de dia não se chama a NVIDIA) ----------
async function textoParaVoz(params: { tipo: "aula" | "explicacao"; id: string }): Promise<string | null> {
  if (params.tipo === "aula") {
    const a = await Aula.findOne({ _id: params.id, status: "aprovada" }).lean();
    const t = a ? await Topic.findById(a.topicId).select("assunto").lean() : null;
    return a && t ? textoDaAula({ assunto: t.assunto, conteudo: a.conteudo, pontosChave: a.pontosChave, comoABancaCobra: a.comoABancaCobra, pegadinhasComuns: a.pegadinhasComuns }) : null;
  }
  const q = await Question.findOne({ _id: params.id, status: "aprovada" }).select("explicacaoGeral").lean();
  return q?.explicacaoGeral ?? null;
}

pregeracoes["voz"] = async (params) => {
  if (!vozConfigurada()) return { ok: false, motivo: "aguardando_modelo", detalhes: "voz da NVIDIA não configurada no .env" };
  const texto = await textoParaVoz(params as { tipo: "aula" | "explicacao"; id: string });
  if (!texto) return { ok: false, motivo: "sem_texto" };
  const a = await audioDe(texto);
  return a ? { ok: true } : { ok: false, motivo: "provedor_falhou", detalhes: "TTS falhou; tenta de novo na próxima noite" };
};

export async function planejarVoz(lote: string, max = Number(process.env.VOZ_NOITE) || 40) {
  if (!vozConfigurada()) return 0;
  const voz = vozPadrao();
  const abertas = new Set((await Tarefa.distinct("params.id", { tipo: "voz", status: { $in: ["pendente", "rodando", "aguardando"] } })).map(String));
  const candidatos: { tipo: "aula" | "explicacao"; id: string; texto: string }[] = [];
  for (const a of await Aula.find({ status: "aprovada" }).select("_id").lean()) {
    const texto = await textoParaVoz({ tipo: "aula", id: String(a._id) });
    if (texto) candidatos.push({ tipo: "aula", id: String(a._id), texto });
  }
  for (const q of await Question.find({ status: "aprovada", explicacaoGeral: { $nin: [null, ""] } }).select("explicacaoGeral").sort({ updatedAt: -1 }).limit(max * 10).lean())
    candidatos.push({ tipo: "explicacao", id: String(q._id), texto: q.explicacaoGeral! });
  const prontos = new Set((await Audio.find({ voz, hash: { $in: candidatos.map((c) => hashFala(paraFala(c.texto), voz)) } }).select("hash").lean()).map((a) => a.hash));
  const novos = candidatos.filter((c) => !abertas.has(c.id) && !prontos.has(hashFala(paraFala(c.texto), voz))).slice(0, max);
  if (novos.length) await Tarefa.insertMany(novos.map((c) => ({ tipo: "voz", params: { tipo: c.tipo, id: c.id }, lote })));
  return novos.length;
}

// Só o que já está pronto (de dia não se chama a NVIDIA para explicação: vem da pré-geração)
export async function audioPronto(textoTela: string, voz = vozPadrao()) {
  const falado = paraFala(textoTela);
  const hash = hashFala(falado, voz);
  const a = await Audio.findOne({ hash, voz }).select("dados").lean();
  return a ? bytesDe(a.dados) : null;
}
