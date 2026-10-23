import { useEffect, useRef, useState } from "react";
import type { Letra, QuestaoDTO, ResultadoSimuladoDTO } from "../../../shared/tipos";
import { NOME_DISCIPLINA } from "../../../shared/tipos";
import { useApp } from "../estado";
import { Alternativas, Cabecalho, Licao } from "../componentes/Questao";
import { IEsq, IDir, ISeta } from "../componentes/Icones";
import { pct } from "../util";
import { Pose } from "../componentes/Pose";
import { RelogioAtivo } from "../relogio";
import { EvolucaoSimulados } from "../componentes/EvolucaoSimulados";
import { COTAS_PROVA, ESTRUTURA_PROVA, resumoPorBloco, pontuacaoProva, type Mistura } from "../../../shared/estruturaProva";

// prova completa = exatamente as cotas do edital (soma dos blocos)
const N_PROVA = Object.values(COTAS_PROVA).reduce((s, c) => s + (c ?? 0), 0);
const TAMANHOS = [
  { n: 10, rotulo: "Relâmpago", tempo: "~30 min" },
  { n: 20, rotulo: "Semanal", tempo: "~1 h" },
  { n: 40, rotulo: "Puxado", tempo: "~2 h" },
  { n: N_PROVA, rotulo: "Prova completa", tempo: "cotas do edital" },
];
const COMPOSICAO = ESTRUTURA_PROVA.blocos
  .map((b) => `${b.nome}: ${Object.entries(b.cotas).map(([d, c]) => `${c} ${NOME_DISCIPLINA[d as keyof typeof NOME_DISCIPLINA]}`).join(", ")}`)
  .join(" · ");
