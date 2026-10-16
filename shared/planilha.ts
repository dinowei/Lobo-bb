// ============================================================
// Avaliador de fórmulas de planilha (Excel em português), puro e sem eval.
// Usado para DESENHAR a figura de planilha e para CALCULAR a resposta das questões
// geradas (regra 10: número nunca depende só da IA).
// Sintaxe pt-BR: ";" separa argumentos, "," é decimal, nomes em português.
// Funções: SOMA, MÉDIA, MÁXIMO, MÍNIMO, CONT.NÚM, CONT.VALORES, CONT.SE, SOMASE, SE, E, OU,
//          ARRED, ARREDONDAR.PARA.CIMA, ARREDONDAR.PARA.BAIXO, PROCV, ABS
// ============================================================
import type { PlanilhaDados } from "./tipos.js";

export type Valor = number | string | boolean | null;
export class ErroPlanilha extends Error {}

const LETRAS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
export const colunaLetra = (i: number) => LETRAS[i];
export const indiceColuna = (l: string) => LETRAS.indexOf(l.toUpperCase());

// "R$ 1.234,56" | "12,5%" | "10" | "3.5" → número; texto que não é número → null
export function paraNumero(s: string): number | null {
  const t = s.replace(/R\$\s*/i, "").replace(/\s/g, "").trim();
  if (!t) return null;
  const pct = t.endsWith("%");
  const corpo = pct ? t.slice(0, -1) : t;
  let n: number;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(corpo) || /^-?\d+,\d+$/.test(corpo)) n = Number(corpo.replace(/\./g, "").replace(",", "."));
  else if (/^-?\d+(\.\d+)?$/.test(corpo)) n = Number(corpo);
  else return null;
  return pct ? n / 100 : n;
}

// ---------- tokens ----------
type Tok =
  | { t: "num"; v: number }
  | { t: "str"; v: string }
  | { t: "ref"; v: string }
  | { t: "intervalo"; de: string; ate: string }
  | { t: "func"; v: string }
  | { t: "op"; v: string }
  | { t: "("; } | { t: ")" } | { t: ";" };

function tokenizar(f: string): Tok[] {
  const s = f.replace(/[“”]/g, '"');
  const toks: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '"') {
      const fim = s.indexOf('"', i + 1);
      if (fim < 0) throw new ErroPlanilha("aspas sem fechar");
      toks.push({ t: "str", v: s.slice(i + 1, fim) });
      i = fim + 1;
      continue;
    }
    const num = /^\d+(,\d+)?/.exec(s.slice(i));
    if (num && !/^[A-Z]/i.test(s[i - 1] ?? "")) {
      toks.push({ t: "num", v: Number(num[0].replace(",", ".")) });
      i += num[0].length;
      continue;
    }
    const intervalo = /^\$?([A-Z])\$?(\d+):\$?([A-Z])\$?(\d+)/i.exec(s.slice(i));
    if (intervalo) {
      toks.push({ t: "intervalo", de: `${intervalo[1].toUpperCase()}${intervalo[2]}`, ate: `${intervalo[3].toUpperCase()}${intervalo[4]}` });
      i += intervalo[0].length;
      continue;
    }
    const nome = /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9.]*/i.exec(s.slice(i));
    if (nome) {
      const n = nome[0].toUpperCase();
      if (s[i + nome[0].length] === "(") toks.push({ t: "func", v: n });
      else if (/^\$?[A-Z]\$?\d+$/.test(n)) toks.push({ t: "ref", v: n.replace(/\$/g, "") });
      else if (n === "VERDADEIRO" || n === "FALSO") toks.push({ t: "num", v: n === "VERDADEIRO" ? 1 : 0 });
      else throw new ErroPlanilha(`nome desconhecido: ${n}`);
      i += nome[0].length;
      continue;
    }
    const op = /^(<=|>=|<>|[+\-*/^&=<>])/.exec(s.slice(i));
    if (op) { toks.push({ t: "op", v: op[0] }); i += op[0].length; continue; }
    if (c === "(" || c === ")" || c === ";") { toks.push({ t: c } as Tok); i++; continue; }
    if (c === "$") { i++; continue; }
    throw new ErroPlanilha(`caractere inesperado: ${c}`);
  }
  return toks;
}

