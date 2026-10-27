// Grade curricular montada no navegador (servidor e demo iguais): trilha + desempenho por tema + tópicos do edital.
// Usada pela tela Grade e pelo Plano (cronograma matéria por matéria). A lente do concurso filtra os temas.
import { useEffect, useMemo, useState } from "react";
import { useApp } from "./estado";
import { montarGrade, type MateriaGrade } from "../../shared/grade";
import { SUBTOPICO_POR_ID } from "../../shared/subtopicos";
import { disciplinaDoTema } from "../../shared/trilhaUnica";
import type { DesempenhoTemaDTO } from "../../shared/desempenhoTema";
import type { Disciplina, TopicoDTO, TrilhaDTO } from "../../shared/tipos";

const semAcento = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

// subtemas = subtópicos do edital dos assuntos do tema; assunto dividido entre temas (Regência × Crase)
// fica só com os subtópicos que falam do tema
function subtemasDe(subtopico: string, topicos: TopicoDTO[], todos: string[]): string[] {
  const s = SUBTOPICO_POR_ID.get(subtopico);
  if (!s) return [];
  const chaves = [s.nome, ...(s.palavras ?? [])].map(semAcento);
  return s.topicos.flatMap((assunto) => {
    const lista = topicos.find((t) => t.assunto === assunto)?.subtopicos ?? [];
    const dividido = todos.filter((id) => SUBTOPICO_POR_ID.get(id)?.topicos.includes(assunto)).length > 1;
    return dividido ? lista.filter((x) => chaves.some((c) => semAcento(x).includes(c))) : lista;
  });
}

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
        return { n: t.n, subtopico: t.subtopico, nome: t.nome, disciplina, subtemas: subtemasDe(t.subtopico, dados.topicos, ids) };
      });
    const placar = new Map(dados.desempenho.map((d) => [d.subtopico, { respondidas: d.respondidas, ultimas: d.ultimas ?? { n: 0, a: 0 }, aprovadas: d.aprovadas }]));
    return montarGrade(temas, placar);
  }, [dados, concurso]);

  return { grade, erro, recarregar: () => setVez((v) => v + 1) };
}
