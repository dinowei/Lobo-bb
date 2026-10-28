# Proposta: banco de regras de Concordância (formato da Crase)

28/10/2026. Só proposta: nada implementado. Decisão do dono antes de começar.

## O formato (igual à Crase)
- **Regras em código** (`src/portugues.ts`, tipo `RegraCrase` → `RegraConcordancia`), cada uma com:
  - `id` e `nome`;
  - `explicacao`: o texto que o aluno lê, com trecho literal de fonte quando houver;
  - `correta`: a frase que aplica a regra está certa ou errada;
  - `trecho`: regex que confere, por código, a forma exata da parte da frase onde a regra se aplica;
  - `pegadinha` e `corrigir`: só nas regras de erro.
- **Moldes** (`data/moldes-concordancia.json`): frases com lacunas. Exemplo: `{sujeito} [havia {problemas_pl}] {final}.`
  - As lacunas críticas (o verbo, a flexão, o núcleo) são preenchidas só pelo código.
  - A IA só amplia o vocabulário das lacunas neutras (regra 14).
- **Juiz:** o LanguageTool local em cada frase. Divergência com a regra do código = frase descartada (regra 13).
- **Benchmark:** `bb -- lt-benchmark` com 20 frases por regra. Só entra no sorteio a regra em que o LanguageTool acerta ≥ 95%. As outras ficam em `FORA_DO_SORTEIO`.

## Regras propostas e o que o LanguageTool valida
Sonda de hoje: 4 pares (certa/errada) por regra. A medida para valer é o benchmark de 20.

| # | Regra (certa ↔ erro) | Fonte literal no acervo | LanguageTool (sonda) | Proposta |
|---|---|---|---|---|
| 1 | HAVER = existir no singular ↔ "Haviam problemas" | TJ-SP p. 15; BB 2021 p. 18 | 4/4 | entra (se o benchmark confirmar) |
| 2 | HAVER/FAZER tempo decorrido no singular ↔ "Fazem dois anos" | TJ-SP p. 15; BB 2021 p. 18 | 3/4 | entra se ≥ 95% |
| 3 | "se" apassivador concorda com o sujeito ↔ "Vende-se casas" | BB 2021 p. 18 (Dica 9) | 3/4 | entra se ≥ 95% |
| 4 | "se" indeterminador no singular ↔ "Precisam-se de" | BB 2021 p. 18 (Dica 9) | 1/4 | **fora do sorteio** |
| 5 | Sujeito composto anteposto no plural ↔ "O gerente e a caixa chegou" | INSS p. 13 (posposto) | 0/4 | **fora do sorteio** |
| 6 | Núcleo do sujeito com termo preposicionado ↔ "O conjunto de propostas foram" | E-book BNB p. 75 (comentário) | 2/4 | **fora do sorteio** |
| 7 | Nominal: núcleos de gêneros diferentes no masculino plural ↔ "A taxa e o prazo são fixas" | E-book BNB p. 75 | 0/4 | **fora do sorteio** |
| 8 | Nominal: meio/bastante/menos/só ↔ "menas", "bastante razões" | provas BB 2023 (oficial) | 2/4 | por palavra: "menas" e "bastantes" passam; "meios" e "só/sós" falham |
| 9 | Partitivo/porcentagem: as duas formas valem | INSS p. 13; PRF p. 22 | (facultativa) | fora: não serve como erro nem como resposta certa (igual à crase facultativa) |
| 10 | Pronome relativo "que": concorda com o antecedente | TJ-SP p. 15 | não medido | medir no benchmark |
| 11 | Concordância ideológica (silepse) | **sem material** | — | fora até o dono trazer material |

Resumo da sonda: o LanguageTool acerta as duas frases em 15 de 32 pares.
- **Validáveis:** regras 1 a 3 e parte da 8.
- **Não validáveis pelo LanguageTool:** sujeito composto (5), gêneros diferentes (7), "se" indeterminador (4) e núcleo preposicionado (6). Pela regra 13, essas não entram no sorteio da esteira, porque sem o juiz obrigatório não há gatilho.
- **O mais cobrado pela Cesgranrio:** as provas BB 2021/2023 cobram justamente 5, 6 e 7 (sujeito composto e gêneros). Ou seja, a parte mais cobrada é a que o LanguageTool não confere.

## Tamanho do trabalho
| Parte | Volume | Estimativa |
|---|---|---|
| Regras em código (certas + de erro, com regex de trecho e correção) | ~16 regras (8 certas + 8 de erro) | 1 sessão |
| Moldes com lacunas críticas por código | ~40 moldes (3–5 por regra) | 1 sessão |
| Vocabulário das lacunas neutras (validado por código) | reaproveita o da Crase + ~30 termos | meia sessão |
| Benchmark do LanguageTool (20 frases/regra) | ~320 frases, ~10 min de máquina | meia sessão |
| `construirConcordancia` + esteira (copia o fluxo da Crase) + testes + e2e | — | 1 sessão |
| **Total** | | **~4 sessões de trabalho**, sem IA para regra nem exemplo |

## O que muda na prática
- Na esteira, com o LanguageTool como juiz obrigatório, só as regras 1–3 (e parte da 8) entram. A maior parte do que a banca cobra (sujeito composto, gêneros) **não** entra.
- Para essas, há duas saídas (decisão do dono):
  1. **Só exemplos oficiais.** Regras 5–7 só com frases das provas oficiais (gabarito pelo banco, como já faz a aula de 28/10). Nada de frase gerada.
  2. **Segundo juiz por código.** Para gênero e número, um verificador próprio: dicionário de gênero e flexão dos núcleos e concordância do adjetivo. É mais 1–2 sessões e precisa de benchmark próprio.

## Perguntas ao dono
1. Seguir com as regras 1–3 (as que o LanguageTool valida) primeiro?
2. Para 5–7: só exemplos oficiais (saída 1) ou o verificador próprio (saída 2)?
3. Material de concordância ideológica (silepse): trazer?
