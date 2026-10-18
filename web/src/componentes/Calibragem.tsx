// Calibragem da confiança: "quando você diz CERTEZA, acerta X%" — painel e Conquistas
import { NOME_DISCIPLINA, type CalibragemDTO, type FaixaConfianca } from "../../../shared/tipos";
import { CERTEZA_MINIMA, CHUTE_ESPERADO } from "../../../shared/aprendizado";
import { pct } from "../util";

const taxa = (f: FaixaConfianca) => (f.n ? pct(f.acertos / f.n) : "—");

// frases do geral + alertas de ilusão de domínio
export function frasesCalibragem(geral: CalibragemDTO | undefined) {
  if (!geral) return [];
  const f: string[] = [];
  if (geral.certeza.n) f.push(`Quando você diz CERTEZA, acerta ${taxa(geral.certeza)}`);
  if (geral.duvida.n) f.push(`Quando diz DÚVIDA, acerta ${taxa(geral.duvida)}`);
  if (geral.chute.n) f.push(`Seus chutes acertam ${taxa(geral.chute)} (o esperado é ~${pct(CHUTE_ESPERADO)})`);
  return f;
}
export const ilusoes = (linhas: CalibragemDTO[]) => linhas.filter((c) => c.disciplina && c.ilusao);

// Cartão compacto para a agenda do painel
export function CartaoCalibragem({ linhas }: { linhas: CalibragemDTO[] }) {
  const geral = linhas.find((c) => !c.disciplina);
  const frases = frasesCalibragem(geral);
  if (!frases.length) return null;
  return (
    <>
      <div className="grupo-dia">Sua confiança</div>
      <div className="evento cartao-motivos">
        {frases.map((f) => <span key={f} className="sub num">{f}</span>)}
        {ilusoes(linhas).map((c) => (
          <span key={c.disciplina} className="aviso-ilusao num">
            Ilusão de domínio em {NOME_DISCIPLINA[c.disciplina!]}: a certeza acerta só {taxa(c.certeza)}
          </span>
        ))}
      </div>
    </>
  );
}

// Tabela completa por disciplina (tela Conquistas)
export function TabelaCalibragem({ linhas }: { linhas: CalibragemDTO[] }) {
  const comDados = linhas.filter((c) => c.certeza.n + c.duvida.n + c.chute.n > 0);
  return (
    <div className="secao rolagem" style={{ marginTop: 18 }}>
      <h2>Calibragem da confiança</h2>
      {!comDados.length ? (
        <p style={{ margin: 0, color: "var(--suave)" }}>Responda algumas questões no treino marcando a confiança e a calibragem aparece aqui.</p>
      ) : (
        <>
          <p style={{ marginTop: 0, color: "var(--suave)", maxWidth: "70ch" }}>
            Bem calibrado é acertar pelo menos {pct(CERTEZA_MINIMA)} quando diz certeza e uns {pct(CHUTE_ESPERADO)} nos chutes. Certeza abaixo
            disso é ilusão de domínio: o conteúdo parece sabido, mas não está.
          </p>
          <table className="tabela">
            <thead>
              <tr><th>Disciplina</th><th>Certeza</th><th>Dúvida</th><th>Chute</th></tr>
            </thead>
            <tbody>
              {comDados.map((c) => (
                <tr key={c.disciplina ?? "geral"}>
                  <td>{c.disciplina ? NOME_DISCIPLINA[c.disciplina] : <b>Geral</b>}</td>
                  <td className="num" style={c.ilusao ? { color: "var(--errado)" } : undefined} title={`${c.certeza.acertos}/${c.certeza.n}`}>
                    {taxa(c.certeza)} <small style={{ color: "var(--suave)" }}>({c.certeza.n})</small>{c.ilusao ? " · ilusão" : ""}
                  </td>
                  <td className="num" title={`${c.duvida.acertos}/${c.duvida.n}`}>{taxa(c.duvida)} <small style={{ color: "var(--suave)" }}>({c.duvida.n})</small></td>
                  <td className="num" title={`${c.chute.acertos}/${c.chute.n}`}>{taxa(c.chute)} <small style={{ color: "var(--suave)" }}>({c.chute.n})</small></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
