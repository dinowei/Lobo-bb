import { useEffect, useState } from "react";
import { NOME_DISCIPLINA, type Disciplina, type ErroDTO } from "../../../shared/tipos";
import { useApp } from "../estado";
import { ISeta } from "../componentes/Icones";
import { MASCOTE } from "../util";

export function Erros() {
  const { api, ir } = useApp();
  const [erros, setErros] = useState<ErroDTO[] | null>(null);
  const [filtro, setFiltro] = useState<Disciplina | "todas">("todas");

  useEffect(() => {
    api.erros().then(setErros);
  }, [api]);

  if (!erros) return <div className="carregando">Carregando…</div>;
  const discs = [...new Set(erros.map((e) => e.disciplina))];
  const lista = filtro === "todas" ? erros : erros.filter((e) => e.disciplina === filtro);

  return (
    <div className="pagina">
      <div className="pagina-cabeca">
        <div>
          <h1>Caderno de erros</h1>
          <p>Questões cuja última resposta foi errada. Acertou na revisão, ela sai daqui sozinha.</p>
        </div>
      </div>

      {erros.length === 0 ? (
        <div className="vazio">
          <img src={MASCOTE} alt="" />
          <div>
            <strong>Caderno limpo</strong>
            <p>Nenhum erro pendente. Quando errar, a questão aparece aqui com o caminho para refazer.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="filtros" role="group" aria-label="Filtrar por disciplina">
            <button className="chip" aria-pressed={filtro === "todas"} onClick={() => setFiltro("todas")}>Todas ({erros.length})</button>
            {discs.map((d) => (
              <button key={d} className="chip" aria-pressed={filtro === d} onClick={() => setFiltro(d)}>
                {NOME_DISCIPLINA[d]} ({erros.filter((e) => e.disciplina === d).length})
              </button>
            ))}
          </div>
          <div>
            {lista.map((e) => (
              <div key={e.questaoId} className="linha-erro">
                <div style={{ minWidth: 0 }}>
                  <small>
                    {NOME_DISCIPLINA[e.disciplina]} · {e.assunto} · errou {e.vezesErrada}x
                  </small>
                  <p>{e.enunciado}</p>
                </div>
                <button className="botao-linha" onClick={() => ir("praticar", { questaoId: e.questaoId })}>
                  Refazer <ISeta />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
