// ============================================================
// BB Estudos — Benchmark de modelos grátis (PROMPT-RETOMADA R2.3)
// Auditor: cada candidato resolve ÀS CEGAS uma amostra estratificada de oficiais (o gabarito
// nunca entra no prompt). Português: o juiz julga frases com resposta conhecida (banco de
// regras da Crase + casos em que o auditor já errou); o escritor escreve frases pela regra e
// a trava de posição confere. Mede acerto (sobre as respondidas) e disponibilidade (falhas de
// infraestrutura) separados. Resultados no banco (retomável) e em docs/BENCHMARK-MODELOS.md.
// ============================================================
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { Types } from "mongoose";
import { Question, Topic, BenchmarkResposta } from "./models.js";
import { chatJSON, auditor, escritorPT, validarOuReparar } from "./llm.js";
import { classificarErro, type TipoFalha } from "./telemetria.js";
import { familiaDe, carregarCatalogo } from "./catalogo.js";
import {
  AUDITOR_CEGO_SYSTEM,
  auditorCegoUser,
  RespostaCegaZ,
  AUDITOR_FRASE_SYSTEM,
  VereditoFraseZ,
  CRASE_ESCRITOR_SYSTEM,
  craseEscritorUser,
  FrasesCraseZ,
} from "./prompts.js";
import { construirCrase, conferirFrase } from "./portugues.js";
import { carregarVariacoes } from "./variacao.js";
import type { BenchmarkLinhaDTO, Letra } from "../shared/tipos.js";

export const RODADAS = { auditor: "auditor-v1", juiz: "juiz-pt-v1", escritor: "escritor-pt-v1" } as const;
export const CANDIDATOS = {
  auditor: ["nvidia/nemotron-3-super-120b-a12b", "nvidia/nemotron-3-ultra-550b-a55b", "openai/gpt-oss-20b", "meta/muse-glimmer-30b", "stepfun-ai/step-5-preview"],
  juiz: ["nvidia/nemotron-3-super-120b-a12b", "nvidia/nemotron-3-ultra-550b-a55b", "openai/gpt-oss-20b", "meta/muse-glimmer-30b", "z-ai/glm-5.3-flash", "deepseek-ai/deepseek-v4.1-flash"],
  escritor: ["z-ai/glm-5.3-flash", "deepseek-ai/deepseek-v4.1-flash", "nvidia/nemotron-3.5-lightning-30b-a3b", "openai/gpt-oss-20b", "meta/muse-glimmer-30b"],
};

// ---------- estatística ----------
// Intervalo de Wilson (95%): honesto com amostra pequena; sobreposição = sem vencedor
export function wilson(acertos: number, n: number, z = 1.96): [number, number] {
  if (!n) return [0, 0];
  const p = acertos / n;
  const den = 1 + (z * z) / n;
  const centro = (p + (z * z) / (2 * n)) / den;
  const meia = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / den;
  return [Math.max(0, centro - meia), Math.min(1, centro + meia)];
}

// ---------- amostra estratificada (mesma para todos os modelos) ----------
const ordem = (semente: string, id: string) => createHash("sha1").update(`${semente}:${id}`).digest("hex");

// Proporcional ao nº de oficiais por disciplina, mínimo 2 por disciplina; sorteio fixo pela semente
export function estratificar<T extends { id: string; estrato: string }>(itens: T[], n: number, semente: string, minimo = 2): T[] {
  const por = new Map<string, T[]>();
  for (const x of itens) por.set(x.estrato, [...(por.get(x.estrato) ?? []), x]);
  const total = itens.length;
  const cotas = new Map([...por.entries()].map(([e, xs]) => [e, Math.min(xs.length, Math.max(minimo, Math.round((xs.length / total) * n)))]));
  // ajusta a soma para n, tirando/pondo nos maiores estratos
  const grupos = [...por.keys()].sort((a, b) => por.get(b)!.length - por.get(a)!.length);
  let soma = [...cotas.values()].reduce((s, x) => s + x, 0);
  for (let i = 0; soma !== n && i < 10_000; i++) {
    const e = grupos[i % grupos.length];
    const c = cotas.get(e)!;
    if (soma > n && c > minimo) (cotas.set(e, c - 1), soma--);
    else if (soma < n && c < por.get(e)!.length) (cotas.set(e, c + 1), soma++);
  }
  return grupos.flatMap((e) => [...por.get(e)!].sort((a, b) => ordem(semente, a.id).localeCompare(ordem(semente, b.id))).slice(0, cotas.get(e)));
}

