// ============================================================
// BB Estudos — Download de leis e normas SÓ de sites oficiais (PROMPT-VIAGEM, etapa 2.1)
// Autorizado pelo dono em 17/10/2026: planalto.gov.br, bcb.gov.br, normativos do CMN/BCB, in.gov.br.
// Leis: página do Planalto. Resoluções e circulares: texto publicado no DOU (in.gov.br), achado
// pela busca oficial. Grava em fontes/<id>/ (fora do Git) e registra em fontes/LEIAME.json a data
// de consulta, o sha256, o endereço e os atos do DOU que citam a norma (para conferir a vigência).
// ============================================================
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { htmlParaTexto } from "./extrair.js";

const HOSTS_OFICIAIS = new Set(["www.planalto.gov.br", "planalto.gov.br", "www.bcb.gov.br", "bcb.gov.br", "www.in.gov.br", "in.gov.br", "pesquisa.in.gov.br"]);
export function hostOficial(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && HOSTS_OFICIAIS.has(u.hostname);
  } catch {
    return false;
  }
}

const FonteZ = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  titulo: z.string(),
  tipo: z.enum(["lei", "norma_bacen_cmn"]),
  disciplina: z.string(),
  orgao: z.string(),
  ano: z.number().int(),
  planalto: z.string().url().optional(),
  dou: z.string().optional(), // consulta exata na busca do DOU
  tituloDou: z.string().optional(), // título do ato no DOU (confere o resultado certo)
  douUrl: z.string().optional(), // endereço direto do ato no DOU (quando a busca não traz o ato antigo)
  revogados: z.array(z.string()).optional(), // artigos revogados por ato posterior: saem do texto (ex.: "8º")
  pendente: z.string().optional(), // não baixa: o porquê (ex.: só há texto consolidado no site do BCB)
});
export type FonteOficial = z.infer<typeof FonteZ>;

export interface Registro {
  id: string;
  titulo: string;
  tipo: FonteOficial["tipo"];
  disciplina: string;
  orgao: string;
  ano: number;
  url: string;
  arquivo: string; // relativo a fontes/
  consultadoEm: string;
  sha256: string;
  bytes: number;
  caracteres: number; // texto aproveitável (sem o riscado)
  vigencia: string; // o que a conferência achou
  citadaPor?: { titulo: string; data: string; trecho: string }[];
}

const pausa = (ms: number) => new Promise((ok) => setTimeout(ok, ms));
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";

// Planalto serve windows-1252; o DOU, UTF-8
export function decodificar(buf: Uint8Array, contentType: string | null): string {
  const doCabecalho = /charset=([\w-]+)/i.exec(contentType ?? "")?.[1];
  const doMeta = /charset=["']?([\w-]+)/i.exec(new TextDecoder("latin1").decode(buf.slice(0, 4096)))?.[1];
  const charset = (doCabecalho ?? doMeta ?? "utf-8").toLowerCase();
  try {
    if (charset.startsWith("utf")) return new TextDecoder("utf-8", { fatal: true }).decode(buf);
    return new TextDecoder("windows-1252").decode(buf); // iso-8859-1 e windows-1252
  } catch {
    return new TextDecoder("windows-1252").decode(buf); // dizia UTF-8, mas não era
  }
}

async function baixar(url: string): Promise<{ html: string; bytes: number }> {
  if (!hostOficial(url)) throw new Error(`site não oficial: ${url}`);
  const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" }, redirect: "follow", signal: AbortSignal.timeout(90_000) });
  if (!hostOficial(r.url)) throw new Error(`redirecionou para fora dos sites oficiais: ${r.url}`);
  if (!r.ok) throw new Error(`HTTP ${r.status} em ${url}`);
  const buf = new Uint8Array(await r.arrayBuffer());
  return { html: decodificar(buf, r.headers.get("content-type")), bytes: buf.length };
}

// ---------- DOU ----------
type ResultadoDou = { urlTitle: string; title: string; pubDate: string; content?: string };
const semMarcacao = (s: string) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

export function resultadosDaBusca(html: string): ResultadoDou[] {
  const m = /<script id="_br_com_seatecnologia_in_buscadou_BuscaDouPortlet_params" type="application\/json">([\s\S]*?)<\/script>/.exec(html);
  if (!m) return [];
  const j = JSON.parse(m[1]) as { jsonArray?: ResultadoDou[] };
  return (j.jsonArray ?? []).map((r) => ({ ...r, title: semMarcacao(r.title), content: r.content ? semMarcacao(r.content) : undefined }));
}

// Só o texto do ato (div.texto-dou), sem o menu e o rodapé do portal
export function textoDoAto(html: string): string {
  const i = html.indexOf('class="texto-dou"');
  if (i < 0) throw new Error("página do DOU sem o bloco texto-dou");
  const inicio = html.lastIndexOf("<div", i);
  let nivel = 0;
  const re = /<\/?div\b[^>]*>/gi;
  re.lastIndex = inicio;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    nivel += m[0][1] === "/" ? -1 : 1;
    if (nivel === 0) return html.slice(inicio, m.index + m[0].length);
  }
  throw new Error("bloco texto-dou sem fechamento");
}

