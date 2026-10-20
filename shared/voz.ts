export const VOZ_LOUISE = "Magpie-Multilingual.PT-BR.Louise" as const;
export const VOZES_NVIDIA = [VOZ_LOUISE, "Magpie-Multilingual.PT-BR.Diego", "Magpie-Multilingual.PT-BR.Isabela"] as const;
export type VozLo = "Louise" | "Diego" | "Isabela";

export function vozTtsPadrao(valor?: string | null): (typeof VOZES_NVIDIA)[number] {
  const definido = valor?.trim();
  return VOZES_NVIDIA.find((voz) => voz === definido) ?? VOZ_LOUISE;
}

export function preferenciaVozLoSalva(valor: unknown, manual: unknown): { vozLo: VozLo; vozLoManual: boolean } {
  if (manual === true && (valor === "Louise" || valor === "Diego" || valor === "Isabela")) {
    return { vozLo: valor, vozLoManual: true };
  }
  // Valores guardados antes do marcador eram herdados do padrão antigo; migra para Louise.
  return { vozLo: "Louise", vozLoManual: false };
}

export function escolherVozNavegador<T extends { lang?: string }>(vozes: readonly T[]): T | undefined {
  const idioma = (voz: T) => voz.lang?.trim().toLowerCase().replaceAll("_", "-") ?? "";
  return vozes.find((voz) => /^pt-br(?:-|$)/.test(idioma(voz))) ?? vozes.find((voz) => /^pt(?:-|$)/.test(idioma(voz)));
}

export function cacheDeVozRemovivel(voz: string): boolean {
  return !VOZES_NVIDIA.includes(voz as (typeof VOZES_NVIDIA)[number]);
}
