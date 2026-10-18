// Markdown mínimo para os documentos do dono (títulos, parágrafos, listas, tabelas, citações,
// **negrito**, `código`, [ ] caixas). Vira elementos React: nada de HTML cru na página.
import type { ReactNode } from "react";

function inline(texto: string): ReactNode[] {
  const t = texto.replace(/\[ \]/g, "☐").replace(/\[x\]/gi, "☑");
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let i = 0;
  let k = 0;
  for (let m = re.exec(t); m; m = re.exec(t)) {
    if (m.index > i) out.push(t.slice(i, m.index));
    const s = m[0];
    out.push(s.startsWith("**") ? <b key={k++}>{s.slice(2, -2)}</b> : <code key={k++}>{s.slice(1, -1)}</code>);
    i = m.index + s.length;
  }
  if (i < t.length) out.push(t.slice(i));
  return out;
}

const ehLista = (l: string) => /^\s*([-*]|\d+\.)\s+/.test(l);
const ehBloco = (l: string) => /^(#{1,4}\s|---+\s*$|\||>)/.test(l) || ehLista(l);
const celulas = (l: string) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

export function Markdown({ texto }: { texto: string }) {
  const linhas = texto.replace(/\r/g, "").split("\n");
  const blocos: ReactNode[] = [];
  let i = 0;
  while (i < linhas.length) {
    const l = linhas[i];
    if (!l.trim()) {
      i++;
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(l);
    if (h) {
      // "#" vira h2: o h1 da página é o título da tela
      const Tag = (["h2", "h3", "h4", "h5"] as const)[h[1].length - 1];
      blocos.push(<Tag key={i}>{inline(h[2])}</Tag>);
      i++;
      continue;
    }
    if (/^---+\s*$/.test(l)) {
      blocos.push(<hr key={i} />);
      i++;
      continue;
    }
    if (l.startsWith("|")) {
      const tabela: string[] = [];
      while (i < linhas.length && linhas[i].startsWith("|")) tabela.push(linhas[i++]);
      const [cab, , ...corpo] = tabela;
      blocos.push(
        <div className="md-tabela" key={i}>
          <table>
            <thead><tr>{celulas(cab).map((c, j) => <th key={j}>{inline(c)}</th>)}</tr></thead>
            <tbody>{corpo.map((r, k) => <tr key={k}>{celulas(r).map((c, j) => <td key={j}>{inline(c)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      );
      continue;
    }
    if (l.startsWith(">")) {
      const citacao: string[] = [];
      while (i < linhas.length && linhas[i].startsWith(">")) citacao.push(linhas[i++].replace(/^>\s?/, ""));
      blocos.push(<blockquote key={i}>{citacao.filter((c) => c.trim()).map((c, k) => <p key={k}>{inline(c)}</p>)}</blockquote>);
      continue;
    }
    if (ehLista(l)) {
      const ordenada = /^\s*\d+\./.test(l);
      const itens: string[] = [];
      while (i < linhas.length && (ehLista(linhas[i]) || (/^\s{2,}\S/.test(linhas[i]) && itens.length))) {
        if (ehLista(linhas[i])) itens.push(linhas[i].replace(/^\s*([-*]|\d+\.)\s+/, ""));
        else itens[itens.length - 1] += ` ${linhas[i].trim()}`;
        i++;
      }
      const Lista = ordenada ? "ol" : "ul";
      blocos.push(<Lista key={i}>{itens.map((it, k) => <li key={k}>{inline(it)}</li>)}</Lista>);
      continue;
    }
    const paragrafo: string[] = [];
    while (i < linhas.length && linhas[i].trim() && !ehBloco(linhas[i])) paragrafo.push(linhas[i++].trim());
    blocos.push(<p key={i}>{inline(paragrafo.join(" "))}</p>);
  }
  return <div className="markdown">{blocos}</div>;
}
