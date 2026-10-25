import { useEffect, useState } from "react";
import { NOME_DISCIPLINA, type Letra, type QuestaoDTO, type ResultadoSimuladoDTO } from "../../../shared/tipos";
import { DIAS_PARA_REFAZER, QUESTOES_DIAGNOSTICO, diagnosticoPendente, fortesEFocos } from "../../../shared/diagnostico";
import { useApp } from "../estado";
import { Alternativas, Cabecalho } from "../componentes/Questao";
import { IDir, IEsq, ISeta } from "../componentes/Icones";
import { pct } from "../util";
import { Pose } from "../componentes/Pose";

// Raio-X: 30 questões médias na proporção da prova, sem correção até o fim e sem tempo
export function Diagnostico() {
  const { api, painel, recarregar, ir, avisar, guardarSaida } = useApp();
  const [questoes, setQuestoes] = useState<QuestaoDTO[] | null>(null);
  const [respostas, setRespostas] = useState<Record<string, Letra>>({});
  const [atual, setAtual] = useState(0);
  const [resultado, setResultado] = useState<ResultadoSimuladoDTO | null>(null);
  const [enviando, setEnviando] = useState(false);
  const rodando = !!questoes?.length && !resultado;
  useEffect(() => {
    guardarSaida(rodando ? "Sair do Raio-X? As respostas marcadas até aqui se perdem." : null);
    return () => guardarSaida(null);
  }, [rodando, guardarSaida]);
  useEffect(() => {
    if (rodando) document.title = `Questão ${atual + 1}/${questoes!.length} · Raio-X · Lobo Binho`;
  }, [rodando, atual, questoes]);
  const historico = painel?.diagnosticos ?? [];
  const ultimo = historico[historico.length - 1];

  async function comecar() {
    const qs = await api.simulado(QUESTOES_DIAGNOSTICO, { diagnostico: true });
    if (qs.length < QUESTOES_DIAGNOSTICO) avisar(`O banco tem ${qs.length} questões disponíveis agora; o Raio-X ficou com ${qs.length}.`);
    setQuestoes(qs);
    setRespostas({});
    setAtual(0);
    setResultado(null);
  }

  async function entregar() {
    if (!questoes || enviando) return;
    setEnviando(true);
    try {
      const r = await api.corrigirSimulado(questoes.map((q) => ({ questaoId: q.id, resposta: respostas[q.id] ?? null, tempoSeg: 0 })), { diagnostico: true });
      setResultado(r);
      recarregar();
    } catch (e) {
      avisar(e instanceof Error ? e.message : "Não deu para entregar agora. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  // ---------- resultado ----------
  if (resultado) {
    const { fortes, focos } = fortesEFocos(resultado.porDisciplina);
    const anterior = historico.length >= 2 ? historico[historico.length - 2] : undefined;
    const antes = (d: string) => anterior?.porDisciplina.find((x) => x.disciplina === d);
    return (
      <div className="pagina">
        <div className="pagina-cabeca">
          <div>
            <h1>Seu Raio-X</h1>
            <p className="num">{resultado.acertos} de {resultado.total} certas ({pct(resultado.acertos / Math.max(1, resultado.total))}). O treino já passou a usar este resultado.</p>
          </div>
          <button className="botao-laranja" onClick={() => ir("praticar", focos[0] ? { disciplina: focos[0] } : {})}>Treinar o foco nº 1 <ISeta /></button>
        </div>
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", marginBottom: 18 }}>
          <div className="secao">
            <h2>Seus 3 pontos fortes</h2>
            <ol className="lista-raiox">{fortes.map((d) => <li key={d}>{NOME_DISCIPLINA[d]}</li>)}</ol>
          </div>
          <div className="secao">
            <h2>Seus 3 focos</h2>
            <ol className="lista-raiox">{focos.map((d) => <li key={d}>{NOME_DISCIPLINA[d]}</li>)}</ol>
            <p className="atalho" style={{ margin: "8px 0 0" }}>Foco = onde você mais perde pontos, pesando quantas questões a matéria tem na prova.</p>
          </div>
        </div>
        <div className="secao rolagem">
          <h2>Por disciplina</h2>
          <table className="tabela">
            <thead><tr><th>Disciplina</th><th>Acertos</th><th style={{ width: "35%" }}>%</th>{anterior && <th>Antes</th>}</tr></thead>
            <tbody>
              {resultado.porDisciplina.map((d) => {
                const a = antes(d.disciplina);
                return (
                  <tr key={d.disciplina}>
                    <td>{NOME_DISCIPLINA[d.disciplina]}</td>
                    <td className="num">{d.acertos}/{d.total}</td>
                    <td><div className="barra"><i style={{ width: pct(d.acertos / d.total) }} /></div></td>
                    {anterior && <td className="num">{a ? pct(a.acertos / a.total) : "—"}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="atalho" style={{ margin: "10px 0 0" }}>A correção comentada de cada questão está no Caderno de erros e nas revisões.</p>
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
          <div className="selos"><span className="selo num">Raio-X · questão {atual + 1} de {questoes.length}</span></div>
          <Cabecalho q={q} />
          <Alternativas q={q} marcada={respostas[q.id] ?? null} onMarcar={(l) => setRespostas((r) => ({ ...r, [q.id]: l }))} />
          <div className="acoes">
            <button className="botao-linha" disabled={atual === 0} onClick={() => setAtual((a) => a - 1)}><IEsq /> Anterior</button>
            {atual < questoes.length - 1 ? (
              <button className="botao-laranja" onClick={() => setAtual((a) => a + 1)}>Próxima <IDir /></button>
            ) : (
              <button className="botao-laranja" disabled={enviando} onClick={entregar}>{enviando ? "Corrigindo…" : "Ver meu Raio-X"} <ISeta /></button>
            )}
          </div>
        </section>
        <aside className="pratica-lateral">
          <div className="mini-stats">
            <div><b className="num">{respondidas}/{questoes.length}</b><span>respondidas</span></div>
            <div><b className="num">sem</b><span>tempo</span></div>
          </div>
          <div className="grade-nav" aria-label="Ir para a questão">
            {questoes.map((x, i) => (
              <button key={x.id} className={`${respostas[x.id] ? "respondida" : ""} ${i === atual ? "atual" : ""}`} onClick={() => setAtual(i)} aria-label={`Questão ${i + 1}`}>{i + 1}</button>
            ))}
          </div>
          <p className="atalho">Não sabe? Deixe em branco: chute atrapalha o Raio-X.</p>
        </aside>
      </div>
    );
  }

  // ---------- convite ----------
  const pendente = diagnosticoPendente(ultimo?.data);
  return (
    <div className="pagina">
      <section className="plano-hoje-cartao raiox-convite" aria-labelledby="titulo-raiox">
        <h2><span aria-hidden="true">◎</span> Raio-X</h2>
        <div className="cartao-interno">
          <h3 id="titulo-raiox">Descubra seu ponto de partida</h3>
          <p>
            {QUESTOES_DIAGNOSTICO} questões de dificuldade média, na proporção da prova. Sem correção até o fim e sem relógio.
            No final: seus 3 pontos fortes, seus 3 focos e o nível de cada disciplina, que o treino passa a usar.
          </p>
          {ultimo && (
            <p className="num">Último Raio-X: {new Date(ultimo.data).toLocaleDateString("pt-BR")} · {ultimo.acertos}/{ultimo.total} certas.{!pendente && ` Dá para refazer a cada ${DIAS_PARA_REFAZER} dias e ver a evolução.`}</p>
          )}
          <div className="acoes">
            <button className="botao-laranja" onClick={comecar}>{ultimo ? "Refazer o Raio-X" : "Começar o Raio-X"} <ISeta /></button>
            <button className="botao-linha" onClick={() => ir("painel")}>Agora não</button>
          </div>
        </div>
        <Pose nome="confiante" largura={150} carregar="eager" alt="" />
      </section>
      {historico.length > 1 && (
        <div className="secao rolagem" style={{ marginTop: 18, maxWidth: 680 }}>
          <h2>Evolução</h2>
          <table className="tabela">
            <thead><tr><th>Data</th><th>Acertos</th><th style={{ width: "40%" }}>%</th></tr></thead>
            <tbody>
              {[...historico].reverse().map((d) => (
                <tr key={d.id}>
                  <td className="num">{new Date(d.data).toLocaleDateString("pt-BR")}</td>
                  <td className="num">{d.acertos}/{d.total}</td>
                  <td><div className="barra"><i style={{ width: pct(d.acertos / Math.max(1, d.total)) }} /></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
