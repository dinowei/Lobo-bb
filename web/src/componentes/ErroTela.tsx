// Erro numa tela não derruba o app: mensagem humana e "Tentar de novo" (remonta só a tela)
import { Component, type ReactNode } from "react";
import { MASCOTE } from "../util";

export class ErroTela extends Component<{ children: ReactNode; chave: string }, { erro: boolean; tentativa: number }> {
  state = { erro: false, tentativa: 0 };
  static getDerivedStateFromError() {
    return { erro: true };
  }
  componentDidCatch(e: unknown) {
    console.error("[tela]", e);
  }
  componentDidUpdate(prev: { chave: string }) {
    if (prev.chave !== this.props.chave && this.state.erro) this.setState({ erro: false });
  }
  render() {
    if (!this.state.erro) return <div key={this.state.tentativa} style={{ display: "contents" }}>{this.props.children}</div>;
    return (
      <div className="vazio" role="alert">
        <img src={MASCOTE} alt="" />
        <div>
          <strong>Algo deu errado nesta tela</strong>
          <p>O resto do app continua funcionando. Tente de novo; se repetir, recarregue a página.</p>
          <div className="acoes">
            <button className="botao-laranja" onClick={() => this.setState((s) => ({ erro: false, tentativa: s.tentativa + 1 }))}>Tentar de novo</button>
          </div>
        </div>
      </div>
    );
  }
}

// Enquanto a tela carrega: blocos no formato do conteúdo (sem spinner solto)
export function Esqueleto() {
  return (
    <div className="esqueleto" aria-busy="true" aria-label="Carregando">
      <i style={{ width: "40%", height: 28 }} />
      <i style={{ width: "70%" }} />
      <i style={{ height: 120 }} />
      <i style={{ height: 120 }} />
    </div>
  );
}
