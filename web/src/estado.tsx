// Estado global: API ativa, painel, navegação, ajustes, avisos de XP e nível
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Api, Disciplina, PainelDTO } from "../../shared/tipos";
import { apiHttp, servidorDisponivel } from "./api/http";
import { conta, EVENTO_SESSAO, type UsuarioDTO } from "./api/conta";
import { Entrar } from "./telas/Entrar";
import { preferenciaVozLoSalva, type VozLo } from "../../shared/voz";
import { concursoAtivo, guardarConcurso, type IdConcursoAtivo } from "./concursoAtivo";

export type Tela = "painel" | "plano" | "praticar" | "revisoes" | "cartoes" | "simulados" | "diagnostico" | "erros" | "redacao" | "conquistas" | "ajustes" | "figuras" | "admin" | "tema";
export const TELAS: Tela[] = ["painel", "plano", "praticar", "revisoes", "cartoes", "simulados", "diagnostico", "erros", "redacao", "conquistas", "ajustes", "figuras", "admin", "tema"];
// sessão montada pela trilha ("Estudar o tema do dia") ou por "Treinar este tema":
// revisões vencidas → N novas do tema → +M mistas da matéria → resultado
export interface SessaoTema {
  subtopico: string;
  nome: string;
  disciplina: Disciplina | null;
  novas: number;
  mistas: number;
  revisoes: boolean;
  trilha: boolean; // veio da trilha: o resultado diz o que acontece amanhã
}
export interface FiltroPratica {
  topicoId?: string;
  disciplina?: Disciplina;
  questaoId?: string;
  revisao?: boolean;
  misto?: boolean; // treino misturado (8.6)
  subtopico?: string; // tela "tema" e praticar só um tema
  sessao?: SessaoTema;
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
  horasPorDia: number; // plano até a prova (8.9)
  diasSemana: number[]; // 0 = domingo … 6 = sábado
  inicioPlano: string; // quando a data da prova foi definida (Semana X de Y)
  velocidadeVoz: number; // 🔊 do Binho
  vozLo: VozLo; // a narração é da Lo (assistente do Binho)
  vozLoManual: boolean; // distingue preferência explícita do padrão herdado
  tema: "escuro" | "claro" | "sistema"; // aparência (padrão escuro, como sempre)
  fonteTitulo: "sora" | "outfit"; // fonte dos títulos em avaliação pelo dono (Inter segue no texto)
}
const AJUSTES_PADRAO: Ajustes = {
  nome: "Dinei", metaDiaria: 20, dataProva: "", duracaoProvaMin: 0, linhaDeCorte: 70, linhasRedacaoMax: 30, cicloFoco: "25/5",
  horasPorDia: 2, diasSemana: [1, 2, 3, 4, 5, 6], inicioPlano: "", velocidadeVoz: 1, vozLo: "Louise", vozLoManual: false,
  tema: "escuro", fonteTitulo: "sora",
};
const CHAVE_AJUSTES = "lobo-ajustes";
function lerAjustes(): Ajustes {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE_AJUSTES) ?? "{}") as Partial<Ajustes>;
    return { ...AJUSTES_PADRAO, ...salvo, ...preferenciaVozLoSalva(salvo.vozLo, salvo.vozLoManual) };
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
  guardarSaida: (mensagem: string | null) => void; // pede confirmação para sair (simulado, Raio-X, redação)
  ajustes: Ajustes;
  salvarAjustes: (a: Ajustes) => void;
  avisar: (texto: ReactNode) => void;
  desfazivel: (texto: string, acao: () => void | Promise<void>, ms?: number) => void;
  toasts: Toast[];
  subiuNivel: { numero: number; titulo: string } | null;
  fecharNivel: () => void;
  // login (modo servidor com contas): null = modo dono único ou demo
  usuario: UsuarioDTO | null;
  ehAdmin: boolean;
  sair: () => Promise<void>;
  atualizarUsuario: (u: UsuarioDTO) => void;
  // F5: aba BB / BACEN (o servidor recebe no cabeçalho X-Concurso; o demo lê do mesmo lugar)
  concurso: IdConcursoAtivo;
  trocarConcurso: (c: IdConcursoAtivo) => void;
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
  const p = new URLSearchParams(location.hash.split("?")[1] ?? "");
  const q = p.get("q");
  const s = p.get("tema");
  return q && /^[0-9a-f]{24}$/i.test(q) ? { questaoId: q } : s && /^[a-z0-9_]{2,40}$/.test(s) ? { subtopico: s } : {};
};

