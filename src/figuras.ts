// ============================================================
// BB Estudos — Figuras das provas oficiais (seção 5.8, Fase 2): cópia fiel, por código
// - imagem embutida no PDF → extrai o arquivo original (sem perda)
// - tabela feita de texto → reconstrói linhas/colunas pelas posições do texto
// - sempre: recorte da página em PNG, para conferência lado a lado
// Tudo entra como "aguardando_conferencia": só vai ao treino depois do OK do dono.
// ============================================================
import { readFile } from "node:fs/promises";
import { getDocumentProxy, renderPageAsImage } from "unpdf";
import { Question } from "./models.js";
import type { TabelaDados, TipoFigura, PosicaoFigura } from "../shared/tipos.js";

type Item = { str: string; x: number; y: number; w: number; h: number };
export type Regiao = { pagina: number; x: number; y: number; w: number; h: number }; // pontos do PDF, origem embaixo/esquerda

const canvas = () => import("@napi-rs/canvas");
// NFKC: o PDF pode guardar "é" como "e" + acento e ligaduras como um caractere só
const espacos = (s: string) => s.normalize("NFKC").replace(/\s+/g, " ").trim();

type Doc = Awaited<ReturnType<typeof getDocumentProxy>>;

async function itensDaPagina(doc: Doc, n: number) {
  const pagina = await doc.getPage(n);
  const { width, height } = pagina.getViewport({ scale: 1 });
  const tc = await pagina.getTextContent();
  const itens: Item[] = [];
  for (const i of tc.items) {
    if (!("str" in i) || !i.str.trim()) continue;
    itens.push({ str: i.str, x: i.transform[4], y: i.transform[5], w: i.width, h: i.height || Math.abs(i.transform[3]) });
  }
  return { pagina, itens, largura: width, altura: height };
}

// Região da figura: entre a linha que contém "antes" e a que contém "depois", na coluna da questão
export function regiaoEntre(
  itens: Item[],
  antes: string,
  depois: string,
  largura: number,
  pagina: number,
  larguraTotal = false // tabela que atravessa as duas colunas
): Regiao | null {
  // o PDF quebra uma linha em vários itens ("Na" + "célula C10…"): compara contra a linha inteira
  const colunaDe = (i: Item) => (i.x < largura / 2 ? 0 : 1);
  const linhas: Item[] = [];
  for (const i of [...itens].sort((p, q) => q.y - p.y || p.x - q.x)) {
    const l = linhas.find((x) => colunaDe(x) === colunaDe(i) && Math.abs(x.y - i.y) < 2);
    if (l) {
      l.str += ` ${i.str}`;
      l.h = Math.max(l.h, i.h);
    } else linhas.push({ ...i });
  }
  const contem = (l: Item, t: string) => espacos(l.str).includes(espacos(t));
  const a = linhas.find((l) => contem(l, antes));
  if (!a) return null;
  const coluna = colunaDe(a);
  const d = linhas.filter((l) => colunaDe(l) === coluna && l.y < a.y && contem(l, depois)).sort((p, q) => q.y - p.y)[0];
  if (!d) return null;
  const x = larguraTotal ? 28 : coluna === 0 ? 28 : largura / 2 + 4;
  const w = larguraTotal ? largura - 56 : largura / 2 - 32;
  const topo = a.y - 2; // logo abaixo da linha "antes"
  const base = d.y + d.h + 1; // logo acima da linha "depois"
  return { pagina, x, y: base, w, h: Math.max(10, topo - base) };
}

// Tabela a partir das posições do texto dentro da região: linhas por altura (y), células por x
export function tabelaDaRegiao(itens: Item[], r: Regiao): TabelaDados {
  const dentro = itens.filter((i) => i.x >= r.x - 2 && i.x <= r.x + r.w && i.y >= r.y && i.y <= r.y + r.h);
  const linhas: Item[][] = [];
  for (const i of [...dentro].sort((p, q) => q.y - p.y || p.x - q.x)) {
    const l = linhas.at(-1);
    if (l && Math.abs(l[0].y - i.y) < 3) l.push(i);
    else linhas.push([i]);
  }
  // colunas = grupos de centros horizontais (de todas as linhas): célula vazia fica em branco,
  // sem deslocar as outras (ex.: "Linha 2" começa na Coluna 2)
  const centro = (i: Item) => i.x + i.w / 2;
  const centros: number[] = [];
  for (const c of dentro.map(centro).sort((a, b) => a - b)) {
    if (centros.length && c - centros.at(-1)! < 14) centros[centros.length - 1] = (centros.at(-1)! + c) / 2;
    else centros.push(c);
  }
  const coluna = (i: Item) => centros.reduce((m, c, k) => (Math.abs(c - centro(i)) < Math.abs(centros[m] - centro(i)) ? k : m), 0);
  const celulas = linhas.map((l) => {
    const linha: string[] = Array(centros.length).fill("");
    for (const i of l) linha[coluna(i)] = espacos(`${linha[coluna(i)]} ${i.str}`);
    return linha;
  });
  const [primeira, ...resto] = celulas;
  const temCabecalho = primeira && resto.length && primeira.every((c) => !/^[\d.,R$\s%-]+$/.test(c) || !c);
  return temCabecalho ? { cabecalho: primeira, linhas: resto } : { linhas: celulas };
}

