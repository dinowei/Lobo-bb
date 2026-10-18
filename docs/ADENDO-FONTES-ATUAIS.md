# Adendo: fonte da prova + fonte atual em cada explicação

**Quando:** junto com a Etapa 6 (noturno), como mais um passo da pré-geração. Não muda a ordem do resto.

## Problema
As explicações citam só a prova de origem ("Fonte: BB 2021 — Escriturário Agente Comercial").
Muita norma mudou desde 2021/2023. O aluno precisa saber: (1) de onde veio a questão e
(2) se o que ela cobra continua valendo HOJE, com a fonte oficial atual.

## Regra principal: NÃO reescrever nada
- Enunciado, alternativas, gabarito oficial e explicações conferidas ficam como estão.
  Gabarito oficial nunca passa por IA (regra 1).
- Só ACRESCENTAR uma camada de fontes à questão (campo novo, migração sem apagar nada).

## Modelo de dados (Question)
```
fontes: [
  { papel: 'origem', tipo: 'prova', ref: 'BB 2021 — Escriturário Agente Comercial', questao: 'Q19' },
  { papel: 'atual', tipo: 'norma', ref: 'Resolução CMN nº X/AAAA, art. Y', sourceId, chunkId,
    trecho: '<trecho LITERAL da fonte ingerida>', url, conferidoEm: Date }
]
situacaoFonte: 'confirmada' | 'mudou' | 'pendente' | 'nao_se_aplica'
oQueMudou?: { antes: string, hoje: string, trechoHoje: string, fonteHoje: ref }
```
- Questão gerada por IA que já tem trechoFonte: vira `papel: 'atual'` direto (já é fonte ingerida).
- `nao_se_aplica`: Português, Matemática, Matemática Financeira, Probabilidade (regra não muda com
  o tempo). Essas mostram só a origem.

## Como preencher (noturno, sem pressa, um job por vez)
Para Conhecimentos Bancários, Vendas e Negociação, Atualidades do Mercado Financeiro e Informática:
1. Busca por CÓDIGO (RAG/embeddings) nos trechos ingeridos de fontes VIGENTES (fonte revogada
   não entra, regra 6). Só fontes oficiais já permitidas: planalto.gov.br, bcb.gov.br, in.gov.br.
2. Um modelo da corrente do AUDITOR (família diferente de quem gerou a explicação, quando houver)
   responde em JSON, com o trecho em mãos:
   - `confirmada`: a fonte atual sustenta a explicação → grava fonte atual + trecho literal.
   - `mudou`: a regra mudou → grava `oQueMudou` (antes/hoje) citando o trecho LITERAL de hoje.
   - `pendente`: não achou fonte atual ingerida → nada muda, entra numa lista para ingerir a norma.
3. Checagens determinísticas: o trecho existe literalmente na fonte; a fonte está vigente; a
   referência (lei/resolução/artigo) bate com os metadados da fonte. Falhou → `pendente`.
4. `mudou` em que a RESPOSTA da questão deixaria de ser a mesma hoje → segue a regra que já
   existe: `desatualizada`, selo "Norma atualizada", fora do simulado fiel; continua visível como
   questão histórica com a explicação do que mudou.
   `mudou` só em detalhe (valor, prazo, nome de órgão) com a resposta ainda certa → fica em
   circulação com o aviso.
5. Reconferência: quando uma fonte é revogada ou uma norma nova é ingerida, as questões ligadas a
   ela voltam para a fila (situacaoFonte = 'pendente').
6. Nada que precise de olho humano entra sem OK do dono: os `mudou` aparecem na aba Pendências
   do Admin para revisão antes de ir ao aluno (aprovação em lote permitida).

## Na tela (estilo atual, regra 8)
Embaixo da explicação, um bloco "Fontes":
- 📄 **Da prova:** BB 2021 — Escriturário Agente Comercial (Q19)
- ✅ **Base atual:** Resolução CMN nº X/AAAA, art. Y. Conferido em 18/10/2026. [ver trecho]
- ⚠️ **Mudou desde a prova:** "Na época valia ___. Hoje vale ___." [ver trecho atual]
- ⏳ **Base atual em conferência** (para `pendente`, discreto)
Aluno não vê menção a IA nem a modelos.

## Relatórios
- Admin: quantas confirmadas / mudou / pendentes por disciplina, e a lista de normas que
  faltam ingerir (para o dono baixar das fontes oficiais).
- Testes: trecho não literal é recusado; fonte revogada não é usada; `mudou` com resposta
  diferente vira desatualizada; Português não recebe fonte atual; migração não apaga campo antigo.
- Commit por parte. DIARIO + RETOMAR AQUI.
