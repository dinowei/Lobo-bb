// Rede de especialistas sob controle do CÓDIGO (V2 §6 e pedido do dono, 24/10/2026).
// Modelos não conversam livremente: cada etapa entrega um CONTRATO em JSON (tarefa, modelo de origem,
// função, fontes, resultado, confiança, pendências, evidências, próximo revisor, status). Quem decide
// o estado final é decidirEstado(), puro e testado: nenhum modelo sozinho aprova, publica, declara
// fonte vigente, mexe em gabarito oficial ou em dado do aluno.
import { z } from "zod";

export const FUNCOES_ESPECIALISTA = [
  "gerador", "auditor", "verificador_fonte", "escritor_pt", "juiz_pt", "contraexemplo", "tutor",
  "planejador", "multimodal", "classificador", "voz",
] as const;
export type FuncaoEspecialista = (typeof FUNCOES_ESPECIALISTA)[number];

// o que cada função NUNCA pode decidir sozinha (V2 §6); o código barra se o contrato tentar
export const PROIBIDO: Record<FuncaoEspecialista, string> = {
  gerador: "aprovar sozinho",
  auditor: "alterar a fonte original",
  verificador_fonte: "declarar fonte vigente sem trecho literal",
  escritor_pt: "mudar o conteúdo factual",
  juiz_pt: "substituir o gabarito oficial",
  contraexemplo: "inventar norma",
  tutor: "contradizer gabarito e explicação aprovados",
  planejador: "ignorar regras e desempenho",
  multimodal: "tratar OCR incerto como fato",
  classificador: "decidir o estado final",
  voz: "criar conteúdo novo",
};

export const FonteUsadaZ = z.object({
  fonteId: z.string().min(1),
  pagina: z.number().int().nonnegative().optional(),
  trecho: z.string().min(1), // literal: o código confere contra o texto da fonte
  camada: z.enum(["A", "B", "C"]).optional(),
});

export const StatusContratoZ = z.enum(["proposto", "aprovado", "reprovado", "aguardando", "falhou"]);

export const ContratoZ = z.object({
  tarefa: z.object({ id: z.string().min(1), tipo: z.string().min(1) }),
  modeloOrigem: z.string().min(1), // "codigo" quando a etapa é determinística (mathjs, trava de posição)
  familia: z.string().min(1), // família do modelo (independência); "codigo" para etapas determinísticas
  funcao: z.enum([...FUNCOES_ESPECIALISTA, "codigo"]),
  fontes: z.array(FonteUsadaZ).default([]),
  resultado: z.unknown(),
  confianca: z.enum(["alta", "media", "baixa"]),
  pendencias: z.array(z.string()).default([]),
  evidencias: z.array(z.string()).default([]),
  proximoRevisor: z.union([z.enum([...FUNCOES_ESPECIALISTA, "codigo"]), z.null()]),
  status: StatusContratoZ,
});
export type Contrato = z.infer<typeof ContratoZ>;

// Afirmação verificável (V2 §8): toda frase factual de ficha, aula ou explicação tenta virar isto
export const AfirmacaoZ = z.object({
  afirmacao: z.string().min(1),
  classe: z.enum(["fato", "regra_normativa", "conceito", "interpretacao", "inferencia", "hipotese", "exemplo"]),
  fonteId: z.string().nullable(),
  pagina: z.number().int().nonnegative().nullable(),
  trechoLiteral: z.string().nullable(),
  vigente: z.boolean().nullable(),
  confianca: z.enum(["alta", "media", "baixa"]),
  conflito: z.boolean(),
  origem: z.enum(["oficial", "didatica", "gerada", "gemini"]),
  status: z.enum(["pendente", "aprovada", "rejeitada"]),
});
export type Afirmacao = z.infer<typeof AfirmacaoZ>;

// classes que só valem com trecho literal conferido (exemplo e hipótese são pedagógicos, marcados como tal)
const PRECISA_TRECHO = new Set<Afirmacao["classe"]>(["fato", "regra_normativa", "conceito"]);

