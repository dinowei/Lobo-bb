# Roadmap

## Pronto
- [x] Esquema do banco (tópicos, fontes, trechos vetorizados, questões, tentativas, revisões, contestações)
- [x] Ingestão de leis e normas (PDF/TXT/HTML), fatiamento por artigo e classificação por tópico
- [x] Ingestão de provas oficiais com gabarito lido sem IA, mais explicação por IA com teste às cegas
- [x] Gerador + auditor (cego + revisão) com checagens determinísticas
- [x] Revogação de normas (questões antigas saem de circulação)
- [x] Motor compartilhado: XP, níveis com títulos da carreira, sequência de dias, domínio por tópico, 15 conquistas, SM-2
- [x] Site: painel, prática com confiança e atalhos, revisões, simulados no peso do edital, caderno de erros, conquistas, ajustes
- [x] Modo demo (33 questões de exemplo) e modo servidor com geração sob demanda
- [x] Atlas + NVIDIA integrados (gerador Lightning, auditor Super com reserva Ultra, escritor de Português GLM, embeddings Nemotron)
- [x] Robustez: novas tentativas (2s/6s/18s), timeout, teto de tokens, reparo de JSON, auditor reserva
- [x] Matemática por construção (Juros compostos, Descontos) com conferência por mathjs
- [x] Variedade sorteada pelo código com tabela de compatibilidade tipo × contexto
- [x] Crase por construção: banco de regras, trava de posição, auditor por frase, enunciado conforme as alternativas, regras menos usadas primeiro
- [x] Provas oficiais BB 2023 (69/70) e BB 2021 (67/70) ingeridas: gabarito por código, disciplina lida da capa, texto de apoio conferido no PDF, conferência literal campo a campo (corrige palavra trocada pela IA), comando `anular`
- [x] Pendentes de figura listados em `docs/PENDENTES-FIGURA.md` (status `precisa_imagem`, fora do treino)
- [x] Fila de um job de IA por vez (`src/fila.ts`); escritor de Português com reserva; desempate da Crase pelo Ultra
- [x] Figuras (5.8, fases 1 a 3): inventário, extração fiel das oficiais com tela de conferência, figuras desenhadas por código nas geradas (planilha, sistema linear, série de depósitos, taxa de abandono)
- [x] Anti-repetição (5.8, fase 4): embedding + trechos (Jaccard) + impressão estrutural, cenários (perfil + situação) menos usados, teto diário de geração, descartes no `status`

## Estado atual
- Etapas 8.1, 8.2 e 8.3 concluídas e registradas no `docs/DIARIO.md`.
- Etapa 8.4 (redação com correção por IA) concluída; E2E real no app gerou tema, corrigiu redação e salvou nota 87/100 no histórico.
- Etapa 6 (noturno + adendo do banco grande): código e testes concluídos; rodada real noturna ainda pendente.
- Etapa 9: requisitos do carrossel do painel registrados no `docs/DIARIO.md`; implementação e validação em 360 px e 1440 px pendentes.

## Próximo (em ordem)
1. Implementar a Etapa 8.5 (aulas curtas por tópico e tutor por questão), incluindo o pré-gerador noturno previsto no adendo.
2. Implementar o carrossel de matérias da Etapa 9 conforme a especificação em `docs/DIARIO.md`.
3. Rodar a validação real do noturno da Etapa 6, sem concorrência com outros jobs de IA.
4. Aplicar `docs/ADENDO-BINHO-VOZ.md` depois da Etapa 9.
5. Revisar pendências restantes: fontes oficiais, tela de revisão, PWA, deploy e edital novo.

## Ideias para depois
- Questões com imagem/tabela: cadastro com figura para as de `docs/PENDENTES-FIGURA.md`
- Gráfico de evolução do domínio por disciplina ao longo das semanas