// ---------- árvore ----------
type No =
  | { k: "valor"; v: Valor }
  | { k: "ref"; v: string }
  | { k: "intervalo"; de: string; ate: string }
  | { k: "func"; nome: string; args: No[] }
  | { k: "bin"; op: string; a: No; b: No }
  | { k: "neg"; a: No };

const PRECEDENCIA: Record<string, number> = { "=": 1, "<>": 1, "<": 1, ">": 1, "<=": 1, ">=": 1, "&": 2, "+": 3, "-": 3, "*": 4, "/": 4, "^": 5 };

function analisar(toks: Tok[]): No {
  let p = 0;
  const olhar = () => toks[p];
  function primario(): No {
    const t = toks[p++];
    if (!t) throw new ErroPlanilha("fórmula incompleta");
    if (t.t === "num") return { k: "valor", v: t.v };
    if (t.t === "str") return { k: "valor", v: t.v };
    if (t.t === "ref") return { k: "ref", v: t.v };
    if (t.t === "intervalo") return { k: "intervalo", de: t.de, ate: t.ate };
    if (t.t === "op" && t.v === "-") return { k: "neg", a: primario() };
    if (t.t === "op" && t.v === "+") return primario();
    if (t.t === "(") {
      const e = expr(0);
      if (toks[p++]?.t !== ")") throw new ErroPlanilha("faltou fechar parêntese");
      return e;
    }
    if (t.t === "func") {
      if (toks[p++]?.t !== "(") throw new ErroPlanilha("faltou parêntese da função");
      const args: No[] = [];
      if (olhar()?.t !== ")") {
        for (;;) {
          args.push(expr(0));
          if (olhar()?.t === ";") { p++; continue; }
          break;
        }
      }
      if (toks[p++]?.t !== ")") throw new ErroPlanilha(`faltou fechar ${t.v}(`);
      return { k: "func", nome: t.v, args };
    }
    throw new ErroPlanilha("fórmula inválida");
  }
  function expr(min: number): No {
    let a = primario();
    for (;;) {
      const t = olhar();
      if (!t || t.t !== "op" || PRECEDENCIA[t.v] === undefined || PRECEDENCIA[t.v] < min) return a;
      p++;
      const prox = t.v === "^" ? PRECEDENCIA[t.v] : PRECEDENCIA[t.v] + 1;
      a = { k: "bin", op: t.v, a, b: expr(prox) };
    }
  }
  const e = expr(0);
  if (p !== toks.length) throw new ErroPlanilha("sobrou coisa na fórmula");
  return e;
}

// ---------- avaliação ----------
export class Planilha {
  private cache = new Map<string, Valor>();
  private emCalculo = new Set<string>();
  constructor(private dados: PlanilhaDados) {}

  bruto(ref: string): string | undefined {
    return this.dados.celulas[ref.toUpperCase()];
  }

  valor(ref: string): Valor {
    const r = ref.toUpperCase();
    if (this.cache.has(r)) return this.cache.get(r)!;
    if (this.emCalculo.has(r)) throw new ErroPlanilha(`referência circular em ${r}`);
    const bruto = this.dados.celulas[r];
    let v: Valor;
    if (bruto === undefined || bruto === "") v = null;
    else if (bruto.startsWith("=")) {
      this.emCalculo.add(r);
      try {
        v = this.avaliar(bruto);
      } finally {
        this.emCalculo.delete(r);
      }
    } else v = paraNumero(bruto) ?? bruto;
    this.cache.set(r, v);
    return v;
  }

  avaliar(formula: string): Valor {
    const v = this.no(analisar(tokenizar(formula.replace(/^=/, ""))));
    if (Array.isArray(v)) throw new ErroPlanilha("intervalo fora de função");
    return v;
  }

