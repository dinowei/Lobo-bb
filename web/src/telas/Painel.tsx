import { useMemo, useState } from "react";
import { PESO_PADRAO } from "../../../shared/motor";
import { NOME_DISCIPLINA, type BancoDTO, type Disciplina, type TopicoProgresso } from "../../../shared/tipos";
import { useApp } from "../estado";
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
        return { ...d, score: peso * (1 - taxa) };
      })
      .sort((a, b) => b.score - a.score);
  }, [painel]);

  const [foco, setFoco] = useState<number>(0);
  if (!painel) return <div className="carregando">Carregando painel…</div>;

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
          <div className="hero-cartoes">
            {recomendadas.slice(0, 3).map((d, i) => (
              <button
                key={d.disciplina}
                className={`cartao-disc${i === 1 ? " laranja" : ""}`}
                onClick={() => ir("praticar", { disciplina: d.disciplina })}
                aria-label={`Praticar ${d.nome}`}
              >
                <span className="n">{String(i + 1).padStart(2, "0")}</span>
                <strong style={{ whiteSpace: "pre-line" }}>{CURTO[d.disciplina]}</strong>
                <Ilustracao disciplina={d.disciplina} />
              </button>
            ))}
          </div>
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
