// Normalizador de fala (antes de qualquer áudio da Lo): converte o texto SÓ para o áudio. Na tela continua
// "R$ 5.306,04"; para a voz vira "cinco mil, trezentos e seis reais e quatro centavos". Puro, sem IA,
// usado no servidor (antes da NVIDIA) e no navegador (voz do navegador). Siglas: shared/siglasFala.ts.
import { SIGLAS_FALA } from "./siglasFala.js";

const UNIDADES = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const DEZENAS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const CENTENAS = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];
const feminino = (s: string) => s.replace(/\bum$/, "uma").replace(/\bdois$/, "duas").replace(/entos\b/g, "entas");

function ate999(n: number, fem = false): string {
  if (n === 100) return "cem";
  const partes: string[] = [];
  const c = Math.floor(n / 100);
  const r = n % 100;
  if (c) partes.push(fem ? feminino(CENTENAS[c]) : CENTENAS[c]);
  if (r) {
    const txt = r < 20 ? UNIDADES[r] : DEZENAS[Math.floor(r / 10)] + (r % 10 ? ` e ${UNIDADES[r % 10]}` : "");
    partes.push(fem ? feminino(txt) : txt);
  }
  return partes.join(" e ");
}

// Número inteiro por extenso. "virgula": pausa antes da centena não redonda ("cinco mil, trezentos e seis")
export function porExtenso(n: number, opts: { virgula?: boolean; fem?: boolean } = {}): string {
  if (!Number.isFinite(n)) return String(n);
  if (n < 0) return `menos ${porExtenso(-n, opts)}`;
  n = Math.floor(n);
  if (n === 0) return "zero";
  const grupos: [number, string][] = [];
  const bi = Math.floor(n / 1e9), mi = Math.floor(n / 1e6) % 1000, mil = Math.floor(n / 1000) % 1000, un = n % 1000;
  if (bi) grupos.push([bi, bi === 1 ? "um bilhão" : `${ate999(bi)} bilhões`]);
  if (mi) grupos.push([mi, mi === 1 ? "um milhão" : `${ate999(mi)} milhões`]);
  if (mil) grupos.push([mil, mil === 1 ? "mil" : `${ate999(mil, opts.fem)} mil`]);
  if (un) grupos.push([un, ate999(un, opts.fem)]);
  let s = grupos[0][1];
  for (const [v, txt] of grupos.slice(1)) s += v < 100 || v % 100 === 0 ? ` e ${txt}` : `${opts.virgula ? "," : ""} ${txt}`;
  return s;
}

// "1.200" → 1200; "1,02" → { inteiro: 1, frac: "02" }
const semPontos = (s: string) => s.replace(/\./g, "");
function decimalFalado(inteiro: string, frac?: string): string {
  const base = porExtenso(Number(semPontos(inteiro)));
  if (!frac) return base;
  const zeros = frac.match(/^0+/)?.[0].length ?? 0;
  const resto = frac.slice(zeros);
  return `${base} vírgula ${[...Array(zeros).fill("zero"), ...(resto ? [porExtenso(Number(resto))] : [])].join(" ")}`;
}

const ORD_UNID = ["", "primeiro", "segundo", "terceiro", "quarto", "quinto", "sexto", "sétimo", "oitavo", "nono"];
const ORD_DEZ = ["", "décimo", "vigésimo", "trigésimo", "quadragésimo", "quinquagésimo", "sexagésimo", "septuagésimo", "octogésimo", "nonagésimo"];
export function ordinal(n: number, fem = false): string {
  if (n < 1 || n > 99) return porExtenso(n);
  const s = [ORD_DEZ[Math.floor(n / 10)], ORD_UNID[n % 10]].filter(Boolean).join(" ");
  return fem ? s.replace(/o\b/g, "a") : s;
}

const ROMANOS: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
export function romano(s: string): number {
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const v = ROMANOS[s[i]], prox = ROMANOS[s[i + 1]] ?? 0;
    total += v < prox ? -v : v;
  }
  return total;
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export const LETRAS_FALA: Record<string, string> = {
  A: "á", B: "bê", C: "cê", D: "dê", E: "é", F: "éfe", G: "gê", H: "agá", I: "í", J: "jota", K: "cá", L: "éle", M: "eme",
  N: "ene", O: "ó", P: "pê", Q: "quê", R: "erre", S: "esse", T: "tê", U: "u", V: "vê", W: "dáblio", X: "xis", Y: "ípsilon", Z: "zê",
};
const soletrar = (s: string) => [...s.toUpperCase()].map((l) => LETRAS_FALA[l] ?? l).join(" ");
const SOBRESCRITO: Record<string, string> = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9" };
const NUM = String.raw`\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?`;
const falarNumero = (s: string) => {
  const [i, f] = s.split(",");
  return decimalFalado(i, f);
};
const TAXAS: Record<string, string> = { "a.m.": "ao mês", "a.a.": "ao ano", "a.d.": "ao dia", "a.s.": "ao semestre", "a.t.": "ao trimestre", "a.b.": "ao bimestre" };
const FUNCOES_PLANILHA: Record<string, string> = { SOMA: "soma", "MÉDIA": "média", MEDIA: "média", MAXIMO: "máximo", "MÁXIMO": "máximo", MINIMO: "mínimo", "MÍNIMO": "mínimo", SE: "se", "CONT.SE": "cont ponto se", "SOMASE": "soma se", PROCV: "proc vê", CONT: "cont" };
const celula = (c: string) => {
  const [, col, lin] = c.match(/^([A-Z]{1,2})(\d+)$/)!;
  return `${soletrar(col)} ${porExtenso(Number(lin))}`;
};