const fmt = (s: number) => `${Math.floor(s / 3600) ? `${Math.floor(s / 3600)}h ` : ""}${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export function Simulados() {
  const { api, painel, recarregar, avisar, ajustes, guardarSaida } = useApp();
  const [questoes, setQuestoes] = useState<QuestaoDTO[] | null>(null);
  const [respostas, setRespostas] = useState<Record<string, Letra>>({});
  const [atual, setAtual] = useState(0);
  const [resultado, setResultado] = useState<ResultadoSimuladoDTO | null>(null);
  const [seg, setSeg] = useState(0);
  const [limiteSeg, setLimiteSeg] = useState(0); // 0 = sem contagem regressiva
  const [confirmarFim, setConfirmarFim] = useState(false);
  const [mistura, setMistura] = useState<Mistura | null>(null);
  // cronômetro só anda com a aba visível (horas líquidas honestas)
  const relogio = useRef<RelogioAtivo>(null as unknown as RelogioAtivo);
  if (!relogio.current) relogio.current = new RelogioAtivo();
  useEffect(() => () => relogio.current.desligar(), []);
  const entregando = useRef(false);
  const corte = (ajustes.linhaDeCorte || 70) / 100;

  useEffect(() => {
    api.misturaSimulado().then(setMistura).catch(() => setMistura(null));
  }, [api]);

  // no meio do simulado: confirma antes de sair; título da aba com a questão
  const rodando = !!questoes?.length && !resultado;
  useEffect(() => {
    guardarSaida(rodando ? "Sair do simulado? As respostas marcadas até aqui se perdem." : null);
    return () => guardarSaida(null);
  }, [rodando, guardarSaida]);
  useEffect(() => {
    if (rodando) document.title = `Questão ${atual + 1}/${questoes!.length} · Simulado · Lobo Binho`;
  }, [rodando, atual, questoes]);

  useEffect(() => {
    if (!questoes || resultado) return;
    const t = setInterval(() => setSeg(relogio.current.segundos()), 1000);
    return () => clearInterval(t);
  }, [questoes, resultado]);

  // tempo acabou: entrega sozinho, como na prova
  useEffect(() => {
    if (limiteSeg && questoes && !resultado && seg >= limiteSeg) finalizar();
  }, [seg, limiteSeg, questoes, resultado]); // eslint-disable-line react-hooks/exhaustive-deps

  async function comecar(n: number) {
    const qs = await api.simulado(n);
    if (qs.length < n) avisar(`O banco tem ${qs.length} questões disponíveis agora; o simulado ficou com ${qs.length}.`);
    setQuestoes(qs);
    setRespostas({});
    setAtual(0);
    setResultado(null);
    // duração da prova vale para a completa; os menores ganham o tempo proporcional
    setLimiteSeg(ajustes.duracaoProvaMin > 0 ? Math.round((ajustes.duracaoProvaMin * 60 * qs.length) / N_PROVA) : 0);
    entregando.current = false;
    relogio.current.zerar();
    setSeg(0);
  }

  async function finalizar() {
    if (!questoes || entregando.current) return;
    entregando.current = true;
    const usado = limiteSeg ? Math.min(seg, limiteSeg) : seg;
    const porQuestao = Math.round(usado / Math.max(1, questoes.length));
    try {
      const r = await api.corrigirSimulado(questoes.map((q) => ({ questaoId: q.id, resposta: respostas[q.id] ?? null, tempoSeg: porQuestao })));
      setResultado(r);
      setConfirmarFim(false);
      if (limiteSeg && seg >= limiteSeg) avisar("Tempo esgotado. Simulado entregue.");
      avisar(<><b>+{r.xpGanho} XP</b> no simulado</>);
      recarregar();
    } catch (e) {
      entregando.current = false;
      avisar(e instanceof Error ? e.message : "Não deu para entregar agora. Tente de novo.");
    }
  }

  // ---------- resultado ----------
  if (resultado && questoes) {
    const nota = resultado.acertos / Math.max(1, resultado.total);
    const blocos = resumoPorBloco(resultado.porDisciplina);
    const prova = pontuacaoProva(resultado.porDisciplina);
    return (
      <div className="pagina">
        <div className="pagina-cabeca">
          <div>
            <h1>Resultado do simulado</h1>
            <p className="num">{resultado.total} questões em {fmt(seg)} · as erradas já entraram na sua revisão espaçada</p>
          </div>
          <div className="cabeca-acoes">
            <button className="botao-laranja" onClick={() => { setQuestoes(null); setResultado(null); }}>Novo simulado <ISeta /></button>
            {/* bateu o corte: comemora; da metade para cima: confiante; abaixo: aponta para as correções */}
            {nota >= corte ? <Pose nome="comemorando" largura={110} carregar="eager" pular className="cabeca-pose" />
              : <Pose nome={nota >= 0.5 ? "confiante" : "apontando"} largura={90} carregar="eager" className="cabeca-pose" />}
          </div>
        </div>
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", marginBottom: 18 }}>
          <div className="secao">
            <div className="placar">
              <b className="num">{pct(nota)}</b>
              <span className="num" style={{ color: "var(--suave)" }}>{resultado.acertos} de {resultado.total} certas</span>
            </div>
            <p style={{ color: "var(--suave)", margin: "10px 0 0" }}>
              {nota >= corte ? "Linha de corte batida. O lobo aprova." : `Abaixo de ${pct(corte)}. Use o caderno de erros antes do próximo.`}
            </p>
            <p className="num" style={{ color: "var(--suave)", margin: "6px 0 0", fontSize: 13 }}>
              Pontos como a banca conta: {prova.pontos.toLocaleString("pt-BR")} de {prova.maximo.toLocaleString("pt-BR")} ({pct(prova.aproveitamento)}).
            </p>
            {prova.eliminado.length > 0 && (
              <p className="num" style={{ color: "var(--errado)", margin: "6px 0 0", fontSize: 13 }}>
                Na prova, isso eliminaria: {prova.eliminado.join(", ")}.
              </p>
            )}
          </div>
          <div className="secao rolagem">
            <h2>Por bloco</h2>
            <table className="tabela">
              <thead><tr><th>Bloco</th><th>Acertos</th><th style={{ width: "35%" }}>%</th></tr></thead>
              <tbody>
                {blocos.map((b) => (
                  <tr key={b.bloco}>
                    <td>{b.bloco}</td>
                    <td className="num">{b.acertos}/{b.total}</td>
                    <td><div className="barra"><i style={{ width: pct(b.acertos / b.total) }} /></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
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
            {limiteSeg ? (
              <div><b className="num" style={limiteSeg - seg <= 300 ? { color: "var(--laranja)" } : undefined}>{fmt(Math.max(0, limiteSeg - seg))}</b><span>restam</span></div>
            ) : (
              <div><b className="num">{fmt(seg)}</b><span>tempo</span></div>
            )}
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
          <p>As questões saem na proporção de cada disciplina na prova. Sem correção até entregar, como na prova.</p>
        </div>
        <Pose nome="mesa" largura={90} carregar="eager" className="cabeca-pose" />
      </div>
      <p className="num" style={{ color: "var(--suave)", margin: "0 0 6px", fontSize: 13 }}>Prova completa: {COMPOSICAO}</p>
      <p className="num" style={{ color: "var(--suave)", margin: "0 0 16px", fontSize: 13 }}>
        {mistura
          ? `Dificuldade: ${pct(mistura.facil)} fáceis, ${pct(mistura.media)} médias, ${pct(mistura.dificil)} difíceis, como numa prova de verdade.`
          : ""}
        {ajustes.duracaoProvaMin > 0 ? ` Tempo: ${ajustes.duracaoProvaMin} min na completa, proporcional nos menores; acabou, entrega.` : " Sem tempo limite (defina a duração em Ajustes)."}
      </p>
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
            <p style={{ margin: 0, color: "var(--suave)" }}>Nenhum simulado ainda. Comece pelo Relâmpago para sentir o ritmo.</p>
          </div>
        )}
      </div>
      {!!painel?.simulados.length && (
        <div className="secao" style={{ marginTop: 16 }}>
          <h2>Evolução</h2>
          <EvolucaoSimulados />
        </div>
      )}
    </div>
  );
}
