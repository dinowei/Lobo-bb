// Entrar / Criar conta (só no modo servidor com contas). Cadastro só com convite.
// Mostrar/ocultar senha, aviso de Caps Lock, força da senha, erro no campo certo, "lembrar de mim".
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { conta, ErroCampo, type UsuarioDTO } from "../api/conta";
import { forcaSenha, NOTA_MINIMA, emailValido } from "../../../shared/senha";
import { Pose } from "../componentes/Pose";

type Modo = "entrar" | "cadastrar";
type Erros = Partial<Record<"nome" | "email" | "senha" | "convite" | "geral", string>>;

export function Entrar({ aoEntrar }: { aoEntrar: (u: UsuarioDTO) => void }) {
  const [modo, setModo] = useState<Modo>(() => (new URLSearchParams(location.search).get("convite") ? "cadastrar" : "entrar"));
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [convite, setConvite] = useState(() => new URLSearchParams(location.search).get("convite") ?? "");
  const [lembrar, setLembrar] = useState(true);
  const [erros, setErros] = useState<Erros>({});
  const [enviando, setEnviando] = useState(false);
  const [estadoConvite, setEstadoConvite] = useState<{ valido: boolean; motivo?: string } | "conferindo" | null>(null);

  // convite conferido enquanto digita (espera 400 ms parado)
  useEffect(() => {
    if (modo !== "cadastrar") return;
    const limpo = convite.replace(/[^A-Za-z0-9]/g, "");
    if (limpo.length < 8) return setEstadoConvite(null);
    setEstadoConvite("conferindo");
    const t = setTimeout(() => conta.convite(convite).then(setEstadoConvite, () => setEstadoConvite(null)), 400);
    return () => clearTimeout(t);
  }, [convite, modo]);

  const trocar = (m: Modo) => {
    setModo(m);
    setErros({});
  };

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    const novos: Erros = {};
    if (modo === "cadastrar" && nome.trim().length < 2) novos.nome = "Diga como quer ser chamado.";
    if (!emailValido(email)) novos.email = email ? "Esse e-mail não parece certo." : "Digite seu e-mail.";
    if (!senha) novos.senha = "Digite a senha.";
    else if (modo === "cadastrar" && forcaSenha(senha).nota < NOTA_MINIMA) novos.senha = forcaSenha(senha).dica ?? "Senha fraca demais.";
    if (modo === "cadastrar" && estadoConvite && estadoConvite !== "conferindo" && !estadoConvite.valido) novos.convite = estadoConvite.motivo;
    if (modo === "cadastrar" && !convite.trim()) novos.convite = "Cadastro só com convite. Peça um código a quem te chamou.";
    setErros(novos);
    if (Object.keys(novos).length) return focarPrimeiroErro(novos);
    setEnviando(true);
    try {
      const u = modo === "entrar" ? await conta.entrar({ email, senha, lembrar }) : await conta.cadastrar({ nome, email, senha, convite, lembrar });
      aoEntrar(u);
    } catch (err) {
      const e2 = err instanceof ErroCampo ? err : new ErroCampo(String(err));
      const campo = (e2.campo ?? "geral") as keyof Erros;
      setErros({ [campo]: e2.message });
      focarPrimeiroErro({ [campo]: e2.message });
    } finally {
      setEnviando(false);
    }
  };

  const forca = forcaSenha(senha);
  return (
    <main className="tela-entrar">
      <div className="cartao-entrar">
        <div className="entrar-marca">
          <Pose nome="lo-e-binho" largura={120} carregar="eager" />
          <div>
            <span className="marca">lobo</span>
            <p>Estudos para o Banco do Brasil</p>
          </div>
        </div>
        <div className="abas-entrar" role="tablist" aria-label="Entrar ou criar conta">
          <button role="tab" aria-selected={modo === "entrar"} className="chip" onClick={() => trocar("entrar")}>Entrar</button>
          <button role="tab" aria-selected={modo === "cadastrar"} className="chip" onClick={() => trocar("cadastrar")}>Criar conta</button>
        </div>
        <h1>{modo === "entrar" ? "Bora estudar" : "Crie sua conta"}</h1>
        <form onSubmit={enviar} noValidate>
          {modo === "cadastrar" && (
            <Campo rotulo="Como quer ser chamado" erro={erros.nome} id="campo-nome">
              {(p) => <input {...p} id="campo-nome" name="name" autoComplete="name" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />}
            </Campo>
          )}
          <Campo rotulo="E-mail" erro={erros.email} id="campo-email">
            {(p) => (
              <input {...p} id="campo-email" type="email" name="email" autoComplete={modo === "entrar" ? "username" : "email"} inputMode="email" autoCapitalize="none" spellCheck={false}
                value={email} onChange={(e) => setEmail(e.target.value)} autoFocus={modo === "entrar"} />
            )}
          </Campo>
          <CampoSenha valor={senha} mudar={setSenha} erro={erros.senha} nova={modo === "cadastrar"} />
          {modo === "cadastrar" && senha && (
            <div className={`forca nota-${forca.nota}`} aria-live="polite">
              <div className="barras" aria-hidden="true">{[1, 2, 3, 4].map((n) => <i key={n} className={forca.nota >= n ? "cheia" : ""} />)}</div>
              <span>{forca.rotulo}{forca.dica ? ` · ${forca.dica}` : ""}</span>
            </div>
          )}
          {modo === "cadastrar" && (
            <Campo rotulo="Código de convite" erro={erros.convite} id="campo-convite" ajuda={estadoConvite === "conferindo" ? "Conferindo…" : estadoConvite?.valido ? "✓ Convite válido" : estadoConvite?.motivo}>
              {(p) => (
                <input {...p} id="campo-convite" name="convite" autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="ABCD-EFGH"
                  value={convite} onChange={(e) => setConvite(e.target.value.toUpperCase())}
                  aria-invalid={!!erros.convite || (estadoConvite !== "conferindo" && estadoConvite?.valido === false)} />
              )}
            </Campo>
          )}
          <label className="lembrar">
            <input type="checkbox" checked={lembrar} onChange={(e) => setLembrar(e.target.checked)} />
            Lembrar de mim por 30 dias
          </label>
          {erros.geral && <p className="erro-geral" role="alert">{erros.geral}</p>}
          <button className="botao-laranja grande" type="submit" disabled={enviando} aria-busy={enviando}>
            {enviando ? (modo === "entrar" ? "Entrando…" : "Criando conta…") : modo === "entrar" ? "Entrar" : "Criar conta"}
          </button>
        </form>
        <p className="suave rodape-entrar">
          {modo === "entrar" ? "Esqueceu a senha? Peça uma provisória ao administrador." : "Sem convite? Peça um código a quem te chamou para o lobo."}
        </p>
      </div>
    </main>
  );
}