export function paraFala(texto: string, siglas: Record<string, string> = SIGLAS_FALA): string {
  let t = ` ${texto} `;
  // 1. planilha: =SOMA(A1:A3) → soma de á um até á três
  t = t.replace(/=\s*([A-ZÁÉÍÓÚÂÊÔÃÕÇ.]+)\(([A-Z]{1,2}\d+):([A-Z]{1,2}\d+)\)/g, (_m, f: string, a: string, b: string) => `${FUNCOES_PLANILHA[f] ?? f.toLowerCase()} de ${celula(a)} até ${celula(b)}`);
  // 2. datas dd/mm/aaaa
  t = t.replace(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g, (m, d: string, mes: string, a: string) => {
    const nd = Number(d), nm = Number(mes);
    if (nm < 1 || nm > 12 || nd < 1 || nd > 31) return m;
    return `${nd === 1 ? "primeiro" : porExtenso(nd)} de ${MESES[nm - 1]} de ${porExtenso(Number(a))}`;
  });
  // 3. lei/resolução/circular nº X/AAAA
  t = t.replace(/\b(Lei|Resolução|Circular|Decreto|Medida Provisória|Instrução Normativa)(\s+(?:CMN|BCB|CVM)?\s*)(?:nº\s*|n\.º\s*)?(\d{1,3}(?:\.\d{3})*)\/(\d{4})\b/g, (_m, tipo: string, meio: string, n: string, a: string) => `${tipo}${meio.trim() ? ` ${meio.trim()}` : ""} ${porExtenso(Number(semPontos(n)))}, de ${porExtenso(Number(a))}`);
  // 4. dinheiro
  t = t.replace(new RegExp(String.raw`R\$\s?(${NUM})`, "g"), (_m, v: string) => {
    const [i, f = "0"] = v.split(",");
    const reais = Number(semPontos(i));
    const cent = Number(f.padEnd(2, "0").slice(0, 2));
    const pReais = reais ? `${porExtenso(reais, { virgula: true })}${reais >= 1e6 && reais % 1e6 === 0 ? " de" : ""} ${reais === 1 ? "real" : "reais"}` : "";
    const pCent = cent ? `${porExtenso(cent)} ${cent === 1 ? "centavo" : "centavos"}` : "";
    return [pReais, pCent].filter(Boolean).join(" e ") || "zero real";
  });
  // 5. porcentagem (com taxa: a.m., a.a. …)
  t = t.replace(new RegExp(String.raw`(${NUM})\s?%(\s?a\.[mdastb]\.)?`, "g"), (_m, v: string, tx?: string) => `${falarNumero(v)} por cento${tx ? ` ${TAXAS[tx.trim()]}` : ""}`);
  t = t.replace(/\ba\.[mdastb]\.(?=\s|$|[,;)])/g, (m) => TAXAS[m] ?? m);
  // 6. potência: 1,02³ ou 1,02^3
  t = t.replace(new RegExp(String.raw`(${NUM})(?:\^(\d+)|([⁰¹²³⁴⁵⁶⁷⁸⁹]+))`, "g"), (_m, b: string, e1?: string, e2?: string) => `${falarNumero(b)} elevado a ${porExtenso(Number(e1 ?? [...e2!].map((c) => SOBRESCRITO[c]).join("")))}`);
  // 7. lei: artigo, parágrafo, inciso, número
  t = t.replace(/\barts?\.\s*(\d+)(º|°)?/gi, (_m, n: string, o?: string) => `artigo ${o || Number(n) < 10 ? ordinal(Number(n)) : porExtenso(Number(n))}`);
  t = t.replace(/§\s*(\d+)(º|°)?/g, (_m, n: string) => `parágrafo ${Number(n) < 10 ? ordinal(Number(n)) : porExtenso(Number(n))}`);
  t = t.replace(/§\s*único/g, "parágrafo único");
  t = t.replace(/\binciso\s+([IVXLCDM]+)\b/g, (_m, r: string) => `inciso ${porExtenso(romano(r))}`);
  t = t.replace(/\bn(?:º|\.º|°)\s*(\d{1,3}(?:\.\d{3})*|\d+)/g, (_m, n: string) => `número ${porExtenso(Number(semPontos(n)))}`);
  // 8. ordinais 1º, 2ª
  t = t.replace(/\b(\d{1,2})(º|°|ª)/g, (_m, n: string, o: string) => ordinal(Number(n), o === "ª"));
  // 9. horas: 10h, 10h30, 1h
  t = t.replace(/\b(\d{1,2})h(\d{2})?\b/g, (_m, h: string, min?: string) => {
    const nh = Number(h);
    const horas = `${porExtenso(nh, { fem: true })} ${nh === 1 ? "hora" : "horas"}`;
    return min && Number(min) ? `${horas} e ${porExtenso(Number(min))} ${Number(min) === 1 ? "minuto" : "minutos"}` : horas;
  });
  // 10. alternativas: "letra B", "(C)"
  t = t.replace(/\bletra\s+([A-E])\b/gi, (_m, l: string) => `letra ${LETRAS_FALA[l.toUpperCase()]}`);
  t = t.replace(/\(([A-E])\)/g, (_m, l: string) => `letra ${LETRAS_FALA[l]}`);
  // 11. células soltas de planilha (C10)
  t = t.replace(/\b([A-Z]{1,2})(\d{1,4})\b/g, (m, col: string, lin: string) => (siglas[m] ? m : `${soletrar(col)} ${porExtenso(Number(lin))}`));
  // 12. símbolos de conta
  t = t
    .replace(/\s*≥\s*/g, " maior ou igual a ")
    .replace(/\s*≤\s*/g, " menor ou igual a ")
    .replace(/\s*≠\s*/g, " diferente de ")
    .replace(/\s*=\s*/g, " igual a ")
    .replace(/\s*[×]\s*/g, " vezes ")
    .replace(/(\d)\s*\*\s*(\d)/g, "$1 vezes $2")
    .replace(/\s*÷\s*/g, " dividido por ")
    .replace(/(\d)\s*\/\s*(\d)/g, "$1 dividido por $2")
    .replace(/\s*\+\s*/g, " mais ")
    .replace(/\s*−\s*/g, " menos ")
    .replace(/(\d)\s+-\s+(\d)/g, "$1 menos $2");
  // 13. números que sobraram
  t = t.replace(new RegExp(String.raw`(?<![\p{L}\d])(${NUM})(?![\d\p{L}])`, "gu"), (n: string) => falarNumero(n));
  // 14. siglas: dicionário; desconhecida em maiúsculas (2 a 4 letras) é soletrada
  t = t.replace(/\b[A-ZÁÉÍÓÚÇ]{2,}(?:\/[A-Z]{2,})?\b/g, (s) => siglas[s] ?? (s.length <= 4 && !s.includes("/") ? soletrar(s) : s));
  t = t.replace(/\b(Pix|Copom|Selic|Drex)\b/g, (s) => siglas[s] ?? s.toLowerCase());
  return t.replace(/\s+([,.;:!?])/g, "$1").replace(/\s{2,}/g, " ").trim();
}

