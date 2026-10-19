// Tela "Figuras" (só o dono, modo servidor): figura extraída × recorte da página original.
// Código extrai, você confirma: figura só vai ao treino com o seu OK.
import { useCallback, useEffect, useRef, useState } from "react";
import type { AmostraFiguraDTO, FiguraConferenciaDTO, FiguraDTO, GraficoDados, PlanilhaDados, QuestaoComFigurasDTO, RegiaoPdf, TabelaDados, TelaProgramaDados } from "../../../shared/tipos";
import { adminFiguras } from "../api/admin";
import { Figura } from "../componentes/Figura";
import { useApp } from "../estado";
import { Pose } from "../componentes/Pose";

const ROTULO_STATUS: Record<FiguraConferenciaDTO["status"], string> = {
  aguardando_conferencia: "Aguardando conferência",
  ok: "Conferida",
  fora: "Fora do treino",
};

function paraDTO(f: FiguraConferenciaDTO): FiguraDTO {
  const d: FiguraDTO = { tipo: f.tipo, posicao: f.posicao, legenda: f.legenda, imagem: f.imagem };
  if (f.tipo === "tabela" && f.dados) d.tabela = f.dados as TabelaDados;
  if (f.tipo === "planilha" && f.dados) d.planilha = f.dados as PlanilhaDados;
  if (f.tipo === "grafico" && f.dados) d.grafico = f.dados as GraficoDados;
  if (f.tipo === "tela_programa" && f.dados) d.tela = f.dados as TelaProgramaDados;
  return d;
}

type Aba = "pendentes" | "todas" | "geradas";
// "#figuras?aba=geradas&assunto=juros" abre direto nas amostras de um assunto (prints automáticos)
const paramDoHash = (nome: string) => new URLSearchParams(location.hash.split("?")[1] ?? "").get(nome);
const abaDoHash = (): Aba => (paramDoHash("aba") === "geradas" ? "geradas" : "pendentes");
const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function Figuras() {
  const { api, avisar } = useApp();
  const [lista, setLista] = useState<QuestaoComFigurasDTO[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Aba>(abaDoHash);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      setLista(await adminFiguras.listar());
    } catch (e) {
      setErro((e as Error).message);
    }
  }, []);
  useEffect(() => {
    if (api.modo === "servidor") carregar();
  }, [api.modo, carregar]);

  if (api.modo !== "servidor")
    return (
      <div className="pagina">
        <div className="vazio"><Pose nome="pensativo" largura={70} /><div><b>A conferência de figuras precisa do servidor.</b><p>Rode "npm run dev" na pasta do projeto.</p></div></div>
      </div>
    );

  const pendentes = (lista ?? []).filter((q) => q.figuras.some((f) => f.status === "aguardando_conferencia"));
  const mostradas = filtro === "pendentes" ? pendentes : lista ?? [];

  return (
    <div className="pagina">
      <div className="pagina-cabeca">
        <div>
          <h1>Figuras</h1>
          <p>Compare a figura com o recorte da prova original. Nenhuma vai ao treino sem o seu OK.</p>
        </div>
        <div className="filtros" role="group" aria-label="Filtro">
          <button className="chip" aria-pressed={filtro === "pendentes"} onClick={() => setFiltro("pendentes")}>Pendentes ({pendentes.length})</button>
          <button className="chip" aria-pressed={filtro === "todas"} onClick={() => setFiltro("todas")}>Todas ({lista?.length ?? 0})</button>
          <button className="chip" aria-pressed={filtro === "geradas"} onClick={() => setFiltro("geradas")}>Geradas (amostra)</button>
        </div>
      </div>

      {filtro === "geradas" ? <Amostras /> : <>
      {erro && (
        <div className="vazio" role="alert"><Pose nome="pensativo" largura={70} /><div><b>Não deu para carregar as figuras.</b><p>{erro}</p><button className="botao-linha" onClick={carregar}>Tentar de novo</button></div></div>
      )}
      {!lista && !erro && <div className="esqueleto" style={{ height: 220 }} aria-busy="true" aria-label="Carregando figuras" />}
      {lista && !mostradas.length && (
        <div className="vazio"><Pose nome="pensativo" largura={70} /><div><b>Nada pendente.</b><p>Todas as figuras já foram conferidas.</p></div></div>
      )}

      <div className="lista-figuras">
        {mostradas.map((q) =>
          q.figuras.map((f) => (
            <CartaoFigura key={f.id} q={q} f={f} aoMudar={async (msg) => { avisar(msg); await carregar(); }} />
          ))
        )}
      </div>
      </>}
    </div>
  );
}

