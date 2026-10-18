// Corrente de modelos (catálogo, regra de família), telemetria, novas tentativas e fila do noturno
// (sem rede e sem banco)
import { test } from "node:test";
import assert from "node:assert/strict";
import OpenAI from "openai";
import {
  carregarCatalogo,
  familiaDe,
  elegiveis,
  correntesLegado,
  correntesDoEnv,
  validarCorrentes,
  violacoesDeFamilia,
  type Correntes,
} from "./catalogo.js";
import { classificarErro, percentil, agregar } from "./telemetria.js";
import { esperaAntesDe, extrasDeRaciocinio } from "./llm.js";
import { anotarResultado, correnteAtiva, foraAgora } from "./corrente.js";
import { destinoDaTarefa } from "./noturno.js";

const LIGHTNING = "nvidia/nemotron-3.5-lightning-30b-a3b";
const SUPER = "nvidia/nemotron-3-super-120b-a12b";
const ULTRA = "nvidia/nemotron-3-ultra-550b-a55b";
const GPT = "openai/gpt-oss-20b";
const MUSE = "meta/muse-glimmer-30b";
const STEP = "stepfun-ai/step-5-preview";
const GLM = "z-ai/glm-5.3-flash";
const DEEPSEEK = "deepseek-ai/deepseek-v4.1-flash";

const ENV = {
  GERADOR_MODEL: LIGHTNING,
  AUDITOR_MODEL: SUPER,
  AUDITOR_MODEL_RESERVA: ULTRA,
  ESCRITOR_PT_MODEL: GLM,
  ESCRITOR_PT_MODEL_RESERVA: DEEPSEEK,
} as NodeJS.ProcessEnv;

test("correnteAtiva rereads an approval written by another process", async () => {
  let valor: { ativa: boolean; correntes: Correntes } | null = null;
  let leituras = 0;
  const lerConfig = async () => {
    leituras++;
    return valor ? { valor } : null;
  };

  assert.notEqual((await correnteAtiva(lerConfig)).modo, "aprovada");
  valor = {
    ativa: true,
    correntes: {
      ...correntesLegado(ENV),
      gerador: [LIGHTNING, GPT, MUSE],
      auditor: [SUPER, ULTRA, MUSE, GPT],
      tutor: [LIGHTNING, GPT, MUSE],
    },
  };
  const ativa = await correnteAtiva(lerConfig);

  assert.equal(leituras, 2, "each call reads the latest stored configuration");
  assert.equal(ativa.modo, "aprovada");
  assert.deepEqual(ativa.correntes.gerador, [LIGHTNING, GPT, MUSE]);
  assert.deepEqual(ativa.correntes.auditor, [SUPER, ULTRA, MUSE, GPT]);
});

test("correnteAtiva does not silently downgrade when Mongo config cannot be read", async () => {
  await assert.rejects(() => correnteAtiva(async () => { throw new Error("Mongo unavailable"); }), /Mongo unavailable/);
});

test("catálogo: famílias, gratuidade e descontinuados", () => {
  const cat = carregarCatalogo();
  assert.equal(familiaDe(LIGHTNING), "nvidia");
  assert.equal(familiaDe(GLM), "zai");
  assert.equal(familiaDe("z-ai/qualquer-novo"), "zai"); // fora do catálogo: pelo dono do id
  assert.equal(cat.get("openai/gpt-oss-120b")?.gratis, false);
  assert.deepEqual(elegiveis(["openai/gpt-oss-120b", "z-ai/glm-5.3", GPT]), [GPT]); // pago e descontinuado saem
});

test("regra de família: auditor nunca da família do gerador; juiz nunca da do escritor", () => {
  const corrente = [SUPER, ULTRA, GPT, MUSE];
  assert.deepEqual(elegiveis(corrente, { excluirFamilias: ["nvidia"] }), [GPT, MUSE]);
  assert.deepEqual(elegiveis(corrente, { excluirFamilias: ["openai"] }), [SUPER, ULTRA, MUSE]);
  assert.deepEqual(elegiveis([SUPER], { excluirFamilias: ["nvidia"] }), []); // ninguém: a questão espera
  assert.deepEqual(elegiveis([GLM, DEEPSEEK], { fora: new Set([GLM]) }), [DEEPSEEK]); // modelo descansando
});

