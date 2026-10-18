// Botão 🔊: ouvir uma explicação, regra, aula ou resposta do Binho (pausa e continua no mesmo botão)
import { useEffect, useId, useState } from "react";
import { useApp } from "../estado";
import { ouvir, tocar } from "../leitor";

export function Ouvir({ texto, titulo, naHora = false, rotulo = "Ouvir" }: { texto: string; titulo?: string; naHora?: boolean; rotulo?: string }) {
  const { api, ajustes } = useApp();
  const id = useId();
  const [estado, setEstado] = useState<"parado" | "carregando" | "tocando" | "pausado">("parado");
  useEffect(() => ouvir((e) => setEstado(e.id === id ? e.estado : "parado")), [id]);
  if (!texto.trim()) return null;
  const icone = estado === "tocando" ? "⏸" : estado === "carregando" ? "…" : "🔊";
  const nome = estado === "tocando" ? "Pausar" : estado === "pausado" ? "Continuar" : rotulo;
  return (
    <button
      className="botao-ouvir"
      onClick={() => void tocar(id, texto, { velocidade: ajustes.velocidadeVoz, servidor: api.modo === "servidor", naHora, titulo, voz: ajustes.vozBinho })}
      aria-label={`${nome}${titulo ? `: ${titulo}` : ""}`}
      aria-pressed={estado === "tocando"}
    >
      <span aria-hidden="true">{icone}</span> {nome}
    </button>
  );
}
