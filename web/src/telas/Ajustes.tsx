import { useState } from "react";
import { useApp } from "../estado";
import { zerarDemo } from "../api/demo";

export function AjustesTela() {
  const { ajustes, salvarAjustes, api, recarregar, avisar, ir } = useApp();
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
          salvarAjustes({ ...form, metaDiaria: Math.max(1, Math.min(300, form.metaDiaria || 20)) });
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
                  onClick={async () => {
                    zerarDemo();
                    setConfirmarZerar(false);
                    await recarregar();
                    avisar("Progresso do demo zerado");
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

      {api.modo === "servidor" && (
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
