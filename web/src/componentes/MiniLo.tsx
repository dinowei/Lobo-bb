// Mini-player da Lo: aparece só enquanto ela está lendo (qualquer 🔊 ou "Estudar ouvindo").
// Turquesa só aqui e em "Voz da Lo" (é a cor da blusa dela); o resto segue o visual de sempre.
import { useEffect, useState } from "react";
import { ouvir, parar, pausarOuContinuar } from "../leitor";

export function MiniLo() {
  const [e, setE] = useState<{ id: string | null; estado: string; titulo?: string }>({ id: null, estado: "parado" });
  useEffect(() => ouvir(setE), []);
  if (!e.id || e.estado === "parado") return null;
  const lendo = e.estado === "tocando";
  return (
    <div className="mini-lo" role="status" aria-live="polite">
      <span className="mini-lo-ponto" aria-hidden="true" />
      <div className="mini-lo-texto">
        <strong>{e.estado === "carregando" ? "A Lo está se preparando…" : lendo ? "A Lo está lendo…" : "A Lo pausou"}</strong>
        {e.titulo && <span className="sub">{e.titulo}</span>}
      </div>
      <button className="botao-linha" onClick={() => pausarOuContinuar()} aria-label={lendo ? "Pausar a Lo" : "Continuar com a Lo"}>{lendo ? "⏸" : "▶"}</button>
      <button className="botao-linha" onClick={() => parar()} aria-label="Parar a Lo">✕</button>
    </div>
  );
}
