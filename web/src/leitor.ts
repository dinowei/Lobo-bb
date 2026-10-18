// Leitor do Binho: um áudio por vez. Primeiro tenta o MP3 da voz da NVIDIA (servidor, pré-gerado);
// sem ele (demo, offline, cota, falha), usa a voz do navegador em pt-BR. Sempre com paraFala.
import { paraFala, frasesParaFala } from "../../shared/fala";

type Estado = "parado" | "carregando" | "tocando" | "pausado";
type Ouvinte = (e: { id: string | null; estado: Estado }) => void;

let atual: { id: string; audio?: HTMLAudioElement; fala?: boolean } | null = null;
let estado: Estado = "parado";
const ouvintes = new Set<Ouvinte>();
const avisar = () => ouvintes.forEach((o) => o({ id: atual?.id ?? null, estado }));
const mudar = (e: Estado) => { estado = e; avisar(); };

export const ouvir = (o: Ouvinte) => { ouvintes.add(o); o({ id: atual?.id ?? null, estado }); return () => { ouvintes.delete(o); }; };

export function parar() {
  atual?.audio?.pause();
  if (atual?.fala && "speechSynthesis" in window) speechSynthesis.cancel();
  atual = null;
  mudar("parado");
}

export function pausarOuContinuar() {
  if (!atual) return;
  if (atual.audio) { if (estado === "tocando") { atual.audio.pause(); mudar("pausado"); } else { void atual.audio.play(); mudar("tocando"); } return; }
  if (estado === "tocando") { speechSynthesis.pause(); mudar("pausado"); } else { speechSynthesis.resume(); mudar("tocando"); }
}

async function mp3DoServidor(texto: string, naHora: boolean, voz?: string): Promise<Blob | null> {
  try {
    const r = await fetch("/api/voz", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ texto, naHora, voz }) });
    return r.status === 200 ? await r.blob() : null;
  } catch {
    return null;
  }
}

function vozDoNavegador(texto: string, velocidade: number, fim: () => void) {
  if (!("speechSynthesis" in window)) return fim();
  speechSynthesis.cancel();
  const frases = frasesParaFala(paraFala(texto));
  const vozPt = speechSynthesis.getVoices().find((v) => v.lang?.toLowerCase().startsWith("pt-br")) ?? speechSynthesis.getVoices().find((v) => v.lang?.toLowerCase().startsWith("pt"));
  frases.forEach((f, i) => {
    const u = new SpeechSynthesisUtterance(f);
    u.lang = "pt-BR";
    u.rate = velocidade;
    if (vozPt) u.voice = vozPt;
    if (i === frases.length - 1) u.onend = fim;
    speechSynthesis.speak(u);
  });
}

// Toca um texto; o mesmo id de novo para/pausa. Retorna quando termina (para a playlist).
export function tocar(id: string, texto: string, opts: { velocidade?: number; servidor?: boolean; naHora?: boolean; titulo?: string; voz?: string } = {}): Promise<void> {
  if (atual?.id === id) { pausarOuContinuar(); return Promise.resolve(); }
  parar();
  const velocidade = opts.velocidade ?? 1;
  atual = { id };
  mudar("carregando");
  return new Promise<void>((terminou) => {
    const fim = () => { if (atual?.id === id) { atual = null; mudar("parado"); } terminou(); };
    (async () => {
      const blob = opts.servidor ? await mp3DoServidor(texto, !!opts.naHora, opts.voz) : null;
      if (atual?.id !== id) return terminou(); // trocou no meio
      if ("mediaSession" in navigator && opts.titulo) navigator.mediaSession.metadata = new MediaMetadata({ title: opts.titulo, artist: "Binho" });
      if (blob) {
        const audio = new Audio(URL.createObjectURL(blob));
        audio.playbackRate = velocidade;
        audio.onended = () => { URL.revokeObjectURL(audio.src); fim(); };
        atual.audio = audio;
        await audio.play().catch(() => fim());
      } else {
        atual.fala = true;
        vozDoNavegador(texto, velocidade, fim);
      }
      mudar("tocando");
    })();
  });
}
