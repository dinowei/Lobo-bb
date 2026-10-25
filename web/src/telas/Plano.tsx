import type { Disciplina } from "../../../shared/tipos";
import { NOME_FASE, SEMANAS_RETA_FINAL } from "../../../shared/plano";
import { useApp } from "../estado";
import { destinoItem, textoItem } from "../itensPlano";
import { hojeLocal, usePlano } from "../usePlano";
import { ISeta } from "../componentes/Icones";
import { Pose } from "../componentes/Pose";

const fmtData = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });


// Plano até a prova: recalculado do seu estado atual toda vez (atrasou, ele redistribui, sem culpa)
export function Plano() {
  const { painel, ajustes, ir } = useApp();
  const plano = usePlano(ajustes.dataProva ? 6 : 4);
  const hoje = hojeLocal();
  if (!painel) return <div className="carregando">Montando seu plano…</div>;
  if (!plano) return <div className="vazio"><Pose nome="pensativo" largura={70} /><div><strong>Sem tópicos ainda</strong><p>Carregue os tópicos do edital para o Binho montar o plano.</p></div></div>;
  const feitoHoje = (d: Disciplina) => painel.hojePorDisciplina?.find((x) => x.disciplina === d)?.n ?? 0;

  return (
    <div className="pagina">
      <div className="pagina-cabeca">
        <div>
          <h1>Plano até a prova</h1>
          <p>
            {plano.totalSemanas
              ? `Semana ${plano.semanaAtual} de ${plano.totalSemanas} · fase: ${NOME_FASE[plano.fase]}. As últimas ${SEMANAS_RETA_FINAL} semanas são só revisão, erros, redação e 2 simulados por semana.`
              : "Sem data de prova: ciclo de estudos contínuo, no peso de cada matéria × onde você está mais fraco."}{" "}
            Atrasou? O plano se refaz sozinho com o que falta.
          </p>
        </div>
        <div className="cabeca-acoes">
          <button className="botao-linha" onClick={() => ir("ajustes")}>Data, horas e dias</button>
          <Pose nome="mesa" largura={90} carregar="eager" className="cabeca-pose" />
        </div>
      </div>
      <ul className="plano-legenda" aria-label="Legenda">
        <li className="item-questoes">Questões</li>
        <li className="item-revisao">Revisão e erros</li>
        <li className="item-simulado">Redação e simulado</li>
      </ul>
      <div className="plano-semanas">
        {plano.semanas.map((s) => {
          const dias = s.dias.length ? (
              <ul className="plano-dias">
                {s.dias.map((d) => (
                  <li key={d.data} className={d.data === hoje ? "hoje" : ""}>
                    <b className="num">{d.data === hoje ? "Hoje" : fmtData(d.data)}</b>
                    <ul>
                      {d.itens.map((i, k) => {
                        const feito = d.data === hoje && i.tipo === "questoes" ? feitoHoje(i.disciplina) : null;
                        return (
                          <li key={k} className={`item-${i.tipo}`}>
                            {d.data === hoje ? (
                              <button className="link" onClick={() => ir(...destinoItem(i))}>{textoItem(i)}</button>
                            ) : (
                              textoItem(i)
                            )}
                            {feito !== null && i.tipo === "questoes" && <span className={`sub num${feito >= i.questoes ? " cumprido" : ""}`}> · {Math.min(feito, i.questoes)}/{i.questoes}</span>}
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="sub" style={{ margin: 0 }}>Sem dias de estudo nesta semana.</p>
            );
          // a semana atual é o destaque laranja (cor sólida com cartão branco por dentro); as outras, cartões comuns
          const atual = s.numero === 1;
          return (
            <section key={s.numero} className={atual ? "secao plano-semana-atual" : "secao"}>
              <h2>
                {plano.totalSemanas ? `Semana ${plano.semanaAtual + s.numero - 1}` : atual ? "Esta semana" : `Daqui a ${s.numero - 1} semana${s.numero > 2 ? "s" : ""}`}
                <span className="selo" style={{ marginLeft: 8 }}>{NOME_FASE[s.fase]}</span>
              </h2>
              {atual ? <div className="cartao-interno plano-interno">{dias}</div> : dias}
            </section>
          );
        })}
      </div>
      {!ajustes.dataProva && (
        <p className="atalho" style={{ marginTop: 14 }}>
          Quando sair o edital, coloque a data da prova em Ajustes: o plano ganha fases e uma linha de chegada. <button className="link" onClick={() => ir("ajustes")}>Ir para Ajustes <ISeta /></button>
        </p>
      )}
    </div>
  );
}
