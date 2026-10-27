// Grade curricular (v1.1, estudo sequencial): uma aba por matéria; dentro, os temas na ordem sugerida da trilha,
// cada um com status, % de acerto nas últimas questões e o próximo passo. Grade livre: qualquer tema abre;
// o "próximo da sequência" fica destacado. A lente do concurso filtra os temas. Regras em shared/grade.ts.
import { useState } from "react";
import { useApp } from "../estado";
import { NOME_STATUS, type IdMateria } from "../../../shared/grade";
import { useGrade } from "../useGrade";
import { Pose } from "../componentes/Pose";
import { ISeta } from "../componentes/Icones";

export function Grade() {
  const { ir } = useApp();
  const { grade, erro, recarregar } = useGrade();
  const [aba, setAba] = useState<IdMateria | null>(null);

  if (erro)
    return (
      <div className="pagina">
        <div className="vazio" role="alert"><Pose nome="pensativo" largura={70} /><div><strong>Não deu para carregar a grade</strong><div className="acoes"><button className="botao-laranja" onClick={recarregar}>Tentar de novo</button></div></div></div>
      </div>
    );
  if (!grade) return <div className="carregando">Montando a grade…</div>;

  const materiaDoProximo = grade.find((m) => m.temas.some((t) => t.proximoDaSequencia))?.id ?? grade[0]?.id ?? null;
  const atual = grade.find((m) => m.id === (aba ?? materiaDoProximo)) ?? grade[0];

  return (
    <div className="pagina tela-grade">
      <div className="pagina-cabeca">
        <div>
          <h1>Grade</h1>
          <p>Uma matéria por vez, um tema por vez, até o fim: aula, questões só daquele tema e revisão dos erros. A grade é livre; o destaque é o próximo da sequência.</p>
        </div>
        <Pose nome="mesa" largura={90} carregar="eager" className="cabeca-pose" />
      </div>

      <div className="chips abas-grade" role="tablist" aria-label="Matérias">
        {grade.map((m) => (
          <button key={m.id} role="tab" className="chip" aria-selected={atual?.id === m.id} onClick={() => setAba(m.id)} data-testid={`grade-aba-${m.id}`}>
            {m.nome} <span className="num">{m.concluidos}/{m.temas.length}</span>
          </button>
        ))}
      </div>

      {atual ? (
        <section className="secao" aria-label={atual.nome} data-testid="grade-materia">
          <h2>{atual.nome}</h2>
          <ol className="lista-grade">
            {atual.temas.map((t) => (
              <li key={t.subtopico} className={t.proximoDaSequencia ? "proximo" : undefined} data-testid={`grade-tema-${t.subtopico}`}>
                <span className="num">{t.n}</span>
                <div className="grade-corpo">
                  <div>
                    <b>{t.nome}</b> <span className={`selo status-${t.status}`}>{NOME_STATUS[t.status]}</span>
                    {t.proximoDaSequencia && <span className="selo laranja">próximo da sequência</span>}
                  </div>
                  <div className="sub">
                    <span className="num">{t.acerto === null ? "sem respostas" : `${t.acerto}% nas últimas`}</span> · {t.proximo}
                  </div>
                  {t.subtemas.length > 0 && <small className="subtemas">{t.subtemas.join(" · ")}</small>}
                </div>
                <button className={t.proximoDaSequencia ? "botao-laranja" : "botao-linha"} onClick={() => ir("tema", { subtopico: t.subtopico })}>
                  {t.status === "nao_iniciado" ? "Começar" : t.status === "concluido" ? "Revisar" : "Continuar"} <ISeta />
                </button>
              </li>
            ))}
          </ol>
        </section>
      ) : <p className="sub">Nenhum tema nesta aba de concurso.</p>}
    </div>
  );
}
