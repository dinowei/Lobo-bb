// Grade curricular montada no navegador (servidor e demo iguais): trilha + desempenho por tema + tópicos do edital.
// Usada pela tela Grade e pelo Plano (cronograma matéria por matéria). A lente do concurso filtra os temas.
import { useEffect, useMemo, useState } from "react";
import { useApp } from "./estado";
import { montarGrade, temaDoDia, type MateriaGrade, type TemaGrade } from "../../shared/grade";
import { tamanhoSessao } from "../../shared/trilha";
import { subtemasDoTema } from "../../shared/estudoTema";
import { SUBTOPICO_POR_ID } from "../../shared/subtopicos";
import { disciplinaDoTema } from "../../shared/trilhaUnica";
import type { DesempenhoTemaDTO } from "../../shared/desempenhoTema";
import type { Disciplina, TopicoDTO, TrilhaDTO } from "../../shared/tipos";


type Dados = { trilha: TrilhaDTO; desempenho: DesempenhoTemaDTO[]; topicos: TopicoDTO[] };

export function useGrade(): { grade: MateriaGrade[] | null; erro: boolean; recarregar: () => void } {
  const { api, concurso } = useApp();
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState(false);
  const [vez, setVez] = useState(0);

  useEffect(() => {
    let vivo = true;
    setErro(false);
    Promise.all([api.trilha(), api.desempenhoTemas(), api.topicos()])
      .then(([trilha, desempenho, topicos]) => vivo && setDados({ trilha, desempenho, topicos }))
      .catch(() => vivo && setErro(true));
    return () => { vivo = false; };
  }, [api, vez]);

  const grade = useMemo(() => {
    if (!dados) return null;
    const des = new Map(dados.desempenho.map((d) => [d.subtopico, d]));
    const ids = dados.trilha.temas.map((t) => t.subtopico);
    const lente = concurso === "geral" ? null : concurso;
    const temas = dados.trilha.temas
      .filter((t) => !lente || (SUBTOPICO_POR_ID.get(t.subtopico)?.concursos ?? []).some((c) => c === lente))
      .map((t) => {
        const s = SUBTOPICO_POR_ID.get(t.subtopico);
        const disciplina = (des.get(t.subtopico)?.disciplina ?? (s ? disciplinaDoTema(s) : null)) as Disciplina | null;
        return { n: t.n, subtopico: t.subtopico, nome: t.nome, disciplina, subtemas: subtemasDoTema(t.subtopico, dados.topicos, ids) };
      });
    const placar = new Map(dados.desempenho.map((d) => [d.subtopico, { respondidas: d.respondidas, recentes: d.recentes ?? [], aprovadas: d.aprovadas }]));
    return montarGrade(temas, placar);
  }, [dados, concurso]);

  return { grade, erro, recarregar: () => setVez((v) => v + 1) };
}

// tema do dia (Painel e página do tema): o próximo da sequência da Grade, a mesma fonte do Plano. Escolha manual
// (ajustes.estudando) aparece no lugar, sem mudar a sequência. Os números do dia vêm da trilha quando é o mesmo tema.
export function useTemaDoDia(trilha: TrilhaDTO | null): { temaHoje: TrilhaDTO["hoje"]; manual: boolean; proximo: TemaGrade | null } {
  const { ajustes } = useApp();
  const { grade } = useGrade();
  return useMemo(() => {
    if (!grade) return { temaHoje: null, manual: false, proximo: null };
    const dia = temaDoDia(grade, ajustes.estudando || null);
    const proximo = grade.flatMap((m) => m.temas).find((t) => t.proximoDaSequencia) ?? null;
    if (!dia) return { temaHoje: null, manual: false, proximo };
    const t = dia.tema;
    const temaHoje: TrilhaDTO["hoje"] = trilha?.hoje?.subtopico === t.subtopico ? trilha.hoje : {
      n: t.n, subtopico: t.subtopico, nome: t.nome, disciplina: t.disciplina, estado: "novo", refazer: false, diaNoTema: 1,
      aprovadas: t.aprovadas, novasFeitasHoje: 0, acertosHoje: 0, tamanho: tamanhoSessao("novo"), mistas: 0,
    };
    return { temaHoje, manual: dia.manual, proximo };
  }, [grade, ajustes.estudando, trilha]);
}
