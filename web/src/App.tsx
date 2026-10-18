import { useMemo, useRef, useState } from "react";
import { useApp, type Tela } from "./estado";
import { MASCOTE, pct } from "./util";
import {
  IAlvo, IBalao, ICalendario, ICasa, IEngrenagem, IEscudo, IFogo, ILupa, IMais, IRaio, ISeta, ISino, ITrofeu,
} from "./componentes/Icones";
import { Painel } from "./telas/Painel";
import { Praticar } from "./telas/Praticar";
import { Revisoes } from "./telas/Revisoes";
import { Simulados } from "./telas/Simulados";
import { Erros } from "./telas/Erros";
import { Conquistas } from "./telas/Conquistas";
import { AjustesTela } from "./telas/Ajustes";
import { Figuras } from "./telas/Figuras";
import { Admin } from "./telas/Admin";

const NAV: { tela: Tela; rotulo: string; Icone: typeof ICasa }[] = [
  { tela: "painel", rotulo: "Painel", Icone: ICasa },
  { tela: "praticar", rotulo: "Praticar", Icone: IBalao },
  { tela: "revisoes", rotulo: "Revisões", Icone: ICalendario },
  { tela: "simulados", rotulo: "Simulados", Icone: IAlvo },
  { tela: "erros", rotulo: "Caderno de erros", Icone: ISino },
  { tela: "conquistas", rotulo: "Conquistas", Icone: ITrofeu },
  { tela: "ajustes", rotulo: "Ajustes", Icone: IEngrenagem },
];

export function App() {
  // aluno nunca vê a tela Admin; sem contas cadastradas, o único usuário do modo servidor é o dono
  const { tela, ir, painel, api, toasts, subiuNivel, fecharNivel, ehAdmin } = useApp();

  return (
    <div className="app">
      <aside className="lateral">
        <div className="marca">lobo</div>
        <nav className="nav" aria-label="Principal">
          {NAV.map(({ tela: t, rotulo, Icone }) => (
            <button key={t} aria-current={tela === t ? "page" : undefined} onClick={() => ir(t)}>
              <Icone />
              {rotulo}
              {t === "revisoes" && !!painel?.revisoesHoje && <span className="contador num">{painel.revisoesHoje}</span>}
            </button>
          ))}
          {ehAdmin && (
            <button aria-current={tela === "admin" ? "page" : undefined} onClick={() => ir("admin")}>
              <IEscudo />
              Admin
              {!!painel?.alertasAdmin?.length && <span className="contador num" aria-label={`${painel.alertasAdmin.length} alerta(s)`}>{painel.alertasAdmin.length}</span>}
            </button>
          )}
        </nav>
        {painel && (
          <div className="cartao-nivel">
            <img className="mascote" src={MASCOTE} alt="" />
            <span className="rotulo">Nível {painel.nivel.numero}</span>
            <h3>{painel.nivel.titulo}</h3>
            <div className="barra" role="progressbar" aria-valuenow={Math.round((painel.nivel.xpNoNivel / painel.nivel.xpParaProximo) * 100)} aria-label="Progresso do nível">
              <i style={{ width: pct(painel.nivel.xpNoNivel / painel.nivel.xpParaProximo) }} />
            </div>
            <button className="botao-escuro" onClick={() => ir("praticar")}>
              Faltam {painel.nivel.xpParaProximo - painel.nivel.xpNoNivel} XP <ISeta />
            </button>
          </div>
        )}
      </aside>

      <div className="principal">
        <header className="topo">
          <Busca />
          <div className="pilulas">
            {api.modo === "demo" && <span className="selo-demo" title="Sem servidor: progresso salvo só neste navegador">modo demo</span>}
            <span className="pilula num" title="XP total">
              <span className="bolinha"><IRaio /></span>
              {(painel?.xp ?? 0).toLocaleString("pt-BR")} XP
            </span>
            <span className="pilula num" title="Dias seguidos estudando">
              <span className="bolinha branca"><IFogo /></span>
              {painel?.sequenciaDias ?? 0} <span className="rotulo-longo">{painel?.sequenciaDias === 1 ? "dia" : "dias"}</span>
            </span>
            <Avatar />
          </div>
        </header>

        <main className="conteudo">
          {tela === "painel" && <Painel />}
          {tela === "praticar" && <Praticar />}
          {tela === "revisoes" && <Revisoes />}
          {tela === "simulados" && <Simulados />}
          {tela === "erros" && <Erros />}
          {tela === "conquistas" && <Conquistas />}
          {tela === "ajustes" && <AjustesTela />}
          {tela === "figuras" && (ehAdmin ? <Figuras /> : <Painel />)}
          {tela === "admin" && (ehAdmin ? <Admin /> : <Painel />)}
        </main>
      </div>

      <nav className="nav-inferior" aria-label="Principal (celular)">
        {[NAV[0], NAV[1], NAV[2], NAV[3]].map(({ tela: t, rotulo, Icone }) => (
          <button key={t} aria-current={tela === t ? "page" : undefined} onClick={() => ir(t)}>
            <Icone tam={20} />
            {rotulo}
          </button>
        ))}
        <button aria-current={["erros", "conquistas", "ajustes"].includes(tela) ? "page" : undefined} onClick={() => ir("conquistas")}>
          <IMais tam={20} />
          Mais
        </button>
      </nav>

      <div className="toast-pilha" aria-live="polite">
        {toasts.map((t) => (<div key={t.id} className="toast">{t.texto}</div>))}
      </div>

      {subiuNivel && (
        <div className="modal-fundo" role="dialog" aria-modal="true" aria-labelledby="titulo-nivel" onClick={fecharNivel}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <img src={MASCOTE} alt="" />
            <p style={{ margin: "4px 0 0", opacity: 0.75 }}>Você subiu para o nível {subiuNivel.numero}</p>
            <h2 id="titulo-nivel">{subiuNivel.titulo}</h2>
            <p>O lobo tá orgulhoso. Bora pro próximo.</p>
            <button className="botao-escuro" onClick={fecharNivel} autoFocus>Continuar <ISeta /></button>
          </div>
        </div>
      )}
    </div>
  );
}

