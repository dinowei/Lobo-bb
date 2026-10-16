// Figura da questão: DADO desenhado por código (nunca imagem gerada por IA).
// Tabela → HTML · planilha → grade com fórmulas avaliadas por código · gráfico → SVG ·
// tela de programa → janela simplificada · imagem → só a original extraída do PDF da prova.
import { useMemo } from "react";
import type { FiguraDTO, GraficoDados, PlanilhaDados, TabelaDados, TelaProgramaDados } from "../../../shared/tipos";
import { Planilha, colunaLetra, textoDaCelula } from "../../../shared/planilha";

export function Figura({ f }: { f: FiguraDTO }) {
  return (
    <figure className="figura">
      {f.tipo === "tabela" && f.tabela && <FigTabela t={f.tabela} legenda={f.legenda} />}
      {f.tipo === "planilha" && f.planilha && <FigPlanilha p={f.planilha} legenda={f.legenda} />}
      {f.tipo === "grafico" && f.grafico && <FigGrafico g={f.grafico} />}
      {f.tipo === "tela_programa" && f.tela && <FigTela t={f.tela} />}
      {!temDados(f) && f.imagem && <img className="fig-imagem" src={f.imagem} alt={f.legenda ?? "Figura da questão"} />}
      {f.legenda && <figcaption>{f.legenda}</figcaption>}
    </figure>
  );
}

const temDados = (f: FiguraDTO) => !!(f.tabela || f.planilha || f.grafico || f.tela);