// O que o modelo vê: só texto de apoio, enunciado e alternativas (nada de gabarito, correta ou explicação)
export function questaoCega(q: { textoBase?: string | null; enunciado: string; alternativas: { letra: string; texto: string }[] }) {
  return { textoBase: q.textoBase ?? null, enunciado: q.enunciado, alternativas: q.alternativas.map((a) => ({ letra: a.letra, texto: a.texto })) };
}

export async function amostraOficiais(n = 60, semente = "bb-2026") {
  const [qs, tops] = await Promise.all([
    Question.find({ origem: "oficial", status: "aprovada", "figuras.0": { $exists: false } }).select("enunciado textoBase alternativas gabarito topicId").lean(),
    Topic.find().select("disciplina").lean(),
  ]);
  const disc = new Map(tops.map((t) => [String(t._id), t.disciplina]));
  const itens = qs.map((q) => ({ id: String(q._id), estrato: disc.get(String(q.topicId)) ?? "?", q }));
  return estratificar(itens, Math.min(n, itens.length), semente);
}

// ---------- casos de Português com resposta conhecida ----------
export const CASOS_ARMADILHA: { item: string; frase: string; correta: boolean }[] = [
  { item: "armadilha:a-ela", frase: "O gerente entregou o relatório à ela antes da reunião de metas.", correta: false },
  { item: "armadilha:a-ela-ok", frase: "O gerente entregou o relatório a ela antes da reunião de metas.", correta: true },
  { item: "armadilha:vossa-senhoria", frase: "Encaminhamos o pedido de revisão à Vossa Senhoria para análise.", correta: false },
  { item: "armadilha:vossa-senhoria-ok", frase: "Encaminhamos o pedido de revisão a Vossa Senhoria para análise.", correta: true },
  { item: "armadilha:recorreu-a", frase: "O cliente recorreu a gerência para contestar a tarifa cobrada.", correta: false },
  { item: "armadilha:recorreu-a-ok", frase: "O cliente recorreu à gerência para contestar a tarifa cobrada.", correta: true },
];

// Frases das Crase aprovadas: a do gabarito é a única certa (garantido pelo banco de regras + auditoria)
export async function casosDaCrase(max = 40) {
  const qs = await Question.find({ "variacao.tipo": "crase (por construção)", status: "aprovada" }).select("alternativas gabarito").lean();
  return qs
    .flatMap((q) => q.alternativas.map((a) => ({ item: `crase:${q._id}:${a.letra}`, frase: a.texto, correta: a.letra === q.gabarito })))
    .slice(0, max);
}

// ---------- execução (retomável) ----------
type Resposta = { resposta?: string; acertou?: boolean; falha?: TipoFalha; ms: number };

async function jaFeito(rodada: string, modelo: string, chave: { questionId?: Types.ObjectId; item?: string }) {
  const ant = await BenchmarkResposta.find({ rodada, modelo, ...chave }).select("falha").lean();
  return ant.some((a) => !a.falha) || ant.length >= 2; // respondeu, ou já falhou 2 vezes
}

async function medir(fn: () => Promise<{ resposta: string; acertou: boolean }>): Promise<Resposta> {
  const t0 = Date.now();
  try {
    return { ...(await fn()), ms: Date.now() - t0 };
  } catch (e) {
    const c = classificarErro(e);
    // sem JSON depois do reparo = formato (o modelo respondeu, mas mal): conta como falha do modelo
    return { falha: c.falha === "outro" && /JSON|inválido|valid/i.test(String(e)) ? "formato" : c.falha, ms: Date.now() - t0 };
  }
}

const pausa = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

// 5 falhas do provedor seguidas: o modelo sai desta rodada e volta na próxima (sem perder a amostra)
const INFRA = new Set(["429", "5xx", "timeout"]);
const MAX_SEGUIDAS = 5;
function seguidasDepois(seguidas: number, r: Resposta, modelo: string): number {
  const n = r.falha && INFRA.has(r.falha) ? seguidas + 1 : 0;
  if (n >= MAX_SEGUIDAS) console.log(`  ⏸ ${modelo}: ${MAX_SEGUIDAS} falhas seguidas do provedor; fica para a próxima rodada`);
  return n;
}

