import { useEffect, useState } from "react";
import { NOME_DISCIPLINA, type Disciplina, type ErroDTO } from "../../../shared/tipos";
import { useApp } from "../estado";
import { ISeta } from "../componentes/Icones";
import { MASCOTE } from "../util";
import { pausarOuContinuar, tocarLista } from "../leitor";

// aoTocar: posição (na lista mostrada) que está tocando agora, para destacar a linha; -1 = nenhuma
function EstudarOuvindo({ erros, aoTocar }: { erros: ErroDTO[]; aoTocar: (i: number) => void }) {
  const { api, ajustes } = useApp();
  const [encerrar, setEncerrar] = useState<(() => void) | null>(null);
  const [atual, setAtual] = useState(-1);
  useEffect(() => () => encerrar?.(), [encerrar]);
  const comExplicacao = erros.filter((e) => e.explicacao);
  if (!comExplicacao.length) return null;
  const comecar = () => {
    const fim = tocarLista(
      comExplicacao.map((e) => ({ id: e.questaoId, texto: `${e.assunto}. ${e.explicacao}`, titulo: e.assunto })),
      { velocidade: ajustes.velocidadeVoz, servidor: api.modo === "servidor", voz: ajustes.vozLo, aoMudar: (i) => { setAtual(i); aoTocar(i === -1 ? -1 : erros.indexOf(comExplicacao[i])); if (i === -1) setEncerrar(null); } }
    );
    setEncerrar(() => fim);
  };
  return (
    <div className="secao estudar-ouvindo">
      <div>
        <strong>🎧 Estudar ouvindo</strong>
        <span className="sub"> · {atual >= 0 ? `a Lo está lendo ${atual + 1} de ${comExplicacao.length}: ${comExplicacao[atual].assunto}` : `a Lo lê as explicações dos seus erros (${comExplicacao.length}), uma atrás da outra`}</span>
      </div>
      <div className="acoes" style={{ marginTop: 8 }}>
        {encerrar ? (
          <>
            <button className="botao-linha" onClick={() => pausarOuContinuar()}>Pausar / continuar</button>
            <button className="botao-linha" onClick={() => { encerrar(); setEncerrar(null); }}>Parar</button>
          </>
        ) : (
          <button className="botao-laranja" onClick={comecar}>Ouvir com a Lo <ISeta /></button>
        )}
      </div>
    </div>
  );
}

export function Erros() {
  const { api, ir } = useApp();
  const [erros, setErros] = useState<ErroDTO[] | null>(null);
  const [filtro, setFiltro] = useState<Disciplina | "todas">("todas");
  const [tocando, setTocando] = useState(-1);

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
          <EstudarOuvindo erros={lista} aoTocar={setTocando} />
          <div>
            {lista.map((e, i) => (
              <div key={e.questaoId} className={`linha-erro${tocando === i ? " tocando" : ""}`}>
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
