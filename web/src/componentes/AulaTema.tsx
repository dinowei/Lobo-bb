// Aula completa do tema (v1.1, item 4): uma seção por subtema, navegável. Cada seção mostra a origem (A oficial,
// B material oficial, C cursinho, ou conceito), exemplos, contraexemplos da Lo, pegadinhas da banca, resumo e as
// fontes literais; o áudio da Lo é por seção, sob pedido. Seção não aprovada aparece "em preparo".
import { useEffect, useRef, useState } from "react";
import type { AulaTemaDTO, SecaoAulaTemaDTO } from "../../../shared/tipos";
import { useApp } from "../estado";
import { Markdown } from "./Markdown";
import { Ouvir } from "./Ouvir";

const ORIGEM: Record<string, string> = { A: "fonte oficial (A)", B: "material oficial (B)", C: "material de cursinho (C)", conceito: "conceito (sem norma)" };

const textoDaSecao = (s: Extract<SecaoAulaTemaDTO, { status: "aprovada" }>) =>
  [`${s.subtema}.`, s.conteudo.replace(/\[\d+\]/g, ""), `Exemplos: ${s.exemplos.join(". ")}`, `Cuidado: ${s.contraexemplos.join(". ")}`, `Pegadinhas: ${s.pegadinhas.join(". ")}`, `Resumo: ${s.resumo}`].join("\n");

export function AulaTema({ subtopico }: { subtopico: string }) {
  const { api } = useApp();
  const [aula, setAula] = useState<AulaTemaDTO | null | undefined>(undefined);
  const refs = useRef<Record<number, HTMLElement | null>>({});
  useEffect(() => {
    setAula(undefined);
    api.aulaTema(subtopico).then(setAula).catch(() => setAula(null));
  }, [api, subtopico]);
  if (!aula?.secoes?.length) return null; // sem aula completa ainda: a página segue com a aula curta e o material

  return (
    <section className="secao aula-tema" aria-labelledby="titulo-aula-tema" data-testid="aula-tema">
      <h2 id="titulo-aula-tema">Aula completa <small className="num">· {aula.secoes.length} seções</small></h2>
      <div className="chips" role="navigation" aria-label="Seções da aula">
        {aula.secoes.map((s) => (
          <button key={s.ordem} className="chip" onClick={() => refs.current[s.ordem]?.scrollIntoView({ behavior: "smooth", block: "start" })}>
            {s.ordem + 1}. {s.subtema}{s.status === "em_preparo" ? " (em preparo)" : ""}
          </button>
        ))}
      </div>
      {aula.secoes.map((s) => (
        <article key={s.ordem} ref={(el) => { refs.current[s.ordem] = el; }} className="secao-aula" data-testid={`secao-aula-${s.ordem}`}>
          <h3>{s.ordem + 1}. {s.subtema}</h3>
          {s.status === "em_preparo" ? (
            <p className="sub">Em preparo: esta parte ainda está sendo conferida. As outras seções já valem.</p>
          ) : (
            <>
              <p><span className="selo">Origem: {ORIGEM[s.origem] ?? s.origem}</span></p>
              <Ouvir texto={textoDaSecao(s)} titulo={`${aula.nome}: ${s.subtema}`} rotulo="Ouvir esta seção com a Lo" />
              <Markdown texto={s.conteudo} />
              <h4>Exemplos</h4>
              <ul>{s.exemplos.map((x) => <li key={x}>{x}</li>)}</ul>
              <h4><span className="selo lo">Contraexemplos da Lo</span></h4>
              <ul>{s.contraexemplos.map((x) => <li key={x}>{x}</li>)}</ul>
              <h4>Pegadinhas da banca</h4>
              <ul>{s.pegadinhas.map((x) => <li key={x}>{x}</li>)}</ul>
              <p><b>Resumo:</b> {s.resumo}</p>
              {!!s.fontes.length && (
                <details>
                  <summary>Fontes ({s.fontes.length})</summary>
                  <ul>{s.fontes.map((f, i) => <li key={i}><b>[{i + 1}] {f.titulo}</b> (camada {f.camada}): “{f.trecho}”</li>)}</ul>
                </details>
              )}
            </>
          )}
        </article>
      ))}
    </section>
  );
}
