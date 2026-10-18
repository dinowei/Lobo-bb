import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RedacaoDTO, TemaRedacaoDTO } from "../../../shared/tipos";
import { useApp } from "../estado";
import { LINHAS_REDACAO, linhasDaFolha } from "../../../shared/redacaoLinhas";

type Rascunho = { texto: string; tempoSeg: number };
const chaveRascunho = (temaId: string) => `lobo-redacao-${temaId}`;
// linhas da folha de prova (estimadas por caracteres), igual ao servidor
const linhasDe = (texto: string) => linhasDaFolha(texto);
const tempo = (seg: number) => `${String(Math.floor(seg / 60)).padStart(2, "0")}:${String(seg % 60).padStart(2, "0")}`;

function trechosMarcados(texto: string, trechos: string[]) {
  const unicos = [...new Set(trechos.filter((t) => t && texto.includes(t)))].sort((a, b) => b.length - a.length);
  if (!unicos.length) return [texto];
  const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(${unicos.map(escapar).join("|")})`, "g");
  return texto.split(re).filter(Boolean).map((p, i) => unicos.includes(p) ? <mark key={i}>{p}</mark> : <span key={i}>{p}</span>);
}

function Resultado({ r }: { r: RedacaoDTO }) {
  if (!r.correcao) return null;
  const c = r.correcao;
  const citados = c.criterios.flatMap((x) => x.trechos);
  return (
    <section className="secao redacao-resultado">
      <div className="redacao-nota">
        <div>
          <span className="sub">Nota estimada</span>
          <strong className="num">{c.notaTotal}<small>/100</small></strong>
        </div>
        <span className={`redacao-corte${c.notaTotal >= 70 ? " passou" : ""}`}>{c.notaTotal >= 70 ? "Acima da linha de 70" : "Abaixo da linha de 70"}</span>
      </div>
      <p className="redacao-aviso">Nota estimada (correção automática; pode variar da banca)</p>
      {c.penalidade && <p className="msg-erro">{c.penalidade}</p>}
      <div className="redacao-colunas">
        {c.criterios.map((x) => (
          <article className="redacao-criterio" key={x.nome}>
            <div><b>{x.nome}</b><strong className="num">{x.nota}/25</strong></div>
            <p>{x.comentario}</p>
            {!!x.trechos.length && <ul>{x.trechos.map((t, i) => <li key={`${t}-${i}`}><q>{t}</q></li>)}</ul>}
          </article>
        ))}
      </div>
      <h3>Seu texto, com os trechos apontados</h3>
      <p className="redacao-texto redacao-marcado">{trechosMarcados(r.texto, citados)}</p>
      <div className="redacao-colunas">
        <div><h3>Pontos fortes</h3><ul>{c.pontosFortes.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
        <div><h3>O que melhorar</h3><ul>{c.melhorias.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
      </div>
      <h3>Exemplo de parágrafo reescrito</h3>
      <p className="redacao-texto">{c.paragrafoReescrito}</p>
    </section>
  );
}

export function Redacao() {
  const { api, ajustes, avisar, recarregar, guardarSaida } = useApp();
  const [temas, setTemas] = useState<TemaRedacaoDTO[]>([]);
  const [historico, setHistorico] = useState<RedacaoDTO[]>([]);
  const [temaId, setTemaId] = useState("");
  const [texto, setTexto] = useState("");
  const [tempoSeg, setTempoSeg] = useState(0);
  const [atual, setAtual] = useState<RedacaoDTO | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [pedindoTema, setPedindoTema] = useState(false);
  const [enviando, setEnviando] = useState(false);
  // escrevendo e ainda não enviou: confirma antes de sair (o rascunho fica salvo neste navegador)
  const escrevendo = !!texto.trim() && !atual;
  useEffect(() => {
    guardarSaida(escrevendo ? "Sair da redação? O rascunho fica salvo neste navegador." : null);
    return () => guardarSaida(null);
  }, [escrevendo, guardarSaida]);
  const [erro, setErro] = useState("");
  const iniciouEm = useRef(Date.now());
  const tema = useMemo(() => temas.find((t) => t.id === temaId), [temas, temaId]);
  const linhas = linhasDe(texto);
  const pendente = atual?.status === "aguardando" || atual?.status === "corrigindo";

  const carregar = useCallback(async () => {
    const [listaTemas, listaRedacoes] = await Promise.all([api.temasRedacao(), api.redacoes()]);
    setTemas(listaTemas);
    setHistorico(listaRedacoes);
    setTemaId((id) => id || listaTemas[0]?.id || "");
    await api.marcarRedacoesVistas();
    await recarregar();
  }, [api, recarregar]);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    carregar().catch((e) => { if (ativo) setErro((e as Error).message); }).finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [carregar]);

  useEffect(() => {
    if (!temaId) return;
    try {
      const d = JSON.parse(localStorage.getItem(chaveRascunho(temaId)) ?? "null") as Rascunho | null;
      setTexto(d?.texto ?? "");
      setTempoSeg(d?.tempoSeg ?? 0);
      iniciouEm.current = Date.now() - (d?.tempoSeg ?? 0) * 1000;
      setAtual(null);
    } catch {
      setTexto("");
      setTempoSeg(0);
      iniciouEm.current = Date.now();
    }
  }, [temaId]);

  useEffect(() => {
    if (!temaId || !texto.trim() || atual) return;
    const id = setInterval(() => setTempoSeg(Math.floor((Date.now() - iniciouEm.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, [temaId, texto, atual]);

  useEffect(() => {
    if (!temaId || atual) return;
    try { localStorage.setItem(chaveRascunho(temaId), JSON.stringify({ texto, tempoSeg } satisfies Rascunho)); } catch { /* o rascunho fica na tela */ }
  }, [temaId, texto, tempoSeg, atual]);

  useEffect(() => {
    if (!atual || !pendente) return;
    const id = setInterval(() => {
      api.redacoes().then((lista) => {
        setHistorico(lista);
        const atualizado = lista.find((r) => r.id === atual.id);
        if (atualizado && atualizado.status !== atual.status) setAtual(atualizado);
      }).catch(() => undefined);
    }, 5000);
    return () => clearInterval(id);
  }, [api, atual, pendente]);

  useEffect(() => {
    if (atual?.status === "corrigida") {
      try { localStorage.removeItem(chaveRascunho(atual.temaId)); } catch { /* ok */ }
      void recarregar();
    }
  }, [atual?.status, atual?.temaId, recarregar]);

  async function pedirTema() {
    setPedindoTema(true);
    setErro("");
    try {
      await api.pedirTemaRedacao();
      if (api.modo === "demo") avisar("No modo demo, use o tema de exemplo.");
      else avisar("Tema pedido. Ele aparece aqui quando ficar pronto.");
      const id = setInterval(() => api.temasRedacao().then((xs) => {
        setTemas(xs);
        if (xs.length) { setTemaId((atual) => atual || xs[0].id); setPedindoTema(false); clearInterval(id); }
      }).catch(() => undefined), 5000);
      setTimeout(() => { clearInterval(id); setPedindoTema(false); }, 10 * 60_000);
    } catch (e) {
      setErro((e as Error).message);
      setPedindoTema(false);
    }
  }

  async function enviar() {
    const temaEnvioId = atual?.temaId ?? tema?.id;
    if (!temaEnvioId || !texto.trim() || linhas > ajustes.linhasRedacaoMax || api.modo === "demo") return;
    setEnviando(true);
    setErro("");
    try {
      const r = await api.corrigirRedacao({ temaId: temaEnvioId, texto, linhas, tempoSeg });
      setAtual(r);
      setHistorico((xs) => [r, ...xs]);
      avisar("Sua redação entrou na fila de correção.");
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  function abrirHistorico(r: RedacaoDTO) {
    setAtual(r);
    setTexto(r.texto);
    setTempoSeg(r.tempoSeg);
  }

  if (carregando) return <div className="carregando">Carregando redação…</div>;
  return (
    <div className="pagina">
      <div className="pagina-cabeca">
        <div><h1>Redação</h1><p>Treine o texto dissertativo-argumentativo e acompanhe sua evolução.</p></div>
        <button className="botao-linha" onClick={() => { setAtual(null); setTexto(""); setTempoSeg(0); }}>Nova redação</button>
      </div>

      {api.modo === "demo" && <p className="msg-aviso">Modo demo: o tema de exemplo e o rascunho funcionam aqui; a correção precisa do servidor.</p>}
      {erro && <p className="msg-erro" role="alert">{erro}</p>}

      {!atual && (
        <section className="secao redacao-editor">
          {temas.length ? (
            <>
              <label className="redacao-seletor" htmlFor="tema-redacao">Tema
                <select id="tema-redacao" value={temaId} onChange={(e) => { setAtual(null); setTemaId(e.target.value); }}>
                  {temas.map((t) => <option value={t.id} key={t.id}>{t.tema}</option>)}
                </select>
              </label>
              {tema && <>
                <h2>{tema.tema}</h2>
                <p>{tema.proposta}</p>
                <div className="redacao-motivadores"><b>Textos motivadores</b>{tema.textosMotivadores.map((t, i) => <blockquote key={i}>{t}</blockquote>)}</div>
                <div className="redacao-controles"><span>Tempo: <b className="num">{tempo(tempoSeg)}</b></span><span>~{linhas} linhas da folha (prova: {LINHAS_REDACAO.minimo} a {Math.min(ajustes.linhasRedacaoMax, LINHAS_REDACAO.maximo)})</span></div>
                <textarea
                  className="redacao-area"
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  maxLength={12000}
                  rows={18}
                  placeholder="Escreva sua redação aqui. O rascunho fica salvo neste navegador."
                  aria-label="Texto da redação"
                  aria-describedby="redacao-ajuda"
                />
                <div className="redacao-controles"><span id="redacao-ajuda" className="sub">{texto.length.toLocaleString("pt-BR")}/12.000 caracteres · rascunho salvo automaticamente</span>
                  <button className="botao-laranja" disabled={enviando || !texto.trim() || linhas > ajustes.linhasRedacaoMax || api.modo === "demo"} onClick={enviar}>
                    {enviando ? "Enviando…" : "Enviar para correção"}
                  </button>
                </div>
                {linhas > ajustes.linhasRedacaoMax && <p className="msg-erro">O limite atual é {ajustes.linhasRedacaoMax} linhas. Confira o edital antes de ajustar em Configurações.</p>}
                {texto.trim() && linhas < LINHAS_REDACAO.minimo && (
                  <p className="sub">Abaixo de {LINHAS_REDACAO.minimo} linhas da folha a redação fica com nota zero, como na banca. Cada linha da folha tem uns {LINHAS_REDACAO.caracteresPorLinha} caracteres.</p>
                )}
              </>}
            </>
          ) : (
            <div className="redacao-vazio"><h2>Nenhum tema pronto</h2><p>Peça um tema; ele aparece aqui quando for preparado.</p>
              <button className="botao-laranja" disabled={pedindoTema} onClick={pedirTema}>{pedindoTema ? "Preparando…" : "Pedir tema"}</button></div>
          )}
        </section>
      )}

      {atual && <>
        <section className="secao">
          <div className="redacao-controles"><h2>{atual.tema}</h2><span className="num">{atual.linhas} linhas · {tempo(atual.tempoSeg)}</span></div>
          <p>{atual.proposta}</p>
          <p className="redacao-texto">{atual.texto}</p>
          {pendente && <p className="msg-aviso">Sua redação está na fila de correção. Esta tela atualiza quando a nota estiver pronta.</p>}
          {atual.status === "erro" && <div><p className="msg-erro">{atual.erro ?? "Não deu para corrigir esta redação."}</p><button className="botao-laranja" onClick={enviar}>Tentar corrigir de novo</button></div>}
        </section>
        <Resultado r={atual} />
      </>}

      {!!historico.length && <section className="secao redacao-historico"><h2>Histórico</h2>
        {historico.map((r) => <button key={r.id} className="redacao-historico-item" onClick={() => abrirHistorico(r)}>
          <span><b>{r.tema}</b><small>{new Date(r.criadoEm).toLocaleDateString("pt-BR")} · {r.linhas} linhas</small></span>
          <strong className="num">{r.correcao ? `${r.correcao.notaTotal}/100` : r.status === "erro" ? "Revisar" : "Na fila"}</strong>
        </button>)}
      </section>}
    </div>
  );
}
