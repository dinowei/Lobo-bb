// ============================================================
// BB Estudos — Leitura de arquivos (PDF/TXT/HTML) e fatiamento em trechos
// ============================================================
import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";

export const normalizar = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\W+/g, " ").trim();
export const hashTexto = (s: string) => createHash("sha256").update(normalizar(s)).digest("hex");

// ------------------------------------------------------------
// Arquivo → páginas de texto limpo
// ------------------------------------------------------------
export async function lerArquivo(caminho: string): Promise<{ paginas: string[]; hash: string }> {
  const buf = await readFile(caminho);
  const hash = createHash("sha256").update(buf).digest("hex");
  const ext = extname(caminho).toLowerCase();

  let paginas: string[];
  if (ext === ".pdf") {
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const { text } = await extractText(pdf, { mergePages: false });
    paginas = text;
  } else if (ext === ".txt" || ext === ".md") {
    paginas = [buf.toString("utf8")];
  } else if (ext === ".html" || ext === ".htm") {
    paginas = [htmlParaTexto(buf.toString("utf8"))];
  } else {
    throw new Error(`Formato não suportado: ${ext} (use .pdf, .txt, .md ou .html)`);
  }
  return { paginas: paginas.map(limpar), hash };
}

function limpar(s: string): string {
  return s
    .replace(/\r/g, "")
    .replace(/(\p{L})-\n(\p{Ll})/gu, "$1$2") // junta palavra quebrada por hífen no fim da linha
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function htmlParaTexto(html: string): string {
  return html
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6]|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

// PDF escaneado (imagem) quase não tem texto extraível → precisa de OCR antes
export function avisarSeEscaneado(paginas: string[], caminho: string) {
  const media = paginas.reduce((s, p) => s + p.length, 0) / Math.max(1, paginas.length);
  if (media < 150) {
    console.warn(
      `⚠ ${caminho}: só ~${Math.round(media)} caracteres por página. Parece PDF escaneado (imagem). ` +
        `Passe por um OCR (ex.: ocrmypdf) antes de ingerir, ou o resultado vai ser pobre.`
    );
  }
}

// ------------------------------------------------------------
// Fatiamento: trechos de ~1200 caracteres com sobreposição,
// respeitando artigos de lei ("Art. 5º") e frases.
// ------------------------------------------------------------
export interface Trecho {
  texto: string;
  pagina: number;
}

export function fatiar(paginas: string[], alvo = 1200, sobreposicao = 200): Trecho[] {
  // 1. unidades = linhas/parágrafos, já com quebra antes de cada artigo
  const unidades: Trecho[] = [];
  paginas.forEach((p, i) => {
    p.replace(/\s*(?=\bArt\.\s*\d)/g, "\n")
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((linha) => {
        for (const pedaco of quebrarLongo(linha, alvo)) unidades.push({ texto: pedaco, pagina: i + 1 });
      });
  });

  // 2. acumula unidades até o tamanho-alvo; começa o próximo com a "cauda" do anterior
  const trechos: Trecho[] = [];
  let atual: Trecho[] = [];
  let tam = 0;
  const emitir = () => {
    const texto = atual.map((u) => u.texto).join("\n");
    if (texto.length >= 80) trechos.push({ texto, pagina: atual[0].pagina });
  };

  for (const u of unidades) {
    if (tam > 0 && tam + u.texto.length > alvo) {
      emitir();
      const cauda: Trecho[] = [];
      let t = 0;
      for (let j = atual.length - 1; j >= 0 && t + atual[j].texto.length <= sobreposicao; j--) {
        cauda.unshift(atual[j]);
        t += atual[j].texto.length + 1;
      }
      atual = cauda;
      tam = t;
    }
    atual.push(u);
    tam += u.texto.length + 1;
  }
  if (atual.length) emitir();
  return trechos;
}

function quebrarLongo(texto: string, alvo: number): string[] {
  if (texto.length <= alvo) return [texto];
  const frases = texto.split(/(?<=[.;:!?])\s+/);
  const out: string[] = [];
  let buf = "";
  for (const f of frases) {
    if (f.length > alvo) {
      if (buf) out.push(buf), (buf = "");
      // frase gigante (tabela achatada, por ex.): corta por palavras
      let resto = f;
      while (resto.length > alvo) {
        const corte = resto.lastIndexOf(" ", alvo) > alvo / 2 ? resto.lastIndexOf(" ", alvo) : alvo;
        out.push(resto.slice(0, corte));
        resto = resto.slice(corte).trim();
      }
      buf = resto;
    } else if ((buf + " " + f).length > alvo) {
      out.push(buf);
      buf = f;
    } else {
      buf = buf ? `${buf} ${f}` : f;
    }
  }
  if (buf) out.push(buf);
  return out;
}

// ------------------------------------------------------------
// Gabarito: a verdade absoluta → NUNCA passa por IA, só leitura determinística.
// Aceita "1 A", "1-A", "01) C", "7 X" / "7 ANULADA" (anulada).
// ------------------------------------------------------------
// ------------------------------------------------------------
// Conferência LITERAL de um campo copiado pela IA contra o texto cru do PDF.
// A IA copia, mas às vezes "corrige" palavras (seus/suas, transformou/transformado).
// - igual: bate com o PDF ignorando espaços, pontuação, hifenização e caixa
// - corrigido: só havia palavras trocadas (sem dígitos): devolve o trecho DO PDF
// - suspeito: não dá para garantir (número diferente, palavras a mais/a menos)
// ------------------------------------------------------------
export type Conferencia = { texto: string; status: "igual" | "corrigido" | "suspeito"; detalhe?: string };

const chave = (s: string) => s.toLowerCase().normalize("NFC").replace(/[^\p{L}\p{N}]/gu, "");

// troca aceitável = mesma palavra com pequena diferença (seus/suas, transformado/transformou, eos/os)
function parecidas(a: string, b: string): boolean {
  const d: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let anterior = d[0];
    d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const atual = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, anterior + (a[i - 1] === b[j - 1] ? 0 : 1));
      anterior = atual;
    }
  }
  return d[b.length] <= Math.max(2, Math.floor(Math.max(a.length, b.length) / 3));
}

