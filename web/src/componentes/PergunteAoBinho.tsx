// "Pergunte ao Binho" por tópico: o Binho responde em texto; o áudio é da Lo (🔊 "Ouvir resposta com a Lo").
// v1.1: dentro de um tema, abre com o contexto dele (aula, ficha do tema, questões que você errou) e cita a fonte;
// fora de tema, é o chat geral do tópico.
import { useEffect, useState } from "react";
import type { RespostaBinhoDTO } from "../../../shared/tipos";
import { useApp } from "../estado";
import { Ouvir } from "./Ouvir";
import { Microfone } from "./Microfone";

export function PergunteAoBinho({ topicoId, assunto, tema }: { topicoId: string; assunto: string; tema?: { subtopico: string; nome: string } }) {
  const { api } = useApp();
  const [pergunta, setPergunta] = useState("");
  const [pensando, setPensando] = useState(false);
  const [r, setR] = useState<RespostaBinhoDTO | null>(null);
  useEffect(() => { setR(null); setPergunta(""); }, [topicoId, tema?.subtopico]);

  const perguntar = async () => {
    if (pergunta.trim().length < 3 || pensando) return;
    setPensando(true);
    try {
      setR(await api.perguntarBinho(topicoId, pergunta.trim(), tema?.subtopico));
    } catch (e) {
      setR({ mensagem: e instanceof Error ? e.message : "O Binho está ocupado, tenta de novo em instantes." });
    } finally {
      setPensando(false);
    }
  };

  return (
    <section className="pergunte-binho" aria-labelledby="titulo-pergunte">
      <h3 id="titulo-pergunte">Pergunte ao Binho</h3>
      <label htmlFor="pergunta-binho" className="sub">
        {tema
          ? <>Dúvida sobre {tema.nome}? Ele responde com a aula, a ficha do tema e as questões que você errou nele, e mostra a fonte.</>
          : <>Dúvida sobre {assunto}? Ele responde com base na aula e nas fontes do tópico.</>}
      </label>
      <textarea
        id="pergunta-binho"
        rows={2}
        maxLength={500}
        value={pergunta}
        onChange={(e) => setPergunta(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void perguntar(); }}
        placeholder="Ex.: qual a diferença entre isso e aquilo?"
      />
      <div className="acoes">
        <Microfone aoFalar={(t) => setPergunta((p) => `${p ? `${p} ` : ""}${t}`.slice(0, 500))} />
        <button className="botao-linha" onClick={perguntar} disabled={pensando || pergunta.trim().length < 3}>
          {pensando ? "O Binho está pensando…" : "Perguntar"}
        </button>
      </div>
      <div aria-live="polite">
        {r?.mensagem && <p className="msg-aviso">{r.mensagem}</p>}
        {r?.resposta && (
          <>
            <p className="resposta-tutor">{r.resposta}</p>
            {r.temaEmAjuste && <small className="sub" data-testid="tema-em-ajuste">Chat do tema em ajuste: por enquanto respondi pelo tópico, sem a ficha e os seus erros.</small>}
            {r.contextoTema && (
              <small className="sub" data-testid="contexto-tema">
                Tema {r.contextoTema.nome}
                {r.contextoTema.trechosDaFicha ? ` · ${r.contextoTema.trechosDaFicha} trecho(s) da ficha do tema` : ""}
                {r.contextoTema.erros ? ` · considerou ${r.contextoTema.erros} questão(ões) que você errou` : ""}
              </small>
            )}
            {!!r.citacoes?.length && (
              <details><summary>Fontes</summary><ul>{r.citacoes.map((c, i) => <li key={i}><b>{c.titulo}:</b> “{c.trecho}”</li>)}</ul></details>
            )}
            <Ouvir texto={r.resposta} titulo="Resposta do Binho" rotulo="Ouvir resposta com a Lo" naHora />
            {r.restantesHoje !== undefined && <small className="sub">{r.restantesHoje} pergunta(s) nova(s) restante(s) hoje</small>}
          </>
        )}
      </div>
    </section>
  );
}
