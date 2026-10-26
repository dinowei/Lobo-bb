// ============================================================
// Esteira de Português em LOTE (decisão do dono, 26/10/2026) — começa pela Crase.
// candidatas montadas por código (moldes) → trava de posição → LanguageTool local (juiz determinístico,
// família independente) → anti-repetição (hash, impressão estrutural, embedding) → 1 em 10 aprovadas vai
// para a auditoria por amostra (juiz de IA frase a frase); concordância < 95% → a esteira PARA e registra.
// Explicações vêm do banco de regras (regra 14). Teto diário próprio (ESTEIRA_PT_MAX_DIA).
// Oficiais primeiro: só gera para o tema ter ≥ ESTEIRA_PT_NOVAS questões novas para o dono.
// ============================================================
import { writeFileSync } from "node:fs";
import type { Types } from "mongoose";
import { Attempt, Config, Geracao, Question, Topic } from "./models.js";
import { ALUNO } from "./estudo.js";
import { checarLoteLT, concordaComRegra, FAMILIA_LT, garantirLT, veredictoLT } from "./languagetool.js";
import { ampliarVocabulario, moldesDaRegra, preencher, regrasComMolde, VOCAB_BASE, type FraseMolde, type Vocabulario } from "./moldesPT.js";
import { conferirFrase, construirCrase, explicacaoGeralCrase, explicarAlternativa, FORA_DO_SORTEIO, REGRAS_CRASE, DICA_CRASE } from "./portugues.js";
import { AREA_CRASE, estruturasPT, TIPO_CRASE } from "./regrasPT.js";
import { carregarVariacoes, contextosPermitidos } from "./variacao.js";
import { historicoRegras } from "./pipeline.js";
import { filtrarRepeticao, impressaoEstrutural } from "./similaridade.js";
import { hashTexto } from "./extrair.js";
import { chatJSONFuncao } from "./corrente.js";
import { VereditoFraseZ } from "./prompts.js";
import type { Letra } from "../shared/tipos.js";
import benchmarkSalvo from "../data/lt-benchmark.json" with { type: "json" };

export const AMOSTRA_A_CADA = 10;
export const CONCORDANCIA_MINIMA = 0.95;
export const MIN_FRASES_AMOSTRA = 10; // a parada só vale com amostra mínima (2 questões)
export const LIMIAR_BENCHMARK = 0.95;
const LETRAS: Letra[] = ["A", "B", "C", "D", "E"];

export type EstadoEsteira = {
  parada: boolean;
  motivo?: string;
  amostra: { frases: number; concordantes: number };
  aprovadasTotal: number; // contador global: a amostra é a 10ª, 20ª, 30ª…
};
const ESTADO_INICIAL: EstadoEsteira = { parada: false, amostra: { frases: 0, concordantes: 0 }, aprovadasTotal: 0 };

// ---------- regras puras ----------
export const vaiParaAmostra = (aprovadasTotal: number) => aprovadasTotal % AMOSTRA_A_CADA === 0;

export function registrarAmostra(e: EstadoEsteira, frases: number, concordantes: number): EstadoEsteira {
  const amostra = { frases: e.amostra.frases + frases, concordantes: e.amostra.concordantes + concordantes };
  const taxa = amostra.concordantes / amostra.frases;
  const parar = amostra.frases >= MIN_FRASES_AMOSTRA && taxa < CONCORDANCIA_MINIMA;
  return { ...e, amostra, ...(parar ? { parada: true, motivo: `amostra auditada com ${(taxa * 100).toFixed(1)}% de concordância (< 95%) em ${amostra.frases} frases` } : {}) };
}

// trecho sem o "a/à": duas frases com o mesmo núcleo ("frente a frente" × "frente à frente") na mesma
// questão entregam a resposta por comparação (lote de prova de 26/10)
export const nucleoDoTrecho = (t: string) => `#${t.toLowerCase().replace(/(^|\s)(à|às|a|as|ao|àquel\p{L}*|aquel\p{L}*)(?=\s|$)/gu, "$1_").replace(/\s+/g, " ").trim()}`;

// a regra certa e o seu erro "espelho" na mesma questão entregam a resposta por comparação
export const ESPELHOS: [string, string][] = [
  ["sem_crase_repetidas", "erro_repetidas"], ["sem_crase_verbo", "erro_verbo"], ["sem_crase_masculino", "erro_masculino"],
  ["horas_exatas", "erro_falta_horas"], ["obrigatoria_regencia", "erro_falta_obrigatoria"], ["aquele", "erro_demonstrativo"],
];
export const temEspelho = (ids: string[]) => ESPELHOS.some(([a, b]) => ids.includes(a) && ids.includes(b));
export const espelhoDe = (certa: string) => ESPELHOS.filter(([a]) => a === certa).map(([, b]) => b);

