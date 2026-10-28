// ============================================================
// Quantos erros o AUDITOR pega? (decisão do dono, 28/10: 3ª vez que ele aprova coisa ruim — €, frase sem
// sentido, inglês). Amostra de 20 casos montados por CÓDIGO a partir de seções de aula e fichas já avaliadas,
// cada um com UM erro conhecido plantado. O auditor atual (corrente "auditor") julga cada caso com o mesmo
// prompt que usa na produção; "pegou" = reprovou o caso. Meta do dono: ≥ 90%.
// Uso: bb -- avaliar-auditor (≈ 20 chamadas, de dia).
// ============================================================
import { AulaTema, Ficha } from "./models.js";
import { chatJSONFuncao } from "./corrente.js";
import { CHECKLIST_SECAO_SYSTEM, ChecklistSecaoZ, redacaoSecaoUser } from "./prompts.js";
import { AuditoriaZ, SISTEMA_AUDITOR } from "./fichas.js";

export type ErroPlantado = "moeda" | "frase_sem_sentido" | "ingles" | "regra_invertida" | "conta_errada" | "exemplo_fora_do_tema" | "pegadinha_falsa" | "contradiz_gabarito" | "nao_sustentada" | "numero_trocado";
type SecaoBase = { tema: string; subtema: string; explicacao: string; resumo: string; regras: { indice: number; texto: string; titulo: string }[]; exemplos: string[]; contraexemplos: string[]; pegadinhas: string[] };
export type CasoSecao = { tipo: "secao"; id: string; erro: ErroPlantado; secao: SecaoBase };
export type CasoFicha = { tipo: "ficha"; id: string; erro: ErroPlantado; tema: string; afirmacoes: { afirmacao: string; classe: string; trecho: string }[]; plantada: number };
export type CasoAuditor = CasoSecao | CasoFicha;

// plantas: cada uma devolve a seção com UM erro (ou null se não se aplica a esta seção)
export const PLANTAS_SECAO: Record<string, (s: SecaoBase) => SecaoBase | null> = {
  moeda: (s) => ({ ...s, explicacao: `${s.explicacao}\n\nPor exemplo, uma tarifa de 10 € sobre 200 € dá 20 €.` }),
  frase_sem_sentido: (s) => ({ ...s, explicacao: `${s.explicacao}\n\nIsso significa que a forma verbal deve concordar apenas com o próprio verbo, e não com a frase.` }),
  ingles: (s) => ({ ...s, explicacao: `${s.explicacao}\n\nIn short, the rule always applies when the subject comes after the verb.` }),
  regra_invertida: (s) => (/singular/.test(s.explicacao) ? { ...s, explicacao: s.explicacao.replace(/singular/g, "plural") } : /multiplic/.test(s.explicacao) ? { ...s, explicacao: s.explicacao.replace(/multiplic(a|ar|am|ando)/g, "som$1") } : null),
  conta_errada: (s) => (s.exemplos.some((e) => /Resposta: R\$/.test(e)) ? { ...s, exemplos: s.exemplos.map((e) => e.replace(/Resposta: R\$ ([\d.]+),(\d\d)/, (_m, a: string) => `Resposta: R$ ${Number(a.replace(/\./g, "")) + 37},00`)) } : null),
  exemplo_fora_do_tema: (s) => ({ ...s, exemplos: [...s.exemplos, /porcent|R\$/i.test(s.exemplos.join(" ")) ? "Um capital de R$ 1.000,00 aplicado a juros compostos de 10% ao mês por 2 meses rende R$ 210,00 de juros." : "“Refiro-me à proposta enviada ontem.” (crase obrigatória)"] }),
  pegadinha_falsa: (s) => ({ ...s, pegadinhas: [...s.pegadinhas, /porcent|R\$/i.test(s.exemplos.join(" ")) ? "Aumento e desconto de mesma taxa sempre se anulam: o preço volta ao valor inicial." : "Verbos impessoais sempre concordam com o termo que vem depois deles."] }),
  contradiz_gabarito: (s) => (s.contraexemplos.some((c) => /gabarito é/.test(c)) ? { ...s, explicacao: `${s.explicacao}\n\nAtenção: na questão oficial citada abaixo, a alternativa B era a correta.` } : null),
};

export function plantarFicha(afirmacoes: CasoFicha["afirmacoes"], erro: ErroPlantado): { afirmacoes: CasoFicha["afirmacoes"]; plantada: number } | null {
  if (!afirmacoes.length) return null;
  const i = 0;
  const a = afirmacoes[i];
  const nova =
    erro === "ingles" ? { ...a, afirmacao: "The rule always applies when the subject comes after the verb." }
      : erro === "nao_sustentada" ? { ...a, afirmacao: `${a.afirmacao.replace(/\.$/, "")}, e a banca Cesgranrio cobra isso em todas as provas desde 2010.` }
        : erro === "regra_invertida" ? (/\bnão\b/.test(a.afirmacao) ? { ...a, afirmacao: a.afirmacao.replace(/\bnão\s/, "") } : { ...a, afirmacao: `Não é verdade que ${a.afirmacao.charAt(0).toLowerCase()}${a.afirmacao.slice(1)}` })
          : erro === "numero_trocado" ? (/\d/.test(a.afirmacao) ? { ...a, afirmacao: a.afirmacao.replace(/\d+/, (n) => String(Number(n) + 7)) } : null)
            : null;
  return nova ? { afirmacoes: afirmacoes.map((x, j) => (j === i ? nova : x)), plantada: i + 1 } : null;
}