export function FigTabela({ t, legenda }: { t: TabelaDados; legenda?: string }) {
  return (
    <div className="fig-rolagem">
      <table className="fig-tabela">
        {legenda && <caption className="sr-only">{legenda}</caption>}
        {t.cabecalho && (
          <thead>
            <tr>{t.cabecalho.map((c, k) => (<th key={k} scope="col">{c}</th>))}</tr>
          </thead>
        )}
        <tbody>
          {t.linhas.map((l, i) => (
            <tr key={i}>
              {l.map((c, k) => (k === 0 && t.cabecalho && !t.cabecalho[0] ? <th key={k} scope="row">{c}</th> : <td key={k}>{c}</td>))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FigPlanilha({ p, legenda }: { p: PlanilhaDados; legenda?: string }) {
  const motor = useMemo(() => new Planilha(p), [p]);
  const colunas = Array.from({ length: p.colunas }, (_, i) => colunaLetra(i));
  const sel = p.selecionada?.toUpperCase();
  const formulaSel = sel ? p.celulas[sel] ?? "" : "";
  return (
    <div className="fig-planilha" role="group" aria-label={legenda ?? "Planilha"}>
      <div className="barra-formula">
        <span className="nome-celula">{sel ?? ""}</span>
        <span className="fx" aria-hidden="true">fx</span>
        <span className="conteudo-formula">{formulaSel}</span>
      </div>
      <div className="fig-rolagem">
        <table>
          <thead>
            <tr>
              <th className="canto" aria-hidden="true" />
              {colunas.map((c) => (<th key={c} scope="col">{c}</th>))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: p.linhas }, (_, i) => i + 1).map((l) => (
              <tr key={l}>
                <th scope="row">{l}</th>
                {colunas.map((c) => {
                  const ref = `${c}${l}`;
                  const texto = textoDaCelula(motor, p, ref);
                  const numero = texto !== "" && /^[-R$\d]/.test(texto) && !/^[A-Z]\d/.test(texto);
                  return (
                    <td key={ref} className={`${ref === sel ? "selecionada" : ""} ${numero ? "num" : ""}`} aria-label={`${ref}: ${texto || "vazia"}`}>
                      {texto}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const CORES = ["var(--laranja)", "#8fb3ff", "#7fd1a8", "#f5c542", "#c9a2ff"];

export function FigGrafico({ g }: { g: GraficoDados }) {
  const W = 520, H = 260, M = { t: 24, d: 16, b: 44, e: 52 };
  const max = Math.max(1, ...g.series.flatMap((s) => s.valores));
  const escalaY = (v: number) => H - M.b - (v / max) * (H - M.t - M.b);
  const largura = (W - M.e - M.d) / g.rotulos.length;
  const fmt = (v: number) => `${g.unidade === "R$" ? "R$ " : ""}${v.toLocaleString("pt-BR")}${g.unidade === "%" ? "%" : ""}`;
  const descricao = g.series.map((s) => `${s.nome}: ${s.valores.map((v, i) => `${g.rotulos[i]} ${fmt(v)}`).join(", ")}`).join("; ");

  if (g.forma === "pizza") {
    const s = g.series[0];
    const total = s.valores.reduce((a, b) => a + b, 0) || 1;
    let ang = -Math.PI / 2;
    return (
      <svg className="fig-grafico" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${g.titulo ?? "Gráfico"}. ${descricao}`}>
        {g.titulo && <text x={W / 2} y={16} textAnchor="middle" className="titulo">{g.titulo}</text>}
        {s.valores.map((v, i) => {
          const a0 = ang;
          const a1 = (ang += (v / total) * 2 * Math.PI);
          const [cx, cy, r] = [150, 140, 95];
          const grande = a1 - a0 > Math.PI ? 1 : 0;
          const d = `M${cx},${cy} L${cx + r * Math.cos(a0)},${cy + r * Math.sin(a0)} A${r},${r} 0 ${grande} 1 ${cx + r * Math.cos(a1)},${cy + r * Math.sin(a1)} Z`;
          return <path key={i} d={d} fill={CORES[i % CORES.length]} stroke="var(--painel)" strokeWidth={2} />;
        })}
        {s.valores.map((v, i) => (
          <g key={i} transform={`translate(290, ${50 + i * 26})`}>
            <rect width={12} height={12} rx={2} fill={CORES[i % CORES.length]} />
            <text x={20} y={11}>{`${g.rotulos[i]}: ${fmt(v)}`}</text>
          </g>
        ))}
      </svg>
    );
  }

  return (
    <svg className="fig-grafico" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${g.titulo ?? "Gráfico"}. ${descricao}`}>
      {g.titulo && <text x={W / 2} y={16} textAnchor="middle" className="titulo">{g.titulo}</text>}
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <g key={f}>
          <line x1={M.e} x2={W - M.d} y1={escalaY(max * f)} y2={escalaY(max * f)} className="grade" />
          <text x={M.e - 6} y={escalaY(max * f) + 4} textAnchor="end" className="eixo">{fmt(Math.round(max * f * 100) / 100)}</text>
        </g>
      ))}
      {g.rotulos.map((r, i) => (
        <text key={r} x={M.e + largura * (i + 0.5)} y={H - M.b + 18} textAnchor="middle" className="eixo">{r}</text>
      ))}
      {g.forma === "barras"
        ? g.series.map((s, k) =>
            s.valores.map((v, i) => {
              const bw = (largura * 0.7) / g.series.length;
              const x = M.e + largura * i + largura * 0.15 + bw * k;
              return (
                <g key={`${k}-${i}`}>
                  <rect x={x} y={escalaY(v)} width={bw} height={H - M.b - escalaY(v)} fill={CORES[k % CORES.length]} rx={2} />
                  <text x={x + bw / 2} y={escalaY(v) - 5} textAnchor="middle" className="valor">{fmt(v)}</text>
                </g>
              );
            })
          )
        : g.series.map((s, k) => (
            <g key={k}>
              <polyline
                fill="none"
                stroke={CORES[k % CORES.length]}
                strokeWidth={2.5}
                points={s.valores.map((v, i) => `${M.e + largura * (i + 0.5)},${escalaY(v)}`).join(" ")}
              />
              {s.valores.map((v, i) => (
                <g key={i}>
                  <circle cx={M.e + largura * (i + 0.5)} cy={escalaY(v)} r={3.5} fill={CORES[k % CORES.length]} />
                  <text x={M.e + largura * (i + 0.5)} y={escalaY(v) - 8} textAnchor="middle" className="valor">{fmt(v)}</text>
                </g>
              ))}
            </g>
          ))}
      {g.series.length > 1 &&
        g.series.map((s, k) => (
          <g key={s.nome} transform={`translate(${M.e + k * 140}, ${H - 12})`}>
            <rect width={10} height={10} rx={2} fill={CORES[k % CORES.length]} />
            <text x={16} y={9} className="eixo">{s.nome}</text>
          </g>
        ))}
    </svg>
  );
}

export function FigTela({ t }: { t: TelaProgramaDados }) {
  return (
    <div className="fig-tela" role="group" aria-label={`Janela: ${t.janela}`}>
      <div className="fig-tela-titulo">
        <span>{t.janela}</span>
        <span className="botoes-janela" aria-hidden="true"><i /><i /><i /></span>
      </div>
      {t.menu && (
        <div className="fig-tela-menu">{t.menu.map((m) => (<span key={m}>{m}</span>))}</div>
      )}
      {t.caixa && (
        <div className="fig-tela-caixa">
          <strong>{t.caixa.titulo}</strong>
          {t.caixa.campos.map((c) => (
            <div key={c.rotulo} className="campo">
              {c.marcado !== undefined ? <span className={`caixinha ${c.marcado ? "on" : ""}`} aria-hidden="true" /> : null}
              <span>{c.rotulo}</span>
              {c.valor !== undefined && <span className="valor">{c.valor}</span>}
            </div>
          ))}
          <div className="botoes">{t.caixa.botoes.map((b) => (<span key={b} className="botao-tela">{b}</span>))}</div>
        </div>
      )}
    </div>
  );
}
