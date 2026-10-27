// Plano até a prova montado no navegador a partir do painel e dos ajustes (servidor e demo iguais)
import { useMemo } from "react";
import { gerarPlano, type Plano } from "../../shared/plano";
import { filaDaGrade } from "../../shared/grade";
import { useApp } from "./estado";
import { useGrade } from "./useGrade";

export const hojeLocal = () => new Date().toLocaleDateString("sv-SE"); // AAAA-MM-DD no fuso do aparelho

export function usePlano(semanasAMostrar = 4): Plano | null {
  const { painel, ajustes } = useApp();
  // v1.1: o cronograma segue a grade (enquanto ela carrega, vale o rodízio de antes; nada é apagado)
  const { grade } = useGrade();
  return useMemo(() => {
    if (!painel?.disciplinas.length) return null;
    return gerarPlano({
      hoje: hojeLocal(),
      dataProva: ajustes.dataProva || undefined,
      inicio: ajustes.inicioPlano || undefined,
      horasPorDia: ajustes.horasPorDia,
      diasSemana: ajustes.diasSemana,
      semanasAMostrar,
      grade: grade ? filaDaGrade(grade) : undefined,
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
  }, [painel, ajustes, semanasAMostrar, grade]);
}
