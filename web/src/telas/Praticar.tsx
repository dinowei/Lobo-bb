import { useCallback, useEffect, useRef, useState } from "react";
import type { Confianca, CorrecaoDTO, Letra, MotivoContestacao, QuestaoDTO } from "../../../shared/tipos";
import { LETRAS, NOME_DISCIPLINA } from "../../../shared/tipos";
import { useApp } from "../estado";
import { Alternativas, Cabecalho, Licao } from "../componentes/Questao";
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
  const inicio = useRef(Date.now());
  const filtroUsado = useRef(filtro);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setMarcada(null);
    setConfianca(null);
    setCorrecao(null);
    setContestando(false);
    // "questaoId" (refazer um erro) vale só para a primeira questão
    const f = filtroUsado.current;
    const r = await api.proxima(f);
    if (f.questaoId) filtroUsado.current = { ...f, questaoId: undefined };
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
        if (correcao) carregar();
        else confirmar();
      }
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [correcao, confirmar, carregar]);

  const topico = q && painel?.topicos.find((t) => t.id === q.topicoId);
  const tituloFoco = filtro.revisao
    ? "Revisão espaçada"
    : filtro.topicoId
      ? painel?.topicos.find((t) => t.id === filtro.topicoId)?.assunto ?? "Tópico"
      : filtro.disciplina
        ? NOME_DISCIPLINA[filtro.disciplina]
        : "Treino inteligente";

  return (
    <div className="pratica">
      <section className="pratica-principal" aria-live="polite">
        {carregando ? (
          <div className="carregando">Buscando a próxima questão…</div>
        ) : !q ? (
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
        ) : (
          <>
            {modo === "revisao" && <div className="selos"><span className="selo">Revisão espaçada: essa questão voltou para fixar</span></div>}
            <Cabecalho q={q} traicoeira={correcao?.traicoeira} />

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
                <Licao c={correcao} />
                <div className="acoes">
                  <button className="botao-laranja" onClick={carregar} autoFocus>Próxima questão <ISeta /></button>
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
          </>
        )}
      </section>

      <aside className="pratica-lateral">
        <div>
          <div className="atalho" style={{ fontSize: 12, color: "var(--suave)" }}>Foco da sessão</div>
          <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em" }}>{tituloFoco}</div>
          {(filtro.topicoId || filtro.disciplina || filtro.revisao) && (
            <button className="link" onClick={() => ir("praticar")}>Trocar para treino inteligente</button>
          )}
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
