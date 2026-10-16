// Questão: enunciado + alternativas; depois de corrigida, mostra a explicação de cada alternativa
import type { AlternativaCorrigida, CorrecaoDTO, Letra, QuestaoDTO } from "../../../shared/tipos";
import { NOME_DISCIPLINA } from "../../../shared/tipos";
import { Figura } from "./Figura";

export function Cabecalho({ q, traicoeira }: { q: QuestaoDTO; traicoeira?: boolean }) {
  return (
    <>
      <div className="migalha">
        <span>{NOME_DISCIPLINA[q.disciplina]}</span>
        <span aria-hidden="true">/</span>
        <b>{q.assunto}</b>
      </div>
      <div className="selos">
        <span className="selo laranja">
          {q.origem === "oficial" ? `Oficial · ${q.prova ?? "prova anterior"}${q.numeroOriginal ? ` · nº ${q.numeroOriginal}` : ""}` : "Inédita · auditada por IA"}
        </span>
        <span className="selo" aria-label={`Dificuldade ${q.dificuldade} de 5`}>
          Dificuldade
          <span className="pontos">
            {[1, 2, 3, 4, 5].map((i) => (<i key={i} className={i <= q.dificuldade ? "on" : ""} />))}
          </span>
        </span>
        {traicoeira && <span className="selo alerta">Traiçoeira: a IA errou essa às cegas</span>}
        {q.notaNorma && <span className="selo atualizada">Norma atualizada</span>}
      </div>
      {q.notaNorma && (
        <div className="nota-norma" role="note">
          <span className="rotulo">Norma atualizada · essa questão saiu do treino</span>
          {q.notaNorma}
        </div>
      )}
      {q.textoBase && (
        <div className="texto-base">
          <span className="rotulo">Texto de apoio</span>
          {q.textoBase}
        </div>
      )}
      {q.figuras?.filter((f) => f.posicao === "textoBase").map((f, i) => (<Figura key={`tb${i}`} f={f} />))}
      <p className="enunciado">{q.enunciado}</p>
      {q.figuras?.filter((f) => f.posicao === "enunciado").map((f, i) => (<Figura key={`en${i}`} f={f} />))}
    </>
  );
}

export function Alternativas({
  q,
  marcada,
  onMarcar,
  correcao,
}: {
  q: QuestaoDTO;
  marcada: Letra | null;
  onMarcar?: (l: Letra) => void;
  correcao?: Pick<CorrecaoDTO, "alternativas" | "gabarito"> | null;
}) {
  const corr = new Map<Letra, AlternativaCorrigida>((correcao?.alternativas ?? []).map((a) => [a.letra, a]));
  return (
    <>
    {q.figuras?.filter((f) => f.posicao === "alternativas").map((f, i) => (<Figura key={`al${i}`} f={f} />))}
    <div className="alternativas" role={correcao ? undefined : "radiogroup"} aria-label="Alternativas">
      {q.alternativas.map((a) => {
        const c = corr.get(a.letra);
        let classe = "";
        if (correcao) classe = c?.correta ? "certa" : a.letra === marcada ? "errada" : "neutra";
        else if (a.letra === marcada) classe = "marcada";
        return (
          <button
            key={a.letra}
            className={`alt ${classe}`}
            role={correcao ? undefined : "radio"}
            aria-checked={correcao ? undefined : a.letra === marcada}
            disabled={!!correcao}
            onClick={() => onMarcar?.(a.letra)}
          >
            <span className="letra">{a.letra}</span>
            <span className="corpo">
              {a.texto}
              {c && (
                <>
                  <span className="explicacao" style={{ display: "block" }}>
                    {c.correta ? "✓ " : a.letra === marcada ? "✕ " : ""}
                    {c.explicacao}
                  </span>
                  {!c.correta && c.pegadinha && <span className="pegadinha">Pegadinha: {c.pegadinha}</span>}
                </>
              )}
            </span>
          </button>
        );
      })}
    </div>
    </>
  );
}

export function Licao({ c }: { c: CorrecaoDTO }) {
  return (
    <div className="licao">
      <h3>O conceito por trás</h3>
      <p>{c.explicacaoGeral}</p>
      {c.fontes.length > 0 && (
        <div className="fontes">Fonte: {c.fontes.map((f) => f.titulo).join(" · ")}</div>
      )}
    </div>
  );
}
