# Relatório de contraste — fase visual final (25/10/2026)

Razão de contraste WCAG 2.1 calculada (fórmula de luminância relativa) para as combinações usadas na interface.
AA = 4,5:1 para texto normal; AA-G = 3:1, que vale para texto grande (≥ 18,66 px negrito ou 24 px) e para
elementos gráficos (barras, linhas, ícones). Todas as cores são tokens em `web/src/estilos.css`.

## Regras que saíram do cálculo

1. **Texto sobre laranja, turquesa e verde é sempre escuro.** Branco reprova nas três.
2. **Laranja, turquesa e verde não viram texto pequeno no tema claro.** Para texto colorido existem os tons
   `-texto` derivados da mesma cor (tabela abaixo); as cores do PDF ficam para preenchimento e marcador.
3. **Semânticas** (sucesso/atenção/erro/informação) também ganharam tons `-texto` por tema, porque algumas
   reprovam como texto pequeno (atenção no claro, erro/informação/sucesso no escuro).
4. Na **navegação preta** (#050505), o item inativo usa #8E9086 (6,29:1) e o ativo é pílula colorida com texto escuro.

## Cores do PDF

| Combinação | Razão | Resultado |
|---|---|---|
| #11110F sobre Binho #FF6B35 | 6,67 | AA |
| #FFFFFF sobre Binho #FF6B35 | 2,84 | reprova (não usado) |
| #071F1E sobre Lo #19B8B0 | 6,97 | AA |
| #FFFFFF sobre Lo #19B8B0 | 2,46 | reprova (não usado) |
| #11110F sobre verde #C6EF4E | 14,27 | AA |
| #FFFFFF sobre verde #C6EF4E | 1,32 | reprova (não usado) |
| #11110F sobre #FFB08F (Binho clara) | 10,67 | AA |
| #071F1E sobre #8CE5DF (Lo clara) | 11,76 | AA |
| #11110F sobre #E4FF9A (verde claro) | 17,17 | AA |
| #171714 sobre #FFF0E9 / #E8FAF8 / #F4FADB (fundos suaves) | 16,16 / 16,65 / 16,72 | AA |
| Binho #FF6B35 como texto sobre #11110F | 6,67 | AA |
| Lo #19B8B0 como texto sobre #11110F | 7,67 | AA |
| verde #C6EF4E como texto sobre #11110F | 14,27 | AA |
| Binho #FF6B35 como texto sobre #FFFFFF | 2,84 | reprova → usar #B23F14 |
| Binho escura #D94E20 sobre #FFFFFF | 4,15 | só AA-G |
| Lo escura #087F7B sobre #FFFFFF | 4,85 | AA |
| verde escuro #7CA51C sobre #FFFFFF | 2,89 | reprova → usar #566F10 |
| texto #171714 sobre fundo claro #F6F7F0 | 16,66 | AA |
| secundário #696B63 sobre #F6F7F0 / #FFFFFF | 5,02 / 5,41 | AA |
| texto #F6F7F0 sobre fundo escuro #11110F | 17,54 | AA |

## Tons derivados (tokens `-texto` e fixos)

| Token | Tema | Valor | Sobre | Razão |
|---|---|---|---|---|
| `--binho-texto` / `--binho-sobre-branco` | claro | #B23F14 | #FFFFFF / #F6F7F0 / #ECEDE5 | 5,81 / 5,39 / 4,93 |
| `--lo-texto` / `--lo-sobre-branco` | claro | #067470 | #F6F7F0 / #ECEDE5 | 5,21 / 4,76 |
| `--verde-texto` / `--verde-sobre-branco` | claro | #566F10 | #F6F7F0 / #FFFFFF | 5,30 / 5,71 |
| `--sucesso-texto` | claro | #1D7A4A | #FFFFFF / #F6F7F0 | 5,34 / 4,95 |
| `--atencao-texto` | claro | #8A5B00 | #FFFFFF / #F6F7F0 | 5,87 / 5,45 |
| `--erro-texto` | claro | #B53A3A | #F6F7F0 | 5,37 |
| `--info-texto` | claro | #2F6BA6 | #F6F7F0 | 5,16 |
| `--sucesso-texto` | escuro | #3DBA7A | #11110F / #1C1C19 | 7,65 / 6,92 |
| `--erro-texto` | escuro | #E26B6B | #11110F / #1C1C19 | 5,90 / 5,33 |
| `--info-texto` | escuro | #6FA6DC | #11110F / #1C1C19 | 7,35 / 6,64 |
| `--atencao-texto` | escuro | #D08A00 | #1C1C19 | 5,95 |
| `--texto-2` | escuro | #A3A59B | #11110F / #1C1C19 | 7,57 / 6,84 |
| `--nav-inativo` | os dois | #8E9086 | #050505 | 6,29 |
| Binho / Lo como texto | escuro | #FF6B35 / #19B8B0 | superfície #1C1C19 | 6,02 / 6,93 |

## Semânticas do PDF como preenchimento

| Combinação | Razão | Uso |
|---|---|---|
| sucesso #228B55 sobre #FFFFFF / #11110F | 4,29 / 4,40 | só AA-G: borda e marcador, texto usa `--sucesso-texto` |
| atenção #D08A00 sobre #FFFFFF / #11110F | 2,87 / 6,59 | no claro só marcador; texto usa `--atencao-texto` |
| erro #C94343 sobre #FFFFFF / #11110F | 4,81 / 3,93 | no escuro texto usa `--erro-texto` |
| informação #3678B9 sobre #FFFFFF / #11110F | 4,62 / 4,09 | no escuro texto usa `--info-texto` |

## Gráficos

- Linhas e barras de resultado usam `--verde-texto` (≥ 3:1 contra a superfície nos dois temas); o preenchimento
  lima (#C6EF4E) fica para áreas, selos de valor e o radar, sempre com texto escuro por cima.
- O gráfico de evolução dos simulados segue a referência "Budget": linha no tom do texto (16,7:1 / 17,5:1),
  ponto em destaque lima com contorno escuro e balão escuro.
- Todo gráfico tem `role="img"` com descrição; o radar tem tabela só para leitor de tela.