// regras ligadas: têm molde, não estão fora do sorteio e o LanguageTool acertou ≥ 95% no benchmark
export function regrasLigadas(bench: { regras: Record<string, { taxa: number }> } | null): Set<string> {
  const comMolde = regrasComMolde();
  return new Set(REGRAS_CRASE.filter((r) => comMolde.has(r.id) && !FORA_DO_SORTEIO.has(r.id) && (bench?.regras[r.id]?.taxa ?? 0) >= LIMIAR_BENCHMARK).map((r) => r.id));
}

export type Contagem = Record<"frases" | "posicao" | "languagetool" | "candidatas" | "duplicada" | "impressao" | "parecida" | "amostra_discordou" | "aprovadas", number>;
export const contagemVazia = (): Contagem => ({ frases: 0, posicao: 0, languagetool: 0, candidatas: 0, duplicada: 0, impressao: 0, parecida: 0, amostra_discordou: 0, aprovadas: 0 });
export function resumoTaxas(c: Contagem): string {
  const pct = (n: number, de: number) => (de ? `${((n / de) * 100).toFixed(0)}%` : "0%");
  return `${c.frases} frases → posição ${c.posicao} (${pct(c.posicao, c.frases)}) · LanguageTool ${c.languagetool} (${pct(c.languagetool, c.frases)}) | ${c.candidatas} candidatas → duplicada ${c.duplicada} · impressão ${c.impressao} · parecida ${c.parecida} (${pct(c.duplicada + c.impressao + c.parecida, c.candidatas)} repetição) · amostra discordou ${c.amostra_discordou} · aprovadas ${c.aprovadas}`;
}

// estoque de frases de UMA regra: preenche os moldes, passa na trava de posição e confere no LanguageTool
// em lotes (uma chamada para várias frases). Devolve as que concordam e as divergentes (para o relatório).
export async function estoqueDaRegra(regra: (typeof REGRAS_CRASE)[number], quantas: number, vocab: Vocabulario = VOCAB_BASE, c: Contagem = contagemVazia()) {
  const moldes = moldesDaRegra(regra.id);
  const vistas = new Set<string>();
  const candidatas: FraseMolde[] = [];
  for (let i = 0; i < quantas * 4 && candidatas.length < quantas; i++) {
    const f = preencher(moldes[i % moldes.length], vocab);
    if (vistas.has(f.frase)) continue;
    vistas.add(f.frase);
    c.frases++;
    if (conferirFrase(f.frase, f.trecho, regra)) { c.posicao++; continue; }
    candidatas.push(f);
  }
  const boas: FraseMolde[] = [];
  const divergentes: string[] = [];
  for (let i = 0; i < candidatas.length; i += 25) {
    const lote = candidatas.slice(i, i + 25);
    const resp = await checarLoteLT(lote.map((f) => f.frase));
    lote.forEach((f, k) => {
      const v = veredictoLT(f.frase, f.trecho, resp[k]);
      if (concordaComRegra(regra.correta, v)) boas.push(f);
      else { c.languagetool++; if (divergentes.length < 4) divergentes.push(`${f.frase} → ${v.regras.join(",") || "nada"}`); }
    });
  }
  return { boas, total: candidatas.length, divergentes };
}

// ---------- benchmark do LanguageTool nas regras do banco (antes de ligar) ----------
export async function benchmarkLT(n = 20, log: (s: string) => void = console.log) {
  if (!(await garantirLT())) throw new Error("LanguageTool local fora do ar");
  const regras: Record<string, { n: number; concordou: number; taxa: number; divergentes: string[] }> = {};
  for (const r of REGRAS_CRASE) {
    if (!moldesDaRegra(r.id).length) continue;
    const e = await estoqueDaRegra(r, n);
    const res = { n: e.total, concordou: e.boas.length, taxa: e.total ? e.boas.length / e.total : 0, divergentes: e.divergentes };
    regras[r.id] = res;
    log(`  ${(res.taxa * 100).toFixed(0).padStart(3)}% ${r.correta ? "certa" : "erro "} ${r.id}${res.divergentes.length ? `  (ex.: ${res.divergentes[0]})` : ""}`);
  }
  const bench = { em: new Date().toISOString(), limiar: LIMIAR_BENCHMARK, regras };
  writeFileSync(new URL("../data/lt-benchmark.json", import.meta.url), `${JSON.stringify(bench, null, 2)}\n`);
  const ligadas = regrasLigadas(bench);
  log(`Regras ligadas (≥ 95% e fora da lista de exclusão): ${[...ligadas].join(", ")}`);
  return { bench, ligadas };
}