  private celulasDo(de: string, ate: string): string[] {
    const [c1, l1] = [indiceColuna(de[0]), Number(de.slice(1))];
    const [c2, l2] = [indiceColuna(ate[0]), Number(ate.slice(1))];
    const refs: string[] = [];
    for (let l = Math.min(l1, l2); l <= Math.max(l1, l2); l++)
      for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++) refs.push(`${colunaLetra(c)}${l}`);
    return refs;
  }

  private no(n: No): Valor | Valor[] {
    switch (n.k) {
      case "valor": return n.v;
      case "ref": return this.valor(n.v);
      case "intervalo": return this.celulasDo(n.de, n.ate).map((r) => this.valor(r));
      case "neg": return -this.num(this.no(n.a));
      case "bin": return this.bin(n.op, this.escalar(this.no(n.a)), this.escalar(this.no(n.b)));
      case "func": return this.func(n.nome, n.args);
    }
  }

  private escalar(v: Valor | Valor[]): Valor {
    if (Array.isArray(v)) throw new ErroPlanilha("intervalo onde se esperava um valor");
    return v;
  }
  private num(v: Valor | Valor[]): number {
    const e = this.escalar(v);
    if (e === null) return 0;
    if (typeof e === "boolean") return e ? 1 : 0;
    if (typeof e === "number") return e;
    const n = paraNumero(e);
    if (n === null) throw new ErroPlanilha(`#VALOR!: "${e}" não é número`);
    return n;
  }

  private bin(op: string, a: Valor, b: Valor): Valor {
    if (op === "&") return `${a ?? ""}${b ?? ""}`;
    if (["=", "<>", "<", ">", "<=", ">="].includes(op)) return comparar(a, op, b);
    const x = this.num(a), y = this.num(b);
    if (op === "+") return x + y;
    if (op === "-") return x - y;
    if (op === "*") return x * y;
    if (op === "/") {
      if (y === 0) throw new ErroPlanilha("#DIV/0!");
      return x / y;
    }
    return x ** y;
  }

  private numeros(args: No[]): number[] {
    const out: number[] = [];
    for (const a of args) {
      const v = this.no(a);
      if (Array.isArray(v)) out.push(...v.filter((x): x is number => typeof x === "number"));
      else out.push(this.num(v));
    }
    return out;
  }

  private func(nome: string, args: No[]): Valor {
    const nomeSemAcento = nome.normalize("NFD").replace(/[̀-ͯ]/g, "");
    const intervalo = (a: No) => {
      const v = this.no(a);
      return Array.isArray(v) ? v : [v];
    };
    switch (nomeSemAcento) {
      case "SOMA": return this.numeros(args).reduce((s, x) => s + x, 0);
      case "MEDIA": {
        const ns = this.numeros(args);
        if (!ns.length) throw new ErroPlanilha("#DIV/0!");
        return ns.reduce((s, x) => s + x, 0) / ns.length;
      }
      case "MAXIMO": return Math.max(...this.numeros(args));
      case "MINIMO": return Math.min(...this.numeros(args));
      case "CONT.NUM": return args.flatMap(intervalo).filter((v) => typeof v === "number").length;
      case "CONT.VALORES": return args.flatMap(intervalo).filter((v) => v !== null && v !== "").length;
      case "CONT.SE": {
        const [r, c] = args;
        const crit = this.escalar(this.no(c));
        return intervalo(r).filter((v) => atende(v, crit)).length;
      }
      case "SOMASE": {
        const [r, c, s] = args;
        const crit = this.escalar(this.no(c));
        const base = intervalo(r);
        const somar = s ? intervalo(s) : base;
        return base.reduce<number>((acc, v, k) => (atende(v, crit) && typeof somar[k] === "number" ? acc + (somar[k] as number) : acc), 0);
      }
      case "SE": {
        const cond = this.escalar(this.no(args[0]));
        const verdadeiro = cond === true || (typeof cond === "number" && cond !== 0);
        const ramo = verdadeiro ? args[1] : args[2];
        return ramo ? this.escalar(this.no(ramo)) : verdadeiro;
      }
      case "E": return args.every((a) => verdadeiro(this.escalar(this.no(a))));
      case "OU": return args.some((a) => verdadeiro(this.escalar(this.no(a))));
      case "ARRED": return arred(this.num(this.no(args[0])), this.num(this.no(args[1] ?? { k: "valor", v: 0 })), Math.round);
      case "ARREDONDAR.PARA.CIMA": return arred(this.num(this.no(args[0])), this.num(this.no(args[1] ?? { k: "valor", v: 0 })), (x) => Math.sign(x) * Math.ceil(Math.abs(x)));
      case "ARREDONDAR.PARA.BAIXO": return arred(this.num(this.no(args[0])), this.num(this.no(args[1] ?? { k: "valor", v: 0 })), (x) => Math.sign(x) * Math.floor(Math.abs(x)));
      case "ABS": return Math.abs(this.num(this.no(args[0])));
      case "PROCV": {
        const procurado = this.escalar(this.no(args[0]));
        const tab = args[1];
        if (tab.k !== "intervalo") throw new ErroPlanilha("PROCV precisa de um intervalo");
        const col = this.num(this.no(args[2]));
        const exato = args[3] ? !verdadeiro(this.escalar(this.no(args[3]))) : false;
        const [c1, l1] = [indiceColuna(tab.de[0]), Number(tab.de.slice(1))];
        const [, l2] = [indiceColuna(tab.ate[0]), Number(tab.ate.slice(1))];
        let achou: number | null = null;
        for (let l = l1; l <= l2; l++) {
          const v = this.valor(`${colunaLetra(c1)}${l}`);
          if (comparar(v, "=", procurado)) { achou = l; break; }
          if (!exato && typeof v === "number" && typeof procurado === "number" && v <= procurado) achou = l;
        }
        if (achou === null) throw new ErroPlanilha("#N/D");
        return this.valor(`${colunaLetra(c1 + col - 1)}${achou}`);
      }
      default:
        throw new ErroPlanilha(`função não suportada: ${nome}`);
    }
  }
}