export async function rodarAuditor(modelos = CANDIDATOS.auditor, n = 60, max = Infinity) {
  const amostra = await amostraOficiais(n);
  let feitas = 0;
  for (const modelo of modelos) {
    let seguidas = 0;
    for (const { q, estrato } of amostra) {
      if (feitas >= max) return feitas;
      if (seguidas >= MAX_SEGUIDAS) break;
      if (await jaFeito(RODADAS.auditor, modelo, { questionId: q._id })) continue;
      const r = await medir(async () => {
        const json = await chatJSON(auditor(), modelo, AUDITOR_CEGO_SYSTEM, auditorCegoUser(questaoCega(q), []), 0, 2000, { funcao: "benchmark" });
        const resposta = RespostaCegaZ.parse(json).resposta;
        return { resposta, acertou: resposta === q.gabarito };
      });
      await BenchmarkResposta.create({ rodada: RODADAS.auditor, modelo, questionId: q._id, disciplina: estrato, ...r });
      feitas++;
      console.log(`${r.falha ? `✖ ${r.falha}` : r.acertou ? "✔" : "✗"} ${modelo} · ${estrato} · ${Math.round(r.ms / 1000)}s`);
      seguidas = seguidasDepois(seguidas, r, modelo);
      await pausa(2000);
    }
  }
  return feitas;
}

export async function rodarJuiz(modelos = CANDIDATOS.juiz, max = Infinity) {
  const casos = [...CASOS_ARMADILHA, ...(await casosDaCrase())];
  let feitas = 0;
  for (const modelo of modelos) {
    let seguidas = 0;
    for (const c of casos) {
      if (feitas >= max) return feitas;
      if (seguidas >= MAX_SEGUIDAS) break;
      if (await jaFeito(RODADAS.juiz, modelo, { item: c.item })) continue;
      const r = await medir(async () => {
        const json = await chatJSON(auditor(), modelo, AUDITOR_FRASE_SYSTEM, `FRASE: ${c.frase}`, 0, 600, { funcao: "benchmark" });
        const v = VereditoFraseZ.parse(json);
        return { resposta: v.correta ? "correta" : "incorreta", acertou: v.correta === c.correta };
      });
      await BenchmarkResposta.create({ rodada: RODADAS.juiz, modelo, item: c.item, disciplina: c.item.split(":")[0], ...r });
      feitas++;
      console.log(`${r.falha ? `✖ ${r.falha}` : r.acertou ? "✔" : "✗"} ${modelo} · ${c.item} · ${Math.round(r.ms / 1000)}s`);
      seguidas = seguidasDepois(seguidas, r, modelo);
      await pausa(2000);
    }
  }
  return feitas;
}

// Escritor: cada montagem pede 5 frases; "acerto" = frases que passam na trava de posição de primeira
export async function rodarEscritor(modelos = CANDIDATOS.escritor, porModelo = 6, max = Infinity) {
  const contextos = carregarVariacoes().contextos;
  let feitas = 0;
  for (const modelo of modelos) {
    let seguidas = 0;
    for (let k = 0; k < porModelo; k++) {
      if (feitas >= max) return feitas;
      if (seguidas >= MAX_SEGUIDAS) break;
      const item = `montagem:${k}`;
      if (await jaFeito(RODADAS.escritor, modelo, { item })) continue;
      const gabarito = "ABCDE"[k % 5] as Letra;
      const m = construirCrase(gabarito, contextos[k % contextos.length]);
      const user = craseEscritorUser({ contexto: contextos[k % contextos.length], frases: m.frases, frasesRecentes: [] });
      const r = await medir(async () => {
        const json = await chatJSON(escritorPT(), modelo, CRASE_ESCRITOR_SYSTEM, user, 0.7, 2000, { funcao: "benchmark" });
        const escrito = await validarOuReparar(FrasesCraseZ, json, { client: escritorPT(), model: modelo, system: CRASE_ESCRITOR_SYSTEM, user });
        const porLetra = new Map(escrito.frases.map((f) => [f.letra, f]));
        const boas = m.frases.filter((f) => {
          const e = porLetra.get(f.letra);
          return e && !conferirFrase(e.frase, e.trecho, f.regra);
        }).length;
        return { resposta: `${boas}/5`, acertou: boas === 5 };
      });
      await BenchmarkResposta.create({ rodada: RODADAS.escritor, modelo, item, disciplina: "crase", ...r });
      feitas++;
      console.log(`${r.falha ? `✖ ${r.falha}` : r.acertou ? "✔" : "✗"} ${modelo} · ${item} · ${r.resposta ?? ""} · ${Math.round(r.ms / 1000)}s`);
      seguidas = seguidasDepois(seguidas, r, modelo);
      await pausa(2000);
    }
  }
  return feitas;
}

