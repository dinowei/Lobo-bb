import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { useApp, type Tela } from "./estado";
import { CONCURSOS, IDS_CONCURSO, SIGLA_CONCURSO } from "../../shared/concursos";
import { Pose } from "./componentes/Pose";
import {
  IAlvo, IBalao, IBandeira, ICalendario, ICartoes, ICasa, ICheck, IEngrenagem, IEscudo, IFogo, ILupa, IMais, IRaio, IRedacao, ISeta, ISino, ITrofeu,
} from "./componentes/Icones";
import { ErroTela, Esqueleto } from "./componentes/ErroTela";
import { MiniLo } from "./componentes/MiniLo";
import { Painel } from "./telas/Painel";
import { SUBTOPICOS } from "../../shared/subtopicos";
import { MISTAS_FIM } from "../../shared/trilha";

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
const Tema = carregar(() => import("./telas/Tema"), "Tema");
const CertoErrado = carregar(() => import("./telas/CertoErrado"), "CertoErrado");

const TITULO: Record<Tela, string> = {
  painel: "Painel", plano: "Plano", praticar: "Praticar", "certo-errado": "Certo ou Errado", revisoes: "Revisões", cartoes: "Cartões", simulados: "Simulados",
  diagnostico: "Raio-X", erros: "Caderno de erros", redacao: "Redação", conquistas: "Conquistas", ajustes: "Ajustes", figuras: "Figuras", admin: "Admin", tema: "Tema",
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

// grupos da barra lateral (referência "Lobo Binho"): o que o Binho ensina, o que a Lo revisa, controle
type Grupo = "binho" | "lo" | "controle";
const NAV: { tela: Tela; rotulo: string; Icone: typeof ICasa; grupo: Grupo }[] = [
  { tela: "painel", rotulo: "Painel", Icone: ICasa, grupo: "binho" },
  { tela: "plano", rotulo: "Plano", Icone: IBandeira, grupo: "binho" },
  { tela: "praticar", rotulo: "Praticar", Icone: IBalao, grupo: "binho" },
  { tela: "revisoes", rotulo: "Revisões", Icone: ICalendario, grupo: "lo" },
  { tela: "cartoes", rotulo: "Cartões", Icone: ICartoes, grupo: "binho" },
  { tela: "certo-errado", rotulo: "Certo ou Errado", Icone: ICheck, grupo: "binho" },
  { tela: "simulados", rotulo: "Simulados", Icone: IAlvo, grupo: "binho" },
  { tela: "redacao", rotulo: "Redação", Icone: IRedacao, grupo: "binho" },
  { tela: "erros", rotulo: "Caderno de erros", Icone: ISino, grupo: "lo" },
  { tela: "conquistas", rotulo: "Conquistas", Icone: ITrofeu, grupo: "binho" },
  { tela: "ajustes", rotulo: "Ajustes", Icone: IEngrenagem, grupo: "controle" },
];
const GRUPOS: { id: Grupo; titulo: string }[] = [
  { id: "binho", titulo: "Binho" },
  { id: "lo", titulo: "Com a Lo" },
  { id: "controle", titulo: "Controle" },
];

export function App() {
  // aluno nunca vê a tela Admin; sem contas cadastradas, o único usuário do modo servidor é o dono
  const { tela, ir, painel, api, toasts, subiuNivel, fecharNivel, ehAdmin, concurso } = useApp();
  const online = useOnline();
  const [menuMais, setMenuMais] = useState(false);
  // título da aba por tela (Praticar e Simulados detalham a questão)
  useEffect(() => { document.title = `${TITULO[tela]} · Lobo Binho`; }, [tela]);
  useEffect(() => setMenuMais(false), [tela]);

  return (
    <div className="app">
      <a href="#conteudo" className="pular">Pular para o conteúdo</a>
      <aside className="lateral">
        <div className="marca">
          <span className="marca-rosto"><Pose nome="em-pe" largura={60} carregar="eager" alt="" /></span>
          <span className="marca-nome"><b>Lobo</b><b>Binho</b></span>
        </div>
        <nav className="nav" aria-label="Principal">
          {GRUPOS.map((g) => (
            <div key={g.id} className={`grupo-nav grupo-${g.id}`}>
              <span className="titulo-grupo" aria-hidden="true">{g.titulo}</span>
              {NAV.filter((n) => n.grupo === g.id).map(({ tela: t, rotulo, Icone }) => (
                <button key={t} aria-current={tela === t ? "page" : undefined} onClick={() => ir(t)} title={rotulo}>
                  <Icone />
                  <span className="rotulo-nav">{rotulo}</span>
                  {t === "revisoes" && !!painel?.revisoesHoje && <span className="contador num">{painel.revisoesHoje}</span>}
                </button>
              ))}
              {g.id === "controle" && ehAdmin && (
                <button aria-current={tela === "admin" ? "page" : undefined} onClick={() => ir("admin")} title="Admin">
                  <IEscudo />
                  <span className="rotulo-nav">Admin</span>
                  {!!painel?.alertasAdmin?.length && <span className="contador num" aria-label={`${painel.alertasAdmin.length} alerta(s)`}>{painel.alertasAdmin.length}</span>}
                </button>
              )}
            </div>
          ))}
        </nav>
        <div className="lema-lateral">
          <p>Grandes conquistas começam com pequenos passos.</p>
          <span className="assinatura">Binho</span>
        </div>
        {painel && (
          <button
            className="nivel-mini"
            onClick={() => ir("praticar")}
            title={`Nível ${painel.nivel.numero} · ${painel.nivel.titulo} · faltam ${painel.nivel.xpParaProximo - painel.nivel.xpNoNivel} XP`}
            aria-label={`Nível ${painel.nivel.numero}, ${painel.nivel.titulo}: faltam ${painel.nivel.xpParaProximo - painel.nivel.xpNoNivel} XP`}
            style={{ ["--progresso" as string]: `${Math.round((painel.nivel.xpNoNivel / painel.nivel.xpParaProximo) * 100)}%` }}
          >
            <Pose nome="em-pe" largura={40} carregar="eager" alt="" />
            <span className="num">{painel.nivel.numero}</span>
          </button>
        )}
      </aside>

      <div className="principal">
        <header className="topo">
          {tela !== "painel" && <h1 className="titulo-tela">{TITULO[tela]}</h1>}
          <Busca />
          <div className="pilulas">
            <SeletorConcurso />
            <Notificacoes />
            {api.modo === "demo" && <span className="selo-demo" title="Sem servidor: progresso salvo só neste navegador">modo demo</span>}
            <span className="pilula pilula-xp num" title={`XP total: ${(painel?.xp ?? 0).toLocaleString("pt-BR")}`}>
              <span className="bolinha"><IRaio /></span>
              <span className="xp-texto">
                <span><b>XP {(painel?.nivel.xpNoNivel ?? 0).toLocaleString("pt-BR")}</b><span className="rotulo-longo"> / {(painel?.nivel.xpParaProximo ?? 0).toLocaleString("pt-BR")}</span></span>
                <i className="xp-barra" aria-hidden="true"><u style={{ width: `${painel ? Math.round((painel.nivel.xpNoNivel / painel.nivel.xpParaProximo) * 100) : 0}%` }} /></i>
              </span>
            </span>
            <span className="pilula pilula-fogo num" title="Dias seguidos estudando">
              <span className="bolinha fogo"><IFogo /></span>
              <span className="xp-texto"><b>{painel?.sequenciaDias ?? 0} {painel?.sequenciaDias === 1 ? "dia" : "dias"}</b><span className="rotulo-longo">na sequência</span></span>
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
            <Suspense fallback={<Esqueleto />} key={concurso}>
              {tela === "painel" && <Painel />}
              {tela === "praticar" && <Praticar />}
              {tela === "certo-errado" && <CertoErrado />}
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
              {tela === "tema" && <Tema />}
            </Suspense>
          </ErroTela>
        </main>
      </div>
      <MiniLo />

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
            <Pose nome="comemorando" largura={160} carregar="eager" pular className="adesivo" />
            <p style={{ margin: "4px 0 0", opacity: 0.75 }}>Você subiu para o nível {subiuNivel.numero}</p>
            <h2 id="titulo-nivel">{subiuNivel.titulo}</h2>
            <p>O Binho tá orgulhoso. Bora pro próximo.</p>
            <button className="botao-escuro" onClick={fecharNivel} autoFocus>Continuar <ISeta /></button>
          </div>
        </div>
      )}
    </div>
  );
}

