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
- Fase B (8.1 a 8.9) concluída no código, no servidor e no demo. Redação: regra de 25 a 30 linhas por código (DECISOES nº 8).
- Aulas (8.5): 0 aprovadas em duas rodadas reais; citação e formato endurecidos por código (DECISOES nº 9).
- Etapa 6: primeira noite real feita (12 aprovadas em 16 tarefas); a meta de aprovadas agora só para a geração.
- Etapa 9:
  - estados (erro, vazio, carregando), offline com fila, atalhos, PWA, Desfazer, menu "Mais" no celular;
  - bateria e2e 6/6 (`scripts/e2e-fluxos.ts`) e prints em `docs/telas/`;
  - Lighthouse pendente (DECISOES nº 10).

## Próximo (em ordem)
1. Rodadas reais de 3 por assunto da Etapa 7 (Amortização, Taxas, Combinatória, Probabilidade, Concordância, Regência, Pontuação).
2. Benchmark completo de madrugada (retomando as amostras gravadas) → escolha definitiva da corrente (espera o dono).
3. Bateria e2e completa (fluxos + login) com os jobs de IA parados; Lighthouse.
4. Aplicar `docs/ADENDO-BINHO-VOZ.md` (depois de tudo).
5. Pendências do dono: fontes do BCB, edital novo (cotas, pesos, duração, regra de linhas), deploy.

## Ideias para depois
- Questões com imagem/tabela: cadastro com figura para as de `docs/PENDENTES-FIGURA.md`
- Gráfico de evolução do domínio por disciplina ao longo das semanas
