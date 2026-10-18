// Linhas da redação contadas como na FOLHA DE PROVA (não por quebra de parágrafo): cada parágrafo
// ocupa as linhas que o texto dele enche, com quebra por palavra. Servidor e site usam a mesma conta.
// Regra das provas BB 2021 e 2023 (Cesgranrio, instruções da capa): "O texto deverá ter de 25 a 30 linhas".
// A penalidade abaixo do mínimo não está na prova: até o edital dizer, vale a mais conservadora (zero).

export const LINHAS_REDACAO = {
  minimo: 25,
  maximo: 30,
  // letra manuscrita na linha da folha da Cesgranrio: ~70 caracteres (estimativa; conferir no edital)
  caracteresPorLinha: 70,
};

type Linha = { inicio: number; fim: number }; // posições no texto original

// Quebra por palavra, parágrafo a parágrafo; palavra maior que a linha ocupa quantas linhas precisar
function linhasDoTexto(texto: string, porLinha = LINHAS_REDACAO.caracteresPorLinha): Linha[] {
  const saida: Linha[] = [];
  const paragrafo = /[^\r\n]+/g;
  for (let p = paragrafo.exec(texto); p; p = paragrafo.exec(texto)) {
    if (!p[0].trim()) continue;
    let atual: Linha | null = null;
    let usado = 0;
    const palavra = /\S+/g;
    for (let w = palavra.exec(p[0]); w; w = palavra.exec(p[0])) {
      const ini = p.index + w.index;
      const tam = w[0].length;
      if (atual && usado + 1 + tam <= porLinha) {
        atual.fim = ini + tam;
        usado += 1 + tam;
        continue;
      }
      // começa linha nova (palavra longa demais vai sendo partida)
      for (let resto = 0; resto < tam; resto += porLinha) {
        atual = { inicio: ini + resto, fim: ini + Math.min(tam, resto + porLinha) };
        saida.push(atual);
        usado = Math.min(porLinha, tam - resto);
      }
    }
  }
  return saida;
}

export const linhasDaFolha = (texto: string, porLinha?: number) => linhasDoTexto(texto, porLinha).length;

// O que a banca lê: até a última linha permitida (o resto fica fora do espaço da redação)
export function textoAteOLimite(texto: string, maximo = LINHAS_REDACAO.maximo, porLinha?: number): string {
  const ls = linhasDoTexto(texto, porLinha);
  return ls.length <= maximo ? texto : texto.slice(0, ls[maximo - 1].fim);
}

export type SituacaoLinhas = "abaixo" | "ok" | "acima";
export function situacaoDasLinhas(linhas: number): SituacaoLinhas {
  return linhas < LINHAS_REDACAO.minimo ? "abaixo" : linhas > LINHAS_REDACAO.maximo ? "acima" : "ok";
}