// ---------- IA só amplia o vocabulário das lacunas neutras (uma vez por semana, em cache) ----------
async function vocabularioDaSemana(log: (s: string) => void): Promise<Vocabulario> {
  const salvo = (await Config.findById("vocab_pt_ia").lean())?.valor as { em: string; extra: Record<string, string[]> } | undefined;
  if (salvo && Date.now() - new Date(salvo.em).getTime() < 7 * 86_400_000) return ampliarVocabulario(VOCAB_BASE, salvo.extra);
  try {
    const system = "Você amplia listas de vocabulário para frases de exemplo de um banco. Responda só JSON {\"sujeito\": [...], \"sujeito_min\": [...], \"final\": [...]}.";
    const user = `Dê 12 itens novos para cada lista, no mesmo estilo dos exemplos, sem repetir.\n- sujeito (pessoa que trabalha ou é cliente de banco, com artigo e maiúscula): ${VOCAB_BASE.neutras.sujeito.join("; ")}\n- sujeito_min (grupo de pessoas, minúsculo, com artigo): ${VOCAB_BASE.neutras.sujeito_min.join("; ")}\n- final (complemento curto de modo ou finalidade, SEM ideia de tempo ou hora e sem a palavra "a"): ${VOCAB_BASE.neutras.final.join("; ")}`;
    const r = await chatJSONFuncao("escritor_pt", system, user, 0.8, 800);
    const extra = r.json as Record<string, string[]>;
    const v = ampliarVocabulario(VOCAB_BASE, extra);
    await Config.updateOne({ _id: "vocab_pt_ia" }, { $set: { valor: { em: new Date().toISOString(), extra, modelo: r.modelo }, em: new Date() } }, { upsert: true });
    log(`… vocabulário neutro ampliado pela IA (${r.modelo}): sujeito ${v.neutras.sujeito.length}, final ${v.neutras.final.length}`);
    return v;
  } catch (e) {
    log(`… vocabulário da IA indisponível (${(e as Error).message.slice(0, 80)}); seguindo com o do código`);
    return VOCAB_BASE;
  }
}

// ---------- a esteira ----------
export const novasMinimas = () => Number(process.env.ESTEIRA_PT_NOVAS) || 15;
export const tetoEsteira = () => Number(process.env.ESTEIRA_PT_MAX_DIA) || 40;

export async function lerEstado(): Promise<EstadoEsteira> {
  return { ...ESTADO_INICIAL, ...((await Config.findById("esteira_pt").lean())?.valor as Partial<EstadoEsteira> | undefined) };
}
async function salvarEstado(e: EstadoEsteira) {
  await Config.updateOne({ _id: "esteira_pt" }, { $set: { valor: e, em: new Date() } }, { upsert: true });
}
export async function retomarEsteira() {
  const e = await lerEstado();
  await salvarEstado({ ...e, parada: false, motivo: undefined, amostra: { frases: 0, concordantes: 0 } });
}

// novas para o dono = aprovadas do subtópico que ele ainda não respondeu (oficiais contam primeiro)
async function novasDoTema(subtopico: string) {
  const ids = (await Question.find({ subtopico, status: "aprovada" }).select("_id").lean()).map((q) => q._id);
  const respondidas = await Attempt.distinct("questionId", { userId: ALUNO(), questionId: { $in: ids } });
  return ids.length - respondidas.length;
}