const verdadeiro = (v: Valor) => v === true || (typeof v === "number" && v !== 0);
const arred = (x: number, casas: number, f: (x: number) => number) => {
  const m = 10 ** casas;
  return f(Math.round(x * m * 1e9) / 1e9) / m;
};

function comparar(a: Valor, op: string, b: Valor): boolean {
  const na = typeof a === "number" ? a : typeof a === "string" ? paraNumero(a) : null;
  const nb = typeof b === "number" ? b : typeof b === "string" ? paraNumero(b) : null;
  const ambosNum = na !== null && nb !== null;
  const x: number | string = ambosNum ? na! : String(a ?? "").toLowerCase();
  const y: number | string = ambosNum ? nb! : String(b ?? "").toLowerCase();
  switch (op) {
    case "=": return x === y;
    case "<>": return x !== y;
    case "<": return x < y;
    case ">": return x > y;
    case "<=": return x <= y;
    default: return x >= y;
  }
}

// critério de CONT.SE/SOMASE: "<=R$ 10,00", ">5", "P101", 7
function atende(v: Valor, crit: Valor): boolean {
  if (typeof crit === "number") return comparar(v, "=", crit);
  const m = /^(<=|>=|<>|<|>|=)?(.*)$/.exec(String(crit ?? ""))!;
  const op = m[1] ?? "=";
  const alvo = m[2];
  if (v === null || v === "") return op === "<>" ? alvo !== "" : alvo === "";
  return comparar(v, op, alvo);
}

// Texto que a célula MOSTRA (fórmula avaliada + formato)
export function textoDaCelula(p: Planilha, dados: PlanilhaDados, ref: string): string {
  let v: Valor;
  try {
    v = p.valor(ref);
  } catch (e) {
    return e instanceof ErroPlanilha ? e.message.split(":")[0] : "#ERRO!";
  }
  if (v === null) return "";
  if (typeof v === "boolean") return v ? "VERDADEIRO" : "FALSO";
  if (typeof v === "string") return v;
  const formato = dados.formatos?.[ref.toUpperCase()] ?? "numero";
  const br = (n: number, casas: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
  if (formato === "moeda") return `R$ ${br(v, 2)}`;
  if (formato === "porcentagem") return `${br(v * 100, 2)}%`;
  return Number.isInteger(v) ? String(v) : br(v, 2);
}
