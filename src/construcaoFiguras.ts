// ============================================================
// BB Estudos — Questões geradas COM FIGURA (seção 5.8, Fase 3), por construção
// Só os tipos que apareceram no inventário das provas oficiais: tabela e planilha.
// O código monta a figura (DADO, desenhado no site), calcula a resposta e os
// distratores. A figura nunca mostra a resposta (célula-alvo vazia, linha com "?").
// ============================================================
import type { Construida, Distrator, FiguraConstruida } from "./construcao.js";
import type { Letra, PlanilhaDados, TabelaDados } from "../shared/tipos.js";
import { Planilha, textoDaCelula } from "../shared/planilha.js";

const sortear = <T>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)];
const inteiro = (a: number, b: number, passo = 1) => a + passo * Math.floor(Math.random() * (Math.floor((b - a) / passo) + 1));
const r2 = (x: number) => Math.round(x * 100) / 100;
const r4 = (x: number) => Math.round(x * 10000) / 10000;
const brl = (x: number) => `R$ ${x.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num4 = (x: number) => x.toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
const embaralhar = <T>(xs: readonly T[]): T[] => xs.map((x) => [Math.random(), x] as const).sort((a, b) => a[0] - b[0]).map(([, x]) => x);

// ---------- descrição em texto da figura (para a IA escrever e para o auditor resolver às cegas) ----------
// A IA às vezes copia a figura no enunciado como tabela de texto ("| A | B | |---|---| …").
// A figura já é desenhada pelo app: o trecho do primeiro ao último "|" sai do texto.
// (só com 6+ barras ou linha separadora: "|x − 2|" de módulo fica intacto)
export function tirarTabelaCopiada(texto: string): string {
  const i = texto.indexOf("|");
  const j = texto.lastIndexOf("|");
  if (i < 0 || j <= i) return texto;
  const trecho = texto.slice(i, j + 1);
  if ((trecho.match(/\|/g) ?? []).length < 6 && !/\|\s*:?-{3,}/.test(trecho)) return texto;
  return `${texto.slice(0, i).trimEnd()} ${texto.slice(j + 1).trimStart()}`.trim();
}

export function descreverFigura(f: FiguraConstruida): string {
  if (f.tipo === "tabela") {
    const t = f.dados;
    const linhas = [...(t.cabecalho ? [t.cabecalho] : []), ...t.linhas].map((l) => `| ${l.map((c) => c || " ").join(" | ")} |`);
    return `Tabela (${f.legenda}):\n${linhas.join("\n")}`;
  }
  const p = f.dados;
  const motor = new Planilha(p);
  const cols = Array.from({ length: p.colunas }, (_, i) => String.fromCharCode(65 + i));
  const linhas: string[] = [];
  for (let l = 1; l <= p.linhas; l++) {
    const cel = cols.map((c) => `${c}${l}=${textoDaCelula(motor, p, `${c}${l}`) || "(vazia)"}`);
    if (cel.some((x) => !x.endsWith("(vazia)"))) linhas.push(cel.join("; "));
  }
  return `Planilha (${f.legenda}), célula selecionada ${p.selecionada ?? "-"} (vazia):\n${linhas.join("\n")}`;
}

// ============================================================
// Informática · Planilhas eletrônicas: valor de uma fórmula (planilha)
// ============================================================
const CONJUNTOS_PLANILHA = [
  { colA: "CLIENTE", nomes: ["Ana", "Bruno", "Carla", "Diego", "Elisa", "Fábio", "Gabi", "Hugo"], colB: "SALDO", moeda: true, colC: "TIPO", cats: ["PF", "PJ"] },
  { colA: "AGÊNCIA", nomes: ["Centro", "Norte", "Sul", "Leste", "Oeste", "Praia", "Serra", "Vale"], colB: "CONTAS", moeda: false, colC: "META", cats: ["Sim", "Não"] },
  { colA: "CODPROD", nomes: ["P101", "P102", "P103", "P104", "P105", "P106", "P107", "P108"], colB: "VALOR", moeda: true, colC: "LINHA", cats: ["Crédito", "Seguro"] },
] as const;

function planilhaFormula(): Construida {
  const k = sortear(CONJUNTOS_PLANILHA);
  const nomes = embaralhar(k.nomes).slice(0, 6);
  const valores = nomes.map(() => (k.moeda ? inteiro(5, 60) : inteiro(3, 40)));
  const cats = nomes.map(() => sortear(k.cats));
  if (new Set(cats).size < 2) cats[0] = k.cats[cats[0] === k.cats[0] ? 1 : 0];
  const celulas: Record<string, string> = { A1: k.colA, B1: k.colB, C1: k.colC };
  const formatos: PlanilhaDados["formatos"] = {};
  nomes.forEach((n, i) => {
    celulas[`A${i + 2}`] = n;
    celulas[`B${i + 2}`] = String(valores[i]);
    celulas[`C${i + 2}`] = cats[i];
    if (k.moeda) formatos[`B${i + 2}`] = "moeda";
  });
  const alvo = sortear(["D10", "E9", "D9", "B10"]);
  const dados: PlanilhaDados = { colunas: 5, linhas: 10, celulas, formatos, selecionada: alvo };
  const avaliar = (f: string) => {
    const v = new Planilha({ ...dados, celulas: { ...celulas, [alvo]: f } }).valor(alvo);
    if (typeof v !== "number") throw new Error("fórmula não numérica");
    return r2(v);
  };

  const limite = sortear(valores);
  const cat = sortear(k.cats);
  const outra = k.cats.find((c) => c !== cat)!;
  const nomeProc = sortear(nomes);
  type Caso = { nome: string; f: string; etapas: number; contagem?: boolean; erros: [string, string][] };
  const casos: Caso[] = [
    {
      nome: "SOMA",
      f: "=SOMA(B2:B7)",
      etapas: 1,
      erros: [["=SOMA(B2:B6)", "deixou a última linha fora do intervalo"], ["=SOMA(B3:B7)", "começou o intervalo na linha 3"], ["=MÉDIA(B2:B7)", "calculou a média em vez da soma"], ["=MÁXIMO(B2:B7)", "pegou só o maior valor"], ["=SOMA(B2:B7)+B2", "somou a primeira célula duas vezes"], ["=SOMA(B2:B7)-B7", "esqueceu a última parcela"]],
    },
    {
      nome: "MÉDIA",
      f: "=MÉDIA(B2:B7)",
      etapas: 1,
      erros: [["=SOMA(B2:B7)/5", "dividiu por 5 em vez de 6"], ["=MÉDIA(B2:B6)", "deixou a última linha fora"], ["=MÉDIA(B3:B7)", "começou o intervalo na linha 3"], ["=SOMA(B2:B7)/7", "contou o cabeçalho como valor"], ["=(MÁXIMO(B2:B7)+MÍNIMO(B2:B7))/2", "fez a média só do maior e do menor"]],
    },
    {
      nome: "CONT.SE",
      f: `=CONT.SE(B2:B7;">=${limite}")`,
      etapas: 1,
      contagem: true,
      erros: [[`=CONT.SE(B2:B7;">${limite}")`, `usou "maior que" e deixou de fora o próprio ${limite}`], [`=CONT.SE(B2:B7;"<${limite}")`, "inverteu o critério"], [`=CONT.SE(B2:B7;"<=${limite}")`, "inverteu o critério e incluiu o limite"], [`=CONT.SE(B2:B6;">=${limite}")`, "deixou a última linha fora"], ["=CONT.VALORES(B2:B7)", "contou todas as células, sem critério"], ["=CONT.VALORES(A1:A7)", "contou também o cabeçalho"]],
    },
    {
      nome: "SOMASE",
      f: `=SOMASE(C2:C7;"${cat}";B2:B7)`,
      etapas: 2,
      erros: [[`=SOMASE(C2:C7;"${outra}";B2:B7)`, `somou os de "${outra}" em vez de "${cat}"`], ["=SOMA(B2:B7)", "somou tudo, sem o critério"], [`=CONT.SE(C2:C7;"${cat}")`, "contou em vez de somar"], [`=SOMASE(C2:C6;"${cat}";B2:B6)`, "deixou a última linha fora"], [`=SOMASE(C2:C7;"${cat}";B2:B7)+SOMASE(C2:C7;"${outra}";B2:B7)/2`, "misturou as duas categorias"]],
    },
    {
      nome: "AMPLITUDE",
      f: "=MÁXIMO(B2:B7)-MÍNIMO(B2:B7)",
      etapas: 2,
      erros: [["=MÁXIMO(B2:B7)", "parou no maior valor"], ["=MÍNIMO(B2:B7)", "pegou só o menor valor"], ["=MÁXIMO(B2:B7)+MÍNIMO(B2:B7)", "somou em vez de subtrair"], ["=MÁXIMO(B2:B6)-MÍNIMO(B2:B6)", "deixou a última linha fora"], ["=MÁXIMO(B3:B7)-MÍNIMO(B3:B7)", "começou o intervalo na linha 3"]],
    },
    {
      nome: "PROCV",
      f: `=PROCV("${nomeProc}";A2:B7;2;FALSO)`,
      etapas: 2,
      erros: nomes.filter((n) => n !== nomeProc).map((n): [string, string] => [`=PROCV("${n}";A2:B7;2;FALSO)`, `leu a linha de ${n}`]),
    },
  ];
  const c = sortear(casos);
  const correta = avaliar(c.f);
  const distratores: Distrator[] = c.erros.map(([f, erro]) => ({ valor: avaliar(f), erro: `${erro} (${f})` }));
  const unidade: Construida["unidade"] = c.contagem || !k.moeda ? "numero" : "reais";
  return {
    tipo: "fórmula em planilha (com figura)",
    etapas: c.etapas,
    pergunta: `o valor que aparecerá na célula ${alvo} ao executar a fórmula ${c.f}`,
    dados: [alvo, c.f],
    fatoresDados: {},
    expressao: String(correta),
    resolucao: `A fórmula ${c.f} aplicada aos dados da planilha resulta em ${unidade === "reais" ? brl(correta) : correta.toLocaleString("pt-BR")}.`,
    unidade,
    correta,
    distratores,
    figura: { tipo: "planilha", posicao: "enunciado", legenda: `Planilha com ${k.colA.toLowerCase()}, ${k.colB.toLowerCase()} e ${k.colC.toLowerCase()}`, dados },
  };
}

// ============================================================
// Matemática · sistema linear em tabela (estilo BB 2023 nº 19)
// A linha pedida é combinação das outras duas: a resposta é única sem achar os preços.
// ============================================================
const ITENS_TABELA = [
  ["Armário", "Mesa", "Cadeira"],
  ["Cofre", "Terminal", "Impressora"],
  ["Pacote A", "Pacote B", "Pacote C"],
  ["Notebook", "Monitor", "Teclado"],
] as const;

function sistemaLinearTabela(): Construida {
  for (;;) {
    const itens = sortear(ITENS_TABELA);
    const precos = itens.map(() => inteiro(120, 900, 10));
    const qX = itens.map(() => inteiro(1, 6));
    const qY = itens.map(() => inteiro(1, 6));
    const [a, b] = sortear([[1, 1], [2, 1], [1, 2], [2, -1], [3, -1], [1, -1]] as const);
    const qZ = qX.map((x, i) => a * x + b * qY[i]);
    if (qZ.some((z) => z <= 0) || qZ.join() === qX.join() || qZ.join() === qY.join()) continue;
    const tot = (q: number[]) => q.reduce((s, x, i) => s + x * precos[i], 0);
    const [TX, TY, TZ] = [tot(qX), tot(qY), tot(qZ)];
    const tabela: TabelaDados = {
      cabecalho: ["", ...itens, "Custo total (R$)"],
      linhas: [
        ["Agência X", ...qX.map(String), String(TX)],
        ["Agência Y", ...qY.map(String), String(TY)],
        ["Agência Z", ...qZ.map(String), "?"],
      ],
    };
    const soma = (q: number[]) => q.reduce((s, x) => s + x, 0);
    const sinal = b >= 0 ? `+ ${b}` : `− ${-b}`;
    return {
      tipo: "sistema linear em tabela (com figura)",
      etapas: 2,
      pergunta: "o custo total da compra para a Agência Z, em reais",
      dados: ["Agência X", "Agência Y", "Agência Z"],
      fatoresDados: {},
      expressao: `${a} * ${TX} + ${b} * ${TY}`,
      resolucao: `As quantidades de Z são ${a} × (X) ${sinal} × (Y), item a item. Logo o custo de Z = ${a} × ${TX} ${sinal} × ${TY} = ${TZ} (sem precisar achar o preço de cada item).`,
      unidade: "reais",
      correta: TZ,
      distratores: [
        { valor: TX + TY, erro: "somou os totais de X e Y" },
        { valor: r2((TX + TY) / 2), erro: "fez a média dos totais" },
        { valor: a * TX, erro: "usou só a Agência X" },
        { valor: Math.abs(b) * TY, erro: "usou só a Agência Y" },
        { valor: b * TX + a * TY, erro: "trocou os coeficientes de X e Y" },
        { valor: Math.abs(a * TX - b * TY), erro: "trocou o sinal de uma das parcelas" },
        { valor: r2((TX / soma(qX)) * soma(qZ)), erro: "usou um preço médio por item de X" },
        { valor: r2((TY / soma(qY)) * soma(qZ)), erro: "usou um preço médio por item de Y" },
        { valor: 2 * TX, erro: "dobrou o total de X" },
        { valor: 2 * TY, erro: "dobrou o total de Y" },
      ],
      figura: { tipo: "tabela", posicao: "enunciado", legenda: `Quantidades de ${itens.join(", ").toLowerCase()} e custo total por agência`, dados: tabela },
    };
  }
}

// ============================================================
// Juros compostos · série de depósitos em tabela (estilo BB 2021 nº 27)
// ============================================================
function serieDepositos(): Construida {
  const i = sortear([0.05, 0.1]);
  const iguais = Math.random() < 0.5;
  const base = sortear([2000, 5000, 10000]);
  const D = [0, 1, 2, 3].map(() => (iguais ? base : sortear([1000, 2000, 3000, 4000, 5000]) * (base / 1000 > 5 ? 2 : 1)));
  const F = [1, 2, 3, 4].map((n) => r4((1 + i) ** n)); // F[n-1] = (1+i)^n
  const chave = (n: number) => `${r4(1 + i)}^${n}`;
  const txt = (n: number) => `${String(r4(1 + i)).replace(".", ",")}^${n} = ${num4(F[n - 1])}`;
  // depósito no início dos anos 1–4; montante no início do ano 5
  const M = r2(D[0] * F[3] + D[1] * F[2] + D[2] * F[1] + D[3] * F[0]);
  const taxa = `${(i * 100).toLocaleString("pt-BR")}% ao ano`;
  const somaD = D.reduce((s, x) => s + x, 0);
  return {
    tipo: "série de depósitos em tabela (com figura)",
    etapas: 2,
    pergunta: "o montante acumulado no início do ano 5, considerando os depósitos da tabela",
    dados: [taxa, txt(2), txt(3), txt(4)],
    fatoresDados: { [chave(2)]: F[1], [chave(3)]: F[2], [chave(4)]: F[3] },
    expressao: `${D[0]} * ${chave(4)} + ${D[1]} * ${chave(3)} + ${D[2]} * ${chave(2)} + ${D[3]} * ${r4(1 + i)}`,
    resolucao: `Cada depósito rende até o início do ano 5: ${D.map((d, k) => `${brl(d)} × ${num4(F[3 - k])}`).join(" + ")} = ${brl(M)}.`,
    unidade: "reais",
    correta: M,
    distratores: [
      { valor: somaD, erro: "ignorou os juros e só somou os depósitos" },
      { valor: r2(D.reduce((s, d, k) => s + d * (1 + i * (4 - k)), 0)), erro: "usou juros simples" },
      { valor: r2(M / (1 + i)), erro: "esqueceu de capitalizar o último ano" },
      { valor: r2(M * (1 + i)), erro: "capitalizou um ano a mais" },
      { valor: r2(M * (1 + i) ** 2), erro: "capitalizou dois anos a mais" },
      { valor: r2(somaD * (1 + 4 * i)), erro: "aplicou 4 anos de juros simples a todos os depósitos" },
      { valor: r2(somaD * r4((1 + i) ** 5)), erro: "aplicou 5 anos de juros compostos a todos os depósitos" },
      { valor: r2(M + somaD * i), erro: "somou mais um ano de juros sobre os depósitos" },
      { valor: r2(D.reduce((s, d, k) => s + d * Math.ceil(F[3 - k] * 100) / 100, 0)), erro: "arredondou os fatores para cima antes da hora" },
      { valor: r2(somaD * F[3]), erro: "aplicou o fator de 4 anos a todos os depósitos" },
      { valor: r2(D[0] * F[3]), erro: "considerou só o primeiro depósito" },
      { valor: r2(D.reduce((s, d, k) => s + d * Math.floor(F[3 - k] * 100) / 100, 0)), erro: "arredondou os fatores antes da hora" },
    ],
    figura: {
      tipo: "tabela",
      posicao: "enunciado",
      legenda: "Depósitos feitos no início de cada ano",
      dados: { cabecalho: ["Início do ano 1", "Início do ano 2", "Início do ano 3", "Início do ano 4"], linhas: [D.map(brl)] },
    },
  };
}

// ============================================================
// Vendas · taxa de abandono em tabela (estilo BB 2023 nº 60)
// Só gera com fonte de Vendas ingerida (regra 3). A empresa certa cai na letra sorteada.
// ============================================================
function taxaAbandono(gabarito: Letra): Construida {
  const empresas = ["V", "W", "X", "Y", "Z"];
  const pos = "ABCDE".indexOf(gabarito);
  const pede = sortear(["menor", "maior"] as const);
  for (;;) {
    const ini = empresas.map(() => inteiro(300, 900, 10));
    const fin = ini.map((n) => Math.round(n * (0.4 + Math.random() * 0.5)));
    const abandono = ini.map((n, k) => 1 - fin[k] / n);
    const alvo = pede === "menor" ? Math.min(...abandono) : Math.max(...abandono);
    const k = abandono.indexOf(alvo);
    const outras = abandono.filter((_, j) => j !== k);
    const folga = Math.min(...outras.map((x) => Math.abs(x - alvo)));
    if (k !== pos || folga < 0.02) continue; // certa na letra sorteada e sem empate visual
    const maisFin = fin.indexOf(Math.max(...fin));
    const menosIni = ini.indexOf(Math.min(...ini));
    const oposta = abandono.indexOf(pede === "menor" ? Math.max(...abandono) : Math.min(...abandono));
    const absoluto = ini.map((n, j) => n - fin[j]);
    const menorAbs = absoluto.indexOf(Math.min(...absoluto));
    const erroDe = (j: number) =>
      j === oposta ? `tem a ${pede === "menor" ? "MAIOR" : "MENOR"} taxa de abandono (inverteu o pedido)`
        : j === maisFin ? "tem mais compras finalizadas, mas a taxa olha a proporção, não o total"
        : j === menosIni ? "tem menos compras iniciadas, o que não decide a taxa"
        : j === menorAbs ? "tem o menor abandono em número absoluto, não em proporção"
        : "leu a linha errada da tabela";
    const pctTxt = (x: number) => `${(x * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
    return {
      tipo: "taxa de abandono em tabela (com figura)",
      etapas: 2,
      pergunta: `a empresa que registrou a ${pede} taxa de abandono (compras iniciadas e não finalizadas, em proporção das iniciadas)`,
      dados: [],
      fatoresDados: {},
      expressao: String(k),
      resolucao: `Taxa de abandono = (iniciadas − finalizadas) / iniciadas: ${empresas.map((e, j) => `${e} ${pctTxt(abandono[j])}`).join("; ")}. A ${pede} é a de ${empresas[k]}.`,
      unidade: "rotulo",
      rotulos: empresas,
      correta: k,
      distratores: empresas.map((_, j) => j).filter((j) => j !== k).map((j) => ({ valor: j, erro: erroDe(j) })),
      figura: {
        tipo: "tabela",
        posicao: "enunciado",
        legenda: "Compras iniciadas e finalizadas na semana, por empresa",
        dados: { cabecalho: ["Empresa", "Compras iniciadas na semana", "Compras finalizadas na semana"], linhas: empresas.map((e, j) => [e, String(ini[j]), String(fin[j])]) },
      },
    };
  }
}

export const CATALOGO_FIGURAS: Record<string, { porTipo: Record<string, (g: Letra) => Construida> }> = {
  "Planilhas eletrônicas": { porTipo: { "fórmula em planilha (com figura)": planilhaFormula } },
  "Funções e equações de 1º e 2º grau": { porTipo: { "sistema linear em tabela (com figura)": sistemaLinearTabela } },
  "Juros compostos": { porTipo: { "série de depósitos em tabela (com figura)": serieDepositos } },
  "Técnicas de vendas": { porTipo: { "taxa de abandono em tabela (com figura)": taxaAbandono } },
};
