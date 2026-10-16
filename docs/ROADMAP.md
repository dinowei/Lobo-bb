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

## Próximo (em ordem)
1. **Leis e normas**: Lei 4.595, Pix, Lei 9.613, LC 105, CDC (etapa C, item 4 do `docs/INTEGRACAO.md`).
2. **Tela de revisão das traiçoeiras, contestadas e pendentes de figura**: lista para aprovar, corrigir ou descartar sem mexer no banco na mão (seção 5.8 do plano).
3. **Escritor de Português com reserva**: o `glm-5.3-flash` deu timeout em 4 de 10 questões de Crase quando rodou junto com o `explicar`; usar `deepseek-v4.1-flash` como reserva.
4. **Construção em outras matérias**: Amortização, Probabilidade, Concordância, Regência, Pontuação.
5. **Pesos do edital**: preencher `questoesNaProva` (o simulado e a prioridade já usam esse peso).
6. **Estoque automático / geração noturna**: um job diário (`npm run bb -- estoque`) num servidor ou numa tarefa agendada.
7. **PWA**: manifest + ícone para instalar no celular e cache das próximas 20 questões para estudar offline.
8. **Deploy**: hospedar API + site (Render, Railway ou VPS) com login simples, porque hoje a API não tem autenticação.
9. **Edital novo**: quando sair, atualizar `data/topicos.json`, rodar `topicos` de novo e ajustar o estilo da nova banca nos prompts.

## Ideias para depois
- Questões com imagem/tabela: cadastro com figura para as de `docs/PENDENTES-FIGURA.md`
- Redação: correção por IA com critérios da banca
- Gráfico de evolução do domínio por disciplina ao longo das semanas