test("legado de hoje fere a regra (Lightning e Super são Nemotron) e o .env pode trocar a corrente", () => {
  const legado = correntesLegado(ENV);
  assert.deepEqual(legado.auditor, [SUPER, ULTRA]);
  assert.deepEqual(legado.juiz_pt, [SUPER, ULTRA]);
  assert.ok(violacoesDeFamilia(legado).some((v) => v.startsWith("Auditor")));
  const env = correntesDoEnv({ ...ENV, CORRENTE_AUDITOR: `${GPT}, ${MUSE},${SUPER}` });
  assert.deepEqual(env.auditor, [GPT, MUSE, SUPER]);
  assert.deepEqual(env.gerador, [LIGHTNING]); // sem variável: legado
});

test("validar correntes: preview não é principal; com o principal do gerador tem que sobrar auditor de outra família", () => {
  const boa: Correntes = {
    gerador: [LIGHTNING, GPT, MUSE],
    auditor: [GPT, MUSE, SUPER],
    escritor_pt: [GLM, DEEPSEEK],
    juiz_pt: [SUPER, ULTRA, GPT],
    tutor: [LIGHTNING, GPT, GLM],
    redacao: [SUPER, ULTRA, GPT],
  };
  const v = validarCorrentes(boa);
  assert.deepEqual(v.erros, []);
  assert.ok(v.avisos.some((a) => a.startsWith("Escritor de Português")), "menos de 3 opções vira aviso");
  // gerador reserva GPT: sobra Muse e Super → ok; se a corrente do auditor fosse só OpenAI, erro
  assert.ok(validarCorrentes({ ...boa, auditor: [SUPER, ULTRA] }).erros.some((e) => e.startsWith("Auditor")));
  assert.ok(validarCorrentes({ ...boa, auditor: [STEP, GPT, MUSE] }).erros.some((e) => e.includes("preview")));
  assert.ok(validarCorrentes({ ...boa, gerador: ["openai/gpt-oss-120b"] }).erros.some((e) => e.includes("grátis")));
});

test("telemetria: recuperável × permanente, percentis e agregação sem contar duas vezes", () => {
  assert.deepEqual(classificarErro(new OpenAI.APIError(429, undefined, "rate", new Headers())), { falha: "429", http: 429, recuperavel: true });
  assert.equal(classificarErro(new OpenAI.APIError(503, undefined, "down", new Headers())).falha, "5xx");
  assert.equal(classificarErro(new OpenAI.APIConnectionTimeoutError()).falha, "timeout");
  assert.deepEqual(classificarErro(new OpenAI.APIError(404, undefined, "model not found", new Headers())), { falha: "permanente", http: 404, recuperavel: false });
  assert.equal(classificarErro(new OpenAI.APIError(400, undefined, "model x is deprecated", new Headers())).falha, "permanente");
  assert.equal(percentil([5, 1, 3, 2, 4], 50), 3);
  assert.equal(percentil([10, 20, 30, 40, 50, 60, 70, 80, 90, 100], 95), 100);
  const em = new Date();
  const [s] = agregar([
    { modelo: GPT, ok: true, ms: 100, em },
    { modelo: GPT, ok: true, ms: 300, em, reserva: true },
    { modelo: GPT, ok: false, falha: "formato", ms: 0, em }, // a 2ª veio sem JSON
    { modelo: GPT, ok: false, falha: "429", ms: 50, em },
  ]);
  assert.equal(s.chamadas, 3);
  assert.equal(s.sucessos, 1);
  assert.equal(s.falhas.formato, 1);
  assert.equal(s.falhas["429"], 1);
  assert.equal(s.comoReserva, 1);
  assert.equal(s.medianaMs, 100);
});

