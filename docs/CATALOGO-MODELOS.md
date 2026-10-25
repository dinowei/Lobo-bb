# Catálogo de modelos (só endpoints grátis da NVIDIA)

Conferido em **17/10/2026**: gratuidade e avisos em build.nvidia.com (páginas de cada fornecedor);
comportamento pela sondagem `npm run bb -- modelos-sondar` (36 chamadas curtas, 4 s entre elas;
bruto em `docs/sondagem-modelos.json`). O catálogo que o código usa é `data/modelos.json`.

## Onde fica cada coisa (inventário)

- **Ids:** `.env` (`GERADOR_MODEL`, `AUDITOR_MODEL`, `AUDITOR_MODEL_RESERVA`, `ESCRITOR_PT_MODEL` e `_RESERVA`,
  `EMBED_MODEL`); catálogo central em `data/modelos.json` (família, funções, status, parâmetros aceitos);
  correntes opcionais `CORRENTE_<FUNÇÃO>` e a corrente aprovada por você (coleção `config`).
- **Chamadas:** `src/llm.ts` (`chamar`, `chatJSON`, reserva, `embedLote`) e `src/corrente.ts`
  (`chatJSONFuncao`, corrente por função com a regra de família). Quem chama: `pipeline.ts` (gerador,
  auditor cego e revisão, escritor e juiz de Português, desempate), `ingestao.ts` (extração sem pensar,
  texto de apoio, explicar), `similaridade.ts` (embeddings), `sondagem.ts` e `benchmark.ts`.
- **Falhas:** 429, 5xx e timeout são recuperáveis: espera 2 s, 6 s, 18 s (±25%), e o `Retry-After` do
  provedor manda até 60 s (mais que isso: passa para a reserva). 401, 403, 404, 410 e "modelo inválido"
  são permanentes: o modelo sai da corrente até reiniciar. 3 falhas seguidas: o modelo descansa 10 min.
  Recusa de `reasoning_budget` (400) repete sem o parâmetro.
- **Em uso de verdade hoje (legado do `.env`):** Lightning (gerador e extração), Super (auditor, juiz por
  frase, explicar), Ultra (reserva do auditor e desempate da Crase), GLM-5.3-flash (escritor de Português),
  DeepSeek-v4.1-flash (reserva do escritor), nemotron-3-embed-1b (embeddings).
- **Telemetria:** coleção `chamadas_modelo` (uma linha por chamada: modelo, função, ok, tipo de falha,
  latência, se foi reserva; sem texto e sem chave; some em 35 dias).

## Classificação

### 1. Grátis, confirmado e testado

| id exato | família | grátis | HTTP | latência (básico) | JSON | raciocínio aceito |
|---|---|---|---|---|---|---|
| `nvidia/nemotron-3.5-lightning-30b-a3b` | nvidia | sim | 200 | 104 s na 1ª, 2–4 s nas outras | sim | `reasoning_budget`; `enable_thinking=false` desliga (9 tokens) |
| `nvidia/nemotron-3-super-120b-a12b` | nvidia | sim | 200 | 17 s na 1ª, 1–4 s | sim | `reasoning_budget`; `enable_thinking=false` desliga |
| `nvidia/nemotron-3.5-super-vl-120b-a12b` (acesso antecipado) | nvidia | sim | 200 | 1,5 s | sim | `reasoning_budget`; `enable_thinking=false` desliga |
| `openai/gpt-oss-20b` | openai | sim | 200 | 1,9 s | sim | `reasoning_effort` (low: 50 → 27 tokens); aceita e ignora os outros dois |
| `meta/muse-glimmer-30b` | meta | sim | 200 | 13 s | sim | `reasoning_effort` e `enable_thinking` (200 → 66 tokens); **recusa** `reasoning_budget` (400) |
| `stepfun-ai/step-5-preview` (preview) | stepfun | sim | 200 | 1,5 s | sim | `reasoning_effort`; **recusa** `reasoning_budget`; com `enable_thinking=false` veio **sem JSON** |
| `z-ai/glm-5.3-flash` | zai | sim | 200 | ~20 s em todas | sim | `reasoning_effort` (low: 33 → 9 tokens); **recusa** `reasoning_budget`; ignora `enable_thinking` |
| `nvidia/nemotron-3-embed-1b` | nvidia | sim | 200 | — | — | embeddings de 2048 dimensões (162 vetores em 17/10/2026) |

