// "Noites seguidas OK: N/5" (decisão do dono, 28/10/2026): quantas noites (janela A) seguidas, da mais recente
// para trás, rodaram com etapas e nenhuma "falhou". Relatório antigo sem etapas interrompe a contagem.
export const META_NOITES_OK = 5;

export function noitesSeguidasOk(relatorios: { janela?: string | null; etapas?: { status?: string | null }[] | null }[]): number {
  let n = 0;
  for (const r of relatorios) {
    if ((r.janela ?? "A") !== "A") continue; // a Janela B (recuperação) não conta como noite
    const etapas = r.etapas ?? [];
    if (!etapas.length || etapas.some((e) => e.status === "falhou")) break;
    n++;
  }
  return n;
}

export const textoNoitesOk = (n: number) => `noites seguidas OK: ${n}/${META_NOITES_OK}`;