test("novas tentativas: exponencial com variação, Retry-After manda até 60 s", () => {
  assert.equal(esperaAntesDe(0, null, 0), 1500); // 2 s − 25%
  assert.equal(esperaAntesDe(0, null, 1), 2500); // 2 s + 25%
  assert.equal(esperaAntesDe(2, null, 0.5), 18000);
  assert.equal(esperaAntesDe(0, 30_000, 0.5), 30_000);
  assert.equal(esperaAntesDe(0, 120_000, 0.5), null); // longe demais: passa a vez para a reserva
});

test("parâmetro de raciocínio vem do catálogo de cada modelo (sondagem de 17/10/2026)", () => {
  assert.deepEqual(extrasDeRaciocinio(LIGHTNING, true, 6000), { reasoning_budget: 6000 });
  assert.deepEqual(extrasDeRaciocinio(ULTRA, true, 6000), {}); // recusa budget
  assert.deepEqual(extrasDeRaciocinio(ULTRA, false, 0), { chat_template_kwargs: { enable_thinking: false } });
  assert.deepEqual(extrasDeRaciocinio(GPT, true, 6000), {}); // sem <PREFIXO>_ESFORCO: padrão do modelo
  assert.deepEqual(extrasDeRaciocinio(GPT, true, 6000, "high"), { reasoning_effort: "high" });
  assert.deepEqual(extrasDeRaciocinio(GLM, false, 0), { reasoning_effort: "low" }); // GLM ignora enable_thinking
  assert.deepEqual(extrasDeRaciocinio(STEP, false, 0), { reasoning_effort: "low" }); // Step sem pensar quebrou o JSON
  assert.deepEqual(extrasDeRaciocinio("fora/do-catalogo", true, 500), { reasoning_budget: 500 }); // comportamento antigo
});

test("descanso: 3 falhas de infraestrutura seguidas tiram o modelo por 10 min; sucesso limpa", () => {
  const t0 = 1_000_000;
  anotarResultado("x/teste", false, t0);
  anotarResultado("x/teste", false, t0);
  assert.ok(!foraAgora(t0).has("x/teste"));
  anotarResultado("x/teste", false, t0);
  assert.ok(foraAgora(t0 + 60_000).has("x/teste"));
  assert.ok(!foraAgora(t0 + 11 * 60_000).has("x/teste"));
  anotarResultado("x/teste", true, t0);
  assert.ok(!foraAgora(t0).has("x/teste"));
});

test("noturno: infraestrutura volta para a fila (10, 30, 90 min) até 3 vezes; qualidade descarta", () => {
  const agora = new Date("2026-10-17T02:00:00");
  assert.deepEqual(destinoDaTarefa({ ok: true }, 0, agora), { status: "concluida" });
  assert.deepEqual(destinoDaTarefa({ ok: false, motivo: "auditor_discordou" }, 0, agora), { status: "descartada", motivo: "auditor_discordou" });
  const esperas = [10, 30, 90];
  const d1 = destinoDaTarefa({ ok: false, motivo: "provedor_falhou" }, 0, agora, esperas);
  const d3 = destinoDaTarefa({ ok: false, motivo: "aguardando_modelo" }, 2, agora, esperas);
  assert.ok(d1.status === "aguardando" && d1.tentativas === 1 && +d1.proximaEm - +agora === 10 * 60_000);
  assert.ok(d3.status === "aguardando" && d3.tentativas === 3 && +d3.proximaEm - +agora === 90 * 60_000);
  assert.equal(destinoDaTarefa({ ok: false, motivo: "provedor_falhou" }, 3, agora, esperas).status, "esgotada");
  const teto = destinoDaTarefa({ ok: false, motivo: "teto_diario" }, 1, agora, esperas);
  assert.ok(teto.status === "aguardando" && teto.tentativas === 1 && teto.proximaEm.getDate() === 18, "teto diário fica para amanhã sem gastar tentativa");
});