function Avatar() {
  const { ajustes, ir } = useApp();
  return (
    <button className="avatar" onClick={() => ir("ajustes")} aria-label="Ajustes do perfil">
      {(ajustes.nome || "?").trim().charAt(0).toUpperCase()}
    </button>
  );
}

function Busca() {
  const { painel, ir } = useApp();
  const [q, setQ] = useState("");
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const achados = useMemo(() => {
    if (!q.trim() || !painel) return [];
    const termo = norm(q);
    return painel.topicos
      .filter((t) => norm(`${t.assunto} ${t.subtopicos.join(" ")}`).includes(termo))
      .slice(0, 6);
  }, [q, painel]);

  return (
    <div
      className="busca"
      ref={caixa}
      onBlur={(e) => {
        if (!caixa.current?.contains(e.relatedTarget as Node)) setAberto(false);
      }}
    >
      <ILupa />
      <input
        id="busca"
        type="search"
        placeholder="Buscar tópico: Pix, crase, SAC, Copom…"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setAberto(true);
        }}
        onFocus={() => setAberto(true)}
        onKeyDown={(e) => e.key === "Escape" && setAberto(false)}
        aria-label="Buscar tópico"
      />
      {aberto && q && (
        <div className="resultados">
          {achados.length ? (
            achados.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setQ("");
                  setAberto(false);
                  ir("praticar", { topicoId: t.id });
                }}
              >
                {t.assunto}
                <small>{t.subtopicos.slice(0, 3).join(" · ")}</small>
              </button>
            ))
          ) : (
            <small style={{ display: "block", padding: "8px 10px" }}>Nenhum tópico com “{q}”.</small>
          )}
        </div>
      )}
    </div>
  );
}
