# Post-it geral: tudo que o dono pediu para anotar

Leia junto com o DIARIO (RETOMAR AQUI). NÃO muda a ordem do PROMPT-RETOMADA: cada item diz QUANDO entra.

## A. Agora (antes de seguir a Fase B)
1. Confirmar no DIARIO se a Etapa 6 (noturno) está implementada E se já rodou uma noite real. Se não rodou, rodar uma noite curta de teste (META_APROVADAS_NOITE=10) e registrar o relatório da noite.
2. Confirmar se o resto da Etapa 7 foi feito (Descontos, Amortização SAC/Price, Taxas, Probabilidade). Se não, fazer depois da 8.5.
3. Benchmark: o limite de "5 falhas seguidas por modelo" não está sendo respeitado (o GLM continuou depois da 5ª). Corrigir com teste. Depois, rodar o benchmark completo SÓ de madrugada, retomando do que já foi gravado (não refazer amostras prontas).
4. Redação: conferir que o mínimo de linhas é aplicado (texto curto demais tem que ser penalizado ou zerado, como na banca). Um texto de 5 linhas não pode tirar 87/100. Teste para isso.

## B. Etapa 6 (noturno)
5. Aplicar docs/ADENDO-BANCO-GRANDE.md (meta 1.200 aprovadas, teto de tentativas x aprovadas, 3 trabalhadores com trava por tópico, token bucket, pré-geração, relatório da noite).

5b. Aplicar docs/ADENDO-FONTES-ATUAIS.md: cada explicação mostra a fonte da prova (origem) E a
    fonte oficial atual; o que mudou desde a prova fica destacado. Sem reescrever explicações.

## C. Etapa 9 (acabamento)
6. Bateria e2e completa só com os jobs de IA parados.
7. Carrossel: o Codex JÁ implementou (validado em 360 e 1440 px). Só CONFERIR contra esta lista e corrigir o que faltar: arrastar no celular (scroll-snap), setas ‹ › no computador, esmaecido na borda + bolinhas, teclado ← →, clique abre Praticar da matéria, ordem por prioridade (peso × fraqueza), barra de domínio em cada cartão, reduced-motion, 360–1440 px. Estilo atual (regra 8).

## D. Depois de TUDO concluído (inclusive Etapa 9)
8. Executar docs/ADENDO-BINHO-VOZ.md: ícone do app a partir do lobo.png atual, nome "Lobo Binho", poses do Binho pelo site, "Pergunte ao Binho" (texto e voz), voz NVIDIA Magpie pt-BR com normalizador de fala, modo "Estudar ouvindo".
   O .env já tem NVIDIA_TTS_API_KEY, NVIDIA_TTS_FUNCTION_ID e NVIDIA_TTS_VOZ (vazia).

## Regras que continuam valendo
- Um job de IA por vez (a trava). Benchmark pode ser interrompido de forma graciosa (SIGINT) se travar a fila por mais de 30 min; registrar no DIARIO.
- Timeouts de diagnóstico menores só no processo de teste, nunca gravados como padrão.
- Commit por item, DIARIO e RETOMAR AQUI sempre atualizados.
