// Espaço da Lo (grupo "Com a Lo", turquesa): a Lo é a assistente e a voz; o Binho é o professor.
// Só apresentação + dados que já existem: "Seu dia" e "Recados" vêm montados por código (shared/espacoLo.ts),
// "Ouvir no almoço" toca o tema do dia com transcrição, e a posição de cada áudio fica salva por aluno.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../estado";
import { NOME_DISCIPLINA, type Disciplina } from "../../../shared/tipos";
import { filtrarBiblioteca, pontoDeRetomada, TERMINOU, type EspacoLoDTO, type ItemAudioDTO, type PosicaoAudio } from "../../../shared/espacoLo";
import { frasesDoTexto, mudarVelocidade, ouvir, parar, pausarOuContinuar, tocar, type Progresso } from "../leitor";
import { Pose } from "../componentes/Pose";
import { IFone } from "../componentes/Icones";

const VELOCIDADES = [0.85, 1, 1.2, 1.5];
const NOME_TIPO = { ficha: "Ficha", aula: "Aula", pontos: "Pontos-chave" } as const;
const ICONE_DIA = { tema: "▦", material: "▤", revisoes: "↻", janela: "☾", alerta: "!" } as const;
const ICONE_RECADO = { selo: "★", ficha: "▤", prova: "✎", conflito: "⚖" } as const;

const pct = (n: number) => `${Math.round(n * 100)}%`;
function situacao(p: PosicaoAudio | null) {
  if (!p) return null;
  if (p.fracao >= TERMINOU) return "ouvido";
  return p.ouvido ? `ouvido · parou em ${pct(p.fracao)}` : `parou em ${pct(p.fracao)}`;
}

