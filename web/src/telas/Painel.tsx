import { useEffect, useMemo, useState } from "react";
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
import { CONCURSOS, SIGLA_CONCURSO } from "../../../shared/concursos";
import type { ProntidaoDTO } from "../../../shared/prontidao";

// Prontidão (trilha única): na aba Geral, um número por concurso; na aba do concurso, a lente dele com os
// temas mais fracos de maior peso. O domínio é um só: estudar um tema comum sobe todos os que o cobram.
function Prontidao() {
  const { api, concurso, ir, trocarConcurso } = useApp();
  const [lista, setLista] = useState<ProntidaoDTO[] | null>(null);
  useEffect(() => { api.prontidao().then(setLista).catch(() => setLista([])); }, [api]);
  if (!lista?.length) return null;
  const doConcurso = concurso === "geral" ? null : lista.find((p) => p.concurso === concurso);
  if (doConcurso)
    return (
      <div className="prontidao-cartao" data-testid="prontidao-lente">
        <div className="prontidao-cabeca">
          <span>Prontidão para {doConcurso.sigla}</span>
          <b className="num">{pct(doConcurso.prontidao)}</b>
          {doConcurso.aConfirmar && <span className="selo alerta" title="Edital pendente: pesos de referência">pesos a confirmar</span>}
        </div>
        <div className="barra-prontidao" aria-hidden="true"><i style={{ width: pct(doConcurso.prontidao) }} /></div>
        <p className="sub">Temas que mais pesam e ainda estão fracos:</p>
        <ul className="lista-fracos">
          {doConcurso.fracos.map((f) => (
            <li key={f.subtopico}><button className="link" onClick={() => ir("tema", { subtopico: f.subtopico })}>{f.nome}</button> <span className="num">{pct(f.dominio)}</span></li>
          ))}
        </ul>
      </div>
    );
  return (
    <div className="prontidao-cartao" data-testid="prontidao-geral">
      <div className="prontidao-cabeca"><span>Prontidão por concurso</span><small>um domínio só: um tema comum sobe todos</small></div>
      <ul className="lista-prontidao">
        {lista.map((p) => (
          <li key={p.concurso}>
            <button className="link" onClick={() => trocarConcurso(p.concurso)} title={p.nome}>{p.sigla}</button>
            <div className="barra-prontidao" aria-hidden="true"><i style={{ width: pct(p.prontidao) }} /></div>
            <span className="num">{pct(p.prontidao)}</span>
            {p.aConfirmar && <span className="selo alerta" title="Edital pendente: pesos de referência">a confirmar</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Painel() {
  const { painel, ajustes, ir, usuario, api, concurso } = useApp();
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
      {/* saudação + chamada principal (referência "Lobo Binho") */}
      <section className="saudacao">
        <div>
          <h1>{primeiraVisita ? "Bem-vindo!" : `Olá, ${ajustes.nome || "concurseiro"}`}</h1>
          <p>
            {primeiraVisita ? "O Binho vai estudar com você." : "Seu estudo de hoje está preparado."}
            {n > 0 && <> Você respondeu <b className="num">{n}</b> {n === 1 ? "questão" : "questões"} esta semana.</>}
            {faltam !== null && faltam >= 0 && <> Faltam <b className="num">{faltam}</b> dias para a prova.</>}
            {plano?.totalSemanas && <> <button className="link" onClick={() => ir("plano")}>Semana <b className="num">{plano.semanaAtual}</b> de <b className="num">{plano.totalSemanas}</b></button></>}
          </p>
          {concurso !== "geral" && !painel.topicos.length && (
            <p className="aviso-concurso-vazio" role="note" data-testid="concurso-sem-conteudo">
              <b>{SIGLA_CONCURSO[concurso]}: as questões ainda estão chegando.</b> O {CONCURSOS[concurso].nome} ({CONCURSOS[concurso].cargo}) entra com o material de estudo; a trilha única já inclui os temas dele.
            </p>
          )}
          <Prontidao />
        </div>
        <button className="botao-laranja botao-grande" onClick={() => (temaHoje ? estudarTemaDoDia() : ir("praticar", trilha?.modo === "domingo" ? { revisao: true } : {}))}>
          <span aria-hidden="true">▶</span> {trilha?.modo === "domingo" && !temaHoje ? "Domingo: revisões e erros" : n > 0 ? "Continuar estudando" : "Começar agora"}
        </button>
      </section>

      {/* destaque do Binho: plano de hoje, laranja sólido com o cartão branco por dentro */}
      <section className="plano-hoje-cartao" aria-labelledby="titulo-plano-hoje">
        <h2 id="titulo-plano-hoje"><span aria-hidden="true">▦</span> Plano de hoje</h2>
        <div className="cartao-interno">
          <h3>{temaHoje ? temaHoje.nome : trilha?.modo === "domingo" ? "Revisões e erros" : deHoje?.itens[0] ? textoItem(deHoje.itens[0]) : "Treino livre"}</h3>
          <ul className="itens-plano">
            <li><span aria-hidden="true">▷</span> <b className="num">{temaHoje ? temaHoje.tamanho - Math.min(temaHoje.tamanho, temaHoje.novasFeitasHoje) : painel.revisoesHoje}</b> {temaHoje ? "questões novas do tema" : "revisões para hoje"}</li>
            <li><span aria-hidden="true">?</span> <b className="num">{temaHoje?.mistas ?? 5}</b> mistas da matéria no fim</li>
          </ul>
          {temaHoje ? (
            <div className="acao-trilha">
              <span className="progresso-tema">
                <span>Progresso do tema</span>
                <b className="num">{pct(Math.min(1, temaHoje.novasFeitasHoje / Math.max(1, temaHoje.tamanho)))}</b>
                <i aria-hidden="true"><u style={{ width: pct(Math.min(1, temaHoje.novasFeitasHoje / Math.max(1, temaHoje.tamanho))) }} /></i>
              </span>
              <small>
                {trilha?.modo === "sabado" ? "Sábado: retomada · " : ""}Tema {temaHoje.n}: <b>{temaHoje.nome}</b>
                {temaHoje.estado === "reforco" ? ` · ${temaHoje.refazer ? "refazer" : "reforço"}` : ""}
              </small>
              <div className="acoes-plano">
                <button className="botao-laranja" onClick={estudarTemaDoDia} data-testid="tema-do-dia">Estudar o tema do dia <ISeta /></button>
                <button className="link" onClick={() => ir("tema", { subtopico: temaHoje.subtopico })}>Ver o tema</button>
              </div>
            </div>
          ) : (
            <div className="acoes-plano"><button className="botao-laranja" onClick={() => ir("plano")}>Ver o plano <ISeta /></button></div>
          )}
          <span className="frase-mascote" aria-hidden="true">Você consegue!</span>
        </div>
        <Pose nome="escrevendo" largura={190} carregar="eager" alt="" />
      </section>

      <SeuDia trilha={trilha} />

      <ProximasAtividades trilha={trilha} temaHoje={temaHoje} estudarTemaDoDia={estudarTemaDoDia} deHoje={deHoje} />

      <ModulosEstudo linhas={recomendadas} foco={disc?.disciplina} aoVerTopicos={(d) => setFoco(recomendadas.findIndex((r) => r.disciplina === d))} />

      <section className="desempenho-cartao" aria-labelledby="titulo-desempenho">
        <h2 id="titulo-desempenho"><span aria-hidden="true">▮▮▮</span> Seu desempenho</h2>
        <div className="desempenho-grade">
          <RadarDominio linhas={recomendadas} />
          <MiniEvolucao />
        </div>
      </section>

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

      {/* o que já existia no painel e não está na referência: banco, motivos de erro, calibragem, horas */}
      <section className="area-detalhes" aria-label="Mais do seu estudo">
        {painel.banco && <CartaoBanco banco={painel.banco} />}
        {painel.motivosErro?.some((d) => d.erros) && <CartaoMotivos linhas={painel.motivosErro} />}
        {painel.calibragem && <CartaoCalibragem linhas={painel.calibragem} />}
        {!!painel.horasSemana?.length && <CartaoHoras linhas={painel.horasSemana} />}
        {painel.totalRespondidas === 0 && (
          <div className="vazio">
            <p style={{ margin: 0 }}>Cada questão respondida vira XP, agenda revisões e mostra seus pontos fracos aqui.</p>
          </div>
        )}
      </section>
    </div>
    )}
    </>
  );
}

// Radar de domínio por matéria (verde institucional): "domínio recente" (média dos tópicos, como o painel
// já calcula) × "acerto geral" (todas as tentativas). Tabela junto: o mesmo dado para leitor de tela.
function RadarDominio({ linhas }: { linhas: { disciplina: Disciplina; nome: string; dominio: number; tentativas: number; acertos: number }[] }) {
  if (linhas.length < 3) return null;
  // mais largo que alto: os rótulos (em duas linhas) cabem dos lados sem cortar
  const L = 380, A = 290, cx = L / 2, c = A / 2, r = 100;
  const ang = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / linhas.length;
  const ponto = (i: number, v: number) => [cx + Math.cos(ang(i)) * r * v, c + Math.sin(ang(i)) * r * v] as const;
  const poligono = (vals: number[]) => vals.map((v, i) => ponto(i, v).map((n) => n.toFixed(1)).join(",")).join(" ");
  const dominio = linhas.map((l) => l.dominio);
  const acerto = linhas.map((l) => (l.tentativas ? l.acertos / l.tentativas : 0));
  return (
    <section className="cartao-radar" aria-labelledby="titulo-radar">
      <h3 id="titulo-radar">Domínio por matéria</h3>
      <ul className="legenda-radar">
        <li><i className="a" />Domínio recente</li>
        <li><i className="b" />Acerto geral</li>
      </ul>
      <div className="radar">
        <svg viewBox={`0 0 ${L} ${A}`} role="img" aria-label={`Radar de domínio: ${linhas.map((l, i) => `${l.nome} ${pct(dominio[i])}`).join(", ")}`}>
          {[0.25, 0.5, 0.75, 1].map((k) => <polygon key={k} className="grade-radar" points={poligono(linhas.map(() => k))} />)}
          {linhas.map((_, i) => { const [x, y] = ponto(i, 1); return <line key={i} className="eixo-radar" x1={cx} y1={c} x2={x} y2={y} />; })}
          {/* como na referência: a série principal preenchida em lima, a comparação só no contorno escuro por cima */}
          <polygon className="serie-a" points={poligono(dominio)} />
          <polygon className="serie-b" points={poligono(acerto)} />
          {linhas.map((l, i) => {
            const [x, y] = ponto(i, 1.1);
            const partes = (CURTO[l.disciplina] ?? SIGLA[l.disciplina]).split("\n");
            return (
              <text key={l.disciplina} className="rotulo-radar" x={x} y={y - (partes.length - 1) * 5.5} textAnchor={Math.abs(x - cx) < 8 ? "middle" : x > cx ? "start" : "end"} dominantBaseline="middle">
                {partes.map((p, k) => <tspan key={k} x={x} dy={k ? 11 : 0}>{p}</tspan>)}
              </text>
            );
          })}
        </svg>
        <div>
          <table className="tabela-radar so-leitor">
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
function SeuDia({ trilha }: { trilha: TrilhaDTO | null }) {
  const { painel, ir } = useApp();
  if (!painel) return null;
  const erros = (painel.motivosErro ?? []).reduce((s, d) => s + d.erros, 0);
  const amanha = painel.revisoesPorDia[1]?.total ?? 0;
  const reforco = trilha?.hoje?.estado === "reforco" ? trilha.hoje.nome : null;
  return (
    <section className="seu-dia" aria-labelledby="titulo-seu-dia">
      <h2 id="titulo-seu-dia"><span className="icone-lo" aria-hidden="true">◎</span> Seu dia com a Lo</h2>
      <div className="cartao-interno">
        <ul>
          <li><span aria-hidden="true">↻</span> <b className="num">{painel.revisoesHoje}</b> {painel.revisoesHoje === 1 ? "revisão pendente" : "revisões pendentes"}</li>
          <li><span aria-hidden="true">?</span> <b className="num">{erros}</b> {erros === 1 ? "erro para refazer" : "erros para refazer"}</li>
          <li><span aria-hidden="true">◷</span> <b className="num">{amanha}</b> {amanha === 1 ? "volta amanhã" : "voltam amanhã"}</li>
        </ul>
        {reforco && <p className="alerta-lo"><span aria-hidden="true">⚠</span> <b>{reforco}</b> precisa de reforço</p>}
        <button className="botao-lo largo" onClick={() => (painel.revisoesHoje ? ir("praticar", { revisao: true }) : ir("erros"))}>
          <span aria-hidden="true">▶</span> {painel.revisoesHoje ? "Começar revisão" : "Ver o caderno de erros"}
        </button>
      </div>
      <span className="frase-mascote lo" aria-hidden="true">Vamos revisar juntos?</span>
      <Pose nome="lo-lendo" largura={150} alt="" />
    </section>
  );
}

// "Próximas atividades" (referência): o que já estava na agenda, com o ponto na cor de quem cuida
// (laranja = Binho/estudo, turquesa = Lo/revisão, verde = resultado/meta/simulado)
function ProximasAtividades({ trilha, temaHoje, estudarTemaDoDia, deHoje }: {
  trilha: TrilhaDTO | null; temaHoje: TrilhaDTO["hoje"]; estudarTemaDoDia: () => void; deHoje: ReturnType<typeof planoDeHoje> | null;
}) {
  const { painel, ir, ajustes } = useApp();
  if (!painel) return null;
  const item = (cor: "binho" | "lo" | "verde", titulo: string, sub: string, acao: () => void, chave: string) => (
    <button key={chave} className="evento atividade" onClick={acao}>
      <i className={`ponto-${cor}`} aria-hidden="true" />
      <span><strong>{titulo}</strong><span className="sub num">{sub}</span></span>
      <IDir />
    </button>
  );
  const itens = [
    temaHoje ? item("binho", `Tema do dia: ${temaHoje.nome}`, `Trilha · tema ${temaHoje.n} de ${trilha?.total ?? 51}${temaHoje.novasFeitasHoje ? ` · ${temaHoje.novasFeitasHoje} novas hoje` : ""}`, estudarTemaDoDia, "tema")
      : trilha?.modo === "domingo" ? item("lo", "Domingo de revisões", "Sem tema novo: revisões e erros", () => ir("praticar", { revisao: true }), "domingo") : null,
    deHoje?.itens.length ? item("binho", "Plano de hoje", deHoje.itens.map((i) => textoItem(i)).slice(0, 2).join(" · "), () => ir("plano"), "plano") : null,
    item("lo", "Revisão espaçada", painel.revisoesHoje ? `${painel.revisoesHoje} ${painel.revisoesHoje === 1 ? "questão vencida" : "questões vencidas"} · hoje` : "Tudo em dia por hoje", () => ir("praticar", { revisao: true }), "revisao"),
    item("lo", "Revisão de amanhã", painel.revisoesPorDia[1]?.total ? `${painel.revisoesPorDia[1].total} questões voltam` : "Nenhuma questão agendada", () => ir("revisoes"), "amanha"),
    item("verde", "Meta do dia", painel.respondeuHoje >= ajustes.metaDiaria ? `Batida! ${painel.respondeuHoje} questões hoje` : `${painel.respondeuHoje} de ${ajustes.metaDiaria} questões`, () => ir("praticar"), "meta"),
    item("verde", "Simulado semanal", "20 questões no peso do edital", () => ir("simulados"), "simulado"),
    diagnosticoPendente(painel.diagnosticos?.[painel.diagnosticos.length - 1]?.data)
      ? item("binho", painel.diagnosticos?.length ? "Hora de refazer o Raio-X" : "Faça seu Raio-X", painel.diagnosticos?.length ? "Já faz 30 dias: veja quanto evoluiu" : "30 questões para o Binho saber onde você está", () => ir("diagnostico"), "raiox") : null,
    painel.redacaoCorrigidaPendente ? item("verde", "Sua redação foi corrigida", "Veja sua nota estimada", () => ir("redacao"), "redacao") : null,
  ].filter(Boolean);
  return (
    <aside className="proximas" aria-labelledby="titulo-proximas">
      <div className="agenda-cabeca">
        <h2 id="titulo-proximas"><span aria-hidden="true">▦</span> Próximas atividades</h2>
        <button className="link" onClick={() => ir("revisoes")}>Ver todas →</button>
      </div>
      <div className="lista-atividades">{itens}</div>
    </aside>
  );
}

// "Módulos de estudo" (referência): cartões por matéria com barra verde do domínio e questões respondidas
function ModulosEstudo({ linhas, foco, aoVerTopicos }: { linhas: DisciplinaHero[]; foco?: Disciplina; aoVerTopicos: (d: Disciplina) => void }) {
  const { painel, ir, api } = useApp();
  const [todos, setTodos] = useState(false);
  const [series, setSeries] = useState<Map<Disciplina, number[]> | null>(null);
  useEffect(() => {
    api.simulados().then((sims) => {
      const m = new Map<Disciplina, number[]>();
      for (const s of [...sims].filter((x) => !x.diagnostico).sort((a, b) => a.data.localeCompare(b.data)))
        for (const p of s.porDisciplina) if (p.total) m.set(p.disciplina, [...(m.get(p.disciplina) ?? []), Math.round((p.acertos / p.total) * 100)]);
      setSeries(m);
    }).catch(() => setSeries(null));
  }, [api]);
  if (!linhas.length) return null;
  const banco = new Map((painel?.banco?.porDisciplina ?? []).map((b) => [b.disciplina, b]));
  return (
    <section className="modulos" aria-labelledby="titulo-modulos">
      <div className="agenda-cabeca">
        <h2 id="titulo-modulos"><span aria-hidden="true">⚙</span> Módulos de estudo</h2>
        {linhas.length > 6 && <button className="link" onClick={() => setTodos((v) => !v)}>{todos ? "Ver menos" : "Ver todos →"}</button>}
      </div>
      <div className="grade-modulos">
        {(todos ? linhas : linhas.slice(0, 6)).map((d) => {
          const b = banco.get(d.disciplina);
          const serie = series?.get(d.disciplina) ?? [];
          return (
            <div key={d.disciplina} className={`modulo${foco === d.disciplina ? " em-foco" : ""}`}>
              <button className="modulo-principal" onClick={() => ir("praticar", { disciplina: d.disciplina })} title={`Praticar ${d.nome}`}>
                <span className="modulo-icone"><Ilustracao disciplina={d.disciplina} /></span>
                <strong>{d.nome}</strong>
                <span className="modulo-barra"><i aria-hidden="true"><u style={{ width: pct(d.dominio) }} /></i><b className="num">{pct(d.dominio)}</b></span>
                <span className="sub num">{b ? `${b.total - b.ineditas} / ${b.total} questões` : `${d.tentativas} respondidas`}</span>
                {serie.length >= 2 && <Sparkline valores={serie} rotulo={`Acerto de ${d.nome} nos simulados`} />}
              </button>
              <button className="link modulo-topicos" onClick={() => aoVerTopicos(d.disciplina)}>Tópicos</button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// "Evolução nos simulados" do painel (referência): linha verde com o valor de cada simulado em selo verde
function MiniEvolucao() {
  const { api, ir } = useApp();
  const [pontos, setPontos] = useState<{ data: string; pct: number }[] | null>(null);
  useEffect(() => {
    api.simulados().then((sims) => setPontos([...sims].filter((s) => !s.diagnostico && s.total).sort((a, b) => a.data.localeCompare(b.data)).slice(-6).map((s) => ({ data: s.data, pct: Math.round((s.acertos / s.total) * 100) })))).catch(() => setPontos([]));
  }, [api]);
  const L = 300, A = 180, M = { e: 34, d: 14, t: 26, b: 24 };
  const x = (i: number) => M.e + (pontos && pontos.length > 1 ? (i * (L - M.e - M.d)) / (pontos.length - 1) : (L - M.e - M.d) / 2);
  const y = (v: number) => M.t + (1 - v / 100) * (A - M.t - M.b);
  return (
    <div className="mini-evolucao">
      <h3>Evolução nos simulados</h3>
      {!pontos ? <p className="atalho">Carregando…</p> : !pontos.length ? (
        <p className="atalho">Faça um simulado para ver sua evolução. <button className="link" onClick={() => ir("simulados")}>Fazer agora</button></p>
      ) : (
        <svg viewBox={`0 0 ${L} ${A}`} role="img" aria-label={`Acerto nos últimos simulados: ${pontos.map((p) => `${new Date(p.data).toLocaleDateString("pt-BR")} ${p.pct}%`).join(", ")}`}>
          {[0, 25, 50, 75, 100].map((v) => (
            <g key={v}>
              <line x1={M.e} x2={L - M.d} y1={y(v)} y2={y(v)} className="grade" />
              <text x={M.e - 6} y={y(v) + 4} textAnchor="end" className="eixo">{v}%</text>
            </g>
          ))}
          <path className="area" d={`M${x(0)},${y(0)} ${pontos.map((p, i) => `L${x(i)},${y(p.pct)}`).join(" ")} L${x(pontos.length - 1)},${y(0)} Z`} />
          <path className="linha" d={pontos.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.pct)}`).join(" ")} />
          {pontos.map((p, i) => (
            <g key={p.data}>
              <circle cx={x(i)} cy={y(p.pct)} r={4.5} className="ponto" />
              <rect x={x(i) - 17} y={y(p.pct) - 24} width={34} height={17} rx={8.5} className="selo-valor" />
              <text x={x(i)} y={y(p.pct) - 12} textAnchor="middle" className="valor">{p.pct}%</text>
              <text x={x(i)} y={A - 6} textAnchor="middle" className="eixo">{new Date(p.data).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</text>
            </g>
          ))}
        </svg>
      )}
    </div>
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

type DisciplinaHero = { disciplina: Disciplina; nome: string; dominio: number; tentativas: number };

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
