// ============================================================
// BB Estudos — Leitura de arquivos (PDF/TXT/HTML) e fatiamento em trechos
// ============================================================
import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { FormatoItem } from "../shared/concursos.js";

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

// Entidades nomeadas comuns em páginas de lei (Planalto, DOU)
const ENTIDADES: Record<string, string> = {
  aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú", Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú",
  acirc: "â", ecirc: "ê", ocirc: "ô", Acirc: "Â", Ecirc: "Ê", Ocirc: "Ô", atilde: "ã", otilde: "õ", Atilde: "Ã", Otilde: "Õ",
  agrave: "à", Agrave: "À", ccedil: "ç", Ccedil: "Ç", uuml: "ü", ordm: "º", ordf: "ª", sect: "§", deg: "°",
  ndash: "–", mdash: "—", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", hellip: "…", laquo: "«", raquo: "»",
};

export function htmlParaTexto(html: string): string {
  return html
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, " ")
    // texto riscado (Planalto: dispositivo revogado ou com redação antiga) não é norma vigente
    .replace(/<(strike|s|del)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6]|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&([A-Za-z]+);/g, (e, nome: string) => ENTIDADES[nome] ?? e);
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

// ------------------------------------------------------------
// Gabarito oficial por banca (F8), sem IA: um bloco por caderno/tipo de prova.
// - grade (Cebraspe e FGV): linha de números seguida da linha de respostas, mesma contagem; "0" é enchimento
// - pares (Cesgranrio): "1 - D 2 - C ..."
// A numeração que recomeça abre um bloco novo (arquivo com Gabarito 1, 2, 3 ou Tipo 1..4).
// Resposta fora do formato, linha de respostas faltando ou numeração com buraco: erro (prova incompleta não entra).
// ------------------------------------------------------------
export type RespostaItem = RespostaGabarito | "certo" | "errado";
export interface BlocoGabarito { titulo: string; respostas: Map<number, RespostaItem> }

const LINHA_NUMEROS = /^\d{1,3}(?:\s+\d{1,3}){4,}$/;
// par "n - X"; o traço pode faltar ("41 C", erro de digitação no PDF da BASA) quando a resposta é letra ou anulada
const PAR = /(\d{1,3})\s*(?:[-–.:)=]\s*)?(anulad[ao]|[A-EX*])(?=\s|$)/gi;
const LINHA_PARES = /^(?:\d{1,3}\s*(?:[-–.:)=]\s*)?(?:anulad[ao]|[A-EX*])(?:\s+|$))+$/i;
// título do bloco: no trecho de texto antes dele, a linha que nomeia o caderno; senão a última
const tituloDoTrecho = (trecho: string[]) => trecho.find((l) => /gabarito \d|tipo \d|prova [a-z0-9]\b|caderno/i.test(l)) ?? trecho.at(-1) ?? "";

function valorItem(token: string, formato: FormatoItem): RespostaItem | null {
  const v = token.toUpperCase();
  if (v === "X" || v === "*" || v === "ANULADA" || v === "ANULADO") return "anulada";
  if (formato === "certo_errado") return v === "C" ? "certo" : v === "E" ? "errado" : null;
  return /^[A-E]$/.test(v) ? (v as RespostaGabarito) : null;
}

function conferirBlocos(blocos: BlocoGabarito[]): BlocoGabarito[] {
  // contínuo do 1º ao último item do bloco (Cebraspe: específicos começam em 51, depois dos básicos)
  for (const b of blocos) {
    const min = Math.min(...b.respostas.keys());
    const max = Math.max(...b.respostas.keys());
    const falta = [...Array(max - min + 1)].map((_, k) => min + k).filter((n) => !b.respostas.has(n));
    if (falta.length) throw new Error(`Gabarito com buraco em "${b.titulo}": faltam ${falta.slice(0, 5).join(", ")}${falta.length > 5 ? "…" : ""}`);
  }
  return blocos;
}