export class TextoPdf {
  private tokens: string[];
  private chaves: string[];
  private tudo: string;
  constructor(paginas: string[]) {
    const limpo = paginas
      .join("\n")
      .replace(/^.*(pcimarkpci|pciconcursos\.com\.br).*$/gm, " ") // cabeçalhos do site
      .replace(/^\s*(BANCO DO BRASIL|RASCUNHO|.*PROVA.*GABARITO.*)\s*$/gm, " ") // cabeçalho da página ("... - PROVA A4GABARITO 1")
      .replace(/^\s*\d{1,3}\s*$/gm, " ") // números soltos (margem, nº da questão)
      .replace(/(\p{L})-\n(\p{L})/gu, "$1$2"); // hifenização de fim de linha
    this.tokens = limpo.split(/\s+/).filter((t) => chave(t));
    this.chaves = this.tokens.map(chave);
    this.tudo = this.chaves.join("");
  }

  conferir(copia: string): Conferencia {
    if (!chave(copia)) return { texto: copia, status: "igual" };
    if (this.tudo.includes(chave(copia))) return { texto: copia, status: "igual" };
    // mesma quantidade de palavras, só algumas trocadas → acha a janela do PDF mais parecida
    const c = copia.split(/\s+/).filter((t) => chave(t));
    const ck = c.map(chave);
    let melhor = { pos: -1, difs: Infinity };
    for (let i = 0; i + ck.length <= this.chaves.length; i++) {
      if (this.chaves[i] !== ck[0] && this.chaves[i + ck.length - 1] !== ck[ck.length - 1]) continue;
      let difs = 0;
      for (let j = 0; j < ck.length && difs <= melhor.difs; j++) if (this.chaves[i + j] !== ck[j]) difs++;
      if (difs < melhor.difs) melhor = { pos: i, difs };
    }
    const limite = Math.max(1, Math.floor(ck.length * 0.1));
    if (melhor.pos < 0 || melhor.difs > limite)
      return { texto: copia, status: "suspeito", detalhe: "não encontrado no PDF" };
    const pdf = this.tokens.slice(melhor.pos, melhor.pos + ck.length);
    const trocas = ck.flatMap((k, j) => (k !== this.chaves[melhor.pos + j] ? [`"${c[j]}" → "${pdf[j]}"`] : []));
    // diferença em número (ou fórmula) não se corrige sozinha: o PDF pode ter perdido símbolos
    if (ck.some((k, j) => k !== this.chaves[melhor.pos + j] && /\d/.test(k + this.chaves[melhor.pos + j])))
      return { texto: copia, status: "suspeito", detalhe: `número diferente do PDF: ${trocas.join(", ")}` };
    if (ck.some((k, j) => k !== this.chaves[melhor.pos + j] && !parecidas(k, this.chaves[melhor.pos + j])))
      return { texto: copia, status: "suspeito", detalhe: `palavras muito diferentes do PDF: ${trocas.join(", ")}` };
    return { texto: pdf.join(" "), status: "corrigido", detalhe: trocas.join(", ") };
  }
}

