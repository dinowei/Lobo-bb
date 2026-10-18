// Estado global: API ativa, painel, navegação, ajustes, avisos de XP e nível
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Api, Disciplina, PainelDTO } from "../../shared/tipos";
import { apiDemo } from "./api/demo";
import { apiHttp, servidorDisponivel } from "./api/http";
import { conta, EVENTO_SESSAO, type UsuarioDTO } from "./api/conta";
import { Entrar } from "./telas/Entrar";

export type Tela = "painel" | "praticar" | "revisoes" | "simulados" | "erros" | "redacao" | "conquistas" | "ajustes" | "figuras" | "admin";
export const TELAS: Tela[] = ["painel", "praticar", "revisoes", "simulados", "erros", "redacao", "conquistas", "ajustes", "figuras", "admin"];
export interface FiltroPratica {
  topicoId?: string;
  disciplina?: Disciplina;
  questaoId?: string;
  revisao?: boolean;
  misto?: boolean; // treino misturado (8.6)
}
import type { CicloFoco } from "../../shared/aprendizado";

export interface Ajustes {
  nome: string;
  metaDiaria: number;
  dataProva: string; // "" = sem data
  duracaoProvaMin: number; // 0 = sem contagem regressiva (só cronômetro), até o edital dizer
  linhaDeCorte: number; // % para "nota de corte batida"
  linhasRedacaoMax: number; // limite de linhas do treino (edital pode mudar)
  cicloFoco: CicloFoco; // 25/5, 50/10 ou desligado
}
const AJUSTES_PADRAO: Ajustes = { nome: "Dinei", metaDiaria: 20, dataProva: "", duracaoProvaMin: 0, linhaDeCorte: 70, linhasRedacaoMax: 30, cicloFoco: "25/5" };
const CHAVE_AJUSTES = "lobo-ajustes";
function lerAjustes(): Ajustes {
  try {
    return { ...AJUSTES_PADRAO, ...JSON.parse(localStorage.getItem(CHAVE_AJUSTES) ?? "{}") };
  } catch {
    return AJUSTES_PADRAO;
  }
}

interface Toast { id: number; texto: ReactNode }

interface Ctx {
  api: Api;
  painel: PainelDTO | null;
  recarregar: () => Promise<PainelDTO | null>;
  tela: Tela;
  filtro: FiltroPratica;
  ir: (t: Tela, filtro?: FiltroPratica) => void;
  ajustes: Ajustes;
  salvarAjustes: (a: Ajustes) => void;
  avisar: (texto: ReactNode) => void;
  toasts: Toast[];
  subiuNivel: { numero: number; titulo: string } | null;
  fecharNivel: () => void;
  // login (modo servidor com contas): null = modo dono único ou demo
  usuario: UsuarioDTO | null;
  ehAdmin: boolean;
  sair: () => Promise<void>;
  atualizarUsuario: (u: UsuarioDTO) => void;
}
const Contexto = createContext<Ctx | null>(null);
export const useApp = () => {
  const c = useContext(Contexto);
  if (!c) throw new Error("useApp fora do Provedor");
  return c;
};

// "#praticar?q=<id>" abre direto uma questão (link compartilhável e prints automáticos)
const telaDoHash = (): Tela => {
  const h = location.hash.replace("#", "").split("?")[0] as Tela;
  return TELAS.includes(h) ? h : "painel";
};
const filtroDoHash = (): FiltroPratica => {
  const q = new URLSearchParams(location.hash.split("?")[1] ?? "").get("q");
  return q && /^[0-9a-f]{24}$/i.test(q) ? { questaoId: q } : {};
};

