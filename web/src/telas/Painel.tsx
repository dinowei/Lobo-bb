import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent, type WheelEvent } from "react";
import { PESO_PADRAO } from "../../../shared/motor";
import { MOTIVOS_ERRO, NOME_DISCIPLINA, NOME_MOTIVO, type BancoDTO, type DesempenhoTemaDTO, type Disciplina, type MotivoErro, type MotivosDisciplinaDTO, type TopicoProgresso, type TrilhaDTO } from "../../../shared/tipos";
import { csvDesempenho, NOME_SELO } from "../../../shared/desempenhoTema";
import { useApp } from "../estado";
import { CartaoCalibragem } from "../componentes/Calibragem";
import { dificuldadeDoRating } from "../../../shared/rating";
import { diagnosticoPendente } from "../../../shared/diagnostico";
import { NOME_FASE, planoDeHoje } from "../../../shared/plano";
import { hojeLocal, usePlano } from "../usePlano";
import { textoItem } from "../itensPlano";
import { Ilustracao } from "../componentes/Ilustracoes";
import { ICheck, IDir, IEsq, ISeta, IFolha } from "../componentes/Icones";
import { COR_DISC, CURTO, SIGLA, diasAte, pct } from "../util";
import { Pose } from "../componentes/Pose";

export function Painel() {
  const { painel, ajustes, ir, usuario, api } = useApp();
  // 1ª visita depois de entrar (por conta; sem conta, por navegador): o Binho acena uma vez
  const chaveVisita = `lobo-boas-vindas-${usuario?.email ?? "local"}`;
  const [primeiraVisita] = useState(() => {
    try { return !localStorage.getItem(chaveVisita); } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem(chaveVisita, "1"); } catch { /* sem storage: acena de novo, sem problema */ }
  }, [chaveVisita]);

  // disciplinas recomendadas: peso no edital × fraqueza
  const recomendadas = useMemo(() => {
    if (!painel) return [];
    return [...painel.disciplinas]
      .map((d) => {
        const peso = painel.topicos.filter((t) => t.disciplina === d.disciplina).reduce((s, t) => s + (t.peso ?? PESO_PADRAO), 0);
        const taxa = d.tentativas ? (d.acertos + 1) / (d.tentativas + 2) : 0.5;
        const topicos = painel.topicos.filter((t) => t.disciplina === d.disciplina);
        const dominio = topicos.length ? topicos.reduce((s, t) => s + t.dominio, 0) / topicos.length : 0;
        return { ...d, score: peso * (1 - taxa), dominio };
      })
      .sort((a, b) => b.score - a.score);
  }, [painel]);

  const [foco, setFoco] = useState<number>(0);
  const plano = usePlano(1);
  const [aba, setAba] = useState<"geral" | "temas">(() => (location.hash.includes("aba=temas") ? "temas" : "geral"));
  const [trilha, setTrilha] = useState<TrilhaDTO | null>(null);
  useEffect(() => {
    api.trilha().then(setTrilha).catch(() => setTrilha(null));
  }, [api, painel?.totalRespondidas]);
  if (!painel) return <div className="carregando">Carregando painel…</div>;
  const temaHoje = trilha?.hoje ?? null;
  // sessão do tema do dia: revisões → novas do tema (já descontadas as de hoje) → +5 mistas da matéria
  const estudarTemaDoDia = () => temaHoje && ir("praticar", {
    sessao: {
      subtopico: temaHoje.subtopico, nome: temaHoje.nome, disciplina: temaHoje.disciplina,
      novas: Math.max(5, temaHoje.tamanho - temaHoje.novasFeitasHoje), mistas: temaHoje.mistas, revisoes: true, trilha: true,
    },
  });
  const deHoje = plano ? planoDeHoje(plano, hojeLocal()) : null;

  // banco recém-criado: ainda sem tópicos (npm run bb -- topicos)
  const disc = recomendadas.length ? recomendadas[((foco % recomendadas.length) + recomendadas.length) % recomendadas.length] : undefined;
  const topicos = disc ? painel.topicos.filter((t) => t.disciplina === disc.disciplina) : [];
  const faltam = diasAte(ajustes.dataProva);
  const n = painel.semana.respondidas;

  return (
    <>
    <div className="abas-painel" role="tablist" aria-label="Painel">
      <button role="tab" aria-selected={aba === "geral"} className={aba === "geral" ? "ativa" : ""} onClick={() => setAba("geral")}>Visão geral</button>
      <button role="tab" aria-selected={aba === "temas"} className={aba === "temas" ? "ativa" : ""} onClick={() => setAba("temas")}>Desempenho por tema</button>
    </div>
    {aba === "temas" ? <DesempenhoTemas /> : (
    <div className="painel-grade">
      <section className="area-hero">
        <div className="hero">
          <div className="hero-texto">
            <div>
              <p className="ola">
                {primeiraVisita ? "Bem-vindo! O Binho vai estudar com você" : `Salve, ${ajustes.nome || "concurseiro"}!`}
                {faltam !== null && faltam >= 0 && <> · faltam <b className="num">{faltam}</b> dias para a prova</>}
                {plano?.totalSemanas && <> · <button className="link" onClick={() => ir("plano")}>semana <b className="num">{plano.semanaAtual}</b> de <b className="num">{plano.totalSemanas}</b></button></>}
              </p>
              <h1>
                {n > 0 ? (
                  <>Você respondeu {n} {n === 1 ? "questão" : "questões"} esta semana</>
                ) : (
                  <>Bora começar? Sua primeira questão te espera</>
                )}
              </h1>
            </div>
            <div className="hero-acao">
              {temaHoje ? (
                <div className="acao-trilha">
                  <button className="botao-laranja" onClick={estudarTemaDoDia} data-testid="tema-do-dia">
                    Estudar o tema do dia <ISeta />
                  </button>
                  <small>
                    {trilha?.modo === "sabado" ? "Sábado: retomada · " : ""}Tema {temaHoje.n}: <b>{temaHoje.nome}</b>
                    {temaHoje.estado === "reforco" ? ` · ${temaHoje.refazer ? "refazer" : "reforço"}` : ""}
                  </small>
                  <button className="link" onClick={() => ir("tema", { subtopico: temaHoje.subtopico })}>Ver o tema</button>
                </div>
              ) : (
                <button className="botao-laranja" onClick={() => ir("praticar", trilha?.modo === "domingo" ? { revisao: true } : {})}>
                  {trilha?.modo === "domingo" ? "Domingo: revisões e erros" : n > 0 ? "Continuar estudando" : "Começar agora"} <ISeta />
                </button>
              )}
              {/* uma pose só: acenando na 1ª visita, lendo na hora de estudar, andando para a próxima tarefa */}
              <Pose nome={primeiraVisita ? "acenando" : n > 0 ? "andando" : "lendo"} largura={84} carregar="eager" />
            </div>
          </div>
          <CarrosselDisciplinas disciplinas={recomendadas} onPraticar={(disciplina) => ir("praticar", { disciplina })} />
        </div>
      </section>

      <RadarDominio linhas={recomendadas} />
      <SeuDia />

      {!disc ? (
        <section className="area-modulo" aria-labelledby="titulo-modulo">
          <div className="cabeca-modulo">
            <div>
              <div className="eyebrow">Nenhum tópico ainda</div>
              <h2 id="titulo-modulo">Banco vazio</h2>
            </div>
          </div>
          <p className="desc">Rode <code>npm run bb -- topicos data/topicos.json</code> pra carregar os tópicos do edital.</p>
        </section>
      ) : (
      <section className="area-modulo" aria-labelledby="titulo-modulo">
        <div className="cabeca-modulo">
          <div>
            <div className="eyebrow num">
              Disciplina {recomendadas.indexOf(disc) + 1} de {recomendadas.length} · {disc.dominados}/{disc.topicos} tópicos dominados
            </div>
            <h2 id="titulo-modulo">{disc.nome}</h2>
            <NivelEstimado nivel={painel.niveis?.find((n) => n.disciplina === disc.disciplina)} />
          </div>
          <div className="progresso-modulo">
            <div className="barra" aria-hidden="true"><i style={{ width: pct(disc.progresso) }} /></div>
            <span className="num">{pct(disc.progresso)}</span>
            <div className="setas">
              <button onClick={() => setFoco((f) => f - 1)} aria-label="Disciplina anterior"><IEsq /></button>
              <button onClick={() => setFoco((f) => f + 1)} aria-label="Próxima disciplina"><IDir /></button>
            </div>
          </div>
        </div>
        <div className="lista-topicos">
          {topicos.map((t) => (
            <LinhaTopico key={t.id} t={t} onClick={() => ir("praticar", { topicoId: t.id })} />
          ))}
        </div>
      </section>
      )}

      <aside className="area-agenda" aria-labelledby="titulo-agenda">
        <div className="agenda-cabeca">
          <h2 id="titulo-agenda">Agenda</h2>
          <button className="link" onClick={() => ir("revisoes")}>Ver tudo</button>
        </div>

        <div className="grupo-dia">Hoje</div>
        {trilha && (
          <button className="evento" onClick={temaHoje ? estudarTemaDoDia : () => ir("praticar", { revisao: true })}>
            <strong>Trilha · Rodada {trilha.rodada}</strong>
            <span className="sub num">
              {temaHoje ? `Tema ${temaHoje.n} de ${trilha.total}: ${temaHoje.nome}${temaHoje.novasFeitasHoje ? ` · ${temaHoje.novasFeitasHoje} novas hoje` : ""}` : trilha.modo === "domingo" ? "Domingo: revisões e erros, sem tema novo" : "Sem tema hoje"}
            </span>
            <div className="rodape"><span className="sub num">{trilha.concluidos} concluídos{trilha.filaRetomada.length ? ` · ${trilha.filaRetomada.length} na retomada` : ""}</span><span className="tag"><i />Trilha</span></div>
          </button>
        )}
        {deHoje && deHoje.itens.length > 0 && (
          <button className="evento" onClick={() => ir("plano")}>
            <strong>Plano de hoje</strong>
            <ul className="plano-hoje">
              {deHoje.itens.map((i, k) => {
                const feito = i.tipo === "questoes" ? (painel.hojePorDisciplina?.find((x) => x.disciplina === i.disciplina)?.n ?? 0) : null;
                return <li key={k} className={feito !== null && i.tipo === "questoes" && feito >= i.questoes ? "cumprido" : ""}>{textoItem(i)}{feito !== null && i.tipo === "questoes" ? ` · ${Math.min(feito, i.questoes)}/${i.questoes}` : ""}</li>;
              })}
            </ul>
            <div className="rodape"><span className="sub">{plano?.totalSemanas ? NOME_FASE[plano.fase] : "Ciclo de estudos"}</span><span className="tag"><i />Plano</span></div>
          </button>
        )}
        {diagnosticoPendente(painel.diagnosticos?.[painel.diagnosticos.length - 1]?.data) && (
          <button className="evento convite-raiox" onClick={() => ir("diagnostico")}>
            <span>
              <strong>{painel.diagnosticos?.length ? "Hora de refazer o Raio-X" : "Faça seu Raio-X"}</strong>
              <span className="sub">{painel.diagnosticos?.length ? "Já faz 30 dias: veja quanto você evoluiu." : "30 questões para o Binho saber onde você está e não gastar seu tempo com o que já sabe."}</span>
            </span>
          </button>
        )}
        <button className="evento" onClick={() => ir("praticar")}>
          <strong>Meta do dia</strong>
          <span className="sub num">
            {painel.respondeuHoje >= ajustes.metaDiaria
              ? `Batida! ${painel.respondeuHoje} questões hoje`
              : `${painel.respondeuHoje} de ${ajustes.metaDiaria} questões`}
          </span>
          <div className="rodape">
            <Rostos discs={recomendadas.slice(0, 3).map((d) => d.disciplina)} />
            <span className="tag verde"><i />Meta</span>
          </div>
        </button>
        <button className="evento" onClick={() => ir("praticar", { revisao: true })}>
          <strong>Revisão espaçada</strong>
          <span className="sub num">
            {painel.revisoesHoje ? `${painel.revisoesHoje} ${painel.revisoesHoje === 1 ? "questão vencida" : "questões vencidas"}` : "Tudo em dia por hoje"}
          </span>
          <div className="rodape">
            <span className="sub">{painel.revisoesHoje ? "Comece por aqui" : "Nada pendente"}</span>
            <span className="tag roxo"><i />Revisão</span>
          </div>
        </button>

        <div className="grupo-dia">Amanhã</div>
        <button className="evento" onClick={() => ir("revisoes")}>
          <strong>Revisão</strong>
          <span className="sub num">
            {painel.revisoesPorDia[1]?.total ? `${painel.revisoesPorDia[1].total} questões voltam` : "Nenhuma questão agendada"}
          </span>
          <div className="rodape"><span /><span className="tag roxo"><i />Revisão</span></div>
        </button>
        <button className="evento" onClick={() => ir("simulados")}>
          <strong>Simulado semanal</strong>
          <span className="sub">20 questões no peso do edital</span>
          <div className="rodape"><span /><span className="tag amarelo"><i />Simulado</span></div>
        </button>

        {painel.banco && <CartaoBanco banco={painel.banco} />}
        {painel.redacaoCorrigidaPendente && <button className="evento" onClick={() => ir("redacao")}><strong>Sua redação foi corrigida</strong><span className="sub">Veja sua nota e os próximos ajustes</span></button>}
        {painel.motivosErro?.some((d) => d.erros) && <CartaoMotivos linhas={painel.motivosErro} />}
        {painel.calibragem && <CartaoCalibragem linhas={painel.calibragem} />}
        {!!painel.horasSemana?.length && <CartaoHoras linhas={painel.horasSemana} />}

        {painel.totalRespondidas === 0 && (
          <div className="vazio" style={{ marginTop: 12 }}>
            <p style={{ margin: 0 }}>Cada questão respondida vira XP, agenda revisões e mostra seus pontos fracos aqui.</p>
          </div>
        )}
      </aside>
    </div>
    )}
    </>
  );
}