// Concurso no cabeçalho (lugar do "Financial" da referência). Só visual por enquanto: trocar de concurso
// é a F5 (abas BB/BACEN, Elo e tópicos por concurso); até lá o BACEN aparece desabilitado com o aviso.
function SeletorConcurso() {
  const { concurso, trocarConcurso } = useApp();
  return (
    <div className="seletor-concurso" role="tablist" aria-label="Concurso">
      <button role="tab" aria-selected={concurso === "geral"} className={concurso === "geral" ? "ativo" : ""} onClick={() => trocarConcurso("geral")} data-testid="aba-geral" title="Visão do todo: trilha única e domínio de todos os temas">
        Geral
      </button>
      {IDS_CONCURSO.map((c) => (
        <button key={c} role="tab" aria-selected={concurso === c} className={concurso === c ? "ativo" : ""} onClick={() => trocarConcurso(c)} data-testid={`aba-${c}`} title={`Lente: ${CONCURSOS[c].nome}: ${CONCURSOS[c].cargo}`}>
          {SIGLA_CONCURSO[c]}
        </button>
      ))}
    </div>
  );
}

// Sino: o que já está no painel (revisões vencidas, redação corrigida, alertas do admin). Esc ou clique fora fecha.
function Notificacoes() {
  const { painel, ir, ehAdmin } = useApp();
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => { if (!caixa.current?.contains(e.target as Node)) setAberto(false); };
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [aberto]);
  const itens: { texto: string; tela: Tela }[] = [];
  if (painel?.revisoesHoje) itens.push({ texto: `${painel.revisoesHoje} ${painel.revisoesHoje === 1 ? "revisão vencida" : "revisões vencidas"}: a Lo te espera`, tela: "revisoes" });
  if (painel?.redacaoCorrigidaPendente) itens.push({ texto: "Sua redação foi corrigida", tela: "redacao" });
  if (ehAdmin) for (const a of painel?.alertasAdmin ?? []) itens.push({ texto: a, tela: "admin" });
  return (
    <div className="notificacoes" ref={caixa} onKeyDown={(e) => e.key === "Escape" && setAberto(false)}>
      <button className="sino" aria-haspopup="true" aria-expanded={aberto} aria-label={`Notificações${itens.length ? `: ${itens.length}` : ""}`} onClick={() => setAberto((v) => !v)}>
        <ISino />
        {!!itens.length && <span className="ponto num" aria-hidden="true">{itens.length}</span>}
      </button>
      {aberto && (
        <div className="notificacoes-lista" role="dialog" aria-label="Notificações">
          {itens.length ? itens.map((i, k) => (
            <button key={k} onClick={() => { setAberto(false); ir(i.tela); }}>{i.texto}</button>
          )) : <p>Nada novo por aqui.</p>}
        </div>
      )}
    </div>
  );
}

