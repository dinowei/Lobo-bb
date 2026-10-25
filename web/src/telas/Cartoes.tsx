import { useCallback, useEffect, useState } from "react";
import { NOME_DISCIPLINA, type FilaCartoesDTO, type NotaCartao } from "../../../shared/tipos";
import { useApp } from "../estado";
import { ISeta } from "../componentes/Icones";
import { Pose } from "../componentes/Pose";

const NOTAS: { nota: NotaCartao; rotulo: string; tecla: string }[] = [
  { nota: 1, rotulo: "Errei", tecla: "1" },
  { nota: 3, rotulo: "Difícil", tecla: "2" },
  { nota: 4, rotulo: "Bom", tecla: "3" },
  { nota: 5, rotulo: "Fácil", tecla: "4" },
];

export function Cartoes() {
  const { api, ir, avisar } = useApp();
  const [fila, setFila] = useState<FilaCartoesDTO | null>(null);
  const [i, setI] = useState(0);
  const [virado, setVirado] = useState(false);
  const [feitos, setFeitos] = useState(0);
  const [erro, setErro] = useState(false);

  const carregar = useCallback(async () => {
    setErro(false);
    try {
      setFila(await api.cartoes());
      setI(0);
      setVirado(false);
    } catch {
      setErro(true);
    }
  }, [api]);
  useEffect(() => { carregar(); }, [carregar]);

  const c = fila?.cartoes[i];
  const avaliar = useCallback(async (nota: NotaCartao) => {
    if (!c || !virado) return;
    try {
      await api.avaliarCartao(c.id, nota);
      setFeitos((n) => n + 1);
      setVirado(false);
      if (fila && i + 1 >= fila.cartoes.length) await carregar(); // os errados voltam em 10 min
      else setI((x) => x + 1);
    } catch (e) {
      avisar(e instanceof Error ? e.message : "Não deu para salvar. Tente de novo.");
    }
  }, [c, virado, api, fila, i, carregar, avisar]);

  // atalhos: espaço vira, 1–4 avaliam
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "BUTTON" && e.key === " ") return;
      if (e.key === " " && !virado) { e.preventDefault(); setVirado(true); }
      const n = NOTAS.find((x) => x.tecla === e.key);
      if (n && virado) avaliar(n.nota);
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [virado, avaliar]);

  return (
    <div className="pagina">
      <div className="pagina-cabeca">
        <div>
          <h1>Cartões</h1>
          <p>Leis, normas e vocabulário de Inglês em frente e verso, com a fonte. Errou, volta em 10 minutos; acertou, volta cada vez mais tarde.</p>
        </div>
        {c && <Pose nome="notebook" largura={90} className="cabeca-pose" />}
      </div>

      {erro ? (
        <div className="vazio">
          <Pose nome="pensativo" largura={70} />
          <div>
            <strong>Não deu para carregar os cartões</strong>
            <div className="acoes"><button className="botao-laranja" onClick={carregar}>Tentar de novo</button></div>
          </div>
        </div>
      ) : !fila ? (
        <div className="carregando">Embaralhando os cartões…</div>
      ) : !c ? (
        <div className="vazio">
          {feitos ? <Pose nome="comemorando" largura={70} pular /> : <Pose nome="pensativo" largura={70} />}
          <div>
            <strong>{feitos ? `Fechou por hoje: ${feitos} cartões revisados` : fila.total ? "Nenhum cartão para hoje" : "Os cartões ainda estão sendo preparados"}</strong>
            <p>{fila.total ? "Os próximos voltam na data certa. Que tal umas questões enquanto isso?" : "O Binho monta cartões novos toda noite a partir das leis e das provas."}</p>
            <div className="acoes"><button className="botao-laranja" onClick={() => ir("praticar")}>Praticar questões <ISeta /></button></div>
          </div>
        </div>
      ) : (
        <div className="cartao-estudo">
          <div className="selos">
            <span className="selo">{NOME_DISCIPLINA[c.disciplina]} · {c.assunto}</span>
            {c.novo && <span className="selo">Novo</span>}
            <span className="selo num">{i + 1} de {fila.cartoes.length}</span>
          </div>
          <button className={`cartao-face${virado ? " virado" : ""}`} onClick={() => setVirado(true)} aria-label={virado ? "Cartão virado" : "Virar o cartão"} disabled={virado}>
            <span className="cartao-papel">
              <span className="cartao-frente">{c.frente}</span>
              {virado ? (
                <>
                  <span className="cartao-verso">{c.verso}</span>
                  {c.fonte && <small className="cartao-fonte">{c.fonte.titulo}: “{c.fonte.trecho}”</small>}
                </>
              ) : (
                <small className="cartao-dica">Pense na resposta e toque (ou <kbd>Espaço</kbd>) para virar</small>
              )}
            </span>
          </button>
          {virado && (
            <div className="acoes" role="group" aria-label="Como foi?">
              {NOTAS.map((n) => (
                <button key={n.nota} className={n.nota === 4 ? "botao-laranja" : "botao-linha"} onClick={() => avaliar(n.nota)}>
                  {n.rotulo} <span className="atalho">{n.tecla}</span>
                </button>
              ))}
            </div>
          )}
          <ul className="cartoes-numeros num" aria-label="Seus cartões">
            <li><b>{fila.vencidos}</b> para revisar hoje</li>
            <li><b>{fila.novosRestantesHoje}</b> novos liberados hoje</li>
            <li><b>{fila.total}</b> no banco</li>
          </ul>
        </div>
      )}
    </div>
  );
}
