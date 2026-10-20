import { createHash } from "node:crypto";

export const hashFala = (textoFalado: string, voz: string) => createHash("sha256").update(`${voz}\n${textoFalado}`).digest("hex");
export const filtroCacheFala = (textoFalado: string, voz: string) => ({ hash: hashFala(textoFalado, voz), voz });