// monta a amostra: 12 seções (as aprovadas do desenho de 28/10, com erros plantados) + 8 fichas aprovadas
export async function montarAmostraAuditor(n = 20): Promise<CasoAuditor[]> {
  const aulas = await AulaTema.find().lean();
  const secoes: SecaoBase[] = aulas.flatMap((a) => a.secoes.filter((s) => s.status === "aprovada").map((s) => ({
    tema: a.nome ?? a.subtopico, subtema: s.subtema, explicacao: (s.conteudo ?? "").replace(/\n\n\*\*Fórmula:\*\*[\s\S]*$/, ""), resumo: s.resumo ?? "",
    regras: (s.fontes ?? []).map((f, i) => ({ indice: i + 1, texto: f.trecho ?? "", titulo: f.titulo ?? "" })), exemplos: s.exemplos, contraexemplos: s.contraexemplos, pegadinhas: s.pegadinhas,
  })));
  const casos: CasoAuditor[] = [];
  const tiposSecao = Object.keys(PLANTAS_SECAO) as ErroPlantado[];
  for (let k = 0; casos.length < Math.min(12, n) && k < tiposSecao.length * Math.max(1, secoes.length); k++) {
    const s = secoes[k % secoes.length];
    const erro = tiposSecao[k % tiposSecao.length];
    const plantada = s ? PLANTAS_SECAO[erro](s) : null;
    if (plantada && !casos.some((c) => c.id === `secao:${s.subtema}:${erro}`)) casos.push({ tipo: "secao", id: `secao:${s.subtema}:${erro}`, erro, secao: plantada });
  }
  const fichas = await Ficha.find({ status: "aprovada" }).sort({ createdAt: -1 }).limit(10).lean();
  const tiposFicha: ErroPlantado[] = ["ingles", "nao_sustentada", "regra_invertida", "numero_trocado"];
  for (let k = 0; casos.length < n && k < fichas.length * tiposFicha.length; k++) {
    const f = fichas[k % fichas.length];
    const erro = tiposFicha[Math.floor(k / fichas.length) % tiposFicha.length];
    const p = plantarFicha(f.afirmacoes.map((a) => ({ afirmacao: a.texto ?? "", classe: a.classe ?? "conceito", trecho: a.trecho ?? "" })), erro);
    if (p && !casos.some((c) => c.id === `ficha:${f.subtopico}:${erro}`)) casos.push({ tipo: "ficha", id: `ficha:${f.subtopico}:${erro}`, erro, tema: f.subtopico, ...p });
  }
  return casos.slice(0, n);
}

// "pegou" = reprovou (seção: algum item do checklist false; ficha: a afirmação plantada não sustentada ou classe errada)
export async function julgarCaso(c: CasoAuditor): Promise<{ pegou: boolean; modelo: string; resumo: string }> {
  if (c.tipo === "secao") {
    const s = c.secao;
    const entrada = redacaoSecaoUser({ tema: s.tema, subtema: s.subtema, regras: s.regras, exemplos: s.exemplos, contraexemplos: s.contraexemplos, pegadinhas: s.pegadinhas });
    const a = await chatJSONFuncao("auditor", CHECKLIST_SECAO_SYSTEM, `${entrada}\n\nEXPLICAÇÃO A CONFERIR:\n${s.explicacao}\n\nRESUMO:\n${s.resumo}`, 0, 1500);
    const r = ChecklistSecaoZ.parse(a.json);
    const pegou = !(r.regraCerta && r.exemploDoTema && r.pegadinhaVerdadeira && r.naoContradizGabarito);
    return { pegou, modelo: a.modelo, resumo: r.problemas.join(" | ").slice(0, 160) };
  }
  const lista = c.afirmacoes.map((x, i) => `${i + 1}. [${x.classe}] ${x.afirmacao}\n   TRECHO: "${x.trecho}"`).join("\n");
  const a = await chatJSONFuncao("auditor", SISTEMA_AUDITOR, `TEMA: ${c.tema}\n\n${lista}`, 0, 1500);
  const r = AuditoriaZ.parse(a.json);
  const v = r.porAfirmacao.find((x) => x.i === c.plantada);
  return { pegou: !v || !v.sustentada || !v.classeCerta, modelo: a.modelo, resumo: (v?.motivo ?? r.problemas.join(" | ")).slice(0, 160) };
}

export async function avaliarAuditor(n = 20) {
  const casos = await montarAmostraAuditor(n);
  const itens: { id: string; erro: ErroPlantado; pegou: boolean; modelo: string; resumo: string }[] = [];
  for (const c of casos) {
    try {
      itens.push({ id: c.id, erro: c.erro, ...(await julgarCaso(c)) });
    } catch (e) {
      itens.push({ id: c.id, erro: c.erro, pegou: false, modelo: "-", resumo: `falha: ${String((e as Error).message).slice(0, 120)}` });
    }
  }
  const pegos = itens.filter((i) => i.pegou).length;
  return { casos: itens.length, pegos, taxa: itens.length ? pegos / itens.length : 0, itens };
}
