// Utilidades dos templates por construção (formatos do Brasil, fatores dados, erros clássicos)
export type Distrator = { valor: number; erro: string };

export const sortear = <T>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)];
export const inteiro = (min: number, max: number, passo = 1) => min + passo * Math.floor(Math.random() * (Math.floor((max - min) / passo) + 1));
export const r2 = (x: number) => Math.round(x * 100) / 100;
export const r4 = (x: number) => Math.round(x * 10000) / 10000;
export const brl = (x: number) => `R$ ${x.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const num4 = (x: number) => x.toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
export const pct = (x: number) => `${x.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
export const taxaTxt = (i: number) => `${(i * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
export const base = (i: number) => String(r4(1 + i)); // 1.04
export const fatorChave = (i: number, n: number) => `${base(i)}^${n}`; // "1.04^8"
export const fatorTxt = (i: number, n: number, f: number) => `${base(i).replace(".", ",")}^${n} = ${num4(f)}`; // "1,04^8 = 1,3686"
export const fator = (i: number, n: number) => r4((1 + i) ** n);
// erro clássico "prazo errado", para os dois lados (n ± 1, n ± 2)
export const prazoErrado = (n: number, valor: (k: number) => number): Distrator[] =>
  [n - 2, n - 1, n + 1, n + 2].filter((k) => k > 0).map((k) => ({ valor: valor(k), erro: `usou n = ${k} em vez de ${n}` }));
// erro clássico "arredondamento antecipado" do fator, para baixo e para cima
export const arredondouFator = (F: number, valor: (f: number) => number): Distrator[] => [
  { valor: valor(Math.floor(F * 100) / 100), erro: `arredondou o fator antes da hora: ${num4(F)} → ${(Math.floor(F * 100) / 100).toLocaleString("pt-BR")}` },
  { valor: valor(Math.ceil(F * 100) / 100), erro: `arredondou o fator para cima antes da hora: ${num4(F)} → ${(Math.ceil(F * 100) / 100).toLocaleString("pt-BR")}` },
];
export const fatorial = (n: number): number => (n <= 1 ? 1 : n * fatorial(n - 1));
export const combinacoes = (n: number, p: number) => Math.round(fatorial(n) / (fatorial(p) * fatorial(n - p)));
export const arranjos = (n: number, p: number) => Math.round(fatorial(n) / fatorial(n - p));
