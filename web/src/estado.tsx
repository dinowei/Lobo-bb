// Estado global: API ativa, painel, navegação, ajustes, avisos de XP e nível
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Api, Disciplina, PainelDTO } from "../../shared/tipos";
import { apiDemo } from "./api/demo";
import { apiHttp, servidorDisponivel } from "./api/http";

export type Tela = "painel" | "praticar" | "revisoes" | "simulados" | "erros" | "conquistas" | "ajustes" | "figuras" | "admin";
export const TELAS: Tela[] = ["painel", "praticar", "revisoes", "simulados", "erros", "conquistas", "ajustes", "figuras", "admin"];
export interface FiltroPratica {
  topicoId?: string;
  disciplina?: Disciplina;
  questaoId?: string;
  revisao?: boolean;
}

export interface Ajustes {
  nome: string;
  metaDiaria: number;
  dataProva: string; // "" = sem data
}
const AJUSTES_PADRAO: Ajustes = { nome: "Dinei", metaDiaria: 20, dataProva: "" };
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

  useEffect(() => {
    servidorDisponivel().then((ok) => setApi(ok ? apiHttp : apiDemo));
  }, []);

  const recarregar = useCallback(async () => {
    if (!api) return null;
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
  }, [api, avisar]);

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

  if (!api) return <div className="carregando">Carregando…</div>;
  return (
    <Contexto.Provider
      value={{ api, painel, recarregar, tela, filtro, ir, ajustes, salvarAjustes, avisar, toasts, subiuNivel, fecharNivel: () => setSubiuNivel(null) }}
    >
      {children}
    </Contexto.Provider>
  );
}