// Figuras como sairiam numa questão gerada, montadas na hora pelo código (sem IA, nada salvo)
function Amostras() {
  const [itens, setItens] = useState<AmostraFiguraDTO[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const carregar = useCallback(async () => {
    setErro(null);
    setItens(null);
    try {
      setItens(await adminFiguras.amostras());
    } catch (e) {
      setErro((e as Error).message);
    }
  }, []);
  useEffect(() => {
    carregar();
  }, [carregar]);

  if (erro)
    return <div className="vazio" role="alert"><Pose nome="pensativo" largura={70} /><div><b>Não deu para montar as amostras.</b><p>{erro}</p><button className="botao-linha" onClick={carregar}>Tentar de novo</button></div></div>;
  if (!itens) return <div className="esqueleto" style={{ height: 220 }} aria-busy="true" aria-label="Montando amostras" />;
  const so = paramDoHash("assunto");
  const mostradas = so ? itens.filter((a) => semAcento(a.assunto).startsWith(semAcento(so))) : itens;
  return (
    <>
      <div className="aviso-amostra">
        <p>Figuras desenhadas pelo código como sairiam numa questão gerada: 5 por tipo, com o gabarito em letras diferentes. A IA não participa e nada é salvo.</p>
        <button className="botao-linha" onClick={carregar}>Sortear outras</button>
      </div>
      <div className="lista-figuras">
        {mostradas.map((a, k) => <CartaoAmostra key={k} a={a} n={k} />)}
      </div>
    </>
  );
}

function CartaoAmostra({ a, n }: { a: AmostraFiguraDTO; n: number }) {
  return (
    <article className="cartao-figura secao" aria-labelledby={`amostra-${n}`}>
      <header>
        <h2 id={`amostra-${n}`}>{a.assunto}</h2>
        <span className="selo">{a.tipo.replace(" (com figura)", "")}</span>
        <span className="selo">{a.figura.tipo}</span>
      </header>
      <p className="enunciado-curto">{a.pergunta.charAt(0).toUpperCase() + a.pergunta.slice(1)}</p>
      <Figura f={a.figura} />
      <ol className="amostra-alternativas" aria-label="Alternativas">
        {a.alternativas.map((alt) => (
          <li key={alt.letra} className={alt.correta ? "certa" : undefined}>
            <b>{alt.letra})</b> {alt.texto}
            {alt.correta ? <span className="selo">gabarito</span> : alt.erro ? <span className="suave"> · {alt.erro}</span> : null}
          </li>
        ))}
      </ol>
      <details>
        <summary>Resolução (feita pelo código)</summary>
        <p className="suave">{a.resolucao}</p>
      </details>
    </article>
  );
}

function CartaoFigura({ q, f, aoMudar }: { q: QuestaoComFigurasDTO; f: FiguraConferenciaDTO; aoMudar: (msg: string) => Promise<void> }) {
  const [ocupado, setOcupado] = useState(false);
  const [ajustando, setAjustando] = useState(false);
  const agir = async (fn: () => Promise<unknown>, msg: string) => {
    setOcupado(true);
    try {
      await fn();
      await aoMudar(msg);
    } catch (e) {
      await aoMudar(`Não deu: ${(e as Error).message}`);
    } finally {
      setOcupado(false);
    }
  };
  return (
    <article className="cartao-figura secao" aria-labelledby={`fig-${f.id}`}>
      <header>
        <h2 id={`fig-${f.id}`}>{q.prova ?? "Questão gerada"}{q.numero ? ` · nº ${q.numero}` : ""}</h2>
        <span className={`selo ${f.status === "ok" ? "" : f.status === "fora" ? "alerta" : "laranja"}`}>{ROTULO_STATUS[f.status]}</span>
        <span className="selo">{f.tipo} · {f.posicao}</span>
      </header>
      <p className="enunciado-curto">{q.enunciado.slice(0, 220)}{q.enunciado.length > 220 ? "…" : ""}</p>
      <div className="lado-a-lado">
        <div>
          <span className="rotulo">Como aparece no app</span>
          <Figura f={paraDTO(f)} />
        </div>
        <div>
          <span className="rotulo">Recorte da prova original</span>
          {f.recortePng ? <img className="fig-imagem" src={f.recortePng} alt="Recorte da página original da prova" /> : <p className="suave">Sem recorte.</p>}
        </div>
      </div>
      {ajustando && <AjustarRecorte q={q} f={f} onFechar={() => setAjustando(false)} onSalvar={(r) => agir(() => adminFiguras.recorte(q.questaoId, f.id, r), "Recorte ajustado: confira de novo")} />}
      <div className="acoes">
        <button className="botao-laranja" disabled={ocupado || f.status === "ok"} onClick={() => agir(() => adminFiguras.ok(q.questaoId, f.id), "Figura conferida")}>OK, está igual</button>
        {f.recorte && <button className="botao-linha" disabled={ocupado} onClick={() => setAjustando((v) => !v)}>Ajustar recorte</button>}
        <button className="botao-linha" disabled={ocupado || f.status === "fora"} onClick={() => agir(() => adminFiguras.fora(q.questaoId, f.id), "Questão fora do treino")}>Fora do treino</button>
      </div>
    </article>
  );
}

