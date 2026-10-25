// Tela Admin (só o dono): IA, Fila, Benchmark, Pendências, Convites e Contas numa tela só, com abas.
// O aluno nunca vê esta tela.
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type {
  AdminBenchmarkDTO,
  AdminFilaDTO,
  AdminIADTO,
  BenchmarkLinhaDTO,
  ContaDTO,
  ConviteDTO,
  ModeloIADTO,
  VozIADTO,
  PendenciaDTO,
  PropostaCorrenteDTO,
  StatusTarefa,
  TarefaDTO,
} from "../../../shared/tipos";
import { adminTelas } from "../api/admin";
import { Markdown } from "../componentes/Markdown";
import { useApp } from "../estado";
import { pct } from "../util";
import { Pose } from "../componentes/Pose";
import { BANCAS, type IdBanca } from "../../../shared/concursos";

type Aba = "ia" | "fila" | "benchmark" | "pendencias" | "concursos" | "convites" | "contas";
const ABAS: { id: Aba; rotulo: string }[] = [
  { id: "ia", rotulo: "IA" },
  { id: "fila", rotulo: "Fila" },
  { id: "benchmark", rotulo: "Benchmark" },
  { id: "pendencias", rotulo: "Pendências" },
  { id: "concursos", rotulo: "Concursos" },
  { id: "convites", rotulo: "Convites" },
  { id: "contas", rotulo: "Contas" },
];
// "#admin?aba=benchmark" abre direto numa aba (links das pendências e prints automáticos)
const abaDoHash = (): Aba => {
  const a = new URLSearchParams(location.hash.split("?")[1] ?? "").get("aba");
  return ABAS.some((x) => x.id === a) ? (a as Aba) : "ia";
};

