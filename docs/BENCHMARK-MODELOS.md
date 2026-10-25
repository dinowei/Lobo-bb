# Benchmark de modelos grátis (NVIDIA)

Gerado em 24/10/2026, 22:29:36 por `npm run bb -- benchmark relatorio`. Resultados brutos na coleção `benchmark_respostas` (retomável: cada modelo × item roda uma vez).

## Como foi medido

- **Acerto** = acertos ÷ questões **respondidas** (o denominador aparece em cada linha). **Disponibilidade** = respondidas ÷ tentativas: falha de infraestrutura (429, 5xx, timeout) e resposta sem JSON não contam como erro de conteúdo, contam aqui.
- **IC 95%**: intervalo de Wilson. Intervalos que se sobrepõem = diferença que a amostra não sustenta; não declaro vencedor nesses casos.
- Parâmetros: os de produção (temperatura 0; Nemotron com `reasoning_budget` do `.env`; demais com o parâmetro aceito na sondagem, ver `docs/CATALOGO-MODELOS.md`), 1 chamada por item, 2 s entre chamadas.

## 1. Auditor: oficiais resolvidas às cegas

Amostra: 60 oficiais aprovadas, sem figura, estratificada por disciplina (proporcional, mínimo 2), sorteio fixo pela semente `bb-2026`: informatica 13, vendas_negociacao 12, lingua_portuguesa 9, conhecimentos_bancarios 9, lingua_inglesa 5, atualidades_mercado_financeiro 5, matematica_financeira 4, matematica 3.
Prompt: `AUDITOR_CEGO_SYSTEM` + enunciado, texto de apoio e alternativas (`questaoCega`: o objeto enviado não tem gabarito, "correta" nem explicação; um teste confere).

| modelo | família | acerto | IC 95% | respondidas | disponibilidade | mediana | falhas |
|---|---|---|---|---|---|---|---|
| stepfun-ai/step-5-preview (preview) | stepfun | 57/59 = **97%** | 88%–99% | 59/60 | 98% | 20 s | formato: 1 |
| nvidia/nemotron-3-ultra-550b-a55b | nvidia | 57/60 = **95%** | 86%–98% | 60/75 | 80% | 10 s | 5xx: 15 |
| meta/muse-glimmer-30b | meta | 57/60 = **95%** | 86%–98% | 60/60 | 100% | 24 s | — |
| nvidia/nemotron-3-super-120b-a12b | nvidia | 54/60 = **90%** | 80%–95% | 60/60 | 100% | 12 s | — |
| openai/gpt-oss-20b | openai | 51/58 = **88%** | 77%–94% | 58/60 | 97% | 10 s | timeout: 1, formato: 1 |

Empate estatístico com o primeiro (intervalos se sobrepõem): nvidia/nemotron-3-ultra-550b-a55b, meta/muse-glimmer-30b, nvidia/nemotron-3-super-120b-a12b, openai/gpt-oss-20b. **Não há vencedor claro.**

Por disciplina (acertos/respondidas):

| modelo | atualidades_mercado_financeiro | conhecimentos_bancarios | informatica | lingua_inglesa | lingua_portuguesa | matematica | matematica_financeira | vendas_negociacao |
|---|---|---|---|---|---|---|---|---|
| stepfun-ai/step-5-preview | 5/5 | 8/9 | 13/13 | 5/5 | 8/8 | 3/3 | 3/3 | 12/13 |
| nvidia/nemotron-3-ultra-550b-a55b | 5/5 | 7/9 | 13/13 | 5/5 | 8/8 | 3/3 | 4/4 | 12/13 |
| meta/muse-glimmer-30b | 5/5 | 7/9 | 12/13 | 5/5 | 8/8 | 3/3 | 4/4 | 13/13 |
| nvidia/nemotron-3-super-120b-a12b | 5/5 | 7/9 | 13/13 | 5/5 | 6/8 | 3/3 | 4/4 | 11/13 |
| openai/gpt-oss-20b | 5/5 | 7/9 | 12/13 | 5/5 | 5/7 | 2/2 | 4/4 | 11/13 |

## 2. Juiz de Português (Crase)

Cada frase isolada, `AUDITOR_FRASE_SYSTEM` (o mesmo do pipeline). Casos: 6 armadilhas em que o auditor já errou ("à ela", "à Vossa Senhoria", "recorreu a gerência") e as versões certas delas + frases das Crase aprovadas (a do gabarito é a única certa, garantido pelo banco de regras).

| modelo | família | acerto | IC 95% | respondidas | disponibilidade | mediana | falhas |
|---|---|---|---|---|---|---|---|
| z-ai/glm-5.3-flash | zai | 45/45 = **100%** | 92%–100% | 45/47 | 96% | 107 s | timeout: 2 |
| nvidia/nemotron-3-ultra-550b-a55b | nvidia | 44/46 = **96%** | 85%–99% | 46/46 | 100% | 6 s | — |
| meta/muse-glimmer-30b | meta | 44/46 = **96%** | 85%–99% | 46/47 | 98% | 27 s | 5xx: 1 |
| stepfun-ai/step-5-preview (preview) | stepfun | 43/46 = **93%** | 82%–98% | 46/46 | 100% | 12 s | — |
| openai/gpt-oss-20b | openai | 40/46 = **87%** | 74%–94% | 46/46 | 100% | 6 s | — |
| nvidia/nemotron-3-super-120b-a12b | nvidia | 39/45 = **87%** | 74%–94% | 45/45 | 100% | 9 s | — |
| deepseek-ai/deepseek-v4.1-flash | deepseek | 0/0 = **0%** | 0%–0% | 0/7 | 0% | 0 s | timeout: 6, 5xx: 1 |

Empate estatístico com o primeiro (intervalos se sobrepõem): nvidia/nemotron-3-ultra-550b-a55b, meta/muse-glimmer-30b, stepfun-ai/step-5-preview, openai/gpt-oss-20b, nvidia/nemotron-3-super-120b-a12b. **Não há vencedor claro.**

## 3. Escritor de Português (Crase)

Montagens do banco de regras (1 regra certa + 4 de erro); "acerto" = as 5 frases passam na trava de posição de primeira.

_Ainda não rodou._

## 4. Redação

Sem redações com nota dada por pessoa, não há como medir a correção de redação com honestidade. A estrutura está pronta (rodada `redacao-v1`, mesmo formato: nota do modelo × nota humana, erro absoluto médio por competência); falta o conjunto de redações corrigidas. **Limitação registrada.**

## Limitações

- Amostra pequena: diferenças de poucos pontos não significam nada (veja os intervalos).
- Oficiais com figura ficaram de fora (o auditor só lê texto).
- Um único prompt por função (o de produção): outro prompt pode mudar o resultado.
- Disponibilidade medida em poucos dias; o endpoint grátis varia por horário.
- Preview/acesso antecipado aparece só como referência: nunca é proposto como principal.
