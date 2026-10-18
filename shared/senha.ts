// Força da senha e e-mail: a mesma regra no cadastro (tela) e no servidor (que recusa senha fraca)
export type Forca = { nota: 0 | 1 | 2 | 3 | 4; rotulo: string; dica?: string };
export const NOTA_MINIMA = 2;
export const TAMANHO_MINIMO = 8;

const COMUNS = ["123456", "12345678", "senha", "password", "qwerty", "abc123", "111111", "000000", "bancodobrasil", "lobo", "concurso", "iloveyou"];

export function forcaSenha(s: string): Forca {
  if (!s) return { nota: 0, rotulo: "", dica: `Use pelo menos ${TAMANHO_MINIMO} caracteres.` };
  if (s.length < TAMANHO_MINIMO) return { nota: 0, rotulo: "Curta demais", dica: `Faltam ${TAMANHO_MINIMO - s.length} caractere(s).` };
  const baixa = s.toLowerCase();
  if (COMUNS.some((c) => baixa.includes(c)) || /^(.)\1+$/.test(s) || /^(0123456789|abcdefgh)/.test(baixa))
    return { nota: 1, rotulo: "Fraca", dica: "Evite sequências e palavras óbvias." };
  const tipos = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(s)).length;
  let nota = 1 + (tipos >= 2 ? 1 : 0) + (tipos >= 3 ? 1 : 0) + (s.length >= 12 ? 1 : 0);
  if (s.length >= 16) nota++;
  const n = Math.min(4, nota) as Forca["nota"];
  const rotulo = ["Curta demais", "Fraca", "Razoável", "Boa", "Forte"][n];
  const dica = n < 3 ? (tipos < 3 ? "Misture letras maiúsculas, números ou símbolos." : "Uma frase com 12+ caracteres é ainda melhor.") : undefined;
  return { nota: n, rotulo, dica };
}

export const emailValido = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim());
export const normalizarEmail = (e: string) => e.trim().toLowerCase();
