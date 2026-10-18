# Adendo: banco grande + noturno em paralelo

Aplicar SÓ quando chegar nas etapas indicadas. Não muda a ordem do PROMPT-VIAGEM nem da PROMPT-RETOMADA.

CONTEXTO: quero depender o mínimo possível de IA "na hora". O banco cresce de madrugada e de dia o app só serve o que já está pronto. Reaproveite o que já existe: src/catalogo.ts, src/corrente.ts, src/telemetria.ts, src/similaridade.ts, o catálogo de cenários, o log de gerações (teto diário) e a fila persistente da R2.2.

## NA ETAPA 6 (NOTURNO)

1. META DE BANCO
   - Meta inicial: 1.200 questões APROVADAS (oficiais contam), distribuídas pela cota de cada disciplina na prova (data/estrutura-prova.json) e, dentro dela, pelos tópicos. Prioridade: disciplina de maior peso com maior falta para a meta.
   - Tópicos sem fonte liberada (Bancários e Atualidades antes das leis; Vendas por doutrina antes do meu OK do glossário) ficam fora da conta até liberar.
   - Depois de bater a meta do tópico, ele só ganha questões novas quando:
     (a) as inéditas para o aluno com MENOS inéditas caem abaixo de 20% da meta do tópico, OU
     (b) o tópico fica "dominado" para algum aluno → gera dificuldade 4–5.

2. TETO
   - O teto diário atual (GERACAO_MAX_DIA=60) conta TENTATIVAS. Separe em dois: GERACAO_MAX_TENTATIVAS_NOITE (padrão 200) e META_APROVADAS_NOITE (padrão 100). A noite para no que vier primeiro.

3. PARALELO (dentro do job noturno, sem quebrar a fila de um job por vez)
   - O noturno continua sendo UM job na fila, mas por dentro roda até 3 trabalhadores (NOTURNO_TRABALHADORES=3).
   - Cada trabalhador prefere um gerador diferente da corrente; o auditor de cada questão é escolhido pela regra de família do corrente.ts.
   - Limite global de pedidos por minuto compartilhado por todos (token bucket na camada do llm.ts, NVIDIA_RPM_MAX=30), respeitando Retry-After.
   - Nunca dois trabalhadores no mesmo tópico ao mesmo tempo (trava por tópico), e o cenário sorteado fica reservado até a questão terminar.
   - Antes de SALVAR, refaça o filtro de similaridade contra o banco atualizado (outro trabalhador pode ter salvo uma parecida segundos antes).
   - Falha de infraestrutura volta pra fila (até 3 voltas, intervalo crescente); descarte só por qualidade, com motivo.

4. PRÉ-GERAÇÃO (para não chamar IA de dia)
   - "Me explica de outro jeito": gerar e salvar uma explicação alternativa para cada questão aprovada que ainda não tenha. Nunca contradiz gabarito nem explicações salvas; auditor de família diferente confere.
   - Deixe os ganchos prontos e ATIVE quando o recurso existir na Fase B: aula curta por tópico (item 8.5) e banco de 40 temas de redação (item 8.4).
   - Ordem dentro da noite: questões até a meta → explicações alternativas → aulas → temas.

5. RELATÓRIO DA NOITE (coleção "relatorios")
   - Aprovadas, tentativas, descartes por motivo (qualidade, similaridade, infraestrutura), questões aprovadas por hora, modelo que mais atendeu e progresso até a meta de 1.200.

## NA FASE B (8.4 e 8.5)

6. Na hora, só a correção de redação usa IA. Se todos os modelos da corrente falharem, a redação entra na fila persistente, é corrigida quando a IA voltar e aparece no painel: "Sua redação foi corrigida". O tutor usa primeiro a explicação pré-gerada e só chama IA se o aluno pedir uma segunda versão.

## NO R3 (TELAS)

7. As telas IA, Fila, Benchmark e Pendências viram UMA tela "Admin" com 4 abas, visível só para o papel admin. Na aba Fila, mostre o relatório da noite e o progresso até 1.200. Alunos não veem nenhuma menção a IA ou a modelos.
8. Painel do aluno: cartão "Banco de questões" com total, inéditas por disciplina e "+N esta noite".

## SEMPRE

9. Troca de modelo em falha é automática pela corrente; nunca exige ação minha. Só a escolha do principal (depois do benchmark) espera meu OK.
10. Testes: dois trabalhadores não salvam questões parecidas; trava por tópico; token bucket respeita o limite; retomada depois de reinício. Commit por item, "RETOMAR AQUI" no DIARIO.
