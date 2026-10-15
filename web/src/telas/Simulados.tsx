import { useEffect, useRef, useState } from "react";
import type { Letra, QuestaoDTO, ResultadoSimuladoDTO } from "../../../shared/tipos";
import { NOME_DISCIPLINA } from "../../../shared/tipos";
import { useApp } from "../estado";
import { Alternativas, Cabecalho, Licao } from "../componentes/Questao";
import { IEsq, IDir, ISeta } from "../componentes/Icones";
import { MASCOTE, pct } from "../util";

const TAMANHOS = [
  { n: 10, rotulo: "Relâmpago", tempo: "~30 min" },
  { n: 20, rotulo: "Semanal", tempo: "~1 h" },
  { n: 40, rotulo: "Puxado", tempo: "~2 h" },
  { n: 70, rotulo: "Prova completa", tempo: "~3 h 30" },
];
const fmt = (s: number) => `${Math.floor(s / 3600) ? `${Math.floor(s / 3600)}h ` : ""}${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export function Simulados() {
  const { api, painel, recarregar, avisar } = useApp();
  const [questoes, setQuestoes] = useState<QuestaoDTO[] | null>(null);
  const [respostas, setRespostas] = useState<Record<string, Letra>>({});
  const [atual, setAtual] = useState(0);
  const [resultado, setResultado] = useState<ResultadoSimuladoDTO | null>(null);
  const [seg, setSeg] = useState(0);
  const [confirmarFim, setConfirmarFim] = useState(false);
  const inicio = useRef(0);

  useEffect(() => {
    if (!questoes || resultado) return;
    const t = setInterval(() => setSeg(Math.round((Date.now() - inicio.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, [questoes, resultado]);

  async function comecar(n: number) {
    const qs = await api.simulado(n);
    if (qs.length < n) avisar(`O banco tem ${qs.length} questões disponíveis agora; o simulado ficou com ${qs.length}.`);
    setQuestoes(qs);
    setRespostas({});
    setAtual(0);
    setResultado(null);
    inicio.current = Date.now();
    setSeg(0);
  }

  async function finalizar() {
    if (!questoes) return;
    const porQuestao = Math.round(seg / Math.max(1, questoes.length));
    const r = await api.corrigirSimulado(questoes.map((q) => ({ questaoId: q.id, resposta: respostas[q.id] ?? null, tempoSeg: porQuestao })));
    setResultado(r);
    setConfirmarFim(false);
    avisar(<><b>+{r.xpGanho} XP</b> no simulado</>);
    recarregar();
  }

  // ---------- resultado ----------
  if (resultado && questoes) {
    const nota = resultado.acertos / Math.max(1, resultado.total);
    return (
      <div className="pagina">
        <div className="pagina-cabeca">
          <div>
            <h1>Resultado do simulado</h1>
            <p className="num">{resultado.total} questões em {fmt(seg)} · as erradas já entraram na sua revisão espaçada</p>
          </div>
          <button className="botao-laranja" onClick={() => { setQuestoes(null); setResultado(null); }}>Novo simulado <ISeta /></button>
        </div>
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", marginBottom: 18 }}>
          <div className="secao">
            <div className="placar">
              <b className="num">{pct(nota)}</b>
              <span className="num" style={{ color: "var(--suave)" }}>{resultado.acertos} de {resultado.total} certas</span>
            </div>
            <p style={{ color: "var(--suave)", margin: "10px 0 0" }}>
              {nota >= 0.7 ? "Nota de corte batida. O lobo aprova." : "Abaixo de 70%. Use o caderno de erros antes do próximo."}
            </p>
          </div>
          <div className="secao rolagem">
            <h2>Por disciplina</h2>
            <table className="tabela">
              <thead><tr><th>Disciplina</th><th>Acertos</th><th style={{ width: "35%" }}>%</th></tr></thead>
              <tbody>
                {resultado.porDisciplina.map((d) => (
                  <tr key={d.disciplina}>
                    <td>{NOME_DISCIPLINA[d.disciplina]}</td>
                    <td className="num">{d.acertos}/{d.total}</td>
                    <td><div className="barra"><i style={{ width: pct(d.acertos / d.total) }} /></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <h2 style={{ fontSize: 16, fontWeight: 600 }}>Correção comentada</h2>
        <div style={{ display: "grid", gap: 26 }}>
          {resultado.correcoes.map((c, i) => {
            const q = questoes.find((x) => x.id === c.questaoId)!;
            return (
              <div key={c.questaoId} style={{ borderTop: "1px solid var(--linha)", paddingTop: 18 }}>
                <div className="selos">
                  <span className="selo num">Questão {i + 1}</span>
                  <span className={`selo ${c.acertou ? "" : "alerta"}`}>
                    {c.resposta ? (c.acertou ? "Acertou" : `Marcou ${c.resposta} · gabarito ${c.gabarito}`) : `Em branco · gabarito ${c.gabarito}`}
                  </span>
                </div>
                <Cabecalho q={q} traicoeira={c.traicoeira} />
                <Alternativas q={q} marcada={c.resposta} correcao={c} />
                <Licao c={c} />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ---------- rodando ----------
  if (questoes && questoes.length) {
    const q = questoes[atual];
    const respondidas = Object.keys(respostas).length;
    return (
      <div className="pratica">
        <section className="pratica-principal">
          <div className="selos"><span className="selo num">Questão {atual + 1} de {questoes.length}</span></div>
          <Cabecalho q={q} />
          <Alternativas q={q} marcada={respostas[q.id] ?? null} onMarcar={(l) => setRespostas((r) => ({ ...r, [q.id]: l }))} />
          <div className="acoes">
            <button className="botao-linha" disabled={atual === 0} onClick={() => setAtual((a) => a - 1)}><IEsq /> Anterior</button>
            {atual < questoes.length - 1 ? (
              <button className="botao-laranja" onClick={() => setAtual((a) => a + 1)}>Próxima <IDir /></button>
            ) : (
              <button className="botao-laranja" onClick={() => setConfirmarFim(true)}>Entregar simulado <ISeta /></button>
            )}
          </div>
        </section>
        <aside className="pratica-lateral">
          <div className="mini-stats">
            <div><b className="num">{fmt(seg)}</b><span>tempo</span></div>
            <div><b className="num">{respondidas}/{questoes.length}</b><span>respondidas</span></div>
          </div>
          <div className="grade-nav" aria-label="Ir para a questão">
            {questoes.map((x, i) => (
              <button key={x.id} className={`${respostas[x.id] ? "respondida" : ""} ${i === atual ? "atual" : ""}`} onClick={() => setAtual(i)} aria-label={`Questão ${i + 1}`}>
                {i + 1}
              </button>
            ))}
          </div>
          {confirmarFim ? (
            <div className="secao">
              <p style={{ margin: "0 0 10px" }}>
                {respondidas < questoes.length ? `${questoes.length - respondidas} em branco contam como erro. ` : ""}Entregar agora?
              </p>
              <div className="acoes" style={{ marginTop: 0 }}>
                <button className="botao-laranja" onClick={finalizar}>Entregar</button>
                <button className="botao-linha" onClick={() => setConfirmarFim(false)}>Voltar</button>
              </div>
            </div>
          ) : (
            <button className="botao-linha" onClick={() => setConfirmarFim(true)}>Entregar simulado</button>
          )}
        </aside>
      </div>
    );
  }

  // ---------- escolha ----------
  return (
    <div className="pagina">
      <div className="pagina-cabeca">
        <div>
          <h1>Simulados</h1>
          <p>As questões são sorteadas no peso de cada disciplina no edital. Sem correção até entregar, como na prova.</p>
        </div>
      </div>
      <div className="opcoes-tamanho" style={{ marginBottom: 22 }}>
        {TAMANHOS.map((t) => (
          <button key={t.n} className="opcao" onClick={() => comecar(t.n)}>
            <b className="num">{t.n}</b>
            <strong>{t.rotulo}</strong>
            <span>{t.tempo}</span>
          </button>
        ))}
      </div>
      <div className="secao rolagem">
        <h2>Histórico</h2>
        {painel?.simulados.length ? (
          <table className="tabela">
            <thead><tr><th>Data</th><th>Questões</th><th>Acertos</th><th style={{ width: "35%" }}>Nota</th></tr></thead>
            <tbody>
              {painel.simulados.map((s) => (
                <tr key={s.id}>
                  <td className="num">{new Date(s.data).toLocaleDateString("pt-BR")}</td>
                  <td className="num">{s.total}</td>
                  <td className="num">{s.acertos}</td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div className="barra" style={{ flex: 1 }}><i style={{ width: pct(s.acertos / s.total) }} /></div>
                      <span className="num">{pct(s.acertos / s.total)}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <img src={MASCOTE} alt="" style={{ width: 56 }} />
            <p style={{ margin: 0, color: "var(--suave)" }}>Nenhum simulado ainda. Comece pelo Relâmpago para sentir o ritmo.</p>
          </div>
        )}
      </div>
    </div>
  );
}
