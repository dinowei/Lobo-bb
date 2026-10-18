import { NOME_DISCIPLINA, type Disciplina } from "../../../shared/tipos";
import { NOME_FASE, SEMANAS_RETA_FINAL, type ItemPlano } from "../../../shared/plano";
import { useApp, type FiltroPratica, type Tela } from "../estado";
import { hojeLocal, usePlano } from "../usePlano";
import { ISeta } from "../componentes/Icones";
import { MASCOTE } from "../util";

const fmtData = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });

export function textoItem(i: ItemPlano) {
  switch (i.tipo) {
    case "questoes": return `${i.questoes} questões de ${NOME_DISCIPLINA[i.disciplina]}`;
    case "revisao": return `Revisão espaçada (${i.minutos} min)`;
    case "erros": return `Caderno de erros (${i.minutos} min)`;
    case "redacao": return `Uma redação (${i.minutos} min)`;
    case "simulado": return `Simulado de ${i.questoes} questões`;
  }
}
export function destinoItem(i: ItemPlano): [Tela, FiltroPratica?] {
  switch (i.tipo) {
    case "questoes": return ["praticar", { disciplina: i.disciplina }];
    case "revisao": return ["praticar", { revisao: true }];
    case "erros": return ["erros"];
    case "redacao": return ["redacao"];
    case "simulado": return ["simulados"];
  }
}

// Plano até a prova: recalculado do seu estado atual toda vez (atrasou, ele redistribui, sem culpa)
export function Plano() {
  const { painel, ajustes, ir } = useApp();
  const plano = usePlano(ajustes.dataProva ? 6 : 4);
  const hoje = hojeLocal();
  if (!painel) return <div className="carregando">Montando seu plano…</div>;
  if (!plano) return <div className="vazio"><img src={MASCOTE} alt="" /><div><strong>Sem tópicos ainda</strong><p>Carregue os tópicos do edital para o lobo montar o plano.</p></div></div>;
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
        <button className="botao-linha" onClick={() => ir("ajustes")}>Data, horas e dias</button>
      </div>
      <div className="plano-semanas">
        {plano.semanas.map((s) => (
          <section key={s.numero} className="secao">
            <h2>
              {plano.totalSemanas ? `Semana ${plano.semanaAtual + s.numero - 1}` : s.numero === 1 ? "Esta semana" : `Daqui a ${s.numero - 1} semana${s.numero > 2 ? "s" : ""}`}
              <span className="selo" style={{ marginLeft: 8 }}>{NOME_FASE[s.fase]}</span>
            </h2>
            {s.dias.length ? (
              <ul className="plano-dias">
                {s.dias.map((d) => (
                  <li key={d.data} className={d.data === hoje ? "hoje" : ""}>
                    <b className="num">{d.data === hoje ? "Hoje" : fmtData(d.data)}</b>
                    <ul>
                      {d.itens.map((i, k) => {
                        const feito = d.data === hoje && i.tipo === "questoes" ? feitoHoje(i.disciplina) : null;
                        return (
                          <li key={k}>
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
            )}
          </section>
        ))}
      </div>
      {!ajustes.dataProva && (
        <p className="atalho" style={{ marginTop: 14 }}>
          Quando sair o edital, coloque a data da prova em Ajustes: o plano ganha fases e uma linha de chegada. <button className="link" onClick={() => ir("ajustes")}>Ir para Ajustes <ISeta /></button>
        </p>
      )}
    </div>
  );
}