export async function rodarEsteiraPT(opts: { candidatas?: number; alvo?: number; log?: (s: string) => void } = {}) {
  const log = opts.log ?? console.log;
  const c = contagemVazia();
  let estado = await lerEstado();
  if (estado.parada) return { contagem: c, resumo: `esteira PARADA: ${estado.motivo} (bb -- esteira-pt --retomar depois de conferir)` };
  const ligadas = regrasLigadas(benchmarkSalvo as { regras: Record<string, { taxa: number }> });
  if (ligadas.size < 5) return { contagem: c, resumo: `só ${ligadas.size} regra(s) ligada(s) no benchmark do LanguageTool: rode "bb -- lt-benchmark"` };
  if (![...ligadas].some((id) => REGRAS_CRASE.find((r) => r.id === id)!.correta) || [...ligadas].filter((id) => !REGRAS_CRASE.find((r) => r.id === id)!.correta).length < 4)
    return { contagem: c, resumo: "o benchmark não ligou 1 regra certa e 4 de erro: não dá para montar a questão" };
  if (!(await garantirLT(process.cwd(), log))) return { contagem: c, resumo: "LanguageTool local fora do ar" };

  const topic = await Topic.findOne({ ativo: true, disciplina: "lingua_portuguesa", assunto: /crase/i }).select("_id disciplina assunto").lean();
  if (!topic) return { contagem: c, resumo: "tópico de Crase não encontrado" };
  const novas = await novasDoTema("crase");
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const jaHoje = await Geracao.countDocuments({ fluxo: "esteira_pt", resultado: "aprovada", em: { $gte: hoje } });
  const alvo = Math.min(opts.alvo ?? Math.max(0, novasMinimas() - novas), tetoEsteira() - jaHoje);
  log(`… Crase: ${novas} novas para você (meta ${novasMinimas()}); hoje a esteira já aprovou ${jaHoje} de ${tetoEsteira()}; alvo agora ${Math.max(0, alvo)}`);
  if (alvo <= 0) return { contagem: c, resumo: `nada a gerar (${novas} novas; teto do dia ${jaHoje}/${tetoEsteira()})` };

  const vocab = await vocabularioDaSemana(log);
  const vars = carregarVariacoes();
  const contextos = contextosPermitidos(vars, topic.assunto, TIPO_CRASE);
  const estruturas = estruturasPT();
  const historico = await historicoRegras(topic._id, AREA_CRASE);
  const total = opts.candidatas ?? (Number(process.env.ESTEIRA_PT_CANDIDATAS) || 300);

  // 1º o estoque de frases por regra (posição + LanguageTool em lote); as questões saem dele, sem mais chamadas
  const porRegra = Math.max(10, Math.ceil((total * 5) / ligadas.size / 2));
  const estoque = new Map<string, FraseMolde[]>();
  for (const id of ligadas) {
    const e = await estoqueDaRegra(REGRAS_CRASE.find((r) => r.id === id)!, porRegra, vocab, c);
    estoque.set(id, e.boas.sort(() => Math.random() - 0.5));
  }
  log(`… estoque: ${[...estoque.entries()].map(([id, fs]) => `${id} ${fs.length}`).join(" · ")}`);
  const tirar = (regra: string, usadas: Set<string>) => {
    const fs = estoque.get(regra) ?? [];
    const i = fs.findIndex((f) => !usadas.has(f.molde) && !usadas.has(nucleoDoTrecho(f.trecho)));
    return i < 0 ? null : fs.splice(i, 1)[0];
  };

  let travadas = 0; // combinação sem frase possível (espelho ou estoque da regra vazio): sorteia de novo
  for (let k = 0; k < total && c.aprovadas < alvo && !estado.parada; k++) {
    const inicio = Date.now();
    const contexto = contextos[Math.floor(Math.random() * contextos.length)];
    const gabarito = LETRAS[Math.floor(Math.random() * 5)];
    const m = construirCrase(gabarito, contexto, historico, estruturas, ligadas, espelhoDe);
    const usadas = new Set<string>();
    const frases: FraseMolde[] = [];
    if (!temEspelho(m.frases.map((f) => f.regra.id)))
      for (const f of m.frases) {
        const r = tirar(f.regra.id, usadas);
        if (!r) break;
        usadas.add(r.molde);
        usadas.add(nucleoDoTrecho(r.trecho));
        frases.push(r);
      }
    if (frases.length < 5) {
      // devolve ao estoque as frases já tiradas desta combinação
      frases.forEach((f) => estoque.get(f.regra.id)?.push(f));
      if (++travadas > 200) { log("… estoque de frases acabou para as combinações possíveis"); break; }
      k--;
      continue;
    }
    c.candidatas++;
    const registrar = (resultado: "aprovada" | "descartada", motivo?: string, questionId?: Types.ObjectId) =>
      Geracao.create({ topicId: topic._id, resultado, motivo, questionId, tipo: TIPO_CRASE, contexto, fluxo: "esteira_pt", ms: Date.now() - inicio });

    const alternativas = m.frases.map((f, i) => ({ letra: f.letra, texto: frases[i].frase, correta: f.letra === gabarito, ...explicarAlternativa(f.regra, frases[i].trecho) }));
    const h = hashTexto(m.enunciado + alternativas.map((a) => a.texto).join("|"));
    if (await Question.exists({ hashEnunciado: h })) { c.duplicada++; await registrar("descartada", "duplicada"); continue; }
    const certa = m.frases.find((f) => f.letra === gabarito)!.regra.id;
    const imp = impressaoEstrutural(TIPO_CRASE, contexto, { certa, erros: m.frases.filter((f) => f.letra !== gabarito).map((f) => f.regra.id).sort(), moldes: frases.map((f) => f.molde).sort() });
    if (await Question.exists({ topicId: topic._id, impressao: imp, status: { $ne: "rejeitada" } })) { c.impressao++; await registrar("descartada", "impressao_repetida"); continue; }
    const sim = await filtrarRepeticao(m.enunciado, alternativas.find((a) => a.correta)!.texto, topic._id, topic.disciplina);
    if (sim.veredito.classe !== "nova") { c.parecida++; await registrar("descartada", sim.veredito.classe); continue; }

    // auditoria por amostra: a 10ª, 20ª… aprovada vai frase a frase para o juiz de IA, às cegas
    const porFrase = m.frases.map((f, i) => ({ letra: f.letra, regraEsperada: f.regra.nome, correta: f.regra.correta, regra: `LanguageTool: ${f.regra.correta ? "sem erro" : "erro no trecho"}`, juiz: FAMILIA_LT, frase: frases[i].frase }));
    let modelos = `moldes (código) + ${FAMILIA_LT}`;
    if (vaiParaAmostra(estado.aprovadasTotal + 1)) {
      let concordantes = 0;
      const juizes = new Set<string>();
      try {
        for (const p of porFrase) {
          const r = await chatJSONFuncao("juiz_pt", AREA_CRASE.juizSystem, `FRASE: ${p.frase}`, 0, 600);
          juizes.add(r.modelo);
          const v = VereditoFraseZ.parse(r.json);
          if (v.correta === p.correta) concordantes++;
          else log(`  ⚖ amostra: ${r.modelo} disse ${v.correta ? "certa" : "errada"} para "${p.frase}" (regra: ${p.regraEsperada})`);
        }
      } catch (e) {
        log(`  ⚠ amostra sem juiz de IA (${(e as Error).message.slice(0, 80)}); questão segue sem amostra`);
      }
      if (juizes.size) {
        estado = registrarAmostra(estado, porFrase.length, concordantes);
        modelos += ` + amostra ${[...juizes].join("/")}`;
        log(`  ⚖ amostra: ${concordantes}/${porFrase.length} frases concordam (acumulado ${estado.amostra.concordantes}/${estado.amostra.frases})`);
        if (concordantes < porFrase.length) { c.amostra_discordou++; await registrar("descartada", "amostra_discordou"); await salvarEstado(estado); continue; }
      }
    }

    const doc = await Question.create({
      topicId: topic._id,
      subtopico: "crase",
      origem: "gerada",
      dificuldade: m.dificuldade,
      enunciado: m.enunciado,
      alternativas: alternativas.map((a) => ({ ...a, pegadinha: a.correta ? undefined : a.pegadinha ?? undefined })),
      gabarito,
      explicacaoGeral: explicacaoGeralCrase(m.frases.find((f) => f.letra === gabarito)!.regra),
      dicaDeProva: DICA_CRASE,
      fontes: [],
      status: "aprovada",
      geradaPor: "esteira PT (moldes do código)",
      auditoria: { modelo: modelos, respostaCega: gabarito, veredito: "aprovada", problemas: [], porFrase: porFrase.map(({ frase: _f, ...p }) => p) },
      variacao: { tipo: TIPO_CRASE, contexto },
      hashEnunciado: h,
      embedding: sim.embedding ?? undefined,
      impressao: imp,
    });
    c.aprovadas++;
    estado = { ...estado, aprovadasTotal: estado.aprovadasTotal + 1 };
    for (const f of m.frases) historico.uso.set(f.regra.id, (historico.uso.get(f.regra.id) ?? 0) + 1);
    historico.anterior = new Set(m.frases.map((f) => f.regra.id));
    await registrar("aprovada", undefined, doc._id);
    await salvarEstado(estado);
    log(`  ✔ ${c.aprovadas}/${alvo} aprovada (certa: ${certa})`);
  }
  await salvarEstado(estado);
  const resumo = `${resumoTaxas(c)}${estado.parada ? ` · PAROU: ${estado.motivo}` : ""}`;
  await Config.updateOne({ _id: "esteira_pt_ultimo" }, { $set: { valor: { em: new Date().toISOString(), contagem: c, resumo }, em: new Date() } }, { upsert: true });
  return { contagem: c, resumo };
}
