// Orçamento por modelo (esteira de conteúdo, decisão do dono 26/10/2026): no lugar do teto fixo GERACAO_MAX_DIA,
// cada modelo grátis tem um BALDE que enche no ritmo medido (chamadas por minuto). Funções puras.

export type Balde = { porMinuto: number; capacidade: number; fichas: number; em: number };

export function novoBalde(porMinuto: number, agora = Date.now()): Balde {
  const capacidade = Math.max(1, Math.floor(porMinuto));
  return { porMinuto, capacidade, fichas: capacidade, em: agora };
}

export function encher(b: Balde, agora = Date.now()): Balde {
  const fichas = Math.min(b.capacidade, b.fichas + ((agora - b.em) / 60_000) * b.porMinuto);
  return { ...b, fichas, em: agora };
}

// gasta uma ficha se houver; senão diz quanto falta esperar pela próxima
export function consumir(b: Balde, agora = Date.now()): { balde: Balde; ok: boolean; esperaMs: number } {
  const cheio = encher(b, agora);
  if (cheio.fichas >= 1) return { balde: { ...cheio, fichas: cheio.fichas - 1 }, ok: true, esperaMs: 0 };
  return { balde: cheio, ok: false, esperaMs: Math.ceil(((1 - cheio.fichas) / b.porMinuto) * 60_000) };
}

// Capacidade real a partir da telemetria: nos minutos em que houve 429, quantas chamadas passaram antes de o
// provedor recusar (o menor desses minutos é o limite); sem nenhum 429, o pico observado é só um piso.
// Usa 80% do limite como ritmo seguro.
export const FOLGA = 0.8;
export type ChamadaTelemetria = { em: number; ok: boolean; falha?: string | null };
export function estimarCapacidade(chamadas: ChamadaTelemetria[]): { rpm: number; base: "429" | "pico" | "sem_dados"; minutos: number } {
  if (!chamadas.length) return { rpm: 0, base: "sem_dados", minutos: 0 };
  const porMinuto = new Map<number, { ok: number; recusadas: number }>();
  for (const c of chamadas) {
    const m = Math.floor(c.em / 60_000);
    const x = porMinuto.get(m) ?? { ok: 0, recusadas: 0 };
    if (c.falha === "429") x.recusadas++;
    else if (c.ok) x.ok++;
    porMinuto.set(m, x);
  }
  const comRecusa = [...porMinuto.values()].filter((x) => x.recusadas > 0 && x.ok > 0);
  if (comRecusa.length) return { rpm: Math.max(1, Math.floor(Math.min(...comRecusa.map((x) => x.ok)) * FOLGA)), base: "429", minutos: porMinuto.size };
  return { rpm: Math.max(1, Math.max(...[...porMinuto.values()].map((x) => x.ok))), base: "pico", minutos: porMinuto.size };
}

// relatório diário: chamadas usadas × capacidade das horas em que a IA trabalhou
export function usoDaCapacidade(chamadasHoje: number, rpm: number, minutosTrabalhados: number) {
  const capacidade = Math.round(rpm * minutosTrabalhados);
  return { usadas: chamadasHoje, capacidade, fracao: capacidade ? chamadasHoje / capacidade : 0 };
}
