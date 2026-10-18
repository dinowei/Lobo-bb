import { useCallback, useEffect, useRef, useState } from "react";
import type { AcaoMotivoDTO, AulaDTO, Confianca, CorrecaoDTO, Disciplina, Letra, MotivoContestacao, MotivoErro, QuestaoDTO } from "../../../shared/tipos";
import { LETRAS, MOTIVOS_ERRO, NOME_DISCIPLINA, NOME_MOTIVO } from "../../../shared/tipos";
import { useApp } from "../estado";
import { Alternativas, Cabecalho, Licao } from "../componentes/Questao";
import { Markdown } from "../componentes/Markdown";
import { ISeta } from "../componentes/Icones";
import { MASCOTE, pct } from "../util";

const CONFIANCAS: { v: Confianca; rotulo: string }[] = [
  { v: 1, rotulo: "Chutei" },
  { v: 2, rotulo: "Na dúvida" },
  { v: 3, rotulo: "Tenho certeza" },
];

export function Praticar() {
  const { api, filtro, ir, recarregar, painel, avisar } = useApp();
  const [q, setQ] = useState<QuestaoDTO | null>(null);
  const [modo, setModo] = useState<"treino" | "revisao">("treino");
  const [aviso, setAviso] = useState<string>();
  const [carregando, setCarregando] = useState(true);
  const [marcada, setMarcada] = useState<Letra | null>(null);
  const [confianca, setConfianca] = useState<Confianca | null>(null);
  const [correcao, setCorrecao] = useState<CorrecaoDTO | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [sessao, setSessao] = useState({ total: 0, acertos: 0, xp: 0 });
  const [contestando, setContestando] = useState(false);
  const [acaoMotivo, setAcaoMotivo] = useState<AcaoMotivoDTO | null>(null);
  const [restante, setRestante] = useState<number | null>(null); // revisão com tempo (desatenção)
  const [aba, setAba] = useState<"aula" | "questoes">("questoes");
  const [aula, setAula] = useState<AulaDTO | null>(null);
  const [carregandoAula, setCarregandoAula] = useState(false);
  const [duvidaTutor, setDuvidaTutor] = useState("");
  const [respostaTutor, setRespostaTutor] = useState("");
  const [origemTutor, setOrigemTutor] = useState("");
  const [restantesTutor, setRestantesTutor] = useState<number | undefined>();
  const [consultandoTutor, setConsultandoTutor] = useState(false);
  const inicio = useRef(Date.now());
  const filtroUsado = useRef(filtro);
  const ultimaDisciplina = useRef<Disciplina | undefined>(undefined); // treino misturado não repete a anterior

  const carregar = useCallback(async () => {
    setCarregando(true);
    setMarcada(null);
    setConfianca(null);
    setCorrecao(null);
    setContestando(false);
    setAcaoMotivo(null);
    // "questaoId" (refazer um erro) vale só para a primeira questão
    const f = filtroUsado.current;
    const r = await api.proxima(f.misto ? { ...f, anterior: ultimaDisciplina.current } : f);
    if (f.questaoId) filtroUsado.current = { ...f, questaoId: undefined };
    ultimaDisciplina.current = r.questao?.disciplina;
    setQ(r.questao);
    setModo(r.modo);
    setAviso(r.aviso);
    setCarregando(false);
    inicio.current = Date.now();
  }, [api]);

  useEffect(() => {
    filtroUsado.current = filtro;
    setSessao({ total: 0, acertos: 0, xp: 0 });
    carregar();
  }, [filtro, carregar]);

  const topicoIdAula = q?.topicoId ?? filtro.topicoId;
  useEffect(() => {
    if (!topicoIdAula) {
      setAula(null);
      return;
    }
    let ativo = true;
    const chaveVista = `lobo-aula-vista:${topicoIdAula}`;
    let vista = false;
    try { vista = localStorage.getItem(chaveVista) === "1"; } catch { /* armazenamento opcional */ }
    setAba(vista ? "questoes" : "aula");
    setCarregandoAula(true);
    api.aula(topicoIdAula)
      .then((r) => { if (ativo) setAula(r); })
      .catch(() => { if (ativo) setAula(null); })
      .finally(() => { if (ativo) setCarregandoAula(false); });
    return () => { ativo = false; };
  }, [api, topicoIdAula]);

  useEffect(() => {
    setDuvidaTutor("");
    setRespostaTutor("");
    setOrigemTutor("");
    setRestantesTutor(undefined);
  }, [q?.id]);

  function abrirQuestoes() {
    if (q?.topicoId) {
      try { localStorage.setItem(`lobo-aula-vista:${q.topicoId}`, "1"); } catch { /* armazenamento opcional */ }
    }
    setAba("questoes");
  }

  async function pedirOutraExplicacao() {
    if (!q || consultandoTutor) return;
    setConsultandoTutor(true);
    setRespostaTutor("");
    setOrigemTutor("");
    try {
      const r = await api.explicarMais(q.id, duvidaTutor.trim() || undefined);
      setRespostaTutor(r.explicacao ?? r.mensagem ?? "Não consegui buscar uma explicação agora.");
      setOrigemTutor(!r.origem ? "" : r.origem === "pregerada" ? "Explicação preparada para esta questão." : r.origem === "cache" ? "Resposta salva da mesma dúvida." : "Nova resposta conferida.");
      setRestantesTutor(r.restantesHoje);
    } catch (e) {
      setRespostaTutor(e instanceof Error ? e.message : "Não deu para buscar outra explicação agora.");
    } finally {
      setConsultandoTutor(false);
    }
  }

  // contagem do tempo-alvo; não entrega sozinha, só avisa quando estoura
  useEffect(() => {
    if (!q?.tempoAlvoSeg || correcao) return setRestante(null);
    const alvo = q.tempoAlvoSeg;
    const tique = () => setRestante(alvo - Math.round((Date.now() - inicio.current) / 1000));
    tique();
    const t = setInterval(tique, 1000);
    return () => clearInterval(t);
  }, [q, correcao]);

  // confundi: a próxima é a questão que compara os dois conceitos
  const proxima = useCallback(() => {
    if (acaoMotivo?.proximaQuestaoId) filtroUsado.current = { ...filtroUsado.current, questaoId: acaoMotivo.proximaQuestaoId };
    carregar();
  }, [acaoMotivo, carregar]);

  async function informarMotivo(m: MotivoErro) {
    if (!q) return;
    try {
      setAcaoMotivo(await api.motivoErro(q.id, m));
      recarregar();
    } catch (e) {
      avisar(e instanceof Error ? e.message : "Não deu para salvar o motivo.");
    }
  }

  const confirmar = useCallback(async () => {
    if (!q || !marcada || !confianca || enviando || correcao) return;
    setEnviando(true);
    try {
      const c = await api.responder({
        questaoId: q.id,
        resposta: marcada,
        confianca,
        tempoSeg: Math.round((Date.now() - inicio.current) / 1000),
        modo,
      });
      setCorrecao(c);
      setSessao((s) => ({ total: s.total + 1, acertos: s.acertos + (c.acertou ? 1 : 0), xp: s.xp + c.xpGanho }));
      avisar(<><b>+{c.xpGanho} XP</b> {c.acertou ? "acertou" : "por tentar"}</>);
      recarregar();
    } finally {
      setEnviando(false);
    }
  }, [q, marcada, confianca, enviando, correcao, api, modo, avisar, recarregar]);

  // atalhos: A–E marca, 1–3 confiança, Enter confirma/avança
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(alvo.tagName) || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toUpperCase();
      if (!correcao && (LETRAS as readonly string[]).includes(k)) setMarcada(k as Letra);
      else if (!correcao && ["1", "2", "3"].includes(k)) setConfianca(Number(k) as Confianca);
      else if (e.key === "Enter") {
        if (alvo.tagName === "BUTTON") return; // botão focado já trata o Enter
        e.preventDefault();
        if (correcao) proxima();
        else confirmar();
      }
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [correcao, confirmar, proxima]);

  const topico = q && painel?.topicos.find((t) => t.id === q.topicoId);
  const tituloFoco = filtro.revisao
    ? "Revisão espaçada"
    : filtro.topicoId
      ? painel?.topicos.find((t) => t.id === filtro.topicoId)?.assunto ?? "Tópico"
      : filtro.disciplina
        ? NOME_DISCIPLINA[filtro.disciplina]
        : filtro.misto
          ? "Treino misturado"
          : "Treino inteligente";

  return (
    <div className="pratica">
      <section className="pratica-principal" aria-live="polite">
        {carregando ? (
          <div className="carregando">Buscando a próxima questão…</div>
        ) : !q ? (
          <>
            <div className="vazio">
              <img src={MASCOTE} alt="" />
              <div>
                <strong>{filtro.revisao ? "Revisões em dia" : "Sem questões aqui por enquanto"}</strong>
                <p>{aviso ?? "Tente outro tópico."}</p>
                <div className="acoes">
                  <button className="botao-laranja" onClick={() => ir("praticar")}>Treino inteligente <ISeta /></button>
                  <button className="botao-linha" onClick={() => ir("painel")}>Voltar ao painel</button>
                </div>
              </div>
            </div>
            {filtro.topicoId && (
              <>
                <div className="pratica-abas" role="tablist" aria-label="Conteúdo do tópico">
                  <button role="tab" aria-selected={aba === "aula"} className={aba === "aula" ? "ativa" : ""} onClick={() => setAba("aula")}>Aula</button>
                  <button role="tab" aria-selected={aba === "questoes"} className={aba === "questoes" ? "ativa" : ""} onClick={() => setAba("questoes")}>Questões</button>
                </div>
                {aba === "aula" && (
                  <article className="aula-topico" role="tabpanel" aria-label={`Aula: ${aula?.assunto ?? "tópico"}`}>
                    {carregandoAula ? <p>Carregando a aula…</p> : aula ? <><h2>{aula.assunto}</h2><Markdown texto={aula.conteudo} /></> : <p>A aula ainda não foi aprovada. Você pode voltar quando o material entrar na fila de preparação.</p>}
                  </article>
                )}
              </>
            )}
          </>
        ) : (
          <>
            {modo === "revisao" && (
              <div className="selos">
                <span className="selo">Revisão espaçada: essa questão voltou para fixar</span>
                {restante !== null && (
                  <span className={`selo num ${restante < 0 ? "alerta" : ""}`}>
                    {restante >= 0 ? `Treino com tempo: ${Math.floor(restante / 60)}:${String(restante % 60).padStart(2, "0")}` : "Tempo-alvo estourado: leia com calma, mas sem enrolar"}
                  </span>
                )}
              </div>
            )}
            <Cabecalho q={q} traicoeira={correcao?.traicoeira} />

            <div className="pratica-abas" role="tablist" aria-label="Conteúdo do tópico">
              <button role="tab" aria-selected={aba === "aula"} className={aba === "aula" ? "ativa" : ""} onClick={() => setAba("aula")}>Aula</button>
              <button role="tab" aria-selected={aba === "questoes"} className={aba === "questoes" ? "ativa" : ""} onClick={abrirQuestoes}>Questões</button>
            </div>

            {aba === "aula" ? (
              <article className="aula-topico" role="tabpanel" aria-label={`Aula: ${aula?.assunto ?? q.assunto}`}>
                {carregandoAula ? <p>Carregando a aula…</p> : aula ? (
                  <>
                    <h2>{aula.assunto}</h2>
                    <Markdown texto={aula.conteudo} />
                    <section><h3>Pontos-chave</h3><ul>{aula.pontosChave.map((p) => <li key={p}>{p}</li>)}</ul></section>
                    <section><h3>Como a banca cobra</h3><p>{aula.comoABancaCobra}</p></section>
                    <section><h3>Pegadinhas comuns</h3><ul>{aula.pegadinhasComuns.map((p) => <li key={p}>{p}</li>)}</ul></section>
                    <section><h3>Exemplo</h3><ul>{aula.exemplos.map((p) => <li key={p}>{p}</li>)}</ul></section>
                    {!!aula.fontes.length && <details><summary>Fontes usadas</summary><ul>{aula.fontes.map((f, i) => <li key={`${f.titulo}-${i}`}><b>{f.titulo}:</b> {f.trecho}</li>)}</ul></details>}
                    <button className="botao-laranja" onClick={abrirQuestoes}>Já sei, ir para as questões <ISeta /></button>
                  </>
                ) : (
                  <>
                    <h2>Aula deste tópico</h2>
                    <p>A aula ainda não foi aprovada. Você pode praticar enquanto ela entra na fila de preparação.</p>
                    <button className="botao-laranja" onClick={abrirQuestoes}>Ir para as questões <ISeta /></button>
                  </>
                )}
              </article>
            ) : <>

            {correcao && (
              <div className={`resultado-faixa ${correcao.acertou ? "ok" : "nok"}`}>
                {correcao.acertou ? "Acertou!" : `Não foi dessa vez. Gabarito: ${correcao.gabarito}`}
                <small className="num">
                  +{correcao.xpGanho} XP · volta em {correcao.proximaRevisaoDias} {correcao.proximaRevisaoDias === 1 ? "dia" : "dias"}
                </small>
              </div>
            )}

            <Alternativas q={q} marcada={marcada} onMarcar={setMarcada} correcao={correcao} />

            {!correcao ? (
              <>
                <div className="confianca" role="group" aria-label="Quão confiante você está?">
                  <span>Sua confiança:</span>
                  {CONFIANCAS.map((c) => (
                    <button key={c.v} className="chip" aria-pressed={confianca === c.v} onClick={() => setConfianca(c.v)}>
                      {c.rotulo}
                    </button>
                  ))}
                </div>
                <div className="acoes">
                  <button className="botao-laranja" disabled={!marcada || !confianca || enviando} onClick={confirmar}>
                    Confirmar resposta <ISeta />
                  </button>
                  <button className="botao-linha" onClick={carregar}>Pular</button>
                  <span className="atalho">Atalhos: A–E marca · 1–3 confiança · Enter confirma</span>
                </div>
              </>
            ) : (
              <>
                {!correcao.acertou && (
                  <div className="motivo-erro">
                    {!acaoMotivo ? (
                      <div className="confianca" role="group" aria-label="Por que você errou?">
                        <span>Por que errou? (opcional)</span>
                        {MOTIVOS_ERRO.map((m) => (
                          <button key={m} className="chip" onClick={() => informarMotivo(m)}>{NOME_MOTIVO[m]}</button>
                        ))}
                      </div>
                    ) : (
                      <div className="secao" style={{ padding: 14 }}>
                        <p style={{ margin: 0 }}>{acaoMotivo.mensagem}</p>
                        {!!acaoMotivo.palavrasChave?.length && (
                          <div className="selos" style={{ marginTop: 10, marginBottom: 0, alignItems: "center" }}>
                            <span className="atalho">O que decidia:</span>
                            {acaoMotivo.palavrasChave.map((p) => <span key={p} className="selo">{p}</span>)}
                          </div>
                        )}
                        {acaoMotivo.motivo === "nao_sabia" && acaoMotivo.topicoId && filtro.topicoId !== acaoMotivo.topicoId && (
                          <button className="link" style={{ marginTop: 8 }} onClick={() => ir("praticar", { topicoId: acaoMotivo.topicoId })}>
                            Treinar só este tópico agora
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <Licao c={correcao} />
                <div className="tutor-outro-jeito">
                  <label htmlFor="duvida-tutor">Me explica de outro jeito</label>
                  <textarea id="duvida-tutor" rows={2} maxLength={500} value={duvidaTutor} onChange={(e) => setDuvidaTutor(e.target.value)} placeholder="Se quiser, diga qual parte ficou confusa (opcional)." />
                  <button className="botao-linha" onClick={pedirOutraExplicacao} disabled={consultandoTutor}>
                    {consultandoTutor ? "Buscando uma explicação…" : "Me explica de outro jeito"}
                  </button>
                  {origemTutor && <small>{origemTutor}{restantesTutor !== undefined ? ` · ${restantesTutor} pedido(s) novo(s) restante(s) hoje` : ""}</small>}
                  {respostaTutor && <p className="resposta-tutor" aria-live="polite">{respostaTutor}</p>}
                </div>
                <div className="acoes">
                  <button className="botao-laranja" onClick={proxima} autoFocus>
                    {acaoMotivo?.proximaQuestaoId ? "Próxima: comparar os conceitos" : "Próxima questão"} <ISeta />
                  </button>
                  <button className="botao-linha" onClick={() => setContestando((v) => !v)}>Contestar questão</button>
                  <span className="atalho">Enter: próxima</span>
                </div>
                {contestando && (
                  <Contestar
                    onEnviar={async (motivo, comentario) => {
                      await api.contestar(q.id, motivo, comentario);
                      setContestando(false);
                      avisar("Questão contestada e tirada de circulação. Obrigado!");
                    }}
                  />
                )}
              </>
            )}
            {aviso && <p className="atalho" style={{ marginTop: 16, maxWidth: "70ch" }}>{aviso}</p>}
            </>}
          </>
        )}
      </section>

      <aside className="pratica-lateral">
        <div>
          <div className="atalho" style={{ fontSize: 12, color: "var(--suave)" }}>Foco da sessão</div>
          <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em" }}>{tituloFoco}</div>
          {(filtro.topicoId || filtro.disciplina || filtro.revisao || filtro.misto) && (
            <button className="link" onClick={() => ir("praticar")}>Trocar para treino inteligente</button>
          )}
          {!filtro.misto && (
            <button className="link" onClick={() => ir("praticar", { misto: true })} title="Uma disciplina diferente a cada questão, no peso da prova">
              Treino misturado
            </button>
          )}
          {filtro.misto && <div className="atalho" style={{ marginTop: 4 }}>Cada questão de uma disciplina, no peso da prova.</div>}
        </div>
        <div className="mini-stats">
          <div><b className="num">{sessao.acertos}/{sessao.total}</b><span>acertos na sessão</span></div>
          <div><b className="num">+{sessao.xp}</b><span>XP na sessão</span></div>
        </div>
        {topico && (
          <div className="secao" style={{ padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--suave)", marginBottom: 8 }}>
              <span>Domínio do tópico</span>
              <span className="num">{topico.tentativas ? pct(topico.dominio) : "novo"}</span>
            </div>
            <div className="barra"><i style={{ width: pct(topico.dominio) }} /></div>
            <div style={{ fontSize: 12, color: "var(--suave)", marginTop: 8 }}>
              {topico.status === "dominado"
                ? "Dominado. Ele volta só nas revisões."
                : "Domina com 80% de acerto em 8+ questões recentes."}
            </div>
          </div>
        )}
        <div className="dica-lobo">
          <img src={MASCOTE} alt="" />
          <b>Dica do lobo</b>
          <p>
            {correcao?.dicaDeProva ??
              (correcao ? "Leia a explicação de cada alternativa: é ali que mora a pegadinha da próxima." : "Seja sincero na confiança: chute certo vale metade do XP e volta antes para revisão.")}
          </p>
        </div>
      </aside>
    </div>
  );
}

function Contestar({ onEnviar }: { onEnviar: (m: MotivoContestacao, c?: string) => Promise<void> }) {
  const [motivo, setMotivo] = useState<MotivoContestacao>("gabarito_errado");
  const [comentario, setComentario] = useState("");
  return (
    <form
      className="contestar"
      onSubmit={(e) => {
        e.preventDefault();
        onEnviar(motivo, comentario || undefined);
      }}
    >
      <strong>O que está errado?</strong>
      <label htmlFor="motivo">
        Motivo
        <select id="motivo" value={motivo} onChange={(e) => setMotivo(e.target.value as MotivoContestacao)}>
          <option value="gabarito_errado">Gabarito errado</option>
          <option value="duas_corretas">Mais de uma alternativa correta</option>
          <option value="desatualizada">Conteúdo desatualizado</option>
          <option value="ambigua">Enunciado ambíguo</option>
          <option value="explicacao_ruim">Explicação confusa</option>
        </select>
      </label>
      <label htmlFor="comentario">
        Comentário (opcional)
        <textarea id="comentario" rows={2} value={comentario} onChange={(e) => setComentario(e.target.value)} />
      </label>
      <div className="acoes"><button className="botao-laranja" type="submit">Enviar e tirar de circulação</button></div>
    </form>
  );
}