export function Provedor({ children }: { children: ReactNode }) {
  const [api, setApi] = useState<Api | null>(null);
  const [painel, setPainel] = useState<PainelDTO | null>(null);
  const [tela, setTela] = useState<Tela>(telaDoHash);
  const [filtro, setFiltro] = useState<FiltroPratica>(filtroDoHash);
  const [ajustes, setAjustes] = useState<Ajustes>(lerAjustes);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [subiuNivel, setSubiuNivel] = useState<Ctx["subiuNivel"]>(null);
  const anterior = useRef<PainelDTO | null>(null);
  const seqToast = useRef(0);

  const avisar = useCallback((texto: ReactNode) => {
    const id = ++seqToast.current;
    setToasts((t) => [...t, { id, texto }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  // login: "verificando" até saber se o servidor pede conta; "pedir" mostra a tela Entrar
  const [usuario, setUsuario] = useState<UsuarioDTO | null>(null);
  const [login, setLogin] = useState<"verificando" | "livre" | "pedir" | "dentro">("verificando");

  useEffect(() => {
    servidorDisponivel().then(async (ok) => {
      if (!ok) {
        setLogin("livre");
        return setApi(apiDemo);
      }
      try {
        const eu = await conta.eu();
        setUsuario(eu.usuario);
        setLogin(!eu.login ? "livre" : eu.usuario ? "dentro" : "pedir");
      } catch {
        setLogin("livre");
      }
      setApi(apiHttp);
    });
  }, []);

  // sessão que acabou no meio do uso: pede login e, depois, continua na mesma tela
  useEffect(() => {
    const f = () => {
      setUsuario(null);
      setLogin("pedir");
    };
    window.addEventListener(EVENTO_SESSAO, f);
    return () => window.removeEventListener(EVENTO_SESSAO, f);
  }, []);

  const entrou = useCallback((u: UsuarioDTO) => {
    setUsuario(u);
    setLogin("dentro");
    anterior.current = null; // outro usuário: não comparar conquistas com as de quem saiu
  }, []);

  const sair = useCallback(async () => {
    await conta.sair().catch(() => undefined);
    setUsuario(null);
    setPainel(null);
    setLogin("pedir");
  }, []);

  const recarregar = useCallback(async () => {
    if (!api || login === "pedir" || login === "verificando") return null;
    const p = await api.painel();
    const antes = anterior.current;
    if (antes) {
      if (p.nivel.numero > antes.nivel.numero) setSubiuNivel({ numero: p.nivel.numero, titulo: p.nivel.titulo });
      for (const c of p.conquistas) {
        const velha = antes.conquistas.find((x) => x.id === c.id);
        if (c.obtida && velha && !velha.obtida) avisar(<>Conquista desbloqueada: <b>{c.titulo}</b></>);
      }
    }
    anterior.current = p;
    setPainel(p);
    return p;
  }, [api, avisar, login]);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  useEffect(() => {
    const f = () => {
      setTela(telaDoHash());
      const fh = filtroDoHash();
      if (fh.questaoId) setFiltro(fh);
    };
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);

  const ir = useCallback((t: Tela, f: FiltroPratica = {}) => {
    setFiltro(f);
    setTela(t);
    try {
      history.replaceState(null, "", `#${t}`);
    } catch {
      /* ambiente sem history */
    }
    window.scrollTo({ top: 0 });
  }, []);

  const salvarAjustes = useCallback((a: Ajustes) => {
    setAjustes(a);
    try {
      localStorage.setItem(CHAVE_AJUSTES, JSON.stringify(a));
    } catch {
      /* ok */
    }
  }, []);

  if (!api || login === "verificando") return <div className="carregando">Carregando…</div>;
  if (login === "pedir") return <Entrar aoEntrar={entrou} />;
  // até existir conta, o único usuário do modo servidor é o dono
  const ehAdmin = api.modo === "servidor" && (login === "livre" || usuario?.papel === "admin");
  return (
    <Contexto.Provider
      value={{
        api, painel, recarregar, tela, filtro, ir, ajustes, salvarAjustes, avisar, toasts, subiuNivel,
        fecharNivel: () => setSubiuNivel(null),
        usuario, ehAdmin, sair, atualizarUsuario: setUsuario,
      }}
    >
      {children}
    </Contexto.Provider>
  );
}
