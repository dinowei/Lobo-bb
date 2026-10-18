import { useState, type FormEvent } from "react";
import { useApp, type Ajustes } from "../estado";
import { zerarDemo } from "../api/demo";
import { conta, ErroCampo } from "../api/conta";
import { CampoSenha } from "./Entrar";
import { forcaSenha, NOTA_MINIMA } from "../../../shared/senha";

// Minha conta: nome, senha e sair de todos os aparelhos (só com login)
function MinhaConta() {
  const { usuario, atualizarUsuario, avisar, sair } = useApp();
  const [nome, setNome] = useState(usuario?.nome ?? "");
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [erros, setErros] = useState<{ nome?: string; atual?: string; nova?: string }>({});
  const [ocupado, setOcupado] = useState<"nome" | "senha" | "todos" | null>(null);
  const [confirmarTodos, setConfirmarTodos] = useState(false);
  if (!usuario) return null;

  const salvarNome = async (e: FormEvent) => {
    e.preventDefault();
    setOcupado("nome");
    try {
      const r = await conta.mudarNome(nome);
      atualizarUsuario({ ...usuario, nome: r.nome });
      setErros({});
      avisar("Nome atualizado");
    } catch (err) {
      setErros({ nome: (err as Error).message });
    } finally {
      setOcupado(null);
    }
  };
  const trocarSenha = async (e: FormEvent) => {
    e.preventDefault();
    if (forcaSenha(nova).nota < NOTA_MINIMA) return setErros({ nova: forcaSenha(nova).dica ?? "Senha fraca demais." });
    setOcupado("senha");
    try {
      await conta.mudarSenha(atual, nova);
      setAtual("");
      setNova("");
      setErros({});
      avisar("Senha trocada");
    } catch (err) {
      const c = err instanceof ErroCampo ? err.campo : undefined;
      setErros({ [c === "atual" ? "atual" : "nova"]: (err as Error).message });
    } finally {
      setOcupado(null);
    }
  };
  const sairDeTodos = async () => {
    setOcupado("todos");
    try {
      await conta.sairDeTodos();
    } finally {
      await sair();
    }
  };

  return (
    <div className="secao" style={{ marginTop: 16, maxWidth: 620 }}>
      <h2>Minha conta</h2>
      <p style={{ marginTop: 0, color: "var(--suave)" }}>{usuario.email}{usuario.papel === "admin" ? " · administrador" : ""}</p>
      <form className="formulario" onSubmit={salvarNome}>
        <label htmlFor="conta-nome">
          Nome
          <input id="conta-nome" autoComplete="name" value={nome} onChange={(e) => setNome(e.target.value)} aria-invalid={!!erros.nome} aria-describedby={erros.nome ? "conta-nome-msg" : undefined} />
        </label>
        {erros.nome && <span id="conta-nome-msg" className="msg-erro" role="alert">{erros.nome}</span>}
        <div><button className="botao-linha" disabled={ocupado === "nome" || nome.trim() === usuario.nome}>{ocupado === "nome" ? "Salvando…" : "Salvar nome"}</button></div>
      </form>
      <form className="formulario" onSubmit={trocarSenha} style={{ marginTop: 18 }}>
        <input type="text" name="username" autoComplete="username" value={usuario.email} readOnly hidden />
        <CampoSenha rotulo="Senha atual" id="conta-atual" valor={atual} mudar={setAtual} erro={erros.atual} nova={false} />
        <CampoSenha rotulo="Nova senha" id="conta-nova" valor={nova} mudar={setNova} erro={erros.nova} nova />
        <div><button className="botao-linha" disabled={ocupado === "senha" || !atual || !nova}>{ocupado === "senha" ? "Trocando…" : "Trocar senha"}</button></div>
      </form>
      <div className="acoes">
        <button className="botao-linha" onClick={() => sair()}>Sair</button>
        {confirmarTodos ? (
          <>
            <span>Sair de todos os aparelhos, inclusive este?</span>
            <button className="botao-laranja" disabled={ocupado === "todos"} onClick={sairDeTodos}>Sim, sair de todos</button>
            <button className="botao-linha" onClick={() => setConfirmarTodos(false)}>Cancelar</button>
          </>
        ) : (
          <button className="botao-linha" onClick={() => setConfirmarTodos(true)}>Sair de todos os aparelhos</button>
        )}
      </div>
    </div>
  );
}

