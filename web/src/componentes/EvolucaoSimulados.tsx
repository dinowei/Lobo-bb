// Evolução dos simulados (F4): gráfico de linha da nota ao longo do tempo (total + uma linha por matéria,
// liga/desliga), filtro por concurso, banca e tipo (completo x parcial não se misturam sem aviso), tabela
// clicável com o detalhe, comparação com o anterior e CSV. Regras em shared/simulados.ts.
import { Fragment, useEffect, useMemo, useState } from "react";
import type { Disciplina, ResumoSimulado } from "../../../shared/tipos";
import { NOME_DISCIPLINA } from "../../../shared/tipos";
import { SUBTOPICO_POR_ID } from "../../../shared/subtopicos";
import { csvSimulados, evolucao } from "../../../shared/simulados";
import { useApp } from "../estado";
import { COR_DISC, CURTO } from "../util";

const L = 640, A = 220, M = { e: 36, d: 12, t: 12, b: 26 };

export function EvolucaoSimulados() {
  const { api } = useApp();
  const [sims, setSims] = useState<ResumoSimulado[] | null>(null);
  const [concurso, setConcurso] = useState("");
  const [banca, setBanca] = useState("");
  const [tipo, setTipo] = useState<"todos" | "completo" | "parcial">("todos");
  const [ligadas, setLigadas] = useState<Set<Disciplina>>(new Set());
  const [hover, setHover] = useState<number | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  useEffect(() => { api.simulados().then(setSims).catch(() => setSims([])); }, [api]);

  const filtrados = useMemo(() => (sims ?? []).filter((s) => tipo === "todos" || (tipo === "completo") === s.completo), [sims, tipo]);
  const pontos = useMemo(() => evolucao(filtrados, { concurso: (concurso || undefined) as never, banca: (banca || undefined) as never }), [filtrados, concurso, banca]);
  const porId = new Map((sims ?? []).map((s) => [s.id, s]));
  if (!sims) return <p className="atalho">Carregando a evolução…</p>;
  if (!pontos.length) return <p className="atalho">A evolução aparece depois do primeiro simulado (o Raio-X não entra).</p>;

  const discs = [...new Set(pontos.flatMap((p) => Object.keys(p.porDisciplina)))] as Disciplina[];
  const misturado = tipo === "todos" && pontos.some((p) => p.completo) && pontos.some((p) => !p.completo);
  const x = (i: number) => M.e + (pontos.length === 1 ? (L - M.e - M.d) / 2 : (i * (L - M.e - M.d)) / (pontos.length - 1));
  const y = (v: number) => M.t + (1 - v / 100) * (A - M.t - M.b);
  const caminho = (vals: (number | undefined)[]) =>
    vals.map((v, i) => (v === undefined ? "" : `${i && vals[i - 1] !== undefined ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`)).join(" ");
  const alternar = (d: Disciplina) => setLigadas((s) => { const n = new Set(s); if (n.has(d)) n.delete(d); else n.add(d); return n; });
  const baixar = () => {
    const url = URL.createObjectURL(new Blob(["﻿" + csvSimulados(sims, discs)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `simulados-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const h = hover !== null ? pontos[hover] : null;
  const concursos = [...new Set(sims.map((s) => s.concurso))];
  const bancas = [...new Set(sims.map((s) => s.banca))];

  return (
    <div className="evolucao" data-testid="evolucao">
      <div className="filtros-linha">
        {concursos.length > 1 && (
          <select aria-label="Concurso" value={concurso} onChange={(e) => setConcurso(e.target.value)}>
            <option value="">Todos os concursos</option>
            {concursos.map((c) => <option key={c} value={c}>{c.toUpperCase()}</option>)}
          </select>
        )}
        {bancas.length > 1 && (
          <select aria-label="Banca" value={banca} onChange={(e) => setBanca(e.target.value)}>
            <option value="">Todas as bancas</option>
            {bancas.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        )}
        <select aria-label="Tipo de simulado" value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)}>
          <option value="todos">Completos e parciais</option>
          <option value="completo">Só completos</option>
          <option value="parcial">Só parciais</option>
        </select>
        <button className="botao-linha" onClick={baixar}>Exportar CSV</button>
      </div>
      {misturado && <p className="atalho">Atenção: completos (●) e parciais (○) na mesma linha. Para comparar de igual para igual, filtre um tipo.</p>}

      <div className="legenda-evolucao" role="group" aria-label="Linhas do gráfico">
        <span className="item-legenda fixo"><i style={{ background: "var(--texto)" }} />Total</span>
        {discs.map((d) => (
          <button key={d} className="item-legenda" aria-pressed={ligadas.has(d)} onClick={() => alternar(d)}>
            <i style={{ background: ligadas.has(d) ? COR_DISC[d] : "transparent", borderColor: COR_DISC[d] }} />{CURTO[d] ?? NOME_DISCIPLINA[d]}
          </button>
        ))}
      </div>

      <div className="grafico-evolucao">
        <svg viewBox={`0 0 ${L} ${A}`} role="img" aria-label={`Acerto nos simulados: ${pontos.map((p) => `${new Date(p.data).toLocaleDateString("pt-BR")} ${p.pct}%`).join(", ")}`} onMouseLeave={() => setHover(null)}>
          {[0, 50, 70, 100].map((v) => (
            <g key={v}>
              <line x1={M.e} x2={L - M.d} y1={y(v)} y2={y(v)} className={v === 70 ? "grade corte" : "grade"} />
              <text x={M.e - 6} y={y(v) + 4} textAnchor="end" className="eixo">{v}%</text>
            </g>
          ))}
          {pontos.map((p, i) => (i === 0 || i === pontos.length - 1 || pontos.length <= 6) && (
            <text key={p.id} x={x(i)} y={A - 6} textAnchor="middle" className="eixo">{new Date(p.data).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</text>
          ))}
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={M.t} y2={A - M.b} className="mira" />}
          {[...ligadas].filter((d) => discs.includes(d)).map((d) => (
            <path key={d} d={caminho(pontos.map((p) => p.porDisciplina[d]))} fill="none" stroke={COR_DISC[d]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          ))}
          <path d={caminho(pontos.map((p) => p.pct))} fill="none" stroke="var(--texto)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          {pontos.map((p, i) => (
            <circle key={p.id} cx={x(i)} cy={y(p.pct)} r={4.5} className={p.completo ? "ponto completo" : "ponto parcial"} />
          ))}
          {pontos.map((p, i) => (
            <rect key={`h-${p.id}`} x={x(i) - (L - M.e - M.d) / Math.max(2, pontos.length * 2)} y={0} width={(L - M.e - M.d) / Math.max(1, pontos.length)} height={A} fill="transparent"
              onMouseEnter={() => setHover(i)} onClick={() => setAberto(p.id)} />
          ))}
        </svg>
        {h && (
          <div className="dica-grafico" style={{ left: `${(x(hover!) / L) * 100}%` }} role="status">
            <b>{new Date(h.data).toLocaleDateString("pt-BR")} · {h.completo ? "completo" : "parcial"}</b>
            <span>Total {h.pct}% · nota {Math.round(h.nota * 100)}% do máximo</span>
            {[...ligadas].filter((d) => h.porDisciplina[d] !== undefined).map((d) => <span key={d}>{CURTO[d] ?? NOME_DISCIPLINA[d]}: {h.porDisciplina[d]}%</span>)}
          </div>
        )}
      </div>

      <div className="tabela-rolavel">
        <table className="tabela">
          <thead>
            <tr><th>Data</th><th>Tipo</th><th>Questões</th><th>%</th><th>Nota</th>{discs.map((d) => <th key={d}>{CURTO[d] ?? NOME_DISCIPLINA[d]}</th>)}</tr>
          </thead>
          <tbody>
            {[...pontos].reverse().map((p) => {
              const s = porId.get(p.id)!;
              return (
                <Fragment key={p.id}>
                  <tr className="linha-clicavel" onClick={() => setAberto(aberto === p.id ? null : p.id)} aria-expanded={aberto === p.id}>
                    <td className="num">{new Date(p.data).toLocaleDateString("pt-BR")}</td>
                    <td>{p.completo ? "completo" : "parcial"}</td>
                    <td className="num">{s.total}</td>
                    <td className="num">{p.pct}%</td>
                    <td className="num">{s.nota.valor.toLocaleString("pt-BR")} / {s.nota.maximo.toLocaleString("pt-BR")}{s.nota.criterio === "liquida" ? " (líquida)" : ""}</td>
                    {discs.map((d) => (
                      <td key={d} className="num">
                        {p.porDisciplina[d] !== undefined ? `${p.porDisciplina[d]}%` : "–"}
                        {p.delta[d] ? <small className={p.delta[d]! > 0 ? "sobe" : "desce"}> {p.delta[d]! > 0 ? "+" : ""}{p.delta[d]}</small> : null}
                      </td>
                    ))}
                  </tr>
                  {aberto === p.id && (
                    <tr className="detalhe-simulado">
                      <td colSpan={5 + discs.length}>
                        <p>
                          {p.melhor && <>Melhor: <b>{NOME_DISCIPLINA[p.melhor]}</b>. </>}
                          {p.pior && <>Pior: <b>{NOME_DISCIPLINA[p.pior]}</b>. </>}
                          {s.brancos ? `${s.brancos} em branco. ` : ""}Tempo: {Math.round(s.tempoSeg / 60)} min.
                        </p>
                        {!!s.porSubtopico.length && (
                          <p className="atalho">
                            Por tema: {s.porSubtopico.sort((a, b) => b.total - a.total).map((t) => `${SUBTOPICO_POR_ID.get(t.subtopico)?.nome ?? t.subtopico} ${t.acertos}/${t.total}`).join(" · ")}
                          </p>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
