// ============================================================
// BB Estudos — índice local do acervo e mapa tema → páginas (F7/F11, sem IA).
// O acervo (ACERVO_DIR, pasta do OneDrive) é SÓ LEITURA: nada é gravado lá. O índice fica em
// acervo-indice/ (fora do Git): um JSON por arquivo, identificado pelo SHA-256 — arquivo já indexado
// com o mesmo hash não é reprocessado; arquivo só na nuvem (não baixado) é pulado e listado.
// O mapa é por palavra-chave (data/subtopicos.json), camada A > B > C, e sai marcado como "auto"
// até alguém conferir: ponteiro para estudar, não afirmação de conteúdo.
// ============================================================
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { extractText, getDocumentProxy } from "unpdf";
import { SUBTOPICOS, type Subtopico } from "../shared/subtopicos.js";

export const PASTA_INDICE = join(process.cwd(), "acervo-indice");
const raiz = () => {
  const r = process.env.ACERVO_DIR;
  if (!r || !existsSync(r)) throw new Error("ACERVO_DIR não está no .env ou a pasta não existe.");
  return r;
};

export type Camada = "A" | "B" | "C";
export type TipoMaterial = "lei" | "prova" | "gabarito" | "edital" | "livro_oficial" | "cursinho";

// classificação pelo caminho (pastas do acervo do dono); o que não casar é C (cursinho)
export function classificarArquivo(rel: string): { camada: Camada; tipo: TipoMaterial } {
  const p = rel.split(/[\\/]/).map((x) => x.toLowerCase());
  const nome = p[p.length - 1];
  const pasta = p.slice(0, -1).join("/");
  if (/gabarito/.test(nome)) return { camada: "A", tipo: "gabarito" };
  if (/editais/.test(pasta) || /\bedital\b/.test(nome)) return { camada: "A", tipo: "edital" };
  if (/provas e gabaritos|provas de outros bancos/.test(pasta)) return { camada: "A", tipo: "prova" };
  if (/\bprova\b/.test(nome) && !/comentad/.test(nome)) return { camada: "A", tipo: "prova" }; // prova solta em outra pasta
  if (/legislacao/.test(pasta) || /^(lei|lc|decreto|constituicao|resolucao|circular)\b/.test(nome)) return { camada: "A", tipo: "lei" };
  if (/apostilas e livros/.test(pasta) && /^(bcb|cvm|susep|bndes)\b/.test(nome)) return { camada: "B", tipo: "livro_oficial" };
  return { camada: "C", tipo: "cursinho" };
}

const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ");

function listarPdfs(dir: string, base = dir): string[] {
  const saida: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) saida.push(...listarPdfs(p, base));
    else if (e.name.toLowerCase().endsWith(".pdf")) saida.push(relative(base, p));
  }
  return saida;
}

