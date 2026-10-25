import { useApp } from "../estado";
import { ISeta } from "../componentes/Icones";
import { fmtDiaCurto } from "../util";

export function Revisoes() {
  const { painel, ir } = useApp();
  if (!painel) return <div className="carregando">Carregando…</div>;
  const max = Math.max(1, ...painel.revisoesPorDia.map((d) => d.total));
  const semana = painel.revisoesPorDia.reduce((s, d) => s + d.total, 0);

  return (
    <div className="pagina tela-lo">
      <div className="pagina-cabeca">
        <div>
          <h1>Revisões</h1>
          <p>
            Toda questão respondida volta no momento certo: errou, volta amanhã; acertou com certeza, o intervalo vai crescendo
            (1, 3, 8 dias…). Chute certo volta cedo, porque sorte não é domínio.
          </p>
        </div>
        <button className="botao-laranja" disabled={!painel.revisoesHoje} onClick={() => ir("praticar", { revisao: true })}>
          {painel.revisoesHoje ? `Revisar ${painel.revisoesHoje} agora` : "Nada para hoje"} <ISeta />
        </button>
      </div>

      <div className="secao">
        <h2 className="num">Próximos 7 dias · {semana} {semana === 1 ? "questão" : "questões"}</h2>
        <div className="colunas-dias" role="img" aria-label={painel.revisoesPorDia.map((d) => `${fmtDiaCurto(d.dia)}: ${d.total}`).join(", ")}>
          {painel.revisoesPorDia.map((d, i) => (
            <div key={d.dia}>
              <b className="num">{d.total}</b>
              <i style={{ height: `${(d.total / max) * 100}%` }} />
              <span>{i === 0 ? "hoje" : fmtDiaCurto(d.dia)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