### 2. Listado, mas não testado

Aparecem para a chave e como "Free Endpoint", fora do escopo do pedido: `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning`,
`nvidia/nemotron-3.5-content-safety`, `meta/llama-3.2-90b-vision-instruct`, `meta/llama-3.2-11b-vision-instruct`,
`meta/llama-guard-4-12b`. O reranker `llama-nemotron-rerank-vl-1b-v2` é só para baixar (sem endpoint grátis).

### 3. Temporariamente fora

| id exato | o que aconteceu em 17/10/2026 |
|---|---|
| `nvidia/nemotron-3-ultra-550b-a55b` | 503 "temporarily overloaded" nas 4 sondas (funcionava nos dias anteriores; recusa `reasoning_budget`) |
| `deepseek-ai/deepseek-v4.1-flash` | timeout de 120 s nas 4 sondas (parâmetros não confirmados) |

### 4. Descontinuado ou sem gratuidade

| id exato | situação |
|---|---|
| `openai/gpt-oss-120b` | endpoint grátis descontinuado: **proibido** (não aparece mais para a chave) |
| `z-ai/glm-5.3` (sem flash) | build.nvidia.com: **"Deprecation in 11d"** (≈ 28/10/2026). **Não afeta o `glm-5.3-flash`**, que é outra página, "Free Endpoint", sem aviso |

## F6 — funções novas (sondagem e aceite em 25/10/2026)

Sondas fora do repositório, poucas chamadas, 4 s entre elas; nenhuma muda corrente (promover é decisão do dono).

| função | modelo | status | medição |
|---|---|---|---|
| (a) reranker | `llama-3.2-nv-rerankqa-1b-v2`, `llama-nemotron-rerank-1b-v2` | **sem endpoint grátis** | 410 "end of life" (18/05 e 25/08/2026). A busca segue só por embedding; a F11 usa A > B > C sem reranker |
| (b) OCR e layout | `nemotron-parse` (v1) | **ativo** (OK do dono 25/10, só página escaneada/sem texto) | 10 páginas do acervo: 10/10 com ≥ 95% das palavras do texto embutido; 8/10 ≥ 96,7% também na ordem; 2–7 s por página; caixas de layout |
| (b) OCR e layout | `nemotron-parse-2.0` | fora | 400 "DEGRADED function"; contexto de 4096 tokens |
| (c) triagem/classificação em JSON | `nemotron-3.5-bolt-e4b` | candidato, abaixo do aceite | 39 questões ambíguas: 92,3% de acordo (tutor atual 94,9%); 0,46 s × 2,3 s. Aceite ≥ 95% |
| (d) visão (classificar figura) | `llama-3.2-11b-vision-instruct` | candidato | transcreveu 100% de uma página com tabela; 19 s |
| (d) visão | `llama-3.2-90b-vision-instruct` | descartado | 97%, mas **trocou o texto** ("Parágrafo único" virou "Para isso"); 61 s |
| (d) visão | `nemotron-3.5-super-vl-120b-a12b` | fora (preview) | cortou a resposta (34%) |
| (e) embedding menor | `nemotron-3.5-embed-1b` | candidato | aceita `dimensions=1024` (o atual só 2048): metade do espaço dos vetores. Troca exige recall@5 + reindexar + rollback |
| (e) embedding | `nemotron-3.5-embed-8b` | descartado | 4096 dimensões, 12 s |

## Limitações das correntes (3 opções por função)

- **Escritor de Português:** só 2 opções fora de preview que escrevem bem em português hoje (GLM-5.3-flash e
  DeepSeek-v4.1-flash, e o DeepSeek estava fora). A 3ª precisa vir do benchmark (Lightning, gpt-oss-20b ou Muse).
- **Juiz de Português:** precisa ser de família diferente do escritor; com escritor GLM, sobram Nemotron,
  OpenAI, Meta e DeepSeek (o benchmark decide quem acerta as armadilhas).
- **Preview/acesso antecipado** (Step 5, Super VL) só entram como reserva, nunca como principal.
- **Regra de família:** hoje gerador (Lightning) e auditor (Super) são os dois Nemotron. Isso fere a regra e
  é decisão sua (`docs/DECISOES-PENDENTES.md`, prioridade alta).