// Radar de domínio por matéria (verde institucional): "domínio recente" (média dos tópicos, como o painel
// já calcula) × "acerto geral" (todas as tentativas). Tabela junto: o mesmo dado para leitor de tela.
function RadarDominio({ linhas }: { linhas: { disciplina: Disciplina; nome: string; dominio: number; tentativas: number; acertos: number }[] }) {
  if (linhas.length < 3) return null;
  const L = 300, c = L / 2, r = 118;
  const ang = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / linhas.length;
  const ponto = (i: number, v: number) => [c + Math.cos(ang(i)) * r * v, c + Math.sin(ang(i)) * r * v] as const;
  const poligono = (vals: number[]) => vals.map((v, i) => ponto(i, v).map((n) => n.toFixed(1)).join(",")).join(" ");
  const dominio = linhas.map((l) => l.dominio);
  const acerto = linhas.map((l) => (l.tentativas ? l.acertos / l.tentativas : 0));
  return (
    <section className="cartao-radar" aria-labelledby="titulo-radar">
      <h2 id="titulo-radar">Domínio por matéria</h2>
      <p className="sub">Domínio recente × acerto geral, de 0 a 100%</p>
      <div className="radar">
        <svg viewBox={`0 0 ${L} ${L}`} role="img" aria-label={`Radar de domínio: ${linhas.map((l, i) => `${l.nome} ${pct(dominio[i])}`).join(", ")}`}>
          {[0.25, 0.5, 0.75, 1].map((k) => <polygon key={k} className="grade-radar" points={poligono(linhas.map(() => k))} />)}
          {linhas.map((_, i) => { const [x, y] = ponto(i, 1); return <line key={i} className="eixo-radar" x1={c} y1={c} x2={x} y2={y} />; })}
          <polygon className="serie-b" points={poligono(acerto)} />
          <polygon className="serie-a" points={poligono(dominio)} />
          {dominio.map((v, i) => { const [x, y] = ponto(i, v); return <circle key={i} className="ponto-radar" cx={x} cy={y} r={4} />; })}
          {linhas.map((l, i) => {
            const [x, y] = ponto(i, 1.1);
            return <text key={l.disciplina} className="rotulo-radar" x={x} y={y} textAnchor={Math.abs(x - c) < 8 ? "middle" : x > c ? "start" : "end"} dominantBaseline="middle">{SIGLA[l.disciplina]}</text>;
          })}
        </svg>
        <div>
          <ul className="legenda-radar">
            <li><i className="a" />Domínio recente</li>
            <li><i className="b" />Acerto geral</li>
          </ul>
          <table className="tabela-radar">
            <caption className="so-leitor">Domínio recente e acerto geral por matéria</caption>
            <tbody>
              {linhas.map((l, i) => <tr key={l.disciplina}><td>{CURTO[l.disciplina] ?? l.nome}</td><td>{pct(dominio[i])}</td><td>{l.tentativas ? pct(acerto[i]) : "–"}</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

// "Seu dia" da Lo (turquesa): revisões vencidas, erros para refazer e o que volta amanhã
function SeuDia() {
  const { painel, ir } = useApp();
  if (!painel) return null;
  const erros = (painel.motivosErro ?? []).reduce((s, d) => s + d.erros, 0);
  const amanha = painel.revisoesPorDia[1]?.total ?? 0;
  return (
    <section className="seu-dia" aria-labelledby="titulo-seu-dia">
      <h2 id="titulo-seu-dia">Seu dia com a Lo</h2>
      <ul>
        <li><b className="num">{painel.revisoesHoje}</b> {painel.revisoesHoje === 1 ? "revisão vencida" : "revisões vencidas"}</li>
        <li><b className="num">{erros}</b> {erros === 1 ? "erro para refazer" : "erros para refazer"}</li>
        <li><b className="num">{amanha}</b> {amanha === 1 ? "volta amanhã" : "voltam amanhã"}</li>
      </ul>
      <button className="botao-lo" onClick={() => (painel.revisoesHoje ? ir("praticar", { revisao: true }) : ir("erros"))}>{painel.revisoesHoje ? "Revisar com a Lo" : "Ver o caderno de erros"} <ISeta /></button>
      <Pose nome="lo-acenando" largura={92} alt="" />
    </section>
  );
}

// Desempenho por tema: % nas questões NOVAS (hoje / 7 dias / total), selo, simulado; filtro por matéria; CSV
function DesempenhoTemas() {
  const { api, ir } = useApp();
  const [linhas, setLinhas] = useState<DesempenhoTemaDTO[] | null>(null);
  const [disc, setDisc] = useState<string>("");
  useEffect(() => {
    api.desempenhoTemas().then(setLinhas).catch(() => setLinhas([]));
  }, [api]);
  if (!linhas) return <div className="carregando">Carregando desempenho…</div>;
  const discs = [...new Set(linhas.map((l) => l.disciplina).filter(Boolean))] as Disciplina[];
  const vis = linhas.filter((l) => !disc || l.disciplina === disc);
  const p = (x: { n: number; a: number }) => (x.n ? pct(x.a / x.n) : "–");
  const baixar = () => {
    const url = URL.createObjectURL(new Blob(["﻿" + csvDesempenho(vis)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `desempenho-por-tema-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <section className="secao desempenho-temas" aria-labelledby="titulo-temas">
      <div className="agenda-cabeca">
        <h2 id="titulo-temas">Desempenho por tema</h2>
        <div className="acoes">
          <select aria-label="Filtrar por matéria" value={disc} onChange={(e) => setDisc(e.target.value)}>
            <option value="">Todas as matérias</option>
            {discs.map((d) => <option key={d} value={d}>{NOME_DISCIPLINA[d]}</option>)}
          </select>
          <button className="botao-linha" onClick={baixar}>Exportar CSV</button>
        </div>
      </div>
      <p className="atalho">Só conta a primeira vez em cada questão (novas). ≥70% concluído · 50–69% reforço · &lt;50% retomar.</p>
      <div className="tabela-rolavel">
        <table className="tabela">
          <thead>
            <tr><th>Tema</th><th>Hoje</th><th>7 dias</th><th>Total</th><th>Resp.</th><th>Domínio</th><th>Simulado</th><th>Última</th><th>Selo</th><th /></tr>
          </thead>
          <tbody>
            {vis.map((l) => (
              <tr key={l.subtopico}>
                <td><button className="link" onClick={() => ir("tema", { subtopico: l.subtopico })}>{l.nome}</button>{l.aprovadas < 15 && <small className="aviso-poucas"> · {l.aprovadas} no banco</small>}</td>
                <td className="num">{p(l.novasHoje)}</td>
                <td className="num">{p(l.novas7d)}</td>
                <td className="num">{p(l.novasTotal)} <small>({l.novasTotal.n})</small></td>
                <td className="num">{l.respondidas}</td>
                <td className="num">{l.respondidas ? pct(l.dominio) : "–"}</td>
                <td className="num">{p(l.simulado)}</td>
                <td className="num">{l.ultima ? new Date(l.ultima).toLocaleDateString("pt-BR") : "–"}</td>
                <td><span className={`selo selo-${l.selo}`}>{NOME_SELO[l.selo]}</span></td>
                <td><button className="link" onClick={() => ir("tema", { subtopico: l.subtopico })}>Treinar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

type DisciplinaHero = { disciplina: Disciplina; nome: string; dominio: number };

// sparkline do cartão de matéria: % de acerto da matéria em cada simulado (do mais antigo ao mais novo)
function Sparkline({ valores, rotulo }: { valores: number[]; rotulo: string }) {
  const L = 100, A = 26;
  const x = (i: number) => (i * L) / (valores.length - 1);
  const y = (v: number) => 3 + (1 - v / 100) * (A - 6);
  return (
    <svg className="spark" viewBox={`0 0 ${L} ${A}`} preserveAspectRatio="none" role="img" aria-label={`${rotulo}: ${valores.map((v) => `${v}%`).join(", ")}`}>
      <path d={valores.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function CarrosselDisciplinas({ disciplinas, onPraticar }: { disciplinas: DisciplinaHero[]; onPraticar: (disciplina: Disciplina) => void }) {
  const { api } = useApp();
  // séries por matéria a partir do histórico de simulados que já existe (api.simulados), sem conta nova
  const [series, setSeries] = useState<Map<Disciplina, number[]> | null>(null);
  useEffect(() => {
    api.simulados().then((sims) => {
      const m = new Map<Disciplina, number[]>();
      for (const s of [...sims].filter((x) => !x.diagnostico).sort((a, b) => a.data.localeCompare(b.data)))
        for (const p of s.porDisciplina) if (p.total) m.set(p.disciplina, [...(m.get(p.disciplina) ?? []), Math.round((p.acertos / p.total) * 100)]);
      setSeries(m);
    }).catch(() => setSeries(null));
  }, [api]);
  const trilho = useRef<HTMLDivElement>(null);
  const ponteiro = useRef({ ativo: false, x: 0, scroll: 0, moveu: false, capturado: false });
  const [posicao, setPosicao] = useState(0);
  const [temAntes, setTemAntes] = useState(false);
  const [temDepois, setTemDepois] = useState(false);
  const [arrastando, setArrastando] = useState(false);

  const atualizar = useCallback(() => {
    const el = trilho.current;
    if (!el) return;
    setTemAntes(el.scrollLeft > 2);
    setTemDepois(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
    const primeiroVisivel = [...el.querySelectorAll<HTMLElement>(".cartao-disc")]
      .findIndex((item) => item.offsetLeft + item.offsetWidth > el.scrollLeft + 4);
    setPosicao(Math.max(0, primeiroVisivel));
  }, []);

  useEffect(() => {
    atualizar();
    const el = trilho.current;
    if (!el) return;
    const observer = new ResizeObserver(atualizar);
    observer.observe(el);
    return () => observer.disconnect();
  }, [atualizar, disciplinas.length]);

  const comportamento = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  const mover = (sentido: -1 | 1) => {
    const el = trilho.current;
    if (el) el.scrollBy({ left: sentido * Math.max(180, el.clientWidth * 0.78), behavior: comportamento() });
  };
  const irPara = (indice: number) => {
    const el = trilho.current;
    const item = el?.querySelectorAll<HTMLElement>(".cartao-disc")[indice];
    if (el && item) el.scrollTo({ left: item.offsetLeft, behavior: comportamento() });
  };

  function iniciarArrasto(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    ponteiro.current = { ativo: true, x: e.clientX, scroll: e.currentTarget.scrollLeft, moveu: false, capturado: false };
    setArrastando(false);
  }
  function arrastar(e: PointerEvent<HTMLDivElement>) {
    if (!ponteiro.current.ativo) return;
    const delta = e.clientX - ponteiro.current.x;
    if (Math.abs(delta) > 5) {
      ponteiro.current.moveu = true;
      setArrastando(true);
      if (!ponteiro.current.capturado) {
        e.currentTarget.setPointerCapture(e.pointerId);
        ponteiro.current.capturado = true;
      }
    }
    e.currentTarget.scrollLeft = ponteiro.current.scroll - delta;
  }
  function terminarArrasto(e: PointerEvent<HTMLDivElement>) {
    if (!ponteiro.current.ativo) return;
    ponteiro.current.ativo = false;
    if (ponteiro.current.capturado && e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    ponteiro.current.capturado = false;
    setArrastando(false);
  }
  function roda(e: WheelEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || el.scrollWidth <= el.clientWidth) return;
    el.scrollLeft += e.deltaY;
    e.preventDefault();
  }

  return (
    <div className={`carrossel-materias${temAntes ? " tem-antes" : ""}${temDepois ? " tem-depois" : ""}`}>
      <button className="carrossel-seta esquerda" onClick={() => mover(-1)} disabled={!temAntes} aria-label="Disciplinas anteriores">‹</button>
      <div
        className={`hero-cartoes${arrastando ? " arrastando" : ""}`}
        ref={trilho}
        role="region"
        aria-label="Disciplinas prioritárias para o treino"
        tabIndex={0}
        onScroll={atualizar}
        onWheel={roda}
        onPointerDown={iniciarArrasto}
        onPointerMove={arrastar}
        onPointerUp={terminarArrasto}
        onPointerCancel={terminarArrasto}
        onClickCapture={(e) => {
          if (ponteiro.current.moveu) {
            e.preventDefault();
            e.stopPropagation();
            ponteiro.current.moveu = false;
          }
        }}
        onKeyDown={(e) => {
          if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
          e.preventDefault();
          mover(e.key === "ArrowRight" ? 1 : -1);
        }}
      >
        {disciplinas.map((d, i) => (
          <button
            key={d.disciplina}
            className={`cartao-disc${i === 1 ? " laranja" : ""}`}
            onClick={() => onPraticar(d.disciplina)}
            title={`Praticar ${d.nome}`}
          >
            {/* nome acessível = o texto visível (WCAG 2.5.3), com o verbo antes só para leitor de tela */}
            <span className="sr-only">Praticar, prioridade </span>
            <span className="n">{String(i + 1).padStart(2, "0")}</span>
            <strong style={{ whiteSpace: "pre-line" }}>{CURTO[d.disciplina]}</strong>
            {(series?.get(d.disciplina)?.length ?? 0) >= 2 && <Sparkline valores={series!.get(d.disciplina)!} rotulo={`Acerto de ${d.nome} nos simulados`} />}
            <span className="dominio-cartao"><span>Domínio</span><b className="num">{pct(d.dominio)}</b><i><u style={{ width: pct(d.dominio) }} /></i></span>
            <Ilustracao disciplina={d.disciplina} />
          </button>
        ))}
      </div>
      <button className="carrossel-seta direita" onClick={() => mover(1)} disabled={!temDepois} aria-label="Próximas disciplinas">›</button>
      <div className="carrossel-pontos" aria-label={`Posição ${Math.min(posicao + 1, disciplinas.length)} de ${disciplinas.length}`}>
        {disciplinas.map((d, i) => <button key={d.disciplina} className={i === posicao ? "ativo" : ""} onClick={() => irPara(i)} aria-label={`Ir para ${d.nome}`} aria-current={i === posicao ? "true" : undefined} />)}
      </div>
    </div>
  );
}

// O que já está pronto para treinar: total, inéditas por disciplina e o que chegou de noite
function CartaoBanco({ banco }: { banco: BancoDTO }) {
  const { ir } = useApp();
  return (
    <>
      <div className="grupo-dia">Banco</div>
      <button className="evento cartao-banco" onClick={() => ir("praticar")}>
        <strong>Banco de questões</strong>
        <span className="sub num">
          {banco.total.toLocaleString("pt-BR")} {banco.total === 1 ? "questão" : "questões"} · {banco.ineditas.toLocaleString("pt-BR")} inéditas para você
        </span>
        {!!banco.porDisciplina.length && (
          <span className="banco-disciplinas">
            {banco.porDisciplina.map((d) => (
              <span key={d.disciplina} title={`${NOME_DISCIPLINA[d.disciplina]}: ${d.ineditas} inéditas de ${d.total}`}>
                <i style={{ background: COR_DISC[d.disciplina] }} aria-hidden="true" />
                <span className="sr-only">{NOME_DISCIPLINA[d.disciplina]}:</span>
                <span aria-hidden="true">{SIGLA[d.disciplina]}</span> <b className="num">{d.ineditas}</b>
              </span>
            ))}
          </span>
        )}
        <div className="rodape">
          <span className="sub">
            {banco.estaNoite ? "Questões novas para você" : "Inéditas primeiro no treino"}
            {banco.repetidasNoite ? ` · ${banco.repetidasNoite} descartada${banco.repetidasNoite === 1 ? "" : "s"} por repetição` : ""}
          </span>
          {banco.estaNoite > 0 && <span className="tag verde"><i />+{banco.estaNoite} esta noite</span>}
        </div>
      </button>
    </>
  );
}

// Por que você erra: barras empilhadas de motivos por disciplina (erros sem motivo ficam de fora da barra)
const COR_MOTIVO: Record<MotivoErro, string> = {
  nao_sabia: "var(--laranja)",
  confundi: "var(--roxo)",
  desatencao: "var(--amarelo)",
  chutei: "var(--suave)",
};
function CartaoMotivos({ linhas }: { linhas: MotivosDisciplinaDTO[] }) {
  const comErro = linhas.filter((d) => d.erros);
  const informados = comErro.reduce((s, d) => s + MOTIVOS_ERRO.reduce((x, m) => x + d.motivos[m], 0), 0);
  return (
    <>
      <div className="grupo-dia">Por que você erra</div>
      <div className="evento cartao-motivos">
        {informados === 0 ? (
          <span className="sub">Depois de errar, toque no motivo. O lobo usa isso para escolher a próxima questão e montar este gráfico.</span>
        ) : (
          <>
            {comErro.map((d) => {
              const total = MOTIVOS_ERRO.reduce((x, m) => x + d.motivos[m], 0);
              return (
                <div key={d.disciplina} className="linha-motivo" title={`${NOME_DISCIPLINA[d.disciplina]}: ${d.erros} erros, ${total} com motivo`}>
                  <span className="sigla">{SIGLA[d.disciplina]}</span>
                  <span className="pilha" aria-label={MOTIVOS_ERRO.map((m) => `${NOME_MOTIVO[m]}: ${d.motivos[m]}`).join(", ")}>
                    {total ? MOTIVOS_ERRO.map((m) => d.motivos[m] ? <i key={m} style={{ width: pct(d.motivos[m] / total), background: COR_MOTIVO[m] }} /> : null) : null}
                  </span>
                  <span className="num sub">{total}/{d.erros}</span>
                </div>
              );
            })}
            <span className="legenda-motivos">
              {MOTIVOS_ERRO.map((m) => (
                <span key={m}><i style={{ background: COR_MOTIVO[m] }} />{NOME_MOTIVO[m]}</span>
              ))}
            </span>
          </>
        )}
      </div>
    </>
  );
}

// Nível estimado (Elo) da disciplina: barra de 800 a 1800, com o rótulo de dificuldade equivalente
function NivelEstimado({ nivel }: { nivel?: { rating: number; n: number } }) {
  if (!nivel || nivel.n < 5) return <div className="nivel-estimado sub">Nível estimado: responda 5 questões para medir</div>;
  const faixa = Math.min(1, Math.max(0, (nivel.rating - 800) / 1000));
  return (
    <div className="nivel-estimado" title={`Rating ${nivel.rating} em ${nivel.n} respostas: você acerta metade das questões de dificuldade ${dificuldadeDoRating(nivel.rating)}`}>
      <span className="sub num">Nível estimado {nivel.rating.toLocaleString("pt-BR")} · dá conta da dificuldade {dificuldadeDoRating(nivel.rating)}</span>
      <div className="barra" aria-hidden="true"><i style={{ width: pct(faixa) }} /></div>
    </div>
  );
}

// Horas líquidas: só o tempo ativo respondendo, últimos 7 dias, por disciplina
const fmtHoras = (seg: number) => (seg >= 3600 ? `${Math.floor(seg / 3600)}h${String(Math.round((seg % 3600) / 60)).padStart(2, "0")}` : `${Math.max(1, Math.round(seg / 60))} min`);
function CartaoHoras({ linhas }: { linhas: { disciplina: Disciplina; seg: number }[] }) {
  const total = linhas.reduce((s, l) => s + l.seg, 0);
  const maior = Math.max(...linhas.map((l) => l.seg));
  return (
    <>
      <div className="grupo-dia">Horas líquidas na semana</div>
      <div className="evento cartao-motivos">
        <span className="sub num">{fmtHoras(total)} de estudo de verdade, sem contar aba parada</span>
        {[...linhas].sort((a, b) => b.seg - a.seg).map((l) => (
          <div key={l.disciplina} className="linha-motivo" title={`${NOME_DISCIPLINA[l.disciplina]}: ${fmtHoras(l.seg)}`}>
            <span className="sigla">{SIGLA[l.disciplina]}</span>
            <span className="pilha"><i style={{ width: pct(l.seg / maior), background: COR_DISC[l.disciplina] }} /></span>
            <span className="num sub">{fmtHoras(l.seg)}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function LinhaTopico({ t, onClick }: { t: TopicoProgresso; onClick: () => void }) {
  return (
    <button className="linha-topico" onClick={onClick}>
      <span className={`icone-status ${t.status}`} aria-label={t.status === "dominado" ? "Dominado" : t.status === "andamento" ? "Em andamento" : "Não iniciado"}>
        <IFolha />
        {t.status === "dominado" && <span className="check"><ICheck /></span>}
      </span>
      <span className="nome">{t.assunto}</span>
      <span className="desc">{t.subtopicos.slice(0, 4).join(", ")}</span>
      <span className="pct num">{t.tentativas ? pct(t.dominio) : "—"}</span>
    </button>
  );
}

function Rostos({ discs }: { discs: Disciplina[] }) {
  return (
    <span className="rostos" aria-label="Disciplinas em foco">
      {discs.map((d) => (
        <span key={d} style={{ background: COR_DISC[d], color: "#121212" }} title={NOME_DISCIPLINA[d]}>{SIGLA[d]}</span>
      ))}
    </span>
  );
}