export function EspacoLo() {
  const { api, ajustes, salvarAjustes, ir, avisar } = useApp();
  const [dados, setDados] = useState<EspacoLoDTO | null>(null);
  const [erro, setErro] = useState(false);
  const [atual, setAtual] = useState<ItemAudioDTO | null>(null);
  const [estado, setEstado] = useState<string>("parado");
  const [prog, setProg] = useState<Progresso | null>(null);
  const [busca, setBusca] = useState("");
  const [disciplina, setDisciplina] = useState("");
  const [situ, setSitu] = useState<"todos" | "ouvidos" | "nao_ouvidos">("todos");
  const ultimoSalvo = useRef({ frase: -1, t: 0 });
  const tocandoPlaylist = useRef(false);

  const carregar = useCallback(() => {
    setErro(false);
    api.espacoLo().then(setDados).catch(() => setErro(true));
  }, [api]);
  useEffect(carregar, [carregar]);
  useEffect(() => ouvir((e) => setEstado(e.id?.startsWith("lo-") ? e.estado : "parado")), []);
  useEffect(() => () => { if (tocandoPlaylist.current) parar(); }, []);

  // a posição vai para o servidor (ou para o aparelho, no demo) a cada frase nova, a cada 5 s no MP3 e no fim
  const guardar = useCallback((item: ItemAudioDTO, p: Progresso) => {
    const agora = Date.now();
    const mudouFrase = p.frases > 0 && p.frase !== ultimoSalvo.current.frase;
    if (!(p.fracao >= 1 || mudouFrase || (p.frases === 0 && agora - ultimoSalvo.current.t > 5000))) return;
    ultimoSalvo.current = { frase: p.frase, t: agora };
    api.salvarPosicaoAudio(item.id, { fracao: p.fracao, frase: p.frase, segundos: p.segundos }).then((posicao) => {
      setDados((d) => d && ({
        ...d,
        playlist: d.playlist.map((i) => (i.id === item.id ? { ...i, posicao } : i)),
        biblioteca: d.biblioteca.some((i) => i.id === item.id) ? d.biblioteca.map((i) => (i.id === item.id ? { ...i, posicao } : i)) : [...d.biblioteca, { ...item, posicao }],
      }));
    }).catch(() => undefined);
  }, [api]);

  const tocarItem = useCallback(async (item: ItemAudioDTO, opts: { doInicio?: boolean; seguir?: boolean } = {}) => {
    if (opts.doInicio) parar(); // o mesmo id em tocar() só pausa/continua: "Repetir" precisa recomeçar
    setAtual(item);
    setProg(null);
    ultimoSalvo.current = { frase: -1, t: 0 };
    tocandoPlaylist.current = true;
    let terminou = false;
    await tocar(`lo-${item.id}`, item.texto, {
      velocidade: ajustes.velocidadeVoz, servidor: api.modo === "servidor", naHora: true, voz: ajustes.vozLo, titulo: item.titulo,
      inicio: opts.doInicio ? { frase: 0, segundos: 0 } : pontoDeRetomada(item.posicao),
      aoProgresso: (p) => { setProg(p); if (p.fracao >= 1) terminou = true; guardar(item, p); },
    });
    // terminou sozinho: a playlist segue para o próximo do tema do dia
    if (terminou && opts.seguir && dados) {
      const i = dados.playlist.findIndex((x) => x.id === item.id);
      const prox = dados.playlist[i + 1];
      if (prox) void tocarItem(prox, { seguir: true });
    }
  }, [ajustes.velocidadeVoz, ajustes.vozLo, api.modo, guardar, dados]);

  const trocarVelocidade = (v: number) => {
    salvarAjustes({ ...ajustes, velocidadeVoz: v });
    mudarVelocidade(v);
  };

  const frases = useMemo(() => (atual ? frasesDoTexto(atual.texto) : []), [atual]);
  const fraseAtual = prog ? (prog.frases ? prog.frase : Math.floor(prog.fracao * frases.length)) : (atual ? pontoDeRetomada(atual.posicao).frase : -1);
  const disciplinas = useMemo(() => [...new Set((dados?.biblioteca ?? []).map((i) => i.disciplina).filter((d): d is Disciplina => !!d))], [dados]);
  const lista = useMemo(() => filtrarBiblioteca(dados?.biblioteca ?? [], { busca, disciplina, situacao: situ }), [dados, busca, disciplina, situ]);
  const porMateria = useMemo(() => {
    const m = new Map<string, ItemAudioDTO[]>();
    for (const i of lista) m.set(i.disciplina ?? "outros", [...(m.get(i.disciplina ?? "outros") ?? []), i]);
    return [...m.entries()];
  }, [lista]);

  if (erro) return (
    <div className="pagina">
      <div className="vazio" role="alert"><Pose nome="pensativo" largura={70} /><div><strong>Não deu para carregar o Espaço da Lo</strong><div className="acoes"><button className="botao-lo" onClick={carregar}>Tentar de novo</button></div></div></div>
    </div>
  );
  if (!dados) return <div className="carregando">A Lo está separando seu dia…</div>;
  const tocando = estado === "tocando";
  const continuar = dados.playlist.find((i) => i.posicao && i.posicao.fracao > 0 && i.posicao.fracao < TERMINOU);

  return (
    <div className="pagina tela-lo">
      <div className="pagina-cabeca">
        <div>
          <h1>Espaço da Lo</h1>
          <p>Seu dia em poucas linhas, o tema do dia para ouvir e tudo o que a Lo já gravou. O Binho ensina; a Lo lembra e lê para você.</p>
        </div>
        <Pose nome="lo-acenando" largura={90} carregar="eager" className="cabeca-pose" />
      </div>

      <div className="lo-grade">
        <section className="seu-dia lo-seu-dia" aria-labelledby="titulo-seu-dia">
          <h2 id="titulo-seu-dia"><span aria-hidden="true">☀</span> Seu dia</h2>
          <div className="cartao-interno">
            <ul className="linhas-dia" data-testid="seu-dia">
              {dados.seuDia.map((l, k) => (
                <li key={k} className={`dia-${l.tipo}`}><span aria-hidden="true">{ICONE_DIA[l.tipo]}</span> {l.texto}</li>
              ))}
            </ul>
            {dados.temaDoDia && (
              <div className="acoes-plano">
                <button className="botao-lo" onClick={() => ir("tema", { subtopico: dados.temaDoDia!.subtopico })}>Ver o tema do dia</button>
                <button className="link" onClick={() => ir("revisoes")}>Ir para as revisões</button>
              </div>
            )}
          </div>
          <Pose nome="lo-narrando" largura={150} carregar="eager" alt="" />
        </section>

        <section className="secao lo-recados" aria-labelledby="titulo-recados">
          <h2 id="titulo-recados">Recados</h2>
          {dados.recados.length ? (
            <ul className="lista-recados" data-testid="recados">
              {dados.recados.map((r, k) => (
                <li key={k} className={`recado-${r.tipo}`}>
                  <span className="icone-recado" aria-hidden="true">{ICONE_RECADO[r.tipo]}</span>
                  <span>{r.texto}</span>
                  {r.subtopico && <button className="link" onClick={() => ir("tema", { subtopico: r.subtopico })}>ver</button>}
                </li>
              ))}
            </ul>
          ) : <p className="sub" style={{ margin: 0 }}>Nenhum recado novo desde a sua última visita.</p>}
        </section>
      </div>

      <section className="secao lo-almoco" aria-labelledby="titulo-almoco">
        <div className="lo-almoco-cabeca">
          <h2 id="titulo-almoco"><IFone /> Ouvir no almoço{dados.temaDoDia ? `: ${dados.temaDoDia.nome}` : ""}</h2>
          {continuar && !atual && (
            <button className="botao-lo" data-testid="continuar" onClick={() => void tocarItem(continuar, { seguir: true })}>
              Continuar de onde parei ({pct(continuar.posicao!.fracao)})
            </button>
          )}
        </div>
        {dados.playlist.length ? (
          <ol className="playlist-lo" data-testid="playlist">
            {dados.playlist.map((i) => (
              <li key={i.id} className={atual?.id === i.id ? "atual" : ""}>
                <button className="faixa-lo" onClick={() => void tocarItem(i, { seguir: true })} aria-label={`Ouvir ${i.titulo}`}>
                  <span className="selo">{NOME_TIPO[i.tipo]}</span>
                  <b>{i.titulo}</b>
                  <small>{situacao(i.posicao) ?? (i.pronto ? "áudio gravado" : "sai na hora")}</small>
                </button>
              </li>
            ))}
          </ol>
        ) : <p className="sub">{dados.temaDoDia ? "Este tema ainda não tem ficha nem aula aprovada para ouvir." : "Sem tema do dia agora."}</p>}

        {atual && (
          <div className="player-lo" data-testid="player-lo">
            <div className="player-lo-topo">
              <div>
                <strong>{atual.titulo}</strong>
                <span className="sub">{estado === "carregando" ? "a Lo está se preparando…" : prog ? pct(prog.fracao) : situacao(atual.posicao) ?? "pronto para ouvir"}</span>
              </div>
              <div className="player-lo-botoes">
                <button className="play-lo" onClick={() => (estado === "parado" ? void tocarItem(atual, { seguir: true }) : pausarOuContinuar())} aria-label={tocando ? "Pausar" : "Tocar"}>{tocando ? "⏸" : "▶"}</button>
                <button className="botao-linha" onClick={() => void tocarItem(atual, { doInicio: true })} data-testid="repetir">Repetir</button>
              </div>
            </div>
            <div className="barra-lo" aria-hidden="true"><i style={{ width: pct(prog?.fracao ?? atual.posicao?.fracao ?? 0) }} /></div>
            <div className="velocidades" role="group" aria-label="Velocidade">
              {VELOCIDADES.map((v) => (
                <button key={v} className="chip" aria-pressed={ajustes.velocidadeVoz === v} onClick={() => trocarVelocidade(v)}>{String(v).replace(".", ",")}×</button>
              ))}
            </div>
            <div className="transcricao" aria-label="Transcrição" data-testid="transcricao">
              {frases.map((f, k) => <p key={k} className={k === fraseAtual ? "lendo" : k < fraseAtual ? "lida" : ""}>{f}</p>)}
            </div>
          </div>
        )}
      </section>

      <section className="secao lo-biblioteca" aria-labelledby="titulo-biblioteca">
        <h2 id="titulo-biblioteca">Áudios da Lo</h2>
        <div className="filtros-lo">
          <input type="search" placeholder="Buscar por tema ou título" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar áudio" />
          <select value={disciplina} onChange={(e) => setDisciplina(e.target.value)} aria-label="Matéria">
            <option value="">Todas as matérias</option>
            {disciplinas.map((d) => <option key={d} value={d}>{NOME_DISCIPLINA[d]}</option>)}
          </select>
          <div className="velocidades" role="group" aria-label="Situação">
            {([["todos", "Todos"], ["nao_ouvidos", "Não ouvidos"], ["ouvidos", "Ouvidos"]] as const).map(([v, r]) => (
              <button key={v} className="chip" aria-pressed={situ === v} onClick={() => setSitu(v)}>{r}</button>
            ))}
          </div>
        </div>
        {porMateria.length ? porMateria.map(([d, itens]) => (
          <div key={d} className="grupo-audios">
            <h3>{NOME_DISCIPLINA[d as Disciplina] ?? "Outros"}</h3>
            <ul className="lista-audios" data-testid="biblioteca">
              {itens.map((i) => (
                <li key={i.id}>
                  <button className="faixa-lo" onClick={() => void tocarItem(i)} aria-label={`Ouvir ${i.titulo}`}>
                    <span className="selo">{NOME_TIPO[i.tipo]}</span>
                    <b>{i.titulo}</b>
                    <small>{i.tema}</small>
                  </button>
                  <span className={`selo-ouvido${i.posicao?.ouvido ? " sim" : ""}`}>{i.posicao?.ouvido ? "ouvido" : "não ouvido"}</span>
                </li>
              ))}
            </ul>
          </div>
        )) : <p className="sub">{dados.biblioteca.length ? "Nada com esse filtro." : "A Lo ainda não gravou nenhum áudio. Ouça o tema do dia que ele entra aqui."}</p>}
      </section>

      <section className="secao lo-voz" aria-labelledby="titulo-voz">
        <Pose nome="lo-lendo" largura={64} alt="" />
        <div>
          <h2 id="titulo-voz">Voz da Lo</h2>
          <p className="sub">A Louise é a voz padrão. A velocidade fica nos botões do player.</p>
        </div>
        <label className="filtros-lo" htmlFor="lo-voz">
          <span className="sr-only">Voz</span>
          <select id="lo-voz" value={ajustes.vozLo} onChange={(e) => { salvarAjustes({ ...ajustes, vozLo: e.target.value as typeof ajustes.vozLo, vozLoManual: true }); avisar("Voz da Lo trocada."); }}>
            <option value="Louise">Louise (padrão)</option>
            <option value="Diego">Diego</option>
            <option value="Isabela">Isabela</option>
          </select>
        </label>
      </section>
    </div>
  );
}