function focarPrimeiroErro(erros: Erros) {
  const ordem = ["nome", "email", "senha", "convite"] as const;
  const campo = ordem.find((c) => erros[c]);
  if (campo) setTimeout(() => document.getElementById(`campo-${campo}`)?.focus(), 0);
}

type PropsCampo = { "aria-invalid": boolean; "aria-describedby"?: string };
function Campo({ rotulo, erro, ajuda, id, children }: { rotulo: string; erro?: string; ajuda?: string; id: string; children: (p: PropsCampo) => ReactNode }) {
  const mensagem = erro ?? ajuda;
  return (
    <div className={`campo${erro ? " com-erro" : ""}`}>
      <label className="rotulo-campo" htmlFor={id}>{rotulo}</label>
      {children({ "aria-invalid": !!erro, "aria-describedby": mensagem ? `${id}-msg` : undefined })}
      {mensagem && <span id={`${id}-msg`} className={erro ? "msg-erro" : "msg-ajuda"} role={erro ? "alert" : undefined}>{mensagem}</span>}
    </div>
  );
}

function CampoSenha({ valor, mudar, erro, nova, rotulo = "Senha", id = "campo-senha" }: { valor: string; mudar: (v: string) => void; erro?: string; nova: boolean; rotulo?: string; id?: string }) {
  const [ver, setVer] = useState(false);
  const [caps, setCaps] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const tecla = (e: KeyboardEvent<HTMLInputElement>) => setCaps(e.getModifierState?.("CapsLock") ?? false);
  return (
    <div className={`campo${erro ? " com-erro" : ""}`}>
      <label className="rotulo-campo" htmlFor={id}>{rotulo}</label>
      <div className="senha-caixa">
        <input ref={ref} id={id} type={ver ? "text" : "password"} name={nova ? "new-password" : "password"} autoComplete={nova ? "new-password" : "current-password"}
          value={valor} onChange={(e) => mudar(e.target.value)} onKeyUp={tecla} onKeyDown={tecla} onBlur={() => setCaps(false)}
          aria-invalid={!!erro} aria-describedby={erro || caps ? `${id}-msg` : undefined} />
        <button type="button" className="ver-senha" onClick={() => { setVer((v) => !v); ref.current?.focus(); }} aria-pressed={ver} aria-label={ver ? "Ocultar senha" : "Mostrar senha"}>
          {ver ? "Ocultar" : "Mostrar"}
        </button>
      </div>
      {(erro || caps) && (
        <span id={`${id}-msg`} className={erro ? "msg-erro" : "msg-aviso"} role={erro ? "alert" : "status"}>
          {erro ?? "Caps Lock ligado"}{erro && caps ? " · Caps Lock ligado" : ""}
        </span>
      )}
    </div>
  );
}

export { CampoSenha };
