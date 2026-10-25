// Leitor da Lo (a assistente do Binho é a voz da narração): um áudio por vez. Primeiro tenta o MP3 da voz da NVIDIA (servidor, pré-gerado);
// sem ele (demo, offline, cota, falha), usa a voz do navegador em pt-BR. Sempre com paraFala.
// Espaço da Lo: começa de uma posição (frase ou segundos), avisa o progresso e troca a velocidade no meio.
import { paraFala, frasesParaFala } from "../../shared/fala";
import { escolherVozNavegador } from "../../shared/voz";

type Estado = "parado" | "carregando" | "tocando" | "pausado";
type Ouvinte = (e: { id: string | null; estado: Estado; titulo?: string }) => void;
export type Progresso = { fracao: number; frase: number; segundos: number; frases: number };

let atual: {
  id: string; titulo?: string; audio?: HTMLAudioElement; fala?: boolean;
  frases?: string[]; frase: number; velocidade: number; geracao: number;
  aoProgresso?: (p: Progresso) => void; fim?: () => void;
} | null = null;
let estado: Estado = "parado";
let geracao = 0; // cada leva de falas do navegador; cancelar não pode encerrar a leva nova
const ouvintes = new Set<Ouvinte>();
const avisar = () => ouvintes.forEach((o) => o({ id: atual?.id ?? null, estado, titulo: atual?.titulo }));
const mudar = (e: Estado) => { estado = e; avisar(); };

export const ouvir = (o: Ouvinte) => { ouvintes.add(o); o({ id: atual?.id ?? null, estado, titulo: atual?.titulo }); return () => { ouvintes.delete(o); }; };

export function parar() {
  atual?.audio?.pause();
  if (atual?.fala && "speechSynthesis" in window) { geracao++; speechSynthesis.cancel(); }
  atual = null;
  mudar("parado");
}

export function pausarOuContinuar() {
  if (!atual) return;
  if (atual.audio) { if (estado === "tocando") { atual.audio.pause(); mudar("pausado"); } else { void atual.audio.play(); mudar("tocando"); } return; }
  if (estado === "tocando") { speechSynthesis.pause(); mudar("pausado"); } else { speechSynthesis.resume(); mudar("tocando"); }
}

// troca a velocidade no meio: no MP3 na hora; na voz do navegador, recomeça da frase atual com a nova velocidade
export function mudarVelocidade(v: number) {
  if (!atual) return;
  atual.velocidade = v;
  if (atual.audio) { atual.audio.playbackRate = v; return; }
  if (atual.fala && atual.frases) falarDesde(atual.frase);
}

async function mp3DoServidor(texto: string, naHora: boolean, voz?: string): Promise<Blob | null> {
  try {
    const r = await fetch("/api/voz", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ texto, naHora, voz }) });
    return r.status === 200 ? await r.blob() : null;
  } catch {
    return null;
  }
}

function falarDesde(inicio: number) {
  const a = atual;
  if (!a?.frases) return;
  if (!("speechSynthesis" in window)) return a.fim?.();
  const minha = ++geracao;
  a.geracao = minha;
  speechSynthesis.cancel();
  const vozPt = escolherVozNavegador(speechSynthesis.getVoices());
  const frases = a.frases;
  if (inicio >= frases.length) return a.fim?.();
  for (let i = inicio; i < frases.length; i++) {
    const u = new SpeechSynthesisUtterance(frases[i]);
    u.lang = "pt-BR";
    u.rate = a.velocidade;
    if (vozPt) u.voice = vozPt;
    u.onstart = () => {
      if (minha !== geracao || atual !== a) return;
      a.frase = i;
      a.aoProgresso?.({ fracao: i / frases.length, frase: i, segundos: 0, frases: frases.length });
    };
    if (i === frases.length - 1) u.onend = () => {
      if (minha !== geracao || atual !== a) return;
      a.aoProgresso?.({ fracao: 1, frase: frases.length, segundos: 0, frases: frases.length });
      a.fim?.();
    };
    speechSynthesis.speak(u);
  }
}

