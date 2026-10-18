// ============================================================
// BB Estudos — Catálogo de modelos e correntes por função (sem rede, sem banco)
// data/modelos.json: id, família, funções, gratuidade, status, parâmetros aceitos.
// Corrente = lista ordenada de modelos para uma função (principal + reservas).
// Regras: o auditor nunca é da família de quem gerou; o juiz de Português nunca é da
// família do escritor; preview nunca é principal; só endpoint grátis.
// ============================================================
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

export const FUNCOES = ["gerador", "auditor", "escritor_pt", "juiz_pt", "tutor", "redacao"] as const;
export type Funcao = (typeof FUNCOES)[number];
export const NOME_FUNCAO: Record<Funcao, string> = {
  gerador: "Gerador",
  auditor: "Auditor",
  escritor_pt: "Escritor de Português",
  juiz_pt: "Juiz de Português",
  tutor: "Tutor",
  redacao: "Redação",
};

const ModeloZ = z.object({
  id: z.string().min(3),
  familia: z.string().min(2),
  funcoes: z.array(z.string()),
  gratis: z.boolean(),
  preview: z.boolean(),
  parametros: z.array(z.enum(["reasoning_budget", "reasoning_effort", "enable_thinking"])),
  status: z.enum(["ativo", "fora", "descontinuado", "nao_testado"]),
  descontinuaEm: z.string().optional(),
  nota: z.string().optional(),
});
export type ModeloCatalogo = z.infer<typeof ModeloZ>;
export type Catalogo = Map<string, ModeloCatalogo>;

let cache: Catalogo | null = null;
export function carregarCatalogo(): Catalogo {
  if (cache) return cache;
  const bruto = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "data", "modelos.json"), "utf8"));
  const r = z.object({ modelos: z.array(ModeloZ) }).safeParse(bruto);
  if (!r.success) throw new Error(`data/modelos.json inválido: ${z.prettifyError(r.error)}`);
  return (cache = new Map(r.data.modelos.map((m) => [m.id, m])));
}

// família pelo catálogo; sem cadastro, pelo dono do id ("z-ai/…" → zai)
const DONO: Record<string, string> = { "z-ai": "zai", "deepseek-ai": "deepseek", "stepfun-ai": "stepfun" };
export function familiaDe(id: string, cat: Catalogo = carregarCatalogo()): string {
  const dono = id.split("/")[0];
  return cat.get(id)?.familia ?? DONO[dono] ?? dono;
}

export type Correntes = Record<Funcao, string[]>;
const unicos = (ids: (string | undefined)[]) => [...new Set(ids.filter((x): x is string => !!x?.trim()).map((x) => x.trim()))];

// Legado = o que roda hoje sem corrente aprovada: os modelos do .env
export function correntesLegado(env: NodeJS.ProcessEnv = process.env): Correntes {
  const gerador = unicos([env.GERADOR_MODEL]);
  const auditor = unicos([env.AUDITOR_MODEL, env.AUDITOR_MODEL_RESERVA]);
  return {
    gerador,
    auditor,
    escritor_pt: unicos([env.ESCRITOR_PT_MODEL || env.GERADOR_MODEL, env.ESCRITOR_PT_MODEL_RESERVA]),
    juiz_pt: auditor,
    tutor: gerador,
    redacao: auditor,
  };
}

// CORRENTE_GERADOR="id1,id2,id3" etc.; função sem variável fica com o legado
export function correntesDoEnv(env: NodeJS.ProcessEnv = process.env): Correntes {
  const legado = correntesLegado(env);
  return Object.fromEntries(
    FUNCOES.map((f) => {
      const v = env[`CORRENTE_${f.toUpperCase()}`];
      return [f, v ? unicos(v.split(",")) : legado[f]];
    })
  ) as Correntes;
}

// Quem é proibido de ser da mesma família de quem
export const FAMILIA_PROIBIDA: Partial<Record<Funcao, Funcao>> = { auditor: "gerador", juiz_pt: "escritor_pt" };

// Quem pode atender agora, na ordem da corrente: fora descontinuado, pago, desativado
// (erro permanente), pausado (falhas seguidas) e as famílias proibidas pela regra
export function elegiveis(
  corrente: string[],
  opcoes: { excluirFamilias?: string[]; fora?: Set<string> } = {},
  cat: Catalogo = carregarCatalogo()
): string[] {
  return corrente.filter((id) => {
    const m = cat.get(id);
    if (m && (m.status === "descontinuado" || !m.gratis)) return false;
    if (opcoes.fora?.has(id)) return false;
    return !(opcoes.excluirFamilias ?? []).includes(familiaDe(id, cat));
  });
}

// Validação de correntes propostas: erro impede aprovar; aviso aparece na tela
export function validarCorrentes(c: Correntes, cat: Catalogo = carregarCatalogo()): { erros: string[]; avisos: string[] } {
  const erros: string[] = [];
  const avisos: string[] = [];
  for (const f of FUNCOES) {
    const ids = c[f] ?? [];
    if (!ids.length) {
      erros.push(`${NOME_FUNCAO[f]}: corrente vazia`);
      continue;
    }
    for (const id of ids) {
      const m = cat.get(id);
      if (!m) erros.push(`${NOME_FUNCAO[f]}: ${id} não está no catálogo`);
      else if (!m.gratis) erros.push(`${NOME_FUNCAO[f]}: ${id} não é endpoint grátis`);
      else if (m.status === "descontinuado") erros.push(`${NOME_FUNCAO[f]}: ${id} está descontinuado`);
    }
    if (cat.get(ids[0])?.preview) erros.push(`${NOME_FUNCAO[f]}: ${ids[0]} é preview e não pode ser o principal`);
    if (ids.length < 3) avisos.push(`${NOME_FUNCAO[f]}: ${ids.length} opção(ões); o ideal são 3`);
  }
  // regra de família: com o principal de quem gera, tem que sobrar quem confere de outra família;
  // com uma reserva, faltar só faz a questão esperar (aviso)
  for (const [quem, deQuem] of Object.entries(FAMILIA_PROIBIDA) as [Funcao, Funcao][]) {
    (c[deQuem] ?? []).forEach((g, i) => {
      if (elegiveis(c[quem] ?? [], { excluirFamilias: [familiaDe(g, cat)] }, cat).length) return;
      const msg = `${NOME_FUNCAO[quem]}: se o ${NOME_FUNCAO[deQuem].toLowerCase()} for ${g}, não sobra ninguém de outra família`;
      (i === 0 ? erros : avisos).push(msg);
    });
  }
  return { erros, avisos };
}

// A corrente fere a regra de família? (o legado de hoje fere: Lightning e Super são Nemotron)
export function violacoesDeFamilia(c: Correntes, cat: Catalogo = carregarCatalogo()): string[] {
  const v: string[] = [];
  for (const [quem, deQuem] of Object.entries(FAMILIA_PROIBIDA) as [Funcao, Funcao][]) {
    const g = c[deQuem]?.[0];
    const a = c[quem]?.[0];
    if (g && a && familiaDe(g, cat) === familiaDe(a, cat))
      v.push(`${NOME_FUNCAO[quem]} (${a}) é da mesma família do ${NOME_FUNCAO[deQuem].toLowerCase()} (${g})`);
  }
  return v;
}
