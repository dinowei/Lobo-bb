import { useApp } from "../estado";
import { IMedalha, ISeta } from "../componentes/Icones";
import { pct } from "../util";
import { Pose } from "../componentes/Pose";
import { TabelaCalibragem } from "../componentes/Calibragem";

export function Conquistas() {
  const { painel, ir } = useApp();
  if (!painel) return <div className="carregando">Carregando…</div>;
  const { nivel } = painel;
  const obtidas = painel.conquistas.filter((c) => c.obtida).length;

  return (
    <div className="pagina">
      <div className="nivel-grande">
        <Pose nome="comemorando" largura={150} carregar="eager" pular={obtidas > 0} className="adesivo" />
        <div>
          <span className="num" style={{ fontWeight: 500, opacity: 0.75 }}>Nível {nivel.numero} · {painel.xp.toLocaleString("pt-BR")} XP no total</span>
          <h2>{nivel.titulo}</h2>
          <p className="num">{nivel.xpNoNivel} de {nivel.xpParaProximo} XP para o nível {nivel.numero + 1}</p>
          <div className="barra"><i style={{ width: pct(nivel.xpNoNivel / nivel.xpParaProximo) }} /></div>
        </div>
      </div>

      <div className="pagina-cabeca">
        <div>
          <h1 style={{ fontSize: 22 }}>Conquistas</h1>
          <p className="num">{obtidas} de {painel.conquistas.length} desbloqueadas · {painel.totalRespondidas} questões respondidas</p>
        </div>
        <div className="acoes" style={{ marginTop: 0 }}>
          <button className="botao-linha" onClick={() => ir("erros")}>Caderno de erros</button>
          <button className="botao-linha" onClick={() => ir("redacao")}>Treinar redação</button>
          <button className="botao-linha" onClick={() => ir("ajustes")}>Ajustes</button>
          <button className="botao-laranja" onClick={() => ir("praticar")}>Ganhar XP <ISeta /></button>
        </div>
      </div>

      <div className="grade-conquistas">
        {painel.conquistas.map((c) => (
          <div key={c.id} className={`conquista${c.obtida ? " obtida" : ""}`}>
            <span className="medalha"><IMedalha /></span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <b>{c.titulo}</b>
              <span>{c.descricao}</span>
              {c.obtida ? (
                <small className="conquista-feita">Desbloqueada</small>
              ) : (
                <div className="conquista-progresso">
                  <div className="barra"><i style={{ width: pct(c.progresso) }} /></div>
                  <small className="num">{pct(c.progresso)}</small>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <TabelaCalibragem linhas={painel.calibragem ?? []} />

      <div className="secao" style={{ marginTop: 18 }}>
        <h2>Como o XP funciona</h2>
        <p style={{ margin: 0, color: "var(--suave)", maxWidth: "70ch" }}>
          Acerto vale de 8 a 16 XP conforme a dificuldade. Acerto chutado vale metade. Erro vale 2 XP, porque tentar também conta.
          Revisão em dia dá +3. Cada nível pede 50 XP a mais que o anterior, e os títulos acompanham a carreira no banco.
        </p>
      </div>
    </div>
  );
}