// "Estudar ouvindo": toca a lista em sequência; anterior/próxima pelos botões do sistema (Media Session,
// funciona com a tela bloqueada quando o navegador deixa). Devolve uma função para encerrar.
export function tocarLista(itens: { id: string; texto: string; titulo: string }[], opts: { velocidade?: number; servidor?: boolean; voz?: string; aoMudar?: (i: number) => void } = {}) {
  let i = 0;
  let encerrada = false;
  const ms = "mediaSession" in navigator ? navigator.mediaSession : null;
  const pular = (delta: number) => { i = Math.max(0, Math.min(itens.length - 1, i + delta)) - 1; parar(); };
  ms?.setActionHandler("nexttrack", () => pular(1));
  ms?.setActionHandler("previoustrack", () => pular(-1));
  ms?.setActionHandler("pause", () => pausarOuContinuar());
  ms?.setActionHandler("play", () => pausarOuContinuar());
  (async () => {
    for (; i < itens.length && !encerrada; i++) {
      opts.aoMudar?.(i);
      await tocar(`lista-${itens[i].id}`, itens[i].texto, { ...opts, titulo: `${i + 1}/${itens.length} · ${itens[i].titulo}` });
    }
    if (!encerrada) opts.aoMudar?.(-1);
  })();
  return () => { encerrada = true; parar(); opts.aoMudar?.(-1); };
}

// as frases que a voz do navegador lê (a transcrição do Espaço da Lo destaca a atual)
export const frasesDoTexto = (texto: string) => frasesParaFala(paraFala(texto));

// Toca um texto; o mesmo id de novo para/pausa. Retorna quando termina (para a playlist).
export function tocar(id: string, texto: string, opts: {
  velocidade?: number; servidor?: boolean; naHora?: boolean; titulo?: string; voz?: string;
  inicio?: { frase: number; segundos: number }; aoProgresso?: (p: Progresso) => void;
} = {}): Promise<void> {
  if (atual?.id === id) { pausarOuContinuar(); return Promise.resolve(); }
  parar();
  const velocidade = opts.velocidade ?? 1;
  atual = { id, titulo: opts.titulo, frase: 0, velocidade, geracao: 0, aoProgresso: opts.aoProgresso };
  const eu = atual;
  mudar("carregando");
  return new Promise<void>((terminou) => {
    const fim = () => { if (atual === eu) { atual = null; mudar("parado"); } terminou(); };
    eu.fim = fim;
    (async () => {
      const blob = opts.servidor ? await mp3DoServidor(texto, !!opts.naHora, opts.voz) : null;
      if (atual !== eu) return terminou(); // trocou no meio
      if ("mediaSession" in navigator && opts.titulo) navigator.mediaSession.metadata = new MediaMetadata({ title: opts.titulo, artist: "Lo, assistente do Binho" });
      if (blob) {
        const audio = new Audio(URL.createObjectURL(blob));
        audio.playbackRate = velocidade;
        if (opts.inicio?.segundos) audio.addEventListener("loadedmetadata", () => { audio.currentTime = Math.min(opts.inicio!.segundos, Math.max(0, audio.duration - 1)); }, { once: true });
        audio.ontimeupdate = () => {
          if (atual === eu && audio.duration) eu.aoProgresso?.({ fracao: audio.currentTime / audio.duration, frase: 0, segundos: audio.currentTime, frases: 0 });
        };
        audio.onended = () => { URL.revokeObjectURL(audio.src); eu.aoProgresso?.({ fracao: 1, frase: 0, segundos: audio.duration || 0, frases: 0 }); fim(); };
        eu.audio = audio;
        await audio.play().catch(() => fim());
      } else {
        eu.fala = true;
        eu.frases = frasesDoTexto(texto);
        falarDesde(Math.min(opts.inicio?.frase ?? 0, Math.max(0, eu.frases.length - 1)));
      }
      if (atual === eu) mudar("tocando");
    })();
  });
}
