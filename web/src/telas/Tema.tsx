// Página do tema (F4): área de ESTUDO (material do acervo com páginas, lei, ficha, aula, ouvir, YouTube, pontos)
// e área de PRÁTICA (novas, revisões, erradas, por origem). Sem mapa do acervo ainda, mostra o que existe.
import { useEffect, useState } from "react";
import type { AulaDTO, TemaDTO, TrilhaDTO } from "../../../shared/tipos";
import { NOME_DISCIPLINA } from "../../../shared/tipos";
import { textoDaAula } from "../../../shared/fala";
import { MISTAS_FIM } from "../../../shared/trilha";
import { useApp } from "../estado";
import { useTemaDoDia } from "../useGrade";
import { PergunteAoBinho } from "../componentes/PergunteAoBinho";
import { Ouvir } from "../componentes/Ouvir";
import { Markdown } from "../componentes/Markdown";
import { ISeta } from "../componentes/Icones";
import { Pose } from "../componentes/Pose";

const NOME_CAMADA = { A: "oficial", B: "material oficial", C: "cursinho" } as const;

export function Tema() {
  const { api, filtro, ir, avisar, estudando: estudandoAgora, definirEstudando } = useApp();
  const sub = filtro.subtopico;
  const [t, setT] = useState<TemaDTO | null | undefined>(undefined);
  const [aula, setAula] = useState<AulaDTO | null>(null);
  const [pedido, setPedido] = useState(false);
  const [trilha, setTrilha] = useState<TrilhaDTO | null>(null);
  const { temaHoje, proximo } = useTemaDoDia(trilha);

  useEffect(() => {
    if (!sub) return setT(null);
    setT(undefined);
    api.tema(sub).then(setT).catch(() => setT(null));
    api.trilha().then(setTrilha).catch(() => setTrilha(null));
  }, [api, sub]);
  useEffect(() => {
    const id = t?.topicoIds[0];
    if (!id) return setAula(null);
    api.aula(id).then(setAula).catch(() => setAula(null));
  }, [api, t?.topicoIds]);
  useEffect(() => { if (t) document.title = `${t.nome} · Lobo Binho`; }, [t]);

  if (t === undefined) return <div className="carregando">Carregando o tema…</div>;
  if (!t) return (
    <div className="vazio">
      <Pose nome="pensativo" largura={70} />
      <div><strong>Tema não encontrado</strong><div className="acoes"><button className="botao-linha" onClick={() => ir("painel")}>Voltar ao painel</button></div></div>
    </div>
  );

  const e = t.estudo;
  const treinar = (revisoes = false) => {
    // treinar um tema fora da sequência = escolha manual (o Painel mostra o que você está estudando)
    const estudando = proximo && proximo.subtopico !== t.subtopico ? t.subtopico : "";
    if (estudando !== estudandoAgora) definirEstudando(estudando);
    ir("praticar", { sessao: { subtopico: t.subtopico, nome: t.nome, disciplina: t.disciplina, novas: 20, mistas: MISTAS_FIM, revisoes, trilha: false } });
  };
  // v1.1: tema do dia = próximo da Grade (ou o escolhido à mão); a sessão só traz o tema
  const ehDoDia = temaHoje?.subtopico === t.subtopico;
  const estudarHoje = () => temaHoje && ir("praticar", {
    sessao: {
      subtopico: t.subtopico, nome: temaHoje.nome, disciplina: t.disciplina, revisoes: true, trilha: true,
      novas: Math.max(5, temaHoje.tamanho - temaHoje.novasFeitasHoje), mistas: temaHoje.mistas,
    },
  });
  // escolha manual: o Painel mostra este tema; a sequência da Grade (e o Plano) não muda
  const fazerDoDia = () => {
    definirEstudando(t.subtopico);
    avisar(`${t.nome} agora é o seu tema do dia. A sequência da Grade continua${proximo ? ` em ${proximo.nome}` : ""}.`);
  };
  const pedirPrioridade = async () => {
    try {
      await api.pedirPrioridadeTema(t.subtopico);
      setPedido(true);
      avisar("Pedido anotado: o noturno prioriza este tema.");
    } catch (err) {
      avisar(err instanceof Error ? err.message : "Não deu para pedir agora.");
    }
  };
  const textoOuvir = [
    `Tema: ${t.nome}.`,
    e.objetivo ?? "",
    e.pontos.length ? `Pontos para lembrar: ${e.pontos.join(". ")}.` : "",
    e.ficha ? `Ficha: ${e.ficha.texto}` : "",
    aula ? textoDaAula(aula) : "",
  ].filter(Boolean).join("\n");

  return (
    <div className="pagina pagina-tema">
      <header className="pagina-cabeca">
        <div>
          <div className="eyebrow num">
            {t.n ? `Trilha · tema ${t.n}` : "Tema"}{t.disciplina ? ` · ${NOME_DISCIPLINA[t.disciplina]}` : ""} · {t.concursos.map((c) => c.toUpperCase()).join(" e ")}
          </div>
          <h1>{t.nome}</h1>
          {e.objetivo && <p className="desc" data-testid="objetivo">{e.objetivo}</p>}
        </div>
        <div className="acoes">
          {ehDoDia ? (
            <button className="botao-laranja" onClick={estudarHoje} data-testid="estudar-hoje">Estudar o tema do dia <ISeta /></button>
          ) : (
            <button className="botao-laranja" onClick={() => treinar()} data-testid="treinar-tema">Treinar este tema <ISeta /></button>
          )}
          {t.n && trilha && !ehDoDia && trilha.modo !== "domingo" && (
            <button className="botao-linha" onClick={fazerDoDia} data-testid="fazer-do-dia" title={`Hoje a sequência está em: ${proximo?.nome ?? "—"}`}>Fazer deste o tema do dia</button>
          )}
        </div>
      </header>

      {t.poucas && (
        <div className="faixa-aviso" role="status">
          Só {t.aprovadas} {t.aprovadas === 1 ? "questão aprovada" : "questões aprovadas"} neste tema (o ideal é 15+).{" "}
          {pedido ? "Pedido feito: o noturno prioriza este tema." : <button className="link" onClick={pedirPrioridade}>Pedir prioridade ao noturno</button>}
        </div>
      )}

      <div className="tema-grade">
        <section className="secao" aria-labelledby="titulo-estudo">
          <h2 id="titulo-estudo">Estudo <small className="num">· {e.tempoMin} min sugeridos</small></h2>

          <h3>Material</h3>
          {e.materialAutomatico && !!e.materiais.length && <p className="atalho">Mapa automático do acervo (por palavra-chave): confira as páginas antes de confiar.</p>}
          {e.materiais.length ? (
            <ul className="lista-material">
              {e.materiais.map((m) => (
                <li key={`${m.arquivo}-${m.paginas}`}>
                  <span className={`selo camada-${m.camada}`}>{m.camada} · {NOME_CAMADA[m.camada]}</span>
                  <span><b>{m.titulo}</b> <span className="num">· p. {m.paginas}</span></span>
                  {m.disponivel ? (
                    <a className="botao-linha" href={`/api/material?arquivo=${encodeURIComponent(m.arquivo)}#page=${m.pagina}`} target="_blank" rel="noopener">Abrir material</a>
                  ) : <small>só abre no PC com o acervo</small>}
                </li>
              ))}
            </ul>
          ) : <p className="atalho">O mapa do acervo deste tema ainda não foi feito.</p>}

          {e.lei && (<><h3>Lei / regra</h3><p><a href={e.lei.url} target="_blank" rel="noopener">{e.lei.nome}</a></p></>)}

          {!!e.pontos.length && (
            <>
              <h3>Pontos para lembrar</h3>
              <ul data-testid="pontos">{e.pontos.map((p) => <li key={p}>{p}</li>)}</ul>
            </>
          )}

          {e.ficha && (
            <>
              <h3>Ficha</h3>
              <div className="ficha-tema">
                <Markdown texto={e.ficha.texto} />
                <blockquote>“{e.ficha.citacao}”<cite> — {e.ficha.fonte}</cite></blockquote>
              </div>
            </>
          )}

          {e.fichaAcervo && (
            <>
              <h3>Ficha do acervo</h3>
              <ul className="ficha-acervo" data-testid="ficha-acervo">
                {e.fichaAcervo.afirmacoes.map((a, i) => (
                  <li key={i}>
                    {a.texto}
                    {a.classe === "exemplo" || a.classe === "hipotese" ? <small> ({a.classe})</small> : null}
                    <details><summary>fonte: {a.titulo}, p. {a.pagina} ({a.camada})</summary><blockquote>“{a.trecho}”</blockquote></details>
                  </li>
                ))}
              </ul>
              {!!e.fichaAcervo.conflitos.length && <p className="atalho">Atenção, o cursinho diverge da lei aqui (vale a lei): {e.fichaAcervo.conflitos.join(" · ")}</p>}
            </>
          )}

          {aula && (
            <details>
              <summary>Aula do tópico ({aula.assunto})</summary>
              <Markdown texto={aula.conteudo} />
            </details>
          )}

          <div className="acoes">
            <Ouvir texto={textoOuvir} titulo={t.nome} rotulo="Estudar ouvindo" />
            <a className="botao-linha" href={e.youtube} target="_blank" rel="noopener" data-testid="youtube">Buscar aula no YouTube</a>
          </div>
          {!!e.oficiaisNoAcervo.length && <p className="atalho">Caiu em prova: {e.oficiaisNoAcervo.join(" · ")}</p>}
          {/* v1.1: chat do tema (aula, ficha do tema e questões que você errou, com a fonte) */}
          {t.topicoIds[0] && <PergunteAoBinho topicoId={t.topicoIds[0]} assunto={t.nome} tema={{ subtopico: t.subtopico, nome: t.nome }} />}
        </section>

        <section className="secao" aria-labelledby="titulo-pratica">
          <h2 id="titulo-pratica">Prática</h2>
          <div className="mini-stats tema-numeros">
            <div className="do-binho"><b className="num">{t.pratica.novas}</b><span>novas para você</span></div>
            <div className="da-lo"><b className="num">{t.pratica.revisoes}</b><span>revisões vencidas</span></div>
            <div className="da-lo"><b className="num">{t.pratica.erradas}</b><span>que você já errou</span></div>
          </div>
          <p className="atalho num">
            No banco: {t.aprovadas} aprovadas · {t.pratica.oficiais} oficiais · {t.pratica.geradas} geradas{t.pratica.derivadas ? ` · ${t.pratica.derivadas} derivadas` : ""}{t.pratica.cursinho ? ` · ${t.pratica.cursinho} de cursinho` : ""}
          </p>
          <div className="acoes">
            <button className="botao-laranja" onClick={() => treinar()}>Treinar este tema <ISeta /></button>
            {t.pratica.revisoes > 0 && <button className="botao-linha" onClick={() => treinar(true)}>Revisões + tema</button>}
            {t.pratica.erradas > 0 && <button className="botao-linha" onClick={() => ir("erros")}>Caderno de erros</button>}
            <button className="botao-linha" onClick={() => ir("certo-errado", { subtopico: t.subtopico })} data-testid="ce-do-tema">Certo ou Errado deste tema</button>
          </div>
        </section>
      </div>
    </div>
  );
}
