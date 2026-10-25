// Player da Lo, fixo no rodapé (estilo podcast): aparece só enquanto ela está lendo (qualquer 🔊 ou
// "Estudar ouvindo"). Turquesa é a cor dela (áudio é da Lo). A lógica é a de sempre (leitor.ts).
import { useEffect, useState } from "react";
import { ouvir, parar, pausarOuContinuar } from "../leitor";
import { Pose } from "./Pose";
import { useApp } from "../estado";

export function MiniLo() {
  const { tela } = useApp();
  const [e, setE] = useState<{ id: string | null; estado: string; titulo?: string }>({ id: null, estado: "parado" });
  useEffect(() => ouvir(setE), []);
  if (!e.id || e.estado === "parado") return null;
  if (tela === "espaco-lo") return null; // o Espaço da Lo tem o próprio player, com transcrição
  const lendo = e.estado === "tocando";
  return (
    <div className={`mini-lo${lendo ? " lendo" : ""}`} role="status" aria-live="polite">
      <Pose nome="lo-narrando" largura={52} carregar="eager" alt="" />
      <div className="mini-lo-texto">
        <strong>{e.estado === "carregando" ? "A Lo está se preparando…" : lendo ? "A Lo está lendo" : "A Lo pausou"}</strong>
        {e.titulo && <span className="sub">{e.titulo}</span>}
      </div>
      <div className="equalizador" aria-hidden="true"><i /><i /><i /><i /><i /></div>
      <button className="play-lo" onClick={() => pausarOuContinuar()} aria-label={lendo ? "Pausar a Lo" : "Continuar com a Lo"}>{lendo ? "⏸" : "▶"}</button>
      <button className="parar-lo" onClick={() => parar()} aria-label="Parar a Lo">✕</button>
    </div>
  );
}