// ---------- utilidades de exibição ----------
const seg = (ms: number) => (ms < 1000 ? `${ms} ms` : `${(ms / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} s`);
function haQuanto(iso?: string): string {
  if (!iso) return "nunca";
  const min = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  return h < 48 ? `há ${h} h` : `há ${Math.round(h / 24)} dias`;
}
const quando = (iso?: string) => (iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");

// Carrega dados de uma aba com estado de carregando / erro / pronto
function useDados<T>(carregar: () => Promise<T>) {
  const [dados, setDados] = useState<T | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const recarregar = useCallback(async () => {
    setErro(null);
    try {
      setDados(await carregar());
    } catch (e) {
      setErro((e as Error).message);
    }
  }, [carregar]);
  useEffect(() => {
    recarregar();
  }, [recarregar]);
  return { dados, erro, recarregar };
}

function Estado({ erro, carregando, tentar, children }: { erro: string | null; carregando: boolean; tentar: () => void; children: ReactNode }) {
  if (erro)
    return (
      <div className="vazio" role="alert">
        <Pose nome="pensativo" largura={70} />
        <div><b>Não deu para carregar.</b><p>{erro}</p><button className="botao-linha" onClick={tentar}>Tentar de novo</button></div>
      </div>
    );
  if (carregando) return <div className="esqueleto" style={{ height: 260 }} aria-busy="true" aria-label="Carregando" />;
  return <>{children}</>;
}

export function Admin() {
  const { api } = useApp();
  const [aba, setAba] = useState<Aba>(abaDoHash);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const f = () => location.hash.startsWith("#admin") && setAba(abaDoHash());
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);

  const escolher = (a: Aba) => {
    setAba(a);
    try {
      history.replaceState(null, "", `#admin?aba=${a}`);
    } catch {
      /* ok */
    }
  };
  // teclado nas abas: setas, Home e End (padrão WAI-ARIA)
  const teclas = (e: KeyboardEvent, i: number) => {
    const n = ABAS.length;
    const alvo = { ArrowRight: (i + 1) % n, ArrowLeft: (i - 1 + n) % n, Home: 0, End: n - 1 }[e.key];
    if (alvo === undefined) return;
    e.preventDefault();
    escolher(ABAS[alvo].id);
    refs.current[alvo]?.focus();
  };

  if (api.modo !== "servidor")
    return (
      <div className="pagina">
        <div className="vazio"><Pose nome="pensativo" largura={70} /><div><b>A tela Admin precisa do servidor.</b><p>Rode "npm run dev" na pasta do projeto.</p></div></div>
      </div>
    );

  return (
    <div className="pagina tela-institucional">
      <div className="pagina-cabeca">
        <div>
          <h1>Admin</h1>
          <p>Modelos, fila do noturno, benchmark e o que espera a sua decisão.</p>
        </div>
      </div>
      <div className="abas" role="tablist" aria-label="Seções do Admin">
        {ABAS.map((a, i) => (
          <button
            key={a.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            id={`aba-${a.id}`}
            aria-selected={aba === a.id}
            aria-controls={`painel-${a.id}`}
            tabIndex={aba === a.id ? 0 : -1}
            className="chip"
            onClick={() => escolher(a.id)}
            onKeyDown={(e) => teclas(e, i)}
          >
            {a.rotulo}
          </button>
        ))}
      </div>
      <section role="tabpanel" id={`painel-${aba}`} aria-labelledby={`aba-${aba}`} className="painel-aba">
        {aba === "ia" && <AbaIA />}
        {aba === "fila" && <AbaFila />}
        {aba === "benchmark" && <AbaBenchmark />}
        {aba === "pendencias" && <AbaPendencias irPara={escolher} />}
        {aba === "concursos" && <AbaConcursos />}
        {aba === "convites" && <AbaConvites />}
        {aba === "contas" && <AbaContas />}
      </section>
    </div>
  );
}

// ---------- Convites: gerar (7 ou 30 dias), copiar/compartilhar o link, cancelar ----------
const SITUACAO_CONVITE: Record<ConviteDTO["situacao"], string> = { valido: "Válido", usado: "Usado", expirado: "Expirado", cancelado: "Cancelado" };
const linkDoConvite = (codigo: string) => `${location.origin}/?convite=${codigo}`;
const mensagemDoConvite = (link: string) => `Bora estudar pro BB comigo no Lobo Binho? Cria sua conta por este link: ${link}`;

function AbaConvites() {
  const { avisar } = useApp();
  const { dados, erro, recarregar } = useDados(adminTelas.convites);
  const [novo, setNovo] = useState<{ link: string; expiraEm: string } | null>(null);
  const [gerando, setGerando] = useState(false);
  const gerar = async (dias: 7 | 30) => {
    setGerando(true);
    try {
      const c = await adminTelas.gerarConvite(dias);
      await recarregar(); // a lista já aparece com o convite novo junto com o link
      setNovo({ link: linkDoConvite(c.codigo), expiraEm: c.expiraEm });
    } catch (e) {
      avisar((e as Error).message);
    } finally {
      setGerando(false);
    }
  };
  const copiar = async (texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      avisar("Link copiado.");
    } catch {
      avisar("Não deu para copiar: selecione o link e copie.");
    }
  };
  // celular: folha de compartilhar do sistema; no PC (sem Web Share) copia a mensagem
  const compartilhar = async (link: string) => {
    const texto = mensagemDoConvite(link);
    if (navigator.share) {
      try {
        await navigator.share({ title: "Lobo Binho", text: texto });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }
    }
    await copiar(texto);
  };
  const cancelar = async (id: string) => {
    try {
      await adminTelas.cancelarConvite(id);
      await recarregar();
    } catch (e) {
      avisar((e as Error).message);
    }
  };
  return (
    <Estado erro={erro} carregando={!dados} tentar={recarregar}>
      <div className="admin-pilha">
        <div className="secao">
          <div className="linha-titulo"><h2>Convidar amigo</h2></div>
          <p className="suave">Cada convite cria uma conta só. Quem entra vê só o próprio progresso.</p>
          <div className="acoes">
            <button className="botao-laranja" disabled={gerando} onClick={() => gerar(7)}>Gerar convite (7 dias)</button>
            <button className="botao-linha" disabled={gerando} onClick={() => gerar(30)}>Gerar convite (30 dias)</button>
          </div>
          {novo && (
            <div className="convite-novo" role="status">
              <label htmlFor="link-convite">Link do convite (vale até {quando(novo.expiraEm)})</label>
              <input id="link-convite" readOnly value={novo.link} onFocus={(e) => e.currentTarget.select()} />
              <div className="acoes">
                <button className="botao-linha" onClick={() => copiar(novo.link)}>Copiar link</button>
                <button className="botao-linha" onClick={() => compartilhar(novo.link)}>Compartilhar</button>
              </div>
            </div>
          )}
        </div>
        <div className="secao">
          <div className="linha-titulo"><h2>Convites</h2></div>
          {dados && !dados.length ? (
            <p className="suave">Nenhum convite ainda.</p>
          ) : (
            <div className="tabela-rolavel">
              <table className="tabela">
                <thead><tr><th>Código</th><th>Criado</th><th>Expira</th><th>Situação</th><th><span className="sr-only">Ações</span></th></tr></thead>
                <tbody>
                  {dados?.map((c) => (
                    <tr key={c.id}>
                      <td className="num">{c.codigo}</td>
                      <td>{quando(c.criadoEm)}</td>
                      <td>{quando(c.expiraEm)}</td>
                      <td>{c.situacao === "usado" ? `Usado por ${c.usadoPor ?? "alguém"}` : SITUACAO_CONVITE[c.situacao]}</td>
                      <td>{c.situacao === "valido" && <button className="link" onClick={() => cancelar(c.id)}>Cancelar</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Estado>
  );
}

// ---------- Contas: nome, e-mail, último acesso e senha provisória (aparece uma vez) ----------
function AbaContas() {
  const { avisar } = useApp();
  const { dados, erro, recarregar } = useDados(adminTelas.contas);
  const [provisoria, setProvisoria] = useState<{ id: string; nome: string; senha: string } | null>(null);
  const gerar = async (c: ContaDTO) => {
    if (!window.confirm(`Gerar uma senha provisória para ${c.nome}? A senha atual deixa de valer e a pessoa sai de todos os aparelhos.`)) return;
    try {
      const r = await adminTelas.senhaProvisoria(c.id);
      setProvisoria({ id: c.id, nome: c.nome, senha: r.provisoria });
    } catch (e) {
      avisar((e as Error).message);
    }
  };
  return (
    <Estado erro={erro} carregando={!dados} tentar={recarregar}>
      <div className="secao">
        <div className="linha-titulo"><h2>Contas</h2></div>
        {provisoria && (
          <div className="convite-novo" role="alert">
            <label htmlFor="senha-provisoria">Senha provisória de {provisoria.nome} (aparece só agora: passe para a pessoa trocar em Ajustes)</label>
            <input id="senha-provisoria" readOnly value={provisoria.senha} onFocus={(e) => e.currentTarget.select()} />
            <div className="acoes"><button className="botao-linha" onClick={() => setProvisoria(null)}>Já passei, esconder</button></div>
          </div>
        )}
        <div className="tabela-rolavel">
          <table className="tabela">
            <thead><tr><th>Nome</th><th>E-mail</th><th>Último acesso</th><th><span className="sr-only">Ações</span></th></tr></thead>
            <tbody>
              {dados?.map((c) => (
                <tr key={c.id}>
                  <td>{c.nome}{c.papel === "admin" && <span className="selo" style={{ marginLeft: 6 }}>admin</span>}</td>
                  <td className="quebra">{c.email}</td>
                  <td>{haQuanto(c.ultimoAcesso)}</td>
                  <td><button className="link" onClick={() => gerar(c)} aria-label={`Nova senha: gerar senha provisória para ${c.nome}`}>Nova senha</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Estado>
  );
}

// ---------- Concursos: banca e área de cada um, sempre com motivo (fica no histórico) ----------
const ROTULO_BANCA = (id: string) => (id === "a_definir" ? "A definir (estuda no estilo da referência)" : BANCAS[id as IdBanca]?.nome ?? id);

function AbaConcursos() {
  const { avisar, recarregar: recarregarPainel } = useApp();
  const { dados, erro, recarregar } = useDados(adminTelas.concursos);
  const [edicao, setEdicao] = useState<{ concurso: string; campo: "banca" | "area"; para: string; motivo: string } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const salvar = async () => {
    if (!edicao) return;
    if (edicao.motivo.trim().length < 5) return avisar("Escreva o motivo (fica no histórico).");
    setSalvando(true);
    try {
      await adminTelas.ajustarConcurso(edicao.concurso, edicao.campo, edicao.para, edicao.motivo.trim());
      setEdicao(null);
      avisar("Concurso atualizado");
      await recarregar();
      void recarregarPainel();
    } catch (e) {
      avisar((e as Error).message);
    } finally {
      setSalvando(false);
    }
  };
  return (
    <Estado erro={erro} carregando={!dados} tentar={recarregar}>
      {dados?.concursos.map((c) => (
        <div key={c.id} className="secao" data-testid={`admin-concurso-${c.id}`}>
          <div className="linha-titulo"><h2>{c.nome}{c.cargo ? ` · ${c.cargo}` : ""}</h2></div>
          <p className="sub" style={{ marginTop: 0 }}>
            Banca: <b>{ROTULO_BANCA(c.banca)}</b>{c.aDefinir && <> · em uso: {c.nomeBanca}</>}
            {c.areas.length > 0 && <> · Área: <b>{c.areas.find((a) => a.id === c.area)?.nome ?? "a escolher"}</b></>}
          </p>
          <div className="acoes">
            <button className="botao-linha" onClick={() => setEdicao({ concurso: c.id, campo: "banca", para: c.banca, motivo: "" })}>Mudar banca</button>
            {c.areas.length > 0 && (
              <button className="botao-linha" onClick={() => setEdicao({ concurso: c.id, campo: "area", para: c.area ?? c.areas[0].id, motivo: "" })}>Mudar área</button>
            )}
          </div>
          {edicao?.concurso === c.id && (
            <div className="convite-novo">
              <label htmlFor={`para-${c.id}`}>
                {edicao.campo === "banca" ? "Nova banca" : "Nova área"}
                <select id={`para-${c.id}`} value={edicao.para} onChange={(e) => setEdicao({ ...edicao, para: e.target.value })}>
                  {edicao.campo === "banca"
                    ? ["a_definir", ...Object.keys(BANCAS)].map((b) => <option key={b} value={b}>{ROTULO_BANCA(b)}</option>)
                    : c.areas.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
                </select>
              </label>
              <label htmlFor={`motivo-${c.id}`}>
                Motivo (ex.: "edital publicado em 12/03, banca Cebraspe")
                <input id={`motivo-${c.id}`} value={edicao.motivo} maxLength={200} onChange={(e) => setEdicao({ ...edicao, motivo: e.target.value })} />
              </label>
              <div className="acoes">
                <button className="botao-laranja" disabled={salvando} onClick={salvar}>{salvando ? "Salvando…" : "Salvar"}</button>
                <button className="botao-linha" onClick={() => setEdicao(null)}>Cancelar</button>
              </div>
            </div>
          )}
        </div>
      ))}
      <div className="secao">
        <div className="linha-titulo"><h2>Histórico</h2></div>
        {!dados?.historico.length ? (
          <p className="sub">Nenhuma mudança ainda.</p>
        ) : (
          <div className="tabela-rolavel">
            <table className="tabela">
              <thead><tr><th>Quando</th><th>Concurso</th><th>Mudança</th><th>Motivo</th><th>Quem</th></tr></thead>
              <tbody>
                {dados.historico.map((h, i) => (
                  <tr key={i}>
                    <td>{quando(h.em)}</td>
                    <td>{h.concurso.toUpperCase()}</td>
                    <td>{h.campo === "banca" ? "Banca" : "Área"}: {h.campo === "banca" ? ROTULO_BANCA(h.de) : h.de} → {h.campo === "banca" ? ROTULO_BANCA(h.para) : h.para}</td>
                    <td>{h.motivo}</td>
                    <td className="quebra">{h.quem}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Estado>
  );
}

// ---------- IA ----------
const MODO: Record<AdminIADTO["modo"], string> = {
  legado: "Legado: os modelos do .env (nada aprovado ainda)",
  env: "Corrente do .env (CORRENTE_ATIVA=1)",
  aprovada: "Corrente aprovada por você",
};

function AbaIA() {
  const { dados, erro, recarregar } = useDados(adminTelas.ia);
  return (
    <Estado erro={erro} carregando={!dados} tentar={recarregar}>
      {dados && (
        <div className="admin-pilha">
          <div className="secao">
            <div className="linha-titulo">
              <h2>Corrente em uso</h2>
              <span className={`selo ${dados.modo === "legado" ? "alerta" : ""}`}>{MODO[dados.modo]}{dados.aprovadaEm ? ` em ${quando(dados.aprovadaEm)}` : ""}</span>
            </div>
            {!!dados.alertas.length && (
              <ul className="alertas" aria-label="Alertas">
                {dados.alertas.map((a) => <li key={a}>{a}</li>)}
              </ul>
            )}
            <dl className="correntes">
              {Object.entries(dados.correntes).map(([f, ids]) => (
                <div key={f}>
                  <dt>{dados.nomesFuncoes[f] ?? f}</dt>
                  <dd>
                    {ids.map((id, i) => <span key={id} className={`selo ${i === 0 ? "laranja" : ""}`} title={i === 0 ? "principal" : `reserva ${i}`}>{id.split("/")[1] ?? id}</span>)}
                    {!!dados.hoje[f]?.length && <span className="suave"> · hoje: {dados.hoje[f].map((h) => `${h.modelo.split("/")[1]} (${h.n})`).join(", ")}</span>}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="suave">Verificação semanal dos modelos: {dados.verificadoEm ? quando(dados.verificadoEm) : "ainda não rodou"} (no noturno).</p>
          </div>
          {dados.banco && <UsoDoBanco b={dados.banco} />}
          {dados.voz && <LinhaVoz v={dados.voz} />}
          <div className="grade-modelos">
            {dados.modelos.map((m) => <CartaoModelo key={m.id} m={m} />)}
          </div>
        </div>
      )}
    </Estado>
  );
}

// Espaço no Atlas grátis: barra de uso (alerta em 80%), o que mais pesa e o cache de áudio contra o teto
function UsoDoBanco({ b }: { b: NonNullable<AdminIADTO["banco"]> }) {
  return (
    <div className="secao">
      <div className="linha-titulo">
        <h2>Uso do banco</h2>
        <span className={`selo ${b.alerta ? "alerta" : ""}`}>{b.usadoMB} de {b.limiteMB} MB · {pct(b.fracao)}</span>
      </div>
      <div className="barra" role="progressbar" aria-label="Uso do banco" aria-valuenow={Math.round(b.fracao * 100)}><i style={{ width: pct(Math.min(1, b.fracao)) }} /></div>
      <dl className="metricas">
        <div><dt>Dados · índices · disco (dbStats)</dt><dd>{b.dadosMB} · {b.indicesMB} · {b.discoMB} MB</dd></div>
        <div><dt>Última referência do Atlas</dt><dd>{b.atlasReferenciaMB} MB (Data Size informado)</dd></div>
        <div><dt>Vector Search (estimativa)</dt><dd>{b.indiceVetorMB} MB · {b.chunks} chunks × {b.vetorKBPorChunk} KB ({b.dimensoesVetor} dimensões)</dd></div>
        <div><dt>Projeção de espaço</dt><dd>+{b.crescimentoKBPorChunk} KB/chunk · ~{b.novosChunksAteAlerta.toLocaleString("pt-BR")} até o alerta de 80% · ~{b.novosChunksAteLimite.toLocaleString("pt-BR")} até {b.limiteMB} MB</dd></div>
        <div><dt>Áudio da Lo</dt><dd>{b.audioMB} de {b.tetoAudioMB} MB (teto; saem os menos ouvidos)</dd></div>
        <div><dt>O que mais pesa</dt><dd>{b.colecoes.map((c) => `${c.nome} ${c.mb}`).join(" · ")} MB</dd></div>
        <div><dt>Telemetria</dt><dd>apagada sozinha em 30 dias</dd></div>
      </dl>
    </div>
  );
}

// Voz da Lo (Magpie TTS): chamadas, falhas e cache, numa linha
function LinhaVoz({ v }: { v: VozIADTO }) {
  const tipos = Object.entries(v.h24.porTipo).map(([t, n]) => `${t}: ${n}`).join(", ");
  return (
    <div className="secao">
      <div className="linha-titulo">
        <h2>Voz da Lo</h2>
        <span className={`selo ${v.configurada ? "" : "alerta"}`}>{v.configurada ? `Magpie · ${v.vozPadrao}` : "não configurada (usa a voz do navegador)"}</span>
      </div>
      <dl className="metricas">
        <div><dt>24 h</dt><dd>{v.h24.chamadas} chamadas · {v.h24.falhas} falha(s){tipos ? ` (${tipos})` : ""}</dd></div>
        <div><dt>7 dias</dt><dd>{v.d7.chamadas} chamadas · {v.d7.falhas} falha(s)</dd></div>
        <div><dt>Cache</dt><dd>{v.cache.audios} áudio(s) · {v.cache.daVozPadrao} na voz atual · {v.cache.mb} MB · {v.cache.minutos} min</dd></div>
        <div><dt>Última falha</dt><dd>{v.ultimaFalha ? haQuanto(v.ultimaFalha) : "—"}</dd></div>
      </dl>
    </div>
  );
}

const ROTULO_COR = { verde: "Respondendo", amarelo: "Instável", vermelho: "Fora", cinza: "Sem dados" } as const;
function CartaoModelo({ m }: { m: ModeloIADTO }) {
  const falhas = m.h24 ? Object.entries(m.h24.falhas).filter(([, n]) => n) : [];
  return (
    <article className="secao cartao-modelo" aria-label={m.id}>
      <header>
        <span className={`bolinha-status ${m.cor}`} aria-hidden="true" />
        <h3>{m.id}</h3>
      </header>
      <p className="suave">
        <span className="sr-only">{ROTULO_COR[m.cor]}: </span>
        {m.motivoCor} · {m.familia}
        {m.preview && " · preview"}
        {m.statusCatalogo !== "ativo" && ` · catálogo: ${m.statusCatalogo}`}
      </p>
      <dl className="metricas">
        <div><dt>24 h</dt><dd>{m.h24 ? `${m.h24.chamadas} chamadas · ${pct(m.h24.taxa)}` : "—"}</dd></div>
        <div><dt>7 dias</dt><dd>{m.d7 ? `${m.d7.chamadas} chamadas · ${pct(m.d7.taxa)}` : "—"}</dd></div>
        <div><dt>Latência (24 h)</dt><dd>{m.h24?.chamadas ? `${seg(m.h24.medianaMs)} · p95 ${seg(m.h24.p95Ms)}` : "—"}</dd></div>
        <div><dt>Última resposta</dt><dd>{haQuanto(m.ultimaResposta)}</dd></div>
      </dl>
      {(!!falhas.length || !!m.h24?.comoReserva) && (
        <p className="suave">
          {falhas.map(([t, n]) => `${t}: ${n}`).join(" · ")}
          {m.h24?.comoReserva ? `${falhas.length ? " · " : ""}atendeu ${m.h24.comoReserva}× como reserva` : ""}
        </p>
      )}
      {(m.nota || m.descontinuaEm) && <p className="nota-modelo">{m.descontinuaEm ? `Descontinua em ${m.descontinuaEm}. ` : ""}{m.nota}</p>}
    </article>
  );
}

// ---------- Fila ----------
const STATUS: Record<StatusTarefa, string> = {
  pendente: "Pendente",
  rodando: "Rodando",
  aguardando: "Aguardando nova tentativa",
  concluida: "Concluída",
  descartada: "Descartada",
  esgotada: "Parada (3 falhas do provedor)",
};
const GRUPO = { qualidade: "Qualidade", similaridade: "Repetição", infraestrutura: "Provedor" } as const;

function AbaFila() {
  const { avisar } = useApp();
  const { dados, erro, recarregar } = useDados(adminTelas.fila);
  const [filtro, setFiltro] = useState<StatusTarefa | "todas">("todas");
  const [ocupado, setOcupado] = useState<string | null>(null);
  const tentar = async (t: TarefaDTO) => {
    setOcupado(t.id);
    try {
      await adminTelas.tentarDeNovo(t.id);
      avisar("Tarefa de volta na fila");
      await recarregar();
    } catch (e) {
      avisar(`Não deu: ${(e as Error).message}`);
    } finally {
      setOcupado(null);
    }
  };
  return (
    <Estado erro={erro} carregando={!dados} tentar={recarregar}>
      {dados && (
        <div className="admin-pilha">
          <div className="secao">
            <div className="linha-titulo">
              <h2>Banco até a meta</h2>
              <span className="num">{dados.progresso.aprovadas.toLocaleString("pt-BR")} de {dados.progresso.meta.toLocaleString("pt-BR")}</span>
            </div>
            <div className="barra grossa" role="progressbar" aria-valuemin={0} aria-valuemax={dados.progresso.meta} aria-valuenow={dados.progresso.aprovadas} aria-label="Questões aprovadas até a meta">
              <i style={{ width: pct(Math.min(1, dados.progresso.aprovadas / dados.progresso.meta)) }} />
            </div>
            <p className="suave">{dados.progresso.oficiais} oficiais + {dados.progresso.geradas} geradas aprovadas.</p>
          </div>
          <RelatorioNoite noite={dados.noite} />
          <div className="secao">
            <div className="linha-titulo">
              <h2>Tarefas</h2>
              <button className="botao-linha" onClick={recarregar}>Atualizar</button>
            </div>
            <div className="filtros" role="group" aria-label="Filtrar tarefas">
              <button className="chip" aria-pressed={filtro === "todas"} onClick={() => setFiltro("todas")}>Todas</button>
              {(Object.keys(STATUS) as StatusTarefa[]).map((s) => (
                <button key={s} className="chip" aria-pressed={filtro === s} onClick={() => setFiltro(s)}>
                  {STATUS[s].split(" (")[0]} <span className="num">{dados.contagem[s]}</span>
                </button>
              ))}
            </div>
            {!dados.tarefas.length ? (
              <div className="vazio"><Pose nome="pensativo" largura={70} /><div><b>Fila vazia.</b><p>O noturno cria as tarefas: <code>npm run bb -- noturno</code>.</p></div></div>
            ) : (
              <ul className="lista-tarefas">
                {dados.tarefas.filter((t) => filtro === "todas" || t.status === filtro).map((t) => (
                  <li key={t.id}>
                    <span className={`selo status-${t.status}`}>{STATUS[t.status]}</span>
                    <div>
                      <b>{t.tipo === "gerar" ? `Gerar · ${t.assunto ?? "?"}` : t.tipo === "verificar_modelos" ? "Verificar modelos" : t.tipo}</b>
                      <p className="suave">
                        {t.motivo ? `${t.motivo}` : ""}
                        {t.tentativas ? ` · ${t.tentativas} falha(s) do provedor` : ""}
                        {t.status === "aguardando" && t.proximaEm ? ` · tenta de novo ${quando(t.proximaEm)}` : ""}
                        {` · ${haQuanto(t.atualizadaEm)}`}
                      </p>
                      {t.detalhes && <p className="detalhe">{t.detalhes}</p>}
                    </div>
                    {(t.status === "aguardando" || t.status === "esgotada") && (
                      <button className="botao-linha" disabled={ocupado === t.id} onClick={() => tentar(t)}>Tentar de novo agora</button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Estado>
  );
}

function RelatorioNoite({ noite }: { noite: AdminFilaDTO["noite"] }) {
  const max = Math.max(1, ...noite.porHora.map((h) => h.aprovadas));
  return (
    <div className="secao">
      <div className="linha-titulo">
        <h2>Esta noite</h2>
        <span className="suave">desde {quando(noite.desde)}</span>
      </div>
      <div className="numeros-noite">
        <div><b className="num">{noite.aprovadas}</b><span>aprovadas</span></div>
        <div><b className="num">{noite.tentativas}</b><span>tentativas</span></div>
        <div><b className="num">{noite.tentativas ? pct(noite.aprovadas / noite.tentativas) : "—"}</b><span>aprovação</span></div>
        <div><b>{noite.modeloQueMaisAtendeu?.split("/")[1] ?? "—"}</b><span>gerador que mais atendeu</span></div>
      </div>
      {!!noite.descartes.length && (
        <ul className="descartes">
          {noite.descartes.map((d) => <li key={d.motivo}><span className={`selo grupo-${d.grupo}`}>{GRUPO[d.grupo]}</span> {d.motivo} <span className="num">{d.n}</span></li>)}
        </ul>
      )}
      {!!noite.porHora.length && (
        <div className="por-hora" aria-label="Aprovadas por hora">
          {noite.porHora.map((h) => (
            <div key={h.hora} title={`${h.aprovadas} às ${h.hora}`}>
              <i style={{ height: `${Math.max(8, (h.aprovadas / max) * 100)}%` }} />
              <span>{h.hora}</span>
            </div>
          ))}
        </div>
      )}
      {!noite.tentativas && <p className="suave">Nenhuma geração desde as 18 h.</p>}
    </div>
  );
}

// ---------- Benchmark ----------
function AbaBenchmark() {
  const { avisar } = useApp();
  const { dados, erro, recarregar } = useDados(adminTelas.benchmark);
  const [confirmar, setConfirmar] = useState<PropostaCorrenteDTO | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [aprovouAgora, setAprovouAgora] = useState(false);

  const aprovar = async (p: PropostaCorrenteDTO) => {
    setOcupado(true);
    try {
      const r = await adminTelas.aprovarCorrentes(p.correntes);
      setConfirmar(null);
      setAprovouAgora(true);
      avisar(r.avisos.length ? `Corrente aprovada (${r.avisos.length} aviso(s))` : "Corrente aprovada");
      await recarregar();
    } catch (e) {
      avisar(`Não deu: ${(e as Error).message}`);
    } finally {
      setOcupado(false);
    }
  };
  const desfazer = async () => {
    setOcupado(true);
    try {
      await adminTelas.desfazerCorrentes();
      setAprovouAgora(false);
      avisar("Aprovação desfeita: voltou a corrente anterior");
      await recarregar();
    } catch (e) {
      avisar(`Não deu: ${(e as Error).message}`);
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Estado erro={erro} carregando={!dados} tentar={recarregar}>
      {dados && (
        <div className="admin-pilha">
          {(aprovouAgora || dados.ativa.modo === "aprovada") && (
            <div className="secao faixa-desfazer" role="status">
              <span>Em uso: corrente aprovada{dados.ativa.aprovadaEm ? ` em ${quando(dados.ativa.aprovadaEm)}` : ""}.</span>
              <button className="botao-linha" disabled={ocupado} onClick={desfazer}>Desfazer aprovação</button>
            </div>
          )}
          {dados.rodadas.map((r) => <TabelaRodada key={r.chave} titulo={r.titulo} rotulo={r.rotuloAcerto} linhas={r.linhas} empatados={r.empatados} />)}
          {!!dados.rodadas[0]?.linhas.length && <PorDisciplina linhas={dados.rodadas[0].linhas} disciplinas={dados.disciplinas} />}
          <div className="secao">
            <h2>Proposta de corrente</h2>
            {!dados.propostas.length ? (
              <p className="suave">A proposta aparece aqui quando o benchmark tiver amostra suficiente. Até lá, nada muda na produção.</p>
            ) : (
              <div className="propostas">
                {dados.propostas.map((p) => (
                  <article key={p.opcao} className="cartao-proposta">
                    <h3>Opção {p.opcao}: {p.titulo}</h3>
                    <p>{p.resumo}</p>
                    <dl className="correntes">
                      {Object.entries(p.correntes).map(([f, ids]) => (
                        <div key={f}><dt>{dados.nomesFuncoes[f] ?? f}</dt><dd>{ids.map((id, i) => <span key={id} className={`selo ${i === 0 ? "laranja" : ""}`}>{id.split("/")[1] ?? id}</span>)}</dd></div>
                      ))}
                    </dl>
                    {!!p.evidencias.length && <><h4>Evidência</h4><ul>{p.evidencias.map((e) => <li key={e}>{e}</li>)}</ul></>}
                    {!!p.riscos.length && <><h4>Riscos</h4><ul>{p.riscos.map((e) => <li key={e}>{e}</li>)}</ul></>}
                    <p className="suave"><b>Reversão:</b> {p.reversao}</p>
                    {!!p.erros.length && <ul className="alertas">{p.erros.map((e) => <li key={e}>{e}</li>)}</ul>}
                    {!!p.avisos.length && <p className="suave">Avisos: {p.avisos.join(" · ")}</p>}
                    {confirmar === p ? (
                      <div className="confirmar" role="alertdialog" aria-label="Confirmar aprovação">
                        <p><b>Trocar os modelos de produção pela opção {p.opcao}?</b> Dá para desfazer depois.</p>
                        <button className="botao-laranja" disabled={ocupado} onClick={() => aprovar(p)}>Sim, aprovar</button>
                        <button className="botao-linha" disabled={ocupado} onClick={() => setConfirmar(null)}>Cancelar</button>
                      </div>
                    ) : (
                      <button className="botao-laranja" disabled={!!p.erros.length || ocupado} onClick={() => setConfirmar(p)}>Aprovar corrente</button>
                    )}
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Estado>
  );
}

function TabelaRodada({ titulo, rotulo, linhas, empatados }: { titulo: string; rotulo: string; linhas: BenchmarkLinhaDTO[]; empatados: string[] }) {
  return (
    <div className="secao">
      <h2>{titulo}</h2>
      {!linhas.length ? (
        <p className="suave">Ainda não rodou: <code>npm run bb -- benchmark {titulo.startsWith("Auditor") ? "auditor" : titulo.includes("Juiz") ? "juiz" : "escritor"}</code>.</p>
      ) : (
        <div className="md-tabela">
          <table>
            <thead>
              <tr><th>Modelo</th><th>{rotulo}</th><th>IC 95%</th><th>Disponibilidade</th><th>Mediana</th><th>Falhas</th></tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.modelo}>
                  <td>{l.modelo}{l.preview && <span className="selo">preview</span>}</td>
                  <td className="num"><b>{pct(l.acerto)}</b> ({l.acertos}/{l.respondidas})</td>
                  <td className="num">{pct(l.ic[0])}–{pct(l.ic[1])}</td>
                  <td className="num">{pct(l.disponibilidade)} ({l.respondidas}/{l.tentativas})</td>
                  <td className="num">{l.medianaS} s</td>
                  <td>{Object.entries(l.falhas).map(([k, v]) => `${k}: ${v}`).join(", ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!!empatados.length && <p className="suave">Empate estatístico com o primeiro: {empatados.join(", ")}. Sem vencedor claro.</p>}
    </div>
  );
}

function PorDisciplina({ linhas, disciplinas }: { linhas: BenchmarkLinhaDTO[]; disciplinas: string[] }) {
  return (
    <details className="secao">
      <summary><h2 className="inline">Auditor por disciplina</h2></summary>
      <div className="md-tabela">
        <table>
          <thead><tr><th>Modelo</th>{disciplinas.map((d) => <th key={d}>{d.replace(/_/g, " ")}</th>)}</tr></thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.modelo}>
                <td>{l.modelo.split("/")[1]}</td>
                {disciplinas.map((d) => <td key={d} className="num">{l.porDisciplina[d] ? `${l.porDisciplina[d].acertos}/${l.porDisciplina[d].n}` : "—"}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

// ---------- Fontes atuais: "mudou desde a prova" só chega ao aluno com o seu OK ----------
function MudancasDeNorma() {
  const { avisar } = useApp();
  const { dados, recarregar } = useDados(adminTelas.fontesAtuais);
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  if (!dados) return null;
  const total = (s: Record<string, number>) => Object.values(s).reduce((a, b) => a + b, 0);
  const aprovar = async (ids: string[]) => {
    const r = await adminTelas.aprovarMudancas(ids);
    avisar(`${r.aprovadas} mudança(s) liberada(s) para o aluno`);
    setMarcadas(new Set());
    recarregar();
  };
  const manter = async (id: string, questao: string) => {
    const motivo = window.prompt(`Por que manter ${questao}?`, "Mudança proposta recusada pelo dono; questão mantida no treino.");
    if (!motivo?.trim()) return;
    const r = await adminTelas.manterQuestoes([id], motivo);
    avisar(`${r.mantidas} questão(ões) mantida(s) e confirmada(s)`);
    setMarcadas((s) => { const n = new Set(s); n.delete(id); return n; });
    recarregar();
  };
  return (
    <section className="secao pendencia" aria-labelledby="titulo-fontes-atuais">
      <div className="linha-titulo">
        <h2 id="titulo-fontes-atuais">Fontes atuais das questões</h2>
        {dados.mudancas.length > 0 && <span className="selo laranja">{dados.mudancas.length} esperando seu OK</span>}
      </div>
      <p className="suave" style={{ marginTop: 0 }}>
        {Object.entries(dados.porDisciplina).map(([d, s]) => `${d}: ${total(s)} (${Object.entries(s).map(([k, v]) => `${k} ${v}`).join(", ")})`).join(" · ") || "Nenhuma questão conferida ainda (npm run bb -- fontes-atuais migrar)."}
      </p>
      {dados.mudancas.length > 0 && (
        <>
          <ul className="lista-mudancas">
            {dados.mudancas.map((m) => (
              <li key={m.id}>
                <label>
                  <input type="checkbox" checked={marcadas.has(m.id)} onChange={(e) => setMarcadas((s) => { const n = new Set(s); if (e.target.checked) n.add(m.id); else n.delete(m.id); return n; })} />
                  <span>
                    <b>{m.questao}</b> · {m.fonte}{m.respostaMudaria && <span className="selo alerta" style={{ marginLeft: 6 }}>resposta mudaria → sai do treino</span>}
                    <br />Na época: {m.antes}<br />Hoje: {m.hoje}
                  </span>
                </label>
                <button className="botao-linha" aria-label={`Manter questão ${m.questao}`} onClick={() => manter(m.id, m.questao)}>Manter questão</button>
              </li>
            ))}
          </ul>
          <div className="acoes">
            <button className="botao-laranja" disabled={!marcadas.size} onClick={() => aprovar([...marcadas])}>Aprovar marcadas ({marcadas.size})</button>
            <button className="botao-linha" onClick={() => aprovar(dados.mudancas.map((m) => m.id))}>Aprovar todas</button>
          </div>
        </>
      )}
      {dados.faltaIngerir.length > 0 && (
        <p className="suave" style={{ marginBottom: 0 }}>
          Normas a ingerir (tópicos com questões sem base atual): {dados.faltaIngerir.slice(0, 8).map((t) => `${t.topico} (${t.questoes})`).join(", ")}.
        </p>
      )}
    </section>
  );
}

// ---------- Pendências ----------
const ATALHOS = [
  { rotulo: "Figuras", destino: "#figuras" },
  { rotulo: "Glossário de Vendas", destino: "doc:fontes-vendas/glossario.md" },
  { rotulo: "Benchmark", destino: "#admin?aba=benchmark" },
  { rotulo: "Calibragem de similaridade", destino: "doc:CALIBRAGEM-SIMILARIDADE.md" },
];
const PRIORIDADE = { alta: "Prioridade alta", media: "Média", baixa: "Baixa" } as const;

function AbaPendencias({ irPara }: { irPara: (a: Aba) => void }) {
  const { ir } = useApp();
  const { dados, erro, recarregar } = useDados(adminTelas.pendencias);
  const [doc, setDoc] = useState<{ nome: string; markdown?: string; erro?: string } | null>(null);
  const abrir = async (destino: string) => {
    if (destino.startsWith("doc:")) {
      const nome = destino.slice(4);
      setDoc({ nome });
      try {
        setDoc({ nome, markdown: (await adminTelas.doc(nome)).markdown });
      } catch (e) {
        setDoc({ nome, erro: (e as Error).message });
      }
      return;
    }
    if (destino.startsWith("#admin")) return irPara((new URLSearchParams(destino.split("?")[1]).get("aba") ?? "ia") as Aba);
    if (destino === "#figuras") ir("figuras");
  };
  return (
    <Estado erro={erro} carregando={!dados} tentar={recarregar}>
      {dados && (
        <div className="admin-pilha">
          <nav className="filtros" aria-label="Atalhos">
            {ATALHOS.map((a) => <button key={a.destino} className="chip" onClick={() => abrir(a.destino)}>{a.rotulo}</button>)}
          </nav>
          {doc && (
            <div className="secao visor-doc" role="region" aria-label={`Documento ${doc.nome}`}>
              <div className="linha-titulo">
                <h2>{doc.nome}</h2>
                <button className="botao-linha" onClick={() => setDoc(null)}>Fechar</button>
              </div>
              {doc.erro ? <p className="suave">{doc.erro}</p> : doc.markdown === undefined ? <div className="esqueleto" style={{ height: 160 }} aria-busy="true" /> : <Markdown texto={doc.markdown} />}
            </div>
          )}
          <MudancasDeNorma />
          {!dados.length ? (
            <div className="vazio"><Pose nome="pensativo" largura={70} /><div><b>Nada esperando você.</b><p>Quando algo precisar da sua decisão, aparece aqui.</p></div></div>
          ) : (
            dados.map((p: PendenciaDTO) => (
              <article key={p.titulo} className={`secao pendencia ${p.prioridade ?? ""}`}>
                <div className="linha-titulo">
                  <h2>{p.titulo}</h2>
                  {p.prioridade && <span className={`selo ${p.prioridade === "alta" ? "laranja" : p.prioridade === "media" ? "alerta" : ""}`}>{PRIORIDADE[p.prioridade]}</span>}
                </div>
                <Markdown texto={p.markdown} />
                {!!p.links.length && (
                  <div className="acoes">
                    {p.links.map((l) => <button key={l.destino} className="botao-linha" onClick={() => abrir(l.destino)}>{l.rotulo}</button>)}
                  </div>
                )}
              </article>
            ))
          )}
        </div>
      )}
    </Estado>
  );
}