async function pngDataUrl(largura: number, altura: number, desenhar: (ctx: CanvasRenderingContext2D) => void | Promise<void>) {
  const { createCanvas } = await canvas();
  const c = createCanvas(largura, altura);
  const ctx = c.getContext("2d") as unknown as CanvasRenderingContext2D;
  await desenhar(ctx);
  return `data:image/png;base64,${c.toBuffer("image/png").toString("base64")}`;
}

// Recorte da página renderizada (escala 2) na região
export async function recortarPagina(buf: Uint8Array, r: Regiao, alturaPagina: number, escala = 2): Promise<string> {
  const png = await renderPageAsImage(buf.slice(), r.pagina, { canvasImport: canvas, scale: escala });
  const { loadImage } = await canvas();
  const img = await loadImage(Buffer.from(png));
  const sx = Math.round(r.x * escala);
  const sy = Math.round((alturaPagina - r.y - r.h) * escala);
  const sw = Math.round(r.w * escala);
  const sh = Math.round(r.h * escala);
  return pngDataUrl(sw, sh, (ctx) => ctx.drawImage(img as unknown as CanvasImageSource, sx, sy, sw, sh, 0, 0, sw, sh));
}

// Imagem embutida que cai dentro da região: devolve o arquivo original (pixels sem perda) em PNG
async function imagemEmbutida(doc: Doc, r: Regiao): Promise<string | null> {
  const pagina = await doc.getPage(r.pagina);
  const pdfjs = await import("unpdf/pdfjs");
  const OPS = (pdfjs as unknown as { OPS: Record<string, number> }).OPS;
  const ops = await pagina.getOperatorList();
  const mult = (a: number[], b: number[]) => [
    a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5],
  ];
  let ctm = [1, 0, 0, 1, 0, 0];
  const pilha: number[][] = [];
  for (let k = 0; k < ops.fnArray.length; k++) {
    const fn = ops.fnArray[k];
    const args = ops.argsArray[k] as unknown[];
    if (fn === OPS.save) pilha.push(ctm);
    else if (fn === OPS.restore) ctm = pilha.pop() ?? ctm;
    else if (fn === OPS.transform) ctm = mult(ctm, args as number[]);
    else if (fn === OPS.paintImageXObject) {
      const [x, y, w, h] = [ctm[4], ctm[5], Math.abs(ctm[0]), Math.abs(ctm[3])];
      const cx = x + w / 2;
      const cy = y + h / 2;
      if (cx < r.x || cx > r.x + r.w || cy < r.y || cy > r.y + r.h) continue; // fora da região (ex.: marca d'água)
      const id = args[0] as string;
      const obj = await new Promise<{ width: number; height: number; data: Uint8ClampedArray; kind: number }>((res) =>
        (pagina as unknown as { objs: { get: (id: string, cb: (o: unknown) => void) => void } }).objs.get(id, (o) => res(o as never))
      );
      const rgba = new Uint8ClampedArray(obj.width * obj.height * 4);
      const canais = obj.kind === 3 ? 4 : obj.kind === 2 ? 3 : 0;
      if (!canais) return null; // imagem de 1 bit: fica só o recorte
      for (let p = 0, q = 0; p < obj.width * obj.height; p++, q += canais) {
        rgba[p * 4] = obj.data[q];
        rgba[p * 4 + 1] = obj.data[q + 1];
        rgba[p * 4 + 2] = obj.data[q + 2];
        rgba[p * 4 + 3] = canais === 4 ? obj.data[q + 3] : 255;
      }
      const { ImageData } = await canvas();
      return pngDataUrl(obj.width, obj.height, (ctx) => ctx.putImageData(new ImageData(rgba, obj.width, obj.height) as unknown as globalThis.ImageData, 0, 0));
    }
  }
  return null;
}

