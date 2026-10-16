# Inventário de figuras das provas oficiais (seção 5.8, Fase 1)

Base: as 140 questões oficiais (BB 2023 e BB 2021, Agente Comercial). Método:
- imagens embutidas no PDF e desenhos vetoriais por página (operadores do PDF, com posição);
- questões que citam tabela, gráfico, planilha, tela etc. (conferidas no texto cru do PDF);
- destaque tipográfico (negrito) que o texto do PDF perde.

A imagem de 263×263 que aparece em **todas** as páginas é a marca d'água do site de onde as
provas vieram, não figura de questão.

## Questões com figura

| Prova | Nº | Disciplina | Tipo | Onde | O que mostra | Como está no PDF | Situação no banco |
|---|---|---|---|---|---|---|---|
| 2023 | 18 | Matemática | tabela | enunciado | grade com os números 1–30 em 7 colunas, linhas pares a partir da coluna 2 | texto + bordas vetoriais (pág. 8) | no treino (tabela legível no texto) |
| 2023 | 19 | Matemática | tabela | enunciado | armários, mesas, cadeiras e custo total por agência | texto + bordas vetoriais (pág. 8) | no treino (tabela legível no texto) |
| 2023 | 41 | Informática | planilha | enunciado | células B2:B6 com valores em R$ (Excel 365) | **imagem embutida** (pág. 13) | `precisa_imagem` |
| 2023 | 60 | Vendas e Negociação | tabela | enunciado | compras iniciadas × finalizadas por empresa (V–Z) | texto + bordas vetoriais (pág. 16) | não entrou (a IA reorganizou a tabela) |
| 2021 | 27 | Matemática Financeira | tabela | enunciado | depósitos de R$ 10.000,00 em jan/2018–jan/2021 + "Dados" com potências | texto + bordas vetoriais (pág. 9); expoentes perdidos | `precisa_imagem` |

## Outras dependências visuais (não são figura, mas o texto perde)

| Prova | Nº | Disciplina | Tipo | O que se perde |
|---|---|---|---|---|
| 2021 | 17 | Matemática | fórmula | frações com + e − nas alternativas |
| 2021 | 19 | Matemática | fórmula | (b − a)/2ⁿ e 10⁻³ |
| 2023 | 3 | Língua Portuguesa | destaque | qual expressão está em negrito (ambígua) |
| 2021 | 5 | Língua Portuguesa | destaque | qual termo está em negrito (ambíguo) |
| 2023 | 5, 7, 9 · 2021 | 3, 4, 6, 7, 9, 10 | Língua Portuguesa | destaque | negrito perdido, mas dedutível pelas alternativas |

## Resumo por tipo

| Tipo | Quantidade |
|---|---|
| tabela | 4 |
| planilha | 1 |
| gráfico | 0 |
| tela de programa | 0 |
| diagrama | 0 |

## Proporção por disciplina → META de figuras nas questões geradas

| Disciplina | Com figura | Total oficial | Proporção | Meta nas geradas |
|---|---|---|---|---|
| Matemática | 2 (tabela) | 10 | 20% | 20% com tabela |
| Matemática Financeira | 1 (tabela) | 10 | 10% | 10% com tabela |
| Informática | 1 (planilha) | 30 | 3% | 5% com planilha (arredondado para cima: 1 em cada 20) |
| Vendas e Negociação | 1 (tabela) | 30 | 3% | 5% com tabela |
| Língua Portuguesa, Inglês, Atualidades, Bancários | 0 | 60 | 0% | sem figura |

A meta fica em `data/figuras-meta.json` e é usada pelo sorteio "com figura" (Fase 3).
Duas provas são pouca amostra: quando entrarem mais provas, rode o inventário de novo.