export function AjustesTela() {
  const { ajustes, salvarAjustes, api, recarregar, avisar, desfazivel, ir, usuario, ehAdmin } = useApp();
  const [form, setForm] = useState(ajustes);
  const [confirmarZerar, setConfirmarZerar] = useState(false);

  return (
    <div className="pagina">
      <div className="pagina-cabeca">
        <div>
          <h1>Ajustes</h1>
          <p>Ficam salvos neste navegador.</p>
        </div>
      </div>

      <form
        className="formulario"
        onSubmit={(e) => {
          e.preventDefault();
          salvarAjustes({
            ...form,
            metaDiaria: Math.max(1, Math.min(300, form.metaDiaria || 20)),
            duracaoProvaMin: Math.max(0, Math.min(600, Math.round(form.duracaoProvaMin || 0))),
            linhaDeCorte: Math.max(1, Math.min(100, Math.round(form.linhaDeCorte || 70))),
            linhasRedacaoMax: Math.max(5, Math.min(60, Math.round(form.linhasRedacaoMax || 30))),
            horasPorDia: Math.max(0.5, Math.min(12, form.horasPorDia || 2)),
            diasSemana: form.diasSemana.length ? form.diasSemana : [1, 2, 3, 4, 5],
            // o plano começa quando a data da prova muda (para "Semana X de Y")
            inicioPlano: form.dataProva && form.dataProva !== ajustes.dataProva ? new Date().toLocaleDateString("sv-SE") : form.dataProva ? ajustes.inicioPlano || new Date().toLocaleDateString("sv-SE") : "",
          });
          avisar("Ajustes salvos");
        }}
      >
        <label htmlFor="nome">
          Como o lobo te chama
          <input id="nome" value={form.nome} maxLength={30} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
        </label>
        <label htmlFor="meta">
          Meta diária de questões
          <input id="meta" type="number" min={1} max={300} value={form.metaDiaria} onChange={(e) => setForm({ ...form, metaDiaria: Number(e.target.value) })} />
        </label>
        <label htmlFor="prova">
          Data da prova (deixe vazio enquanto o edital não sai)
          <input id="prova" type="date" value={form.dataProva} onChange={(e) => setForm({ ...form, dataProva: e.target.value })} />
        </label>
        <label htmlFor="horas">
          Horas de estudo por dia (o plano distribui esse tempo)
          <input id="horas" type="number" min={0.5} max={12} step={0.5} value={form.horasPorDia} onChange={(e) => setForm({ ...form, horasPorDia: Number(e.target.value) })} />
        </label>
        <fieldset className="dias-semana">
          <legend>Dias da semana em que você estuda</legend>
          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((nome, d) => (
            <button
              key={d}
              type="button"
              className="chip"
              aria-pressed={form.diasSemana.includes(d)}
              onClick={() => setForm({ ...form, diasSemana: form.diasSemana.includes(d) ? form.diasSemana.filter((x) => x !== d) : [...form.diasSemana, d].sort() })}
            >
              {nome}
            </button>
          ))}
        </fieldset>
        <label htmlFor="duracao">
          Duração da prova completa, em minutos (vazio = só cronômetro, sem tempo acabando)
          <input id="duracao" type="number" min={0} max={600} value={form.duracaoProvaMin || ""} onChange={(e) => setForm({ ...form, duracaoProvaMin: Number(e.target.value) })} />
        </label>
        <label htmlFor="corte">
          Linha de corte nos simulados (%)
          <input id="corte" type="number" min={1} max={100} value={form.linhaDeCorte} onChange={(e) => setForm({ ...form, linhaDeCorte: Number(e.target.value) })} />
        </label>
        <label htmlFor="linhas-redacao">
          Limite de linhas da redação (padrão 30; confira no edital)
          <input id="linhas-redacao" type="number" min={5} max={60} value={form.linhasRedacaoMax} onChange={(e) => setForm({ ...form, linhasRedacaoMax: Number(e.target.value) })} />
        </label>
        <label htmlFor="voz-binho">
          Voz do Binho (🔊)
          <select id="voz-binho" value={form.vozBinho} onChange={(e) => setForm({ ...form, vozBinho: e.target.value as Ajustes["vozBinho"] })}>
            <option value="Diego">Diego</option>
            <option value="Isabela">Isabela</option>
            <option value="Louise">Louise</option>
          </select>
        </label>
        <label htmlFor="velocidade-voz">
          Velocidade da voz
          <select id="velocidade-voz" value={form.velocidadeVoz} onChange={(e) => setForm({ ...form, velocidadeVoz: Number(e.target.value) })}>
            <option value={0.85}>Mais devagar</option>
            <option value={1}>Normal</option>
            <option value={1.2}>Mais rápida</option>
            <option value={1.5}>Bem rápida</option>
          </select>
        </label>
        <label htmlFor="ciclo-foco">
          Ciclo de foco no treino (minutos de foco/pausa)
          <select id="ciclo-foco" value={form.cicloFoco} onChange={(e) => setForm({ ...form, cicloFoco: e.target.value as Ajustes["cicloFoco"] })}>
            <option value="25/5">25 de foco, 5 de pausa</option>
            <option value="50/10">50 de foco, 10 de pausa</option>
            <option value="desligado">Desligado</option>
          </select>
        </label>
        <div><button className="botao-laranja" type="submit">Salvar</button></div>
      </form>

      <div className="secao" style={{ marginTop: 26, maxWidth: 620 }}>
        <h2>Fonte das questões</h2>
        {api.modo === "demo" ? (
          <>
            <p style={{ marginTop: 0, color: "var(--suave)" }}>
              <b style={{ color: "var(--texto)" }}>Modo demo.</b> Você está usando as questões de exemplo e o progresso fica só neste navegador.
              Com o servidor ligado (npm run dev na pasta do projeto), o site passa a usar o banco de verdade, com as provas oficiais e
              as questões novas que chegam toda noite.
            </p>
            {confirmarZerar ? (
              <div className="acoes">
                <span>Apagar todo o progresso do demo?</span>
                <button
                  className="botao-laranja"
                  onClick={() => {
                    setConfirmarZerar(false);
                    desfazivel("O progresso do demo será apagado em 5 s.", async () => {
                      zerarDemo();
                      await recarregar();
                      avisar("Progresso do demo zerado");
                    });
                  }}
                >
                  Apagar
                </button>
                <button className="botao-linha" onClick={() => setConfirmarZerar(false)}>Cancelar</button>
              </div>
            ) : (
              <button className="botao-linha" onClick={() => setConfirmarZerar(true)}>Zerar progresso do demo</button>
            )}
          </>
        ) : (
          <p style={{ margin: 0, color: "var(--suave)" }}>
            <b style={{ color: "var(--texto)" }}>Conectado ao servidor.</b> Questões, tentativas e revisões ficam salvas no seu MongoDB.
          </p>
        )}
      </div>

      {usuario && <MinhaConta />}

      {ehAdmin && (
        <div className="secao" style={{ marginTop: 16, maxWidth: 620 }}>
          <h2>Conferência</h2>
          <p style={{ marginTop: 0, color: "var(--suave)" }}>
            Figuras extraídas das provas e desenhadas pelo código esperam o seu OK antes de entrar no treino.
          </p>
          <button className="botao-linha" onClick={() => ir("figuras")}>Conferir figuras</button>
        </div>
      )}
    </div>
  );
}
