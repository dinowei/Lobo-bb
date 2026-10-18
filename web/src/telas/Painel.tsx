import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent, type WheelEvent } from "react";
import { PESO_PADRAO } from "../../../shared/motor";
import { MOTIVOS_ERRO, NOME_DISCIPLINA, NOME_MOTIVO, type BancoDTO, type Disciplina, type MotivoErro, type MotivosDisciplinaDTO, type TopicoProgresso } from "../../../shared/tipos";
import { useApp } from "../estado";
import { CartaoCalibragem } from "../componentes/Calibragem";
import { dificuldadeDoRating } from "../../../shared/rating";
import { diagnosticoPendente } from "../../../shared/diagnostico";
import { NOME_FASE, planoDeHoje } from "../../../shared/plano";
import { hojeLocal, usePlano } from "../usePlano";
import { textoItem } from "./Plano";
import { Ilustracao } from "../componentes/Ilustracoes";
import { ICheck, IDir, IEsq, ISeta, IFolha } from "../componentes/Icones";
import { COR_DISC, CURTO, MASCOTE, SIGLA, diasAte, pct } from "../util";

export function Painel() {
  const { painel, ajustes, ir } = useApp();

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
  if (!painel) return <div className="carregando">Carregando painel…</div>;
  const deHoje = plano ? planoDeHoje(plano, hojeLocal()) : null;

  // banco recém-criado: ainda sem tópicos (npm run bb -- topicos)
  const disc = recomendadas.length ? recomendadas[((foco % recomendadas.length) + recomendadas.length) % recomendadas.length] : undefined;
  const topicos = disc ? painel.topicos.filter((t) => t.disciplina === disc.disciplina) : [];
  const faltam = diasAte(ajustes.dataProva);
  const n = painel.semana.respondidas;

  return (
    <div className="painel-grade">
      <section className="area-hero">
        <div className="hero">
          <div className="hero-texto">
            <div>
              <p className="ola">
                Salve, {ajustes.nome || "concurseiro"}!
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
            <button className="botao-laranja" onClick={() => ir("praticar")}>
              {n > 0 ? "Continuar estudando" : "Começar agora"} <ISeta />
            </button>
          </div>
          <CarrosselDisciplinas disciplinas={recomendadas} onPraticar={(disciplina) => ir("praticar", { disciplina })} />
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

      <aside className="area-agenda" aria-labelledby="titulo-agenda">
        <div className="agenda-cabeca">
          <h2 id="titulo-agenda">Agenda</h2>
          <button className="link" onClick={() => ir("revisoes")}>Ver tudo</button>
        </div>

        <div className="grupo-dia">Hoje</div>
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
            <img src={MASCOTE} alt="" />
            <span>
              <strong>{painel.diagnosticos?.length ? "Hora de refazer o Raio-X" : "Faça seu Raio-X"}</strong>
              <span className="sub">{painel.diagnosticos?.length ? "Já faz 30 dias: veja quanto você evoluiu." : "30 questões para o lobo saber onde você está e não gastar seu tempo com o que já sabe."}</span>
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
            <span className="tag"><i />Meta</span>
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
            <img src={MASCOTE} alt="" style={{ width: 52 }} />
            <p style={{ margin: 0 }}>Cada questão respondida vira XP, agenda revisões e mostra seus pontos fracos aqui.</p>
          </div>
        )}
      </aside>
    </div>
  );
}

type DisciplinaHero = { disciplina: Disciplina; nome: string; dominio: number };

function CarrosselDisciplinas({ disciplinas, onPraticar }: { disciplinas: DisciplinaHero[]; onPraticar: (disciplina: Disciplina) => void }) {
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
            aria-label={`Praticar ${d.nome}. Prioridade ${i + 1} de ${disciplinas.length}. Domínio ${pct(d.dominio)}`}
          >
            <span className="n">{String(i + 1).padStart(2, "0")}</span>
            <strong style={{ whiteSpace: "pre-line" }}>{CURTO[d.disciplina]}</strong>
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