export function lerGabaritoGrade(texto: string, formato: FormatoItem): BlocoGabarito[] {
  const linhas = texto.split("\n").map((l) => l.trim());
  const blocos: BlocoGabarito[] = [];
  let trecho: string[] = [];
  let ultimo = 0;
  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i];
    if (!LINHA_NUMEROS.test(l)) {
      if (l && !/^[\d\s]+$/.test(l)) trecho.push(l);
      continue;
    }
    const titulo = tituloDoTrecho(trecho);
    const nums = l.split(/\s+/).map(Number);
    if (nums.every((n) => n === 0)) {
      i++; // grade vazia de enchimento (e a linha de "0" embaixo)
      continue;
    }
    const resp = (linhas[i + 1] ?? "").split(/\s+/);
    if (resp.length !== nums.length) throw new Error(`Linha de respostas não bate com a de números (${nums[0]}–${nums.at(-1)})`);
    i++;
    for (let k = 0; k < nums.length; k++) {
      const n = nums[k];
      if (n === 0) {
        if (resp[k] !== "0") throw new Error(`Resposta "${resp[k]}" sem número de item`);
        continue;
      }
      const v = valorItem(resp[k], formato);
      if (!v) throw new Error(`Resposta "${resp[k]}" fora do formato ${formato} no item ${n}`);
      if (!blocos.length || n <= ultimo) blocos.push({ titulo, respostas: new Map() });
      blocos.at(-1)!.respostas.set(n, v);
      ultimo = n;
    }
    trecho = [];
  }
  return conferirBlocos(blocos);
}

export function lerGabaritoPares(texto: string): BlocoGabarito[] {
  const blocos: BlocoGabarito[] = [];
  let trecho: string[] = [];
  let ultimo = 0;
  // tabela em colunas (BNDES 2024): "36 - B 36 - A 36 - Anulada ...", um caderno por coluna
  let colunas: BlocoGabarito[] = [];
  let ultimoColuna = 0;
  for (const linha of texto.split("\n").map((l) => l.trim())) {
    if (!LINHA_PARES.test(linha)) {
      // começa como par mas não fecha ("3 - F", "1 7- B"): erro, para não perder o fim do gabarito calado
      if (/^\d{1,3}\s*[-–.:)=]\s*\S/.test(linha)) throw new Error(`Linha do gabarito ilegível: "${linha.slice(0, 60)}"`);
      if (linha) trecho.push(linha);
      continue;
    }
    const titulo = tituloDoTrecho(trecho);
    const pares = [...linha.matchAll(PAR)];
    if (pares.length >= 2 && pares.every((m) => m[1] === pares[0][1])) {
      const n = Number(pares[0][1]);
      if (colunas.length !== pares.length || n <= ultimoColuna) {
        const nomes = trecho.find((l) => /^(?:prova \d+\s*){2,}$/i.test(l))?.match(/prova \d+/gi) ?? [];
        colunas = pares.map((_, k) => ({ titulo: nomes[k] ?? `coluna ${k + 1}`, respostas: new Map() }));
        blocos.push(...colunas);
      }
      pares.forEach((m, k) => {
        const v = valorItem(m[2], "multipla");
        if (!v) throw new Error(`Resposta "${m[2]}" fora do formato no item ${n}`);
        colunas[k].respostas.set(n, v);
      });
      ultimoColuna = n;
      trecho = [];
      continue;
    }
    for (const m of pares) {
      const n = Number(m[1]);
      const v = valorItem(m[2], "multipla");
      if (!v) throw new Error(`Resposta "${m[2]}" fora do formato no item ${n}`);
      if (!blocos.length || n <= ultimo) blocos.push({ titulo, respostas: new Map() });
      blocos.at(-1)!.respostas.set(n, v);
      ultimo = n;
    }
    trecho = [];
  }
  return conferirBlocos(blocos);
}

// formato vem da prova (a Cebraspe também faz múltipla escolha, ex.: Banrisul 2025), nunca de adivinhação
export function lerGabaritoOficial(texto: string, formato: FormatoItem): BlocoGabarito[] {
  const grade = lerGabaritoGrade(texto, formato);
  if (grade.length) return grade;
  if (formato === "certo_errado") throw new Error("Gabarito Certo/Errado sem grade de itens");
  const pares = lerGabaritoPares(texto);
  if (!pares.length) throw new Error("Nenhuma resposta reconhecida no gabarito");
  return pares;
}