// Arraste um retângulo sobre a página para definir o novo recorte (convertido para pontos do PDF)
function AjustarRecorte({ q, f, onFechar, onSalvar }: { q: QuestaoComFigurasDTO; f: FiguraConferenciaDTO; onFechar: () => void; onSalvar: (r: Omit<RegiaoPdf, "pagina">) => void }) {
  const [ctx, setCtx] = useState<{ png: string; regiao: RegiaoPdf; atual: RegiaoPdf } | null>(null);
  const [sel, setSel] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const img = useRef<HTMLImageElement>(null);
  const arrastando = useRef(false);

  useEffect(() => {
    adminFiguras.contexto(q.questaoId, f.id).then(setCtx).catch(() => setCtx(null));
  }, [q.questaoId, f.id]);

  // seleção inicial = recorte atual
  useEffect(() => {
    if (!ctx) return;
    const { regiao: r, atual: a } = ctx;
    setSel({ x0: (a.x - r.x) / r.w, x1: (a.x + a.w - r.x) / r.w, y0: (r.y + r.h - (a.y + a.h)) / r.h, y1: (r.y + r.h - a.y) / r.h });
  }, [ctx]);

  const pos = (e: React.PointerEvent) => {
    const b = img.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - b.left) / b.width)), y: Math.min(1, Math.max(0, (e.clientY - b.top) / b.height)) };
  };

  if (!ctx) return <div className="esqueleto" style={{ height: 160 }} aria-busy="true" aria-label="Carregando página" />;
  const { regiao: r } = ctx;
  const salvar = () => {
    if (!sel) return;
    const [x0, x1] = [Math.min(sel.x0, sel.x1), Math.max(sel.x0, sel.x1)];
    const [y0, y1] = [Math.min(sel.y0, sel.y1), Math.max(sel.y0, sel.y1)];
    onSalvar({ x: r.x + x0 * r.w, w: (x1 - x0) * r.w, y: r.y + r.h - y1 * r.h, h: (y1 - y0) * r.h });
  };
  return (
    <div className="ajuste-recorte">
      <p className="suave">Arraste sobre a página para marcar a área da figura.</p>
      <div
        className="area-arraste"
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          arrastando.current = true;
          const p = pos(e);
          setSel({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
        }}
        onPointerMove={(e) => {
          if (!arrastando.current) return;
          const p = pos(e);
          setSel((s) => (s ? { ...s, x1: p.x, y1: p.y } : s));
        }}
        onPointerUp={() => (arrastando.current = false)}
      >
        <img ref={img} src={ctx.png} alt="Página da prova em volta da figura" draggable={false} />
        {sel && (
          <div
            className="selecao"
            style={{
              left: `${Math.min(sel.x0, sel.x1) * 100}%`,
              top: `${Math.min(sel.y0, sel.y1) * 100}%`,
              width: `${Math.abs(sel.x1 - sel.x0) * 100}%`,
              height: `${Math.abs(sel.y1 - sel.y0) * 100}%`,
            }}
          />
        )}
      </div>
      <div className="acoes">
        <button className="botao-laranja" onClick={salvar} disabled={!sel || Math.abs(sel.x1 - sel.x0) < 0.02 || Math.abs(sel.y1 - sel.y0) < 0.02}>Usar esse recorte</button>
        <button className="botao-linha" onClick={onFechar}>Cancelar</button>
      </div>
    </div>
  );
}
