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

## Próximo (em ordem)
1. **Primeiro ciclo real**: configurar Atlas e IAs, ingerir a prova BB 2023 e a Lei 4.595, gerar 10 questões, estudar uma semana e anotar o que incomoda.
2. **Tela de revisão das traiçoeiras e contestadas**: lista para aprovar, corrigir ou descartar sem mexer no banco na mão.
3. **Pesos do edital**: preencher `questoesNaProva` (o simulado e a prioridade já usam esse peso).
4. **Estoque automático**: um job diário (`npm run bb -- estoque`) num servidor ou numa tarefa agendada.
5. **PWA**: manifest + ícone para instalar no celular e cache das próximas 20 questões para estudar offline.
6. **Deploy**: hospedar API + site (Render, Railway ou VPS) com login simples, porque hoje a API não tem autenticação.
7. **Edital novo**: quando sair, atualizar `data/topicos.json`, rodar `topicos` de novo e ajustar o estilo da nova banca nos prompts.

## Ideias para depois
- Questões com imagem/tabela (hoje são puladas na ingestão)
- Redação: correção por IA com critérios da banca
- Gráfico de evolução do domínio por disciplina ao longo das semanas