export function Provedor({ children }: { children: ReactNode }) {
  const [api, setApi] = useState<Api | null>(null);
  const [painel, setPainel] = useState<PainelDTO | null>(null);
  const [tela, setTela] = useState<Tela>(telaDoHash);
  const [filtro, setFiltro] = useState<FiltroPratica>(filtroDoHash);
  const [ajustes, setAjustes] = useState<Ajustes>(lerAjustes);
  const [concurso, setConcurso] = useState<IdConcursoAtivo>(concursoAtivo);
  // aparência: tema claro/escuro (ou o do sistema) e fonte dos títulos, como atributos no <html>
  useEffect(() => {
    const raiz = document.documentElement;
    const aplicar = () => {
      const escuro = ajustes.tema === "sistema" ? window.matchMedia("(prefers-color-scheme: dark)").matches : ajustes.tema !== "claro";
      raiz.dataset.theme = escuro ? "escuro" : "claro";
    };
    aplicar();
    raiz.dataset.fonteTitulo = ajustes.fonteTitulo;
    if (ajustes.tema !== "sistema") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", aplicar);
    return () => mq.removeEventListener("change", aplicar);
  }, [ajustes.tema, ajustes.fonteTitulo]);
  const guarda = useRef<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [subiuNivel, setSubiuNivel] = useState<Ctx["subiuNivel"]>(null);
  const anterior = useRef<PainelDTO | null>(null);
  const seqToast = useRef(0);

  const avisar = useCallback((texto: ReactNode) => {
    const id = ++seqToast.current;
    setToasts((t) => [...t, { id, texto }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  // ação destrutiva com "Desfazer" por 5 s: só executa se ninguém desfizer
  const desfazivel = useCallback((texto: string, acao: () => void | Promise<void>, ms = 5000) => {
    const id = ++seqToast.current;
    let cancelado = false;
    const tirar = () => setToasts((t) => t.filter((x) => x.id !== id));
    const desfazer = () => { cancelado = true; tirar(); };
    setToasts((t) => [...t, { id, texto: <>{texto} <button className="link desfazer" onClick={desfazer}>Desfazer</button></> }]);
    setTimeout(() => {
      tirar();
      if (!cancelado) void Promise.resolve(acao()).catch((e) => avisar(e instanceof Error ? e.message : "Não deu para concluir. Tente de novo."));
    }, ms);
  }, [avisar]);

  // login: "verificando" até saber se o servidor pede conta; "pedir" mostra a tela Entrar
  const [usuario, setUsuario] = useState<UsuarioDTO | null>(null);
  const [login, setLogin] = useState<"verificando" | "livre" | "pedir" | "dentro">("verificando");

  useEffect(() => {
    servidorDisponivel().then(async (ok) => {
      if (!ok) {
        // o demo (com as questões de exemplo) só é baixado quando não há servidor
        const { apiDemo } = await import("./api/demo");
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
      if (fh.questaoId || fh.subtopico) setFiltro(fh);
    };
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);

  const ir = useCallback((t: Tela, f: FiltroPratica = {}) => {
    // no meio de simulado, Raio-X ou redação: confirma antes de sair (o rascunho da redação fica salvo)
    if (guarda.current && !window.confirm(guarda.current)) return;
    guarda.current = null;
    setFiltro(f);
    setTela(t);
    try {
      history.replaceState(null, "", `#${t}${t === "tema" && f.subtopico ? `?tema=${f.subtopico}` : ""}`);
    } catch {
      /* ambiente sem history */
    }
    window.scrollTo({ top: 0 });
  }, []);

  const guardarSaida = useCallback((mensagem: string | null) => {
    guarda.current = mensagem;
  }, []);
  useEffect(() => {
    const f = (e: BeforeUnloadEvent) => {
      if (!guarda.current) return;
      e.preventDefault();
      e.returnValue = guarda.current;
    };
    window.addEventListener("beforeunload", f);
    return () => window.removeEventListener("beforeunload", f);
  }, []);

  const salvarAjustes = useCallback((a: Ajustes) => {
    setAjustes(a);
    try {
      localStorage.setItem(CHAVE_AJUSTES, JSON.stringify(a));
    } catch {
      /* ok */
    }
  }, []);

  // trocar de aba: guarda (o próximo pedido já vai com o novo concurso), recarrega o painel; a tela atual
  // remonta (App usa o concurso como chave) e busca de novo os dados dela
  const trocarConcurso = useCallback((c: IdConcursoAtivo) => {
    if (c === concursoAtivo()) return;
    guardarConcurso(c);
    setConcurso(c);
    void recarregar();
  }, [recarregar]);

  if (!api || login === "verificando") return <div className="carregando">Carregando…</div>;
  if (login === "pedir") return <Entrar aoEntrar={entrou} />;
  // até existir conta, o único usuário do modo servidor é o dono
  const ehAdmin = api.modo === "servidor" && (login === "livre" || usuario?.papel === "admin");
  return (
    <Contexto.Provider
      value={{
        concurso, trocarConcurso,
        api, painel, recarregar, tela, filtro, ir, guardarSaida, ajustes, salvarAjustes, avisar, desfazivel, toasts, subiuNivel,
        fecharNivel: () => setSubiuNivel(null),
        usuario, ehAdmin, sair, atualizarUsuario: setUsuario,
      }}
    >
      {children}
    </Contexto.Provider>
  );
}
