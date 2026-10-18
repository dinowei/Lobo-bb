// Plano até a prova montado no navegador a partir do painel e dos ajustes (servidor e demo iguais)
import { useMemo } from "react";
import { gerarPlano, type Plano } from "../../shared/plano";
import { useApp } from "./estado";

export const hojeLocal = () => new Date().toLocaleDateString("sv-SE"); // AAAA-MM-DD no fuso do aparelho

export function usePlano(semanasAMostrar = 4): Plano | null {
  const { painel, ajustes } = useApp();
  return useMemo(() => {
    if (!painel?.disciplinas.length) return null;
    return gerarPlano({
      hoje: hojeLocal(),
      dataProva: ajustes.dataProva || undefined,
      inicio: ajustes.inicioPlano || undefined,
      horasPorDia: ajustes.horasPorDia,
      diasSemana: ajustes.diasSemana,
      semanasAMostrar,
      disciplinas: painel.disciplinas.map((d) => {
        const ts = painel.topicos.filter((t) => t.disciplina === d.disciplina);
        return {
          disciplina: d.disciplina,
          dominio: d.tentativas ? (d.acertos + 1) / (d.tentativas + 2) : 0,
          rating: painel.niveis?.find((n) => n.disciplina === d.disciplina && n.n >= 5)?.rating,
          topicos: ts.length,
          topicosVistos: ts.filter((t) => t.tentativas > 0).length,
        };
      }),
    });
  }, [painel, ajustes, semanasAMostrar]);
}