// Texto corrido de uma aula para ouvir (Markdown sem marcação + seções). O mesmo texto no servidor
// (pré-geração) e no site (botão): o hash bate e o áudio pronto é achado.
export function textoDaAula(a: { assunto: string; conteudo: string; pontosChave: string[]; comoABancaCobra: string; pegadinhasComuns: string[] }) {
  const limpo = a.conteudo.replace(/\[\d+\]/g, "").replace(/[#*_`>]/g, "").replace(/\n{2,}/g, "\n").trim();
  return [`Aula: ${a.assunto}.`, limpo, `Pontos-chave: ${a.pontosChave.join("; ")}.`, `Como a banca cobra: ${a.comoABancaCobra}`, `Pegadinhas comuns: ${a.pegadinhasComuns.join("; ")}.`].join("\n");
}

// Frases curtas para a voz (o modelo erra mais em pt-BR com texto longo): quebra em sentenças
export function frasesParaFala(texto: string, max = 220): string[] {
  const frases = texto.match(/[^.!?;]+[.!?;]?/g)?.map((s) => s.trim()).filter(Boolean) ?? [];
  return frases.flatMap((f) => (f.length <= max ? [f] : f.split(/,\s+/).reduce<string[]>((acc, p) => {
    if (acc.length && (acc[acc.length - 1] + ", " + p).length <= max) acc[acc.length - 1] += `, ${p}`;
    else acc.push(p);
    return acc;
  }, [])));
}