// arquivos do OneDrive que estão só na nuvem (ler um deles dispara download): atributo Offline ou RecallOnDataAccess
function soNaNuvem(dir: string): Set<string> {
  try {
    const cmd = `Get-ChildItem -LiteralPath '${dir.replace(/'/g, "''")}' -Recurse -File -Filter *.pdf | Where-Object { ($_.Attributes -band 0x1000) -or ($_.Attributes -band 0x400000) } | ForEach-Object { $_.FullName }`;
    const out = execFileSync("powershell", ["-NoProfile", "-Command", cmd], { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
    return new Set(out.split(/\r?\n/).filter(Boolean).map((f) => relative(dir, f)));
  } catch {
    return new Set();
  }
}

export interface IndiceArquivo { arquivo: string; sha256: string; bytes: number; camada: Camada; tipo: TipoMaterial; paginas: string[] }
const arquivoIndice = (sha: string) => join(PASTA_INDICE, `${sha}.json`);
const MANIFESTO = () => join(PASTA_INDICE, "manifesto.json");

export async function indexarAcervo(opcoes: { log?: (s: string) => void } = {}) {
  const log = opcoes.log ?? console.log;
  const base = raiz();
  mkdirSync(PASTA_INDICE, { recursive: true });
  const nuvem = soNaNuvem(base);
  const arquivos = listarPdfs(base);
  const manifesto: { arquivo: string; sha256: string; bytes: number; paginas: number; camada: Camada; tipo: TipoMaterial }[] = [];
  const r = { total: arquivos.length, novos: 0, jaIndexados: 0, nuvem: [] as string[], erros: [] as string[], paginas: 0 };
  for (const rel of arquivos) {
    if (nuvem.has(rel)) { r.nuvem.push(rel); continue; }
    const abs = join(base, rel);
    const buf = readFileSync(abs);
    const sha = createHash("sha256").update(buf).digest("hex");
    const c = classificarArquivo(rel);
    let paginas: string[];
    if (existsSync(arquivoIndice(sha))) {
      paginas = (JSON.parse(readFileSync(arquivoIndice(sha), "utf8")) as IndiceArquivo).paginas;
      r.jaIndexados++;
    } else {
      try {
        const pdf = await getDocumentProxy(new Uint8Array(buf));
        const { text } = await extractText(pdf, { mergePages: false });
        paginas = text.map((t) => String(t).replace(/[ \t]+/g, " "));
        const doc: IndiceArquivo = { arquivo: rel.split(sep).join("/"), sha256: sha, bytes: buf.length, ...c, paginas };
        writeFileSync(arquivoIndice(sha), JSON.stringify(doc));
        r.novos++;
        if (r.novos % 25 === 0) log(`  … ${r.novos} novos indexados`);
      } catch (e) {
        r.erros.push(`${rel}: ${(e as Error).message.slice(0, 80)}`);
        continue;
      }
    }
    r.paginas += paginas.length;
    manifesto.push({ arquivo: rel.split(sep).join("/"), sha256: sha, bytes: buf.length, paginas: paginas.length, ...c });
  }
  writeFileSync(MANIFESTO(), JSON.stringify({ em: new Date().toISOString(), raiz: "ACERVO_DIR", arquivos: manifesto, nuvem: r.nuvem }, null, 1));
  return r;
}

function carregarIndice(): IndiceArquivo[] {
  if (!existsSync(MANIFESTO())) throw new Error('Índice do acervo vazio: rode "npm run bb -- acervo indexar".');
  const m = JSON.parse(readFileSync(MANIFESTO(), "utf8")) as { arquivos: { arquivo: string; sha256: string }[] };
  return m.arquivos.flatMap((a) => {
    if (!existsSync(arquivoIndice(a.sha256))) return [];
    const doc = JSON.parse(readFileSync(arquivoIndice(a.sha256), "utf8")) as IndiceArquivo;
    // caminho atual (o arquivo pode ter mudado de pasta) e camada recalculada (a regra pode ter melhorado)
    return [{ ...doc, arquivo: a.arquivo, ...classificarArquivo(a.arquivo) }];
  });
}

// texto de páginas já indexadas (1-based, inclusive); null se o arquivo não está no índice
export function paginasIndexadas(arquivo: string, de: number, ate = de): { texto: string; pagina: number }[] | null {
  if (!existsSync(MANIFESTO())) return null;
  const m = JSON.parse(readFileSync(MANIFESTO(), "utf8")) as { arquivos: { arquivo: string; sha256: string }[] };
  const a = m.arquivos.find((x) => x.arquivo === arquivo);
  if (!a || !existsSync(arquivoIndice(a.sha256))) return null;
  const doc = JSON.parse(readFileSync(arquivoIndice(a.sha256), "utf8")) as IndiceArquivo;
  return doc.paginas.slice(de - 1, ate).map((texto, i) => ({ texto, pagina: de + i }));
}

// ---------- mapa tema → páginas ----------
export interface TrechoMapa { arquivo: string; paginas: string; pagina: number; camada: Camada; tipo: TipoMaterial; pontos: number }
const RANK: Record<Camada, number> = { A: 0, B: 1, C: 2 };

// frases dos tópicos do subtópico, sem o parêntese ("Licitações e contratos (Lei 14.133/2021)" → "licitações e contratos")
export const frasesDosTopicos = (s: Pick<Subtopico, "topicos">) =>
  s.topicos.flatMap((t) => t.replace(/\(.*?\)/g, "").split(/[;:]/)).map((x) => x.trim()).filter((x) => x.length >= 6);

// pontos de uma página para um subtópico: nome do tema 3, frase de tópico 2, palavra-chave 1 (teto de 10 por
// termo). Só casa no INÍCIO de palavra: "acao" não pode contar dentro de "contratação" (1º mapa de 24/10).
export function pontosDaPagina(texto: string, s: Pick<Subtopico, "nome" | "palavras"> & Partial<Pick<Subtopico, "topicos">>): number {
  const t = normalizar(texto);
  const conta = (termo: string) => {
    const k = normalizar(termo).replace(/\(.*?\)/g, "").trim();
    if (k.length < 3) return 0;
    const re = new RegExp(`(?<![a-z0-9])${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "g");
    return Math.min(10, (t.match(re) ?? []).length);
  };
  return conta(s.nome) * 3 + (s.topicos ? frasesDosTopicos({ topicos: s.topicos }) : []).reduce((soma, f) => soma + conta(f) * 2, 0) + (s.palavras ?? []).reduce((soma, p) => soma + conta(p), 0);
}

// número de lei no nome do tema ou do tópico ("Licitações (14.133)") → o arquivo daquela lei vai primeiro
export const numeroDeLei = (s: Pick<Subtopico, "nome" | "topicos">) => [s.nome, ...s.topicos].join(" ").match(/\b(\d{1,2}\.\d{3})\b/)?.[1] ?? null;

// junta páginas vizinhas com pontos em faixas e devolve a melhor faixa de cada arquivo
export function melhorFaixa(pontos: number[], minimo = 4): { de: number; ate: number; total: number } | null {
  let melhor: { de: number; ate: number; total: number } | null = null;
  let de = -1, total = 0;
  for (let i = 0; i <= pontos.length; i++) {
    const p = pontos[i] ?? 0;
    if (p >= minimo) { if (de < 0) { de = i; total = 0; } total += p; continue; }
    if (de >= 0) {
      const ate = Math.min(i - 1, de + 9); // no máximo 10 páginas
      if (!melhor || total > melhor.total) melhor = { de, ate, total };
      de = -1;
    }
  }
  return melhor;
}

// Que tipo de material serve para estudar cada matéria: em Português, "concordância" e "pontuação" também
// aparecem em lei e em livro jurídico, com outro sentido (1º mapa de 24/10 pôs a LGPD em Interpretação).
const SO_CURSINHO = new Set(["lingua_portuguesa", "lingua_inglesa", "matematica", "raciocinio_logico", "probabilidade_estatistica", "informatica"]);
const SEM_LEI = new Set(["matematica_financeira", "vendas_negociacao"]);
const NORMATIVOS_EM_MATERIA_TECNICA = new Set(["seguranca_lgpd", "cdc"]); // LGPD e CDC são lei, apesar da matéria
export function tiposPermitidos(disciplina: string | null, subtopico: string): Set<TipoMaterial> {
  if (NORMATIVOS_EM_MATERIA_TECNICA.has(subtopico)) return new Set(["lei", "livro_oficial", "cursinho"]);
  if (disciplina && SO_CURSINHO.has(disciplina)) return new Set(["cursinho"]);
  if (disciplina && SEM_LEI.has(disciplina)) return new Set(["livro_oficial", "cursinho"]);
  return new Set(["lei", "livro_oficial", "cursinho"]);
}

// matéria do subtópico pelos arquivos de tópicos (BB e BACEN)
function disciplinaPorAssunto(): Map<string, string> {
  const m = new Map<string, string>();
  for (const arq of ["topicos.json", "topicos-bacen.json"]) {
    const j = JSON.parse(readFileSync(join(process.cwd(), "data", arq), "utf8")) as { disciplinas: Record<string, { assunto: string }[]> };
    for (const [d, lista] of Object.entries(j.disciplinas)) for (const t of lista) m.set(t.assunto, d);
  }
  return m;
}

// 1 a 3 trechos para estudar (sem prova/gabarito/edital), A > B > C entre os fortes (≥ 30% do melhor)
export function escolherTrechos(candidatos: TrechoMapa[], max = 3, permitidos: Set<TipoMaterial> = new Set(["lei", "livro_oficial", "cursinho"])): TrechoMapa[] {
  const estudo = candidatos.filter((c) => permitidos.has(c.tipo));
  if (!estudo.length) return [];
  const topo = Math.max(...estudo.map((c) => c.pontos));
  const fortes = estudo.filter((c) => c.pontos >= 0.3 * topo);
  return fortes.sort((a, b) => RANK[a.camada] - RANK[b.camada] || b.pontos - a.pontos).slice(0, max);
}

const NOME_CAMADA: Record<Camada, string> = { A: "oficial", B: "material oficial", C: "cursinho" };
const titulo = (arquivo: string) => arquivo.split("/").pop()!.replace(/\.pdf$/i, "");

// grava o mapa: o doc legível (todos os temas) e data/temas.json só onde ainda não há entrada conferida
export function escreverMapa(mapa: ReturnType<typeof mapearTemas>) {
  const caminhoTemas = join(process.cwd(), "data", "temas.json");
  const temas = JSON.parse(readFileSync(caminhoTemas, "utf8")) as { _sobre: string; temas: Record<string, Record<string, unknown>> };
  let novos = 0, mantidos = 0;
  for (const m of mapa) {
    const atual = temas.temas[m.subtopico];
    if (atual && !atual.auto) { mantidos++; continue; } // conferido à mão (ex.: crase): não mexe
    if (!m.trechos.length) continue;
    temas.temas[m.subtopico] = {
      auto: true,
      materiais: m.trechos.map((t) => ({ arquivo: t.arquivo, paginas: t.paginas, pagina: t.pagina, camada: t.camada, titulo: titulo(t.arquivo) })),
      oficiais: [],
    };
    novos++;
  }
  writeFileSync(caminhoTemas, JSON.stringify(temas, null, 2) + "\n");
  const linhas = [
    "# Cronograma × material do acervo (mapa automático)",
    "",
    `Gerado por \`npm run bb -- acervo mapa\` em ${new Date().toLocaleDateString("pt-BR")}. Por palavra-chave (data/subtopicos.json), 1 a 3 trechos por tema, camada A (lei) > B (livro oficial) > C (cursinho) entre os trechos fortes. **Automático: conferir antes de confiar.** Páginas = páginas do PDF. Caminhos relativos a ACERVO_DIR. "Caiu em prova" lista páginas de provas com o tema (não o número da questão).`,
    "",
  ];
  for (const m of mapa) {
    linhas.push(`## ${m.nome} (\`${m.subtopico}\`)`, "");
    if (!m.trechos.length) linhas.push("_Nada forte o bastante no acervo._");
    for (const t of m.trechos) linhas.push(`- **${t.camada}** (${NOME_CAMADA[t.camada]}) · ${titulo(t.arquivo)} · p. ${t.paginas} · ${t.pontos} pontos`);
    if (m.provas.length) linhas.push(`- Caiu em prova: ${m.provas.map((p) => `${titulo(p.arquivo)} p. ${p.pagina}`).join("; ")}`);
    linhas.push("");
  }
  writeFileSync(join(process.cwd(), "docs", "CRONOGRAMA-MATERIAL.md"), linhas.join("\n"));
  return { total: mapa.length, comMaterial: mapa.filter((m) => m.trechos.length).length, novos, mantidos };
}

export function mapearTemas(subtopicos: Subtopico[] = SUBTOPICOS) {
  const indice = carregarIndice();
  const discDe = disciplinaPorAssunto();
  return subtopicos.map((s) => {
    const permitidos = tiposPermitidos(s.topicos.map((a) => discDe.get(a)).find(Boolean) ?? null, s.id);
    const candidatos: TrechoMapa[] = [];
    const provas: { arquivo: string; pagina: number; pontos: number }[] = [];
    for (const doc of indice) {
      const pts = doc.paginas.map((t) => pontosDaPagina(t, s));
      if (doc.tipo === "prova") {
        pts.forEach((p, i) => { if (p >= 3) provas.push({ arquivo: doc.arquivo, pagina: i + 1, pontos: p }); });
        continue;
      }
      if (doc.tipo === "gabarito" || doc.tipo === "edital") continue;
      const f = melhorFaixa(pts);
      if (f) candidatos.push({ arquivo: doc.arquivo, paginas: f.de === f.ate ? `${f.de + 1}` : `${f.de + 1}–${f.ate + 1}`, pagina: f.de + 1, camada: doc.camada, tipo: doc.tipo, pontos: f.total });
    }
    // tema que É uma lei: o texto da lei entra primeiro (a melhor faixa dela, ou o começo). A lei vem do
    // número no nome ("Licitações (14.133)") ou do campo "leis" do subtópico ("13.709" para LGPD)
    const lei = s.leis?.[0] ?? numeroDeLei(s);
    const doTexto = lei ? indice.find((d) => d.tipo === "lei" && d.arquivo.split("/").pop()!.includes(lei)) : undefined;
    let trechos = escolherTrechos(candidatos, 3, permitidos);
    if (doTexto) {
      const daLei = candidatos.find((c) => c.arquivo === doTexto.arquivo) ?? { arquivo: doTexto.arquivo, paginas: `1–${Math.min(10, doTexto.paginas.length)}`, pagina: 1, camada: "A" as const, tipo: "lei" as const, pontos: 0 };
      trechos = [daLei, ...trechos.filter((t) => t.arquivo !== doTexto.arquivo)].slice(0, 3);
    }
    return { subtopico: s.id, nome: s.nome, trechos, provas: provas.sort((a, b) => b.pontos - a.pontos).slice(0, 8) };
  });
}