async function buscarNoDou(consulta: string) {
  const url = `https://www.in.gov.br/consulta/-/buscar/dou?q=${encodeURIComponent(`"${consulta}"`)}&s=todos&exactDate=all&sortType=0`;
  return resultadosDaBusca((await baixar(url)).html);
}

// Tira do texto os artigos revogados por ato posterior ("8º" tira do "Art. 8º" até o próximo artigo)
export function semArtigos(texto: string, artigos: string[]): string {
  let t = texto;
  for (const a of artigos) {
    const num = a.replace(/[º°o]$/i, "");
    const inicio = new RegExp(`(^|\\n)\\s*Art\\.\\s*${num}(º|°|o)?(?!\\d)[\\s.\\-–]`, "i").exec(t);
    if (!inicio) throw new Error(`artigo ${a} não encontrado para retirar`);
    const de = inicio.index + inicio[1].length;
    const resto = t.slice(de + 5);
    const prox = /\n\s*Art\.\s*\d+/.exec(resto);
    const ate = prox ? de + 5 + prox.index : t.length;
    t = `${t.slice(0, de)}[Art. ${a} revogado]\n${t.slice(ate)}`;
  }
  return t;
}

// ---------- vigência ----------
// Planalto: aviso de revogação no cabeçalho (antes de "O PRESIDENTE DA REPÚBLICA": revogação de
// artigo isolado aparece depois e não conta). DOU: atos que citam a norma ("altera", "revoga").
export function conferirVigencia(texto: string, citadaPor: { trecho: string }[] = []): string {
  const cabecalho = texto.split(/O\s+PRESIDENTE\s+DA\s+REP[ÚU]BLICA|O\s+VICE-PRESIDENTE/i)[0].slice(0, 3000);
  if (/revogad[ao] pel[ao]/i.test(cabecalho)) return "ATENÇÃO: o cabeçalho indica revogação; conferir";
  const revoga = citadaPor.filter((c) => /revoga/i.test(c.trecho)).length;
  const altera = citadaPor.filter((c) => /altera|nova redação|acrescenta/i.test(c.trecho)).length;
  if (revoga) return `conferir: ${revoga} ato(s) do DOU com "revoga" citando esta norma`;
  if (altera) return `vigente, com ${altera} ato(s) que alteram (texto do DOU é o original)`;
  return "vigente (nenhum ato de revogação encontrado na busca do DOU)";
}

