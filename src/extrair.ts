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