// Menu da conta (avatar no topo, no PC e no celular): e-mail, Minha conta, Convidar amigo (admin), Sair.
// Esc ou clique fora fecha; setas andam entre os itens; o foco volta para o avatar.
function Avatar() {
  const { ajustes, ir, usuario, ehAdmin, sair } = useApp();
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const itens = () => [...(caixa.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])];
  const fechar = (devolverFoco = true) => {
    setAberto(false);
    if (devolverFoco) botao.current?.focus();
  };
  useEffect(() => {
    if (!aberto) return;
    itens()[0]?.focus();
    const fora = (e: PointerEvent) => { if (!caixa.current?.contains(e.target as Node)) fechar(false); };
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [aberto]); // eslint-disable-line react-hooks/exhaustive-deps
  const teclas = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") return fechar();
    const lista = itens();
    const i = lista.indexOf(document.activeElement as HTMLButtonElement);
    const alvo = { ArrowDown: (i + 1) % lista.length, ArrowUp: (i - 1 + lista.length) % lista.length, Home: 0, End: lista.length - 1 }[e.key];
    if (alvo === undefined) return;
    e.preventDefault();
    lista[alvo]?.focus();
  };
  const escolher = (acao: () => void) => () => { fechar(false); acao(); };
  const convidar = () => {
    ir("admin");
    try { history.replaceState(null, "", "#admin?aba=convites"); } catch { /* ok */ }
  };
  return (
    <div className="menu-conta" ref={caixa} onKeyDown={teclas}>
      <button
        ref={botao}
        className="avatar"
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls="menu-conta"
        aria-label={`Conta${usuario ? `: ${usuario.nome}` : ""}`}
        onClick={() => setAberto((v) => !v)}
      >
        {(usuario?.nome || ajustes.nome || "?").trim().charAt(0).toUpperCase()}
      </button>
      {aberto && (
        <div id="menu-conta" className="menu-conta-lista" role="menu" aria-label="Conta">
          <div className="menu-conta-email">{usuario ? usuario.email : "Sem conta: progresso deste aparelho"}</div>
          <button role="menuitem" onClick={escolher(() => ir("ajustes"))}>Minha conta</button>
          {ehAdmin && usuario && <button role="menuitem" onClick={escolher(convidar)}>Convidar amigo</button>}
          {usuario && <button role="menuitem" onClick={escolher(() => void sair())}>Sair</button>}
        </div>
      )}
    </div>
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
  // temas (subtópicos) primeiro: "crase" abre o Praticar SÓ de crase
  const temas = useMemo(() => {
    if (!q.trim() || !painel) return [];
    const termo = norm(q);
    const assuntos = new Set(painel.topicos.map((t) => t.assunto));
    return SUBTOPICOS.filter((s) => s.topicos.some((a) => assuntos.has(a)) && norm(s.nome).includes(termo)).slice(0, 4);
  }, [q, painel]);
  const treinarTema = (s: (typeof SUBTOPICOS)[number]) => {
    setQ("");
    setAberto(false);
    const disciplina = painel?.topicos.find((t) => s.topicos.includes(t.assunto))?.disciplina ?? null;
    ir("praticar", { sessao: { subtopico: s.id, nome: s.nome, disciplina, novas: 20, mistas: MISTAS_FIM, revisoes: false, trilha: false } });
  };

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
        placeholder="Buscar tema, disciplina ou questão: Pix, crase, SAC…"
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
          {temas.map((s) => (
            <button key={s.id} onClick={() => treinarTema(s)} data-testid={`busca-tema-${s.id}`}>
              Treinar o tema: {s.nome}
              <small>só questões de {s.nome}, novas primeiro</small>
            </button>
          ))}
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
          ) : !temas.length && (
            <small style={{ display: "block", padding: "8px 10px" }}>Nenhum tópico com “{q}”.</small>
          )}
        </div>
      )}
    </div>
  );
}