// ---------- relatório ----------
// tentativas = respondidas + falhas; acerto = acertos / respondidas; disponibilidade = respondidas / tentativas
export type LinhaRelatorio = BenchmarkLinhaDTO;

export async function relatorio(rodada: string): Promise<LinhaRelatorio[]> {
  const rs = await BenchmarkResposta.find({ rodada }).lean();
  const cat = carregarCatalogo();
  const por = new Map<string, typeof rs>();
  for (const r of rs) por.set(r.modelo, [...(por.get(r.modelo) ?? []), r]);
  return [...por.entries()]
    .map(([modelo, xs]) => {
      const resp = xs.filter((x) => !x.falha);
      const acertos = resp.filter((x) => x.acertou).length;
      const falhas: Record<string, number> = {};
      for (const x of xs) if (x.falha) falhas[x.falha] = (falhas[x.falha] ?? 0) + 1;
      const porDisciplina: Record<string, { n: number; acertos: number }> = {};
      for (const x of resp) {
        const d = (porDisciplina[x.disciplina ?? "?"] ??= { n: 0, acertos: 0 });
        d.n++;
        if (x.acertou) d.acertos++;
      }
      const ms = resp.map((x) => x.ms ?? 0).sort((a, b) => a - b);
      return {
        modelo,
        familia: familiaDe(modelo),
        preview: cat.get(modelo)?.preview ?? false,
        tentativas: xs.length,
        respondidas: resp.length,
        acertos,
        acerto: resp.length ? acertos / resp.length : 0,
        ic: wilson(acertos, resp.length),
        disponibilidade: xs.length ? resp.length / xs.length : 0,
        medianaS: ms.length ? Math.round(ms[Math.floor(ms.length / 2)] / 1000) : 0,
        falhas,
        porDisciplina,
      };
    })
    .sort((a, b) => b.acerto - a.acerto);
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
function tabela(linhas: LinhaRelatorio[], rotuloAcerto: string) {
  return [
    `| modelo | família | ${rotuloAcerto} | IC 95% | respondidas | disponibilidade | mediana | falhas |`,
    "|---|---|---|---|---|---|---|---|",
    ...linhas.map(
      (l) =>
        `| ${l.modelo}${l.preview ? " (preview)" : ""} | ${l.familia} | ${l.acertos}/${l.respondidas} = **${pct(l.acerto)}** | ${pct(l.ic[0])}–${pct(l.ic[1])} | ${l.respondidas}/${l.tentativas} | ${pct(l.disponibilidade)} | ${l.medianaS} s | ${Object.entries(l.falhas).map(([k, v]) => `${k}: ${v}`).join(", ") || "—"} |`
    ),
  ].join("\n");
}

// Sem vencedor quando os intervalos se sobrepõem
export function empatados(linhas: LinhaRelatorio[]): string[] {
  const top = linhas.filter((l) => l.respondidas >= 10)[0];
  if (!top) return [];
  return linhas.filter((l) => l !== top && l.respondidas >= 10 && l.ic[1] >= top.ic[0]).map((l) => l.modelo);
}

export async function escreverRelatorio(arquivo = "docs/BENCHMARK-MODELOS.md") {
  const [aud, juiz, esc] = await Promise.all([relatorio(RODADAS.auditor), relatorio(RODADAS.juiz), relatorio(RODADAS.escritor)]);
  const amostra = await amostraOficiais(60);
  const porDisc = new Map<string, number>();
  for (const a of amostra) porDisc.set(a.estrato, (porDisc.get(a.estrato) ?? 0) + 1);
  const disciplinas = [...porDisc.keys()].sort();
  const tabelaDisc = [
    `| modelo | ${disciplinas.join(" | ")} |`,
    `|---|${disciplinas.map(() => "---").join("|")}|`,
    ...aud.map((l) => `| ${l.modelo} | ${disciplinas.map((d) => (l.porDisciplina[d] ? `${l.porDisciplina[d].acertos}/${l.porDisciplina[d].n}` : "—")).join(" | ")} |`),
  ].join("\n");
  const emp = (ls: LinhaRelatorio[]) => {
    const e = empatados(ls);
    return e.length ? `Empate estatístico com o primeiro (intervalos se sobrepõem): ${e.join(", ")}. **Não há vencedor claro.**` : "";
  };
  const md = `# Benchmark de modelos grátis (NVIDIA)

Gerado em ${new Date().toLocaleString("pt-BR")} por \`npm run bb -- benchmark relatorio\`. Resultados brutos na coleção \`benchmark_respostas\` (retomável: cada modelo × item roda uma vez).

## Como foi medido

- **Acerto** = acertos ÷ questões **respondidas** (o denominador aparece em cada linha). **Disponibilidade** = respondidas ÷ tentativas: falha de infraestrutura (429, 5xx, timeout) e resposta sem JSON não contam como erro de conteúdo, contam aqui.
- **IC 95%**: intervalo de Wilson. Intervalos que se sobrepõem = diferença que a amostra não sustenta; não declaro vencedor nesses casos.
- Parâmetros: os de produção (temperatura 0; Nemotron com \`reasoning_budget\` do \`.env\`; demais com o parâmetro aceito na sondagem, ver \`docs/CATALOGO-MODELOS.md\`), 1 chamada por item, 2 s entre chamadas.

## 1. Auditor: oficiais resolvidas às cegas

Amostra: ${amostra.length} oficiais aprovadas, sem figura, estratificada por disciplina (proporcional, mínimo 2), sorteio fixo pela semente \`bb-2026\`: ${[...porDisc.entries()].map(([d, k]) => `${d} ${k}`).join(", ")}.
Prompt: \`AUDITOR_CEGO_SYSTEM\` + enunciado, texto de apoio e alternativas (\`questaoCega\`: o objeto enviado não tem gabarito, "correta" nem explicação; um teste confere).

${aud.length ? tabela(aud, "acerto") : "_Ainda não rodou._"}

${emp(aud)}

Por disciplina (acertos/respondidas):

${aud.length ? tabelaDisc : "_—_"}

## 2. Juiz de Português (Crase)

Cada frase isolada, \`AUDITOR_FRASE_SYSTEM\` (o mesmo do pipeline). Casos: ${CASOS_ARMADILHA.length} armadilhas em que o auditor já errou ("à ela", "à Vossa Senhoria", "recorreu a gerência") e as versões certas delas + frases das Crase aprovadas (a do gabarito é a única certa, garantido pelo banco de regras).

${juiz.length ? tabela(juiz, "acerto") : "_Ainda não rodou._"}

${emp(juiz)}

## 3. Escritor de Português (Crase)

Montagens do banco de regras (1 regra certa + 4 de erro); "acerto" = as 5 frases passam na trava de posição de primeira.

${esc.length ? tabela(esc, "5/5 na trava") : "_Ainda não rodou._"}

## 4. Redação

Sem redações com nota dada por pessoa, não há como medir a correção de redação com honestidade. A estrutura está pronta (rodada \`redacao-v1\`, mesmo formato: nota do modelo × nota humana, erro absoluto médio por competência); falta o conjunto de redações corrigidas. **Limitação registrada.**

## Limitações

- Amostra pequena: diferenças de poucos pontos não significam nada (veja os intervalos).
- Oficiais com figura ficaram de fora (o auditor só lê texto).
- Um único prompt por função (o de produção): outro prompt pode mudar o resultado.
- Disponibilidade medida em poucos dias; o endpoint grátis varia por horário.
- Preview/acesso antecipado aparece só como referência: nunca é proposto como principal.
`;
  await writeFile(arquivo, md, "utf8");
  return { auditor: aud, juiz, escritor: esc };
}
