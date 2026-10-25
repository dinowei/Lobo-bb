// Tela Certo/Errado (F10): afirmação + Certo / Errado / Em branco. Antes de responder é o Binho (laranja);
// a correção é da Lo (turquesa). A nota usa a penalidade da banca do concurso ativo (Cebraspe: erro anula acerto)
// e o Binho diz, com os números do aluno, se vale chutar ou deixar em branco neste assunto.
import { useCallback, useEffect, useRef, useState } from "react";
import type { CorrecaoCEDTO, ProximoItemCEDTO } from "../../../shared/tipos";
import { NOME_DISCIPLINA } from "../../../shared/tipos";
import { useApp } from "../estado";
import { ISeta } from "../componentes/Icones";
import { Pose } from "../componentes/Pose";

type Resposta = "C" | "E" | null;
const ROTULO: Record<"C" | "E", string> = { C: "Certo", E: "Errado" };

export function CertoErrado() {
  const { api, avisar, filtro, ir } = useApp();
  const subtopico = filtro.subtopico;
  const [dados, setDados] = useState<ProximoItemCEDTO | null>(null);
  const [correcao, setCorrecao] = useState<CorrecaoCEDTO | null>(null);
  const [marcada, setMarcada] = useState<Resposta | undefined>(undefined);
  const [placar, setPlacar] = useState({ pontos: 0, itens: 0 });
  const [enviando, setEnviando] = useState(false);
  const vistos = useRef<string[]>([]);
  const inicio = useRef(Date.now());

  const carregar = useCallback(async () => {
    setCorrecao(null);
    setMarcada(undefined);
    try {
      let d = await api.proximoItemCE({ excluir: vistos.current, ...(subtopico ? { subtopico } : {}) });
      // acabaram os inéditos desta rodada: recomeça sem a lista de vistos
      if (!d.item && vistos.current.length) {
        vistos.current = [];
        d = await api.proximoItemCE(subtopico ? { subtopico } : {});
      }
      if (d.item) vistos.current = [...vistos.current, d.item.id].slice(-60);
      setDados(d);
      inicio.current = Date.now();
    } catch (e) {
      avisar((e as Error).message);
    }
  }, [api, avisar, subtopico]);
  useEffect(() => { void carregar(); }, [carregar]);

  const responder = useCallback(async (r: Resposta) => {
    if (!dados?.item || correcao || enviando) return;
    setMarcada(r);
    setEnviando(true);
    try {
      const c = await api.responderItemCE({ itemId: dados.item.id, resposta: r, tempoSeg: (Date.now() - inicio.current) / 1000 });
      setCorrecao(c);
      setPlacar((p) => ({ pontos: p.pontos + c.pontos, itens: p.itens + 1 }));
    } catch (e) {
      avisar((e as Error).message);
      setMarcada(undefined);
    } finally {
      setEnviando(false);
    }
  }, [api, avisar, correcao, dados, enviando]);

  // atalhos: C, E, B (em branco); Enter vai para a próxima depois da correção
  useEffect(() => {
    const f = (ev: KeyboardEvent) => {
      if (ev.target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(ev.target.tagName)) return;
      const k = ev.key.toUpperCase();
      if (!correcao && (k === "C" || k === "E")) void responder(k);
      else if (!correcao && k === "B") void responder(null);
      else if (correcao && k === "ENTER") void carregar();
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [carregar, correcao, responder]);

  const item = dados?.item;
  const rec = correcao?.recomendacao ?? dados?.recomendacao;
  return (
    <div className="pagina tela-ce">
      <div className="pagina-cabeca">
        <div>
          <h1>Certo ou Errado</h1>
          {subtopico && dados?.item && (
            <p className="ce-filtro">Só deste tema: <b>{dados.item.assunto}</b> · <button className="link" onClick={() => ir("certo-errado")}>ver todos</button></p>
          )}
          <p>Julgue a afirmação. {dados ? <>Nota no critério da <b>{dados.nomeBanca}</b>{dados.banca === "cebraspe" ? ": cada erro anula um acerto, e em branco vale zero." : ": errar não tira ponto."}</> : null}</p>
        </div>
        {placar.itens > 0 && (
          <div className="ce-placar num" aria-live="polite">
            <b>{placar.pontos > 0 ? `+${placar.pontos}` : placar.pontos}</b> ponto{Math.abs(placar.pontos) === 1 ? "" : "s"} em {placar.itens} {placar.itens === 1 ? "item" : "itens"}
          </div>
        )}
      </div>

      {!dados ? (
        <div className="esqueleto" style={{ height: 240 }} aria-busy="true" aria-label="Carregando" />
      ) : !item ? (
        <div className="vazio">
          <Pose nome="pensativo" largura={90} />
          <div><b>Nada por aqui ainda.</b><p>{dados.aviso}</p></div>
        </div>
      ) : (
        <article className="secao ce-cartao" data-testid="item-ce" data-subtopico={item.subtopico ?? ""}>
          <div className="selos">
            {item.disciplina && <span className="selo laranja">{NOME_DISCIPLINA[item.disciplina]}</span>}
            <span className="selo">{item.assunto}</span>
            {item.origem === "oficial" && item.prova && <span className="selo">{item.prova}</span>}
          </div>
          {item.textoBase && (
            <div className="texto-base"><span className="rotulo">Texto</span>{item.textoBase}</div>
          )}
          <p className="ce-afirmacao">{item.afirmacao}</p>

          {rec && rec.recomenda !== "sem_dados" && !correcao && (
            <p className={`ce-recomendacao ${rec.recomenda}`} role="note" data-testid="recomendacao-ce">
              <b>{rec.recomenda === "branco" ? "Binho: na dúvida, em branco." : "Binho: vale responder."}</b> {rec.motivo}
            </p>
          )}

          {!correcao ? (
            <div className="ce-botoes" role="group" aria-label="Sua resposta">
              <button className="ce-certo" disabled={enviando} onClick={() => responder("C")}>Certo <kbd>C</kbd></button>
              <button className="ce-errado" disabled={enviando} onClick={() => responder("E")}>Errado <kbd>E</kbd></button>
              <button className="ce-branco" disabled={enviando} onClick={() => responder(null)}>Em branco <kbd>B</kbd></button>
            </div>
          ) : (
            <>
              <div className={`resultado-faixa ${correcao.acertou === null ? "branco" : correcao.acertou ? "ok" : "nok"}`} data-testid="correcao-ce">
                {correcao.acertou === null
                  ? `Em branco. Gabarito: ${correcao.gabarito === "anulada" ? "anulado" : ROTULO[correcao.gabarito]}`
                  : correcao.acertou ? `Acertou: ${ROTULO[marcada as "C" | "E"]}!` : `Não foi dessa vez. Gabarito: ${correcao.gabarito === "anulada" ? "anulado" : ROTULO[correcao.gabarito]}`}
                <small className="num">{correcao.pontos > 0 ? `+${correcao.pontos}` : correcao.pontos} ponto{Math.abs(correcao.pontos) === 1 ? "" : "s"}</small>
              </div>
              <p className="aviso-lo"><b>Lo:</b> {correcao.explicacao}</p>
              {correcao.recomendacao.recomenda !== "sem_dados" && <p className="ce-recomendacao-depois">{correcao.recomendacao.motivo}</p>}
              <div className="acoes">
                <button className="botao-laranja" onClick={carregar} autoFocus>Próximo item <ISeta /></button>
                <span className="atalho">Enter: próximo</span>
              </div>
            </>
          )}
        </article>
      )}
    </div>
  );
}