// ---------- download de tudo ----------
export async function baixarFontes(apenas: string[] = [], pasta = "fontes"): Promise<Registro[]> {
  const lista = z.object({ fontes: z.array(FonteZ) }).parse(JSON.parse(await readFile("data/fontes-oficiais.json", "utf8"))).fontes;
  const manifesto = join(pasta, "LEIAME.json");
  const anteriores: Registro[] = await readFile(manifesto, "utf8").then((t) => JSON.parse(t).fontes as Registro[]).catch(() => []);
  // só o que ainda está na lista (fonte trocada ou pendente sai do manifesto e não é ingerida)
  const ativos = new Set(lista.filter((f) => !f.pendente).map((f) => f.id));
  const registros = new Map(anteriores.filter((r) => ativos.has(r.id)).map((r) => [r.id, r]));
  for (const f of lista.filter((x) => !apenas.length || apenas.includes(x.id))) {
    if (f.pendente) {
      console.log(`⏸ ${f.id}: pendente (${f.pendente})`);
      continue;
    }
    try {
      let url: string;
      let html: string;
      let bytes: number;
      let citadaPor: Registro["citadaPor"];
      if (f.planalto) {
        url = f.planalto;
        ({ html, bytes } = await baixar(url));
      } else if (f.dou || f.douUrl) {
        const resultados = f.dou ? await buscarNoDou(f.dou) : [];
        const ato = f.douUrl ? { urlTitle: f.douUrl, title: f.tituloDou ?? "" } : resultados.find((r) => r.title.toUpperCase() === f.tituloDou?.toUpperCase());
        if (!ato) throw new Error(`não achei "${f.tituloDou}" na busca do DOU (${resultados.length} resultado(s))`);
        url = `https://www.in.gov.br/en/web/dou/-/${ato.urlTitle}`;
        const pagina = await baixar(url);
        html = textoDoAto(pagina.html);
        bytes = pagina.bytes;
        citadaPor = resultados
          .filter((r) => r.urlTitle !== ato.urlTitle)
          .map((r) => ({ titulo: r.title, data: r.pubDate, trecho: (r.content ?? "").slice(0, 300) }))
          .slice(0, 15);
      } else throw new Error("sem endereço (planalto ou dou)");

      // texto limpo (sem o riscado e sem os artigos revogados) é o que vai para a ingestão
      let texto = htmlParaTexto(html).replace(/[ \t ]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
      if (f.revogados?.length) texto = semArtigos(texto, f.revogados);
      if (texto.length < 800) throw new Error(`texto curto demais (${texto.length} caracteres): página mudou?`);
      await mkdir(join(pasta, f.id), { recursive: true });
      const arquivo = join(f.id, `${f.id}.txt`);
      const conteudo = `${f.titulo}\nFonte oficial: ${url} (consultado em ${new Date().toISOString().slice(0, 10)})\n\n${texto}\n`;
      await writeFile(join(pasta, arquivo), conteudo, "utf8");
      await writeFile(join(pasta, f.id, `${f.id}.original.html`), `<meta charset="utf-8">\n${html}`, "utf8"); // para auditoria
      const reg: Registro = {
        id: f.id,
        titulo: f.titulo,
        tipo: f.tipo,
        disciplina: f.disciplina,
        orgao: f.orgao,
        ano: f.ano,
        url,
        arquivo,
        consultadoEm: new Date().toISOString(),
        sha256: createHash("sha256").update(conteudo).digest("hex"),
        bytes,
        caracteres: texto.length,
        vigencia: conferirVigencia(texto, citadaPor),
        citadaPor,
      };
      registros.set(f.id, reg);
      console.log(`✔ ${f.id}: ${Math.round(texto.length / 1000)} mil caracteres · ${reg.vigencia}`);
    } catch (e) {
      console.warn(`✖ ${f.id}: ${(e as Error).message}`);
    }
    await writeFile(manifesto, JSON.stringify({ geradoEm: new Date().toISOString(), fontes: [...registros.values()] }, null, 2), "utf8");
    await pausa(1500); // gentil com os sites públicos
  }
  return [...registros.values()];
}