// ------------------------------------------------------------
// Distribuição das questões por disciplina, lida da CAPA da prova (Cesgranrio):
// uma linha com os nomes das disciplinas e, abaixo, "1 a 10 ... 11 a 15 ...".
// Determinística: a IA não decide a disciplina de questão oficial.
// ------------------------------------------------------------
const TITULOS_DISCIPLINA: [string, string][] = [
  // do mais longo para o mais curto ("Matemática Financeira" antes de "Matemática")
  ["atualidades do mercado financeiro", "atualidades_mercado_financeiro"],
  ["probabilidade e estatistica", "probabilidade_estatistica"],
  ["conhecimentos de informatica", "informatica"],
  ["conhecimentos bancarios", "conhecimentos_bancarios"],
  ["matematica financeira", "matematica_financeira"],
  ["vendas e negociacao", "vendas_negociacao"],
  ["lingua portuguesa", "lingua_portuguesa"],
  ["lingua inglesa", "lingua_inglesa"],
  ["informatica", "informatica"],
  ["matematica", "matematica"],
];

// A página onde começa a seção da disciplina (título sozinho na linha, ex.: "LÍNGUA PORTUGUESA").
// Ignora a capa, onde os nomes aparecem na tabela de distribuição.
export function paginaDaSecao(paginas: string[], disciplina: string): number {
  const semAcento = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const titulos = TITULOS_DISCIPLINA.filter(([, id]) => id === disciplina).map(([t]) => t);
  return paginas.findIndex((p, i) => i > 0 && p.split("\n").some((l) => titulos.includes(semAcento(l).trim())));
}

export function lerDistribuicao(paginas: string[]): Map<number, string> | null {
  const semAcento = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const porNumero = new Map<number, string>();
  let nomes: string[] = [];
  for (const linha of paginas.slice(0, 2).join("\n").split("\n")) {
    const l = semAcento(linha);
    const intervalos = [...l.matchAll(/(\d{1,3})\s+a\s+(\d{1,3})/g)].map((m) => [Number(m[1]), Number(m[2])]);
    if (intervalos.length && nomes.length === intervalos.length) {
      intervalos.forEach(([ini, fim], k) => {
        for (let n = ini; n <= fim; n++) porNumero.set(n, nomes[k]);
      });
      nomes = [];
      continue;
    }
    // linha de títulos: pega os nomes na ordem em que aparecem, sem sobrepor
    const achados: { pos: number; id: string }[] = [];
    let resto = l;
    for (const [titulo, id] of TITULOS_DISCIPLINA) {
      let pos = resto.indexOf(titulo);
      while (pos >= 0) {
        achados.push({ pos, id });
        resto = resto.slice(0, pos) + " ".repeat(titulo.length) + resto.slice(pos + titulo.length);
        pos = resto.indexOf(titulo);
      }
    }
    if (achados.length >= 2) nomes = achados.sort((a, b) => a.pos - b.pos).map((a) => a.id);
  }
  // só vale se cobrir 1..N sem buraco
  const max = Math.max(0, ...porNumero.keys());
  if (!max || [...Array(max)].some((_, k) => !porNumero.has(k + 1))) return null;
  return porNumero;
}

export type RespostaGabarito = "A" | "B" | "C" | "D" | "E" | "anulada";

export function lerGabarito(texto: string): Map<number, RespostaGabarito> {
  const mapa = new Map<number, RespostaGabarito>();
  const re = /(?:^|[\s;,|])(\d{1,3})\s*[-–.:)=]?\s*(ANULADA|Anulada|anulada|[A-EX*])(?=$|[\s;,|])/gm;
  for (const m of texto.matchAll(re)) {
    const n = Number(m[1]);
    const v = m[2].toUpperCase();
    mapa.set(n, v === "X" || v === "*" || v === "ANULADA" ? "anulada" : (v as RespostaGabarito));
  }
  return mapa;
}
