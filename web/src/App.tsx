import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { useApp, type Tela } from "./estado";
import { MASCOTE, pct } from "./util";
import {
  IAlvo, IBalao, IBandeira, ICalendario, ICartoes, ICasa, IEngrenagem, IEscudo, IFogo, ILupa, IMais, IRaio, IRedacao, ISeta, ISino, ITrofeu,
} from "./componentes/Icones";
import { ErroTela, Esqueleto } from "./componentes/ErroTela";
import { Painel } from "./telas/Painel";

// cada tela num pedaço próprio do bundle (o painel vem junto: é a primeira que aparece)
const carregar = <K extends string>(imp: () => Promise<Record<K, ComponentType>>, nome: K) => lazy(() => imp().then((m) => ({ default: m[nome] })));
const Praticar = carregar(() => import("./telas/Praticar"), "Praticar");
const Revisoes = carregar(() => import("./telas/Revisoes"), "Revisoes");
const Cartoes = carregar(() => import("./telas/Cartoes"), "Cartoes");
const Diagnostico = carregar(() => import("./telas/Diagnostico"), "Diagnostico");
const Plano = carregar(() => import("./telas/Plano"), "Plano");
const Simulados = carregar(() => import("./telas/Simulados"), "Simulados");
const Redacao = carregar(() => import("./telas/Redacao"), "Redacao");
const Erros = carregar(() => import("./telas/Erros"), "Erros");
const Conquistas = carregar(() => import("./telas/Conquistas"), "Conquistas");
const AjustesTela = carregar(() => import("./telas/Ajustes"), "AjustesTela");
const Figuras = carregar(() => import("./telas/Figuras"), "Figuras");
const Admin = carregar(() => import("./telas/Admin"), "Admin");

const TITULO: Record<Tela, string> = {
  painel: "Painel", plano: "Plano", praticar: "Praticar", revisoes: "Revisões", cartoes: "Cartões", simulados: "Simulados",
  diagnostico: "Raio-X", erros: "Caderno de erros", redacao: "Redação", conquistas: "Conquistas", ajustes: "Ajustes", figuras: "Figuras", admin: "Admin",
};

function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  return online;
}

const NAV: { tela: Tela; rotulo: string; Icone: typeof ICasa }[] = [
  { tela: "painel", rotulo: "Painel", Icone: ICasa },
  { tela: "plano", rotulo: "Plano", Icone: IBandeira },
  { tela: "praticar", rotulo: "Praticar", Icone: IBalao },
  { tela: "revisoes", rotulo: "Revisões", Icone: ICalendario },
  { tela: "cartoes", rotulo: "Cartões", Icone: ICartoes },
  { tela: "simulados", rotulo: "Simulados", Icone: IAlvo },
  { tela: "redacao", rotulo: "Redação", Icone: IRedacao },
  { tela: "erros", rotulo: "Caderno de erros", Icone: ISino },
  { tela: "conquistas", rotulo: "Conquistas", Icone: ITrofeu },
  { tela: "ajustes", rotulo: "Ajustes", Icone: IEngrenagem },
];

export function App() {
  // aluno nunca vê a tela Admin; sem contas cadastradas, o único usuário do modo servidor é o dono
  const { tela, ir, painel, api, toasts, subiuNivel, fecharNivel, ehAdmin } = useApp();
  const online = useOnline();
  const [menuMais, setMenuMais] = useState(false);
  // título da aba por tela (Praticar e Simulados detalham a questão)
  useEffect(() => { document.title = `${TITULO[tela]} · Lobo`; }, [tela]);
  useEffect(() => setMenuMais(false), [tela]);

  return (
    <div className="app">
      <a href="#conteudo" className="pular">Pular para o conteúdo</a>
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
            <img className="mascote" src={MASCOTE} alt="" width={166} height={188} />
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

        {!online && (
          <div className="faixa-offline" role="status">
            Você está offline. Suas respostas ficam guardadas e são enviadas sozinhas quando a conexão voltar.
          </div>
        )}

        <main className="conteudo" id="conteudo" tabIndex={-1}>
          <ErroTela chave={tela}>
            <Suspense fallback={<Esqueleto />}>
              {tela === "painel" && <Painel />}
              {tela === "praticar" && <Praticar />}
              {tela === "revisoes" && <Revisoes />}
              {tela === "cartoes" && <Cartoes />}
              {tela === "plano" && <Plano />}
              {tela === "diagnostico" && <Diagnostico />}
              {tela === "simulados" && <Simulados />}
              {tela === "redacao" && <Redacao />}
              {tela === "erros" && <Erros />}
              {tela === "conquistas" && <Conquistas />}
              {tela === "ajustes" && <AjustesTela />}
              {tela === "figuras" && (ehAdmin ? <Figuras /> : <Painel />)}
              {tela === "admin" && (ehAdmin ? <Admin /> : <Painel />)}
            </Suspense>
          </ErroTela>
        </main>
      </div>

      <nav className="nav-inferior" aria-label="Principal (celular)">
        {[NAV[0], NAV[1], NAV[2], NAV[3]].map(({ tela: t, rotulo, Icone }) => (
          <button key={t} aria-current={tela === t ? "page" : undefined} onClick={() => ir(t)}>
            <Icone tam={20} />
            {rotulo}
          </button>
        ))}
        <button aria-current={NAV.slice(4).some((n) => n.tela === tela) || tela === "admin" ? "page" : undefined} aria-expanded={menuMais} aria-controls="menu-mais" onClick={() => setMenuMais((v) => !v)}>
          <IMais tam={20} />
          Mais
        </button>
      </nav>
      {menuMais && (
        <div className="menu-mais-fundo" onClick={() => setMenuMais(false)}>
          <nav id="menu-mais" className="menu-mais" aria-label="Mais telas" onClick={(e) => e.stopPropagation()}>
            {NAV.slice(4).map(({ tela: t, rotulo, Icone }) => (
              <button key={t} aria-current={tela === t ? "page" : undefined} onClick={() => ir(t)}>
                <Icone tam={20} />
                {rotulo}
              </button>
            ))}
            {ehAdmin && (
              <button aria-current={tela === "admin" ? "page" : undefined} onClick={() => ir("admin")}>
                <IEscudo tam={20} />
                Admin
              </button>
            )}
          </nav>
        </div>
      )}

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