// Arquivo PDF de uma prova (pelo nome), lido de data/figuras-oficiais.json
export async function arquivoDaProva(prova: string, caminhoConfig = "data/figuras-oficiais.json"): Promise<string | null> {
  const config = JSON.parse(await readFile(caminhoConfig, "utf8")) as { provas: { prova: string; arquivo: string }[] };
  return config.provas.find((p) => p.prova === prova)?.arquivo ?? null;
}

// Refaz o recorte de uma região (usado quando o dono ajusta o recorte na tela Figuras)
export async function recortarDeNovo(arquivo: string, r: Regiao): Promise<string> {
  const buf = new Uint8Array(await readFile(arquivo));
  const doc = await getDocumentProxy(buf.slice());
  const { height } = (await doc.getPage(r.pagina)).getViewport({ scale: 1 });
  return recortarPagina(buf, r, height);
}

type ConfigFigura = {
  numero: number;
  pagina: number;
  tipo: TipoFigura;
  posicao: PosicaoFigura;
  antes: string;
  depois: string;
  legenda?: string;
  imagem?: boolean;
  larguraTotal?: boolean;
  regiao?: { x: number; y: number; w: number; h: number }; // recorte fixo (pt), quando não há texto em volta
};

// Comando "figuras-oficiais": lê data/figuras-oficiais.json e grava as figuras nas questões
export async function extrairFigurasOficiais(caminhoConfig: string) {
  const config = JSON.parse(await readFile(caminhoConfig, "utf8")) as {
    provas: { prova: string; arquivo: string; figuras: ConfigFigura[] }[];
  };
  const fora: string[] = [];
  for (const p of config.provas) {
    const buf = new Uint8Array(await readFile(p.arquivo));
    const doc = await getDocumentProxy(buf.slice());
    const porQuestao = new Map<number, Record<string, unknown>[]>();
    for (const f of p.figuras) {
      const { itens, largura, altura } = await itensDaPagina(doc, f.pagina);
      const r = f.regiao ? { pagina: f.pagina, ...f.regiao } : regiaoEntre(itens, f.antes, f.depois, largura, f.pagina, f.larguraTotal);
      if (!r) {
        console.warn(`  ⚠ ${p.prova} nº ${f.numero}: não achei "${f.antes}" → "${f.depois}" na página ${f.pagina}`);
        continue;
      }
      const recortePng = await recortarPagina(buf, r, altura);
      const figura: Record<string, unknown> = {
        tipo: f.tipo,
        posicao: f.posicao,
        legenda: f.legenda,
        recorte: r,
        recortePng,
        origem: "pdf",
        status: "aguardando_conferencia",
      };
      if (f.imagem) figura.imagem = (await imagemEmbutida(doc, r)) ?? undefined;
      else if (f.tipo === "tabela") figura.dados = tabelaDaRegiao(itens, r);
      else figura.imagem = recortePng; // ex.: bloco "Dados" com expoentes: a figura É o recorte
      const lista = porQuestao.get(f.numero) ?? [];
      lista.push(figura);
      porQuestao.set(f.numero, lista);
      const resumo = figura.dados ? `tabela ${(figura.dados as TabelaDados).linhas.length} linhas` : figura.imagem ? "imagem" : "só recorte";
      console.log(`  ✔ ${p.prova.slice(0, 7)} nº ${f.numero}: ${f.tipo} (${resumo}), recorte ${Math.round(r.w)}×${Math.round(r.h)} pt`);
    }
    for (const [numero, figuras] of porQuestao) {
      const q = await Question.findOne({ origem: "oficial", prova: p.prova, numeroOriginal: numero });
      if (!q) {
        fora.push(`${p.prova} nº ${numero}`);
        continue;
      }
      // idempotente: troca só as figuras extraídas do PDF que ainda não foram conferidas
      const mantidas = (q.figuras ?? []).filter((x) => x.origem !== "pdf" || x.status !== "aguardando_conferencia");
      q.set("figuras", [...mantidas, ...figuras]);
      await q.save();
    }
  }
  if (fora.length) console.log(`ℹ Figuras extraídas de questões que não estão no banco (cadastre a questão antes): ${fora.join("; ")}`);
  console.log('Confira na tela "Figuras" do site: nenhuma vai ao treino sem o seu OK.');
}
