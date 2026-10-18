// 🎤 Falar em vez de digitar (reconhecimento de voz do navegador, pt-BR). A NVIDIA não tem ASR
// grátis com pt-BR (o Whisper hospedado é gRPC de parceiro); sem suporte no navegador, o botão some.
import { useRef, useState } from "react";

type Reconhecedor = { lang: string; interimResults: boolean; maxAlternatives: number; start: () => void; stop: () => void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };
const Classe = (window as unknown as { SpeechRecognition?: new () => Reconhecedor; webkitSpeechRecognition?: new () => Reconhecedor }).SpeechRecognition
  ?? (window as unknown as { webkitSpeechRecognition?: new () => Reconhecedor }).webkitSpeechRecognition;

export function Microfone({ aoFalar }: { aoFalar: (texto: string) => void }) {
  const [ouvindo, setOuvindo] = useState(false);
  const rec = useRef<Reconhecedor | null>(null);
  if (!Classe) return null;
  const alternar = () => {
    if (ouvindo) return rec.current?.stop();
    const r = new Classe();
    r.lang = "pt-BR";
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (e) => aoFalar(Array.from(e.results).map((x) => x[0].transcript).join(" ").trim());
    r.onend = () => setOuvindo(false);
    r.onerror = () => setOuvindo(false);
    rec.current = r;
    setOuvindo(true);
    r.start();
  };
  return (
    <button type="button" className="botao-ouvir" onClick={alternar} aria-pressed={ouvindo} aria-label={ouvindo ? "Parar de ouvir" : "Falar a dúvida"}>
      <span aria-hidden="true">{ouvindo ? "⏹" : "🎤"}</span> {ouvindo ? "Ouvindo…" : "Falar"}
    </button>
  );
}