export type EstadoFinal = "aprovada" | "rejeitada" | "aguardando_auditoria_independente" | "aguardando_fonte" | "pendente";

export interface Checagens {
  deterministicas: { nome: string; ok: boolean }[]; // mathjs, trava de posição, gabarito oficial, schema…
  trechosLiterais?: { trecho: string; achado: boolean }[]; // conferência no texto da fonte (código)
}

// O código decide. Regras, nesta ordem:
// 1) contrato inválido ou checagem determinística reprovada → rejeitada (o código manda sobre o modelo);
// 2) trecho citado que não existe na fonte → aguardando_fonte (nunca "vigente" sem trecho);
// 3) algum revisor reprovou → rejeitada;
// 4) aprovação de auditor exige família diferente da do gerador; sem ninguém independente →
//    aguardando_auditoria_independente (nunca aprovação silenciosa);
// 5) alguma etapa com pendência ou "aguardando" → pendente.
export function decidirEstado(contratos: unknown[], checagens: Checagens): { estado: EstadoFinal; motivos: string[] } {
  const motivos: string[] = [];
  const validos: Contrato[] = [];
  for (const [i, c] of contratos.entries()) {
    const r = ContratoZ.safeParse(c);
    if (!r.success) motivos.push(`contrato ${i} inválido`);
    else validos.push(r.data);
  }
  if (motivos.length) return { estado: "rejeitada", motivos };
  const reprovadasDet = checagens.deterministicas.filter((d) => !d.ok);
  if (reprovadasDet.length) return { estado: "rejeitada", motivos: reprovadasDet.map((d) => `checagem do código: ${d.nome}`) };
  const semTrecho = (checagens.trechosLiterais ?? []).filter((t) => !t.achado);
  if (semTrecho.length) return { estado: "aguardando_fonte", motivos: semTrecho.map((t) => `trecho não encontrado na fonte: "${t.trecho.slice(0, 60)}"`) };
  const reprovou = validos.filter((c) => c.status === "reprovado");
  if (reprovou.length) return { estado: "rejeitada", motivos: reprovou.map((c) => `${c.funcao} (${c.modeloOrigem}) reprovou`) };
  const gerador = validos.find((c) => c.funcao === "gerador" || c.funcao === "escritor_pt");
  const revisoresAprov = validos.filter((c) => (c.funcao === "auditor" || c.funcao === "juiz_pt" || c.funcao === "verificador_fonte") && c.status === "aprovado");
  const independentes = revisoresAprov.filter((c) => !gerador || c.familia !== gerador.familia);
  if (!independentes.length)
    return { estado: "aguardando_auditoria_independente", motivos: [revisoresAprov.length ? "só aprovou revisor da mesma família do gerador" : "nenhum revisor aprovou"] };
  const abertos = validos.filter((c) => c.status === "aguardando" || c.status === "falhou" || c.pendencias.length);
  if (abertos.length) return { estado: "pendente", motivos: abertos.flatMap((c) => c.pendencias.length ? c.pendencias : [`${c.funcao}: ${c.status}`]) };
  return { estado: "aprovada", motivos: [] };
}

// Afirmação: o código aceita fato/regra/conceito só com trecho literal achado e fonte vigente
export function decidirAfirmacao(a: Afirmacao, trechoAchado: boolean): Afirmacao["status"] {
  if (a.conflito) return "pendente"; // divergência vai para auditoria (e para o aluno, quando for o caso)
  if (!PRECISA_TRECHO.has(a.classe)) return a.classe === "hipotese" ? "pendente" : "aprovada"; // exemplo/interpretação/inferência: marcados, sem virar fato
  if (!a.fonteId || !a.trechoLiteral || !trechoAchado) return "rejeitada";
  if (a.vigente === false) return "rejeitada"; // revogada: sai do conteúdo vigente (fica no histórico)
  return a.vigente === true ? "aprovada" : "pendente";
}
