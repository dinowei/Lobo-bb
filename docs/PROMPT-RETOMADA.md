# Prompt de retomada (depois do limite semanal)

**Como usar:** quando o limite do Claude Code liberar, coloque este arquivo em `docs/` e mande:
`Leia docs/PROMPT-RETOMADA.md e execute.`

```
Leia o CLAUDE.md, docs/PROMPT-VIAGEM.md, docs/DIARIO.md, docs/DECISOES-PENDENTES.md
e o "git log --oneline -20". Você parou no meio do PROMPT-VIAGEM porque o limite
semanal de uso acabou. Retome de onde parou, com as regras abaixo.

======================================================================
R0. ECONOMIA DE USO (o limite semanal é o recurso mais escasso agora)
======================================================================
- Antes de qualquer coisa, descubra pelo DIARIO e pelo git log o último passo
  concluído e confira se há alterações sem commit (git status). Termine e commite
  o que estava pela metade antes de começar algo novo.
- Typecheck e testes: rode no FIM de cada bloco de mudanças, não a cada edição.
- Não leia arquivos grandes inteiros: busque o trecho (grep) e leia só ele.
- Saída longa de comando: filtre (tail, grep, contagem) em vez de ler tudo.
- Prints de tela: só no fim de cada etapa, não a cada ajuste de CSS.
- Mensagens e DIARIO curtos e objetivos.
- Ao fim de CADA etapa, escreva no DIARIO uma linha "RETOMAR AQUI: <próximo passo
  exato>", para a próxima sessão começar sem reler tudo.
- Se perceber que o limite está perto do fim: pare num ponto limpo, commit + push,
  e atualize o "RETOMAR AQUI".

======================================================================
R1. TERMINE A ETAPA EM QUE PAROU
======================================================================
Siga o PROMPT-VIAGEM exatamente de onde parou (provavelmente Etapa 1, Fase 3 ou 4:
figuras geradas e anti-repetição). Commit + push.

======================================================================
R2. NOVA ETAPA 1.5: CORRENTE DE MODELOS GRÁTIS (antes da Etapa 2)
======================================================================
Motivo: a NVIDIA grátis está derrubando rodadas inteiras (503/timeout) e tudo que vem
depois (leis, noturno, Fase B) depende de IA estável. Regras desta etapa:
SÓ endpoints GRATUITOS da NVIDIA. Proibido qualquer provedor pago, cartão ou
crédito. Proibido openai/gpt-oss-120b (endpoint grátis descontinuado).
NÃO troque os modelos padrão de produção nesta etapa: prepare tudo, rode o
benchmark e deixe a PROPOSTA em DECISOES-PENDENTES para eu aprovar.

R2.1 Catálogo real
  - Inventarie onde ficam os ids, as chamadas, os tratamentos de 429/503/timeout e
    quais modelos estão em uso de verdade.
  - Teste com poucas chamadas curtas, espaçadas (sem gerar carga), os candidatos:
    nvidia/nemotron-3.5-lightning (id exato da sua config), nemotron-3-super,
    nemotron-3-ultra, openai/gpt-oss-20b, meta/muse-glimmer-30b,
    stepfun-ai/step-5-preview, z-ai/glm-5.3-flash (id exato), deepseek v4.1 flash
    (id exato da ficha), nvidia/nemotron-3.5-super-vl-120b-a12b.
  - Registre por modelo: id exato, se é endpoint grátis, status HTTP, latência,
    JSON válido sim/não, parâmetros aceitos (raciocínio/esforço).
  - Classifique em docs/CATALOGO-MODELOS.md: (1) grátis confirmado e testado,
    (2) listado mas não testado, (3) temporariamente fora, (4) descontinuado ou sem
    gratuidade. Confira o aviso de descontinuação do z-ai/glm-5-3 (sem flash) e se
    ele afeta o flash.

R2.2 Infraestrutura (código, sem trocar os padrões)
  - Catálogo central de modelos: id, família (nvidia, openai, meta, zai, deepseek,
    stepfun), funções, status, último sucesso/falha, métricas.
  - Corrente por função (gerador, auditor, escritor PT, juiz PT, tutor, redação),
    configurável no .env/arquivo de config, com 3 opções quando existirem; se não
    houver 3 viáveis, registre a limitação em vez de inventar.
  - REGRA com testes: o auditor nunca é da mesma família de quem gerou; o juiz de
    Português nunca é da mesma família do escritor. Se o gerador cair para reserva,
    o auditor é recalculado. Se não houver candidato elegível, a questão espera
    (não viola a regra).
  - Falhas: backoff exponencial com jitter, respeitar Retry-After, limite de
    tentativas, separar erro recuperável (429/503/timeout) de permanente (id
    inválido, descontinuado), pular modelo desativado.
  - Noturno: tarefa persistida no Mongo; falha de infraestrutura volta pra fila até
    3 vezes com intervalo crescente (config); sobrevive a reinício; descarte só por
    qualidade, com motivo registrado.
  - Verificação semanal dos modelos (no noturno), com alerta no painel.
  - Telemetria por modelo: chamadas, sucesso, falhas por tipo (429/503/timeout/
    formato), latência mediana e p95, uso como reserva. Sem chaves ou textos nos logs.
  - ATENÇÃO: hoje gerador (Lightning) e auditor (Super) são da MESMA família
    (Nemotron) e isso fere a regra. Não troque sozinho: registre como decisão
    PRIORIDADE ALTA em DECISOES-PENDENTES, com a recomendação que sair do benchmark.

R2.3 Benchmark (roda no noturno, em várias noites se preciso, sem pressa)
  - Auditor: Super, Ultra, gpt-oss-20b, Muse Glimmer 30b, Step 5 Preview resolvem
    ÀS CEGAS uma amostra estratificada de 60 oficiais (expandir até as 133 se a
    cota deixar). Garanta que o gabarito não vaza no prompt nem em metadados.
    Meça separadamente: acerto (sobre as que responderam, com o denominador) e
    disponibilidade (falhas de infraestrutura). Por disciplina também.
  - Português: escritor e juiz avaliados separadamente com o banco de regras da
    Crase + os casos em que o auditor errou ("à ela", "à Vossa Senhoria",
    "recorreu a gerência").
  - Redação: só prepare a estrutura do benchmark; sem redações com nota humana,
    registre a limitação.
  - Resultado em docs/BENCHMARK-MODELOS.md, com amostra, prompt, parâmetros,
    incerteza e limitações. Não declare vencedor por diferença pequena.
  - Proposta de correntes (Opção A: gerador Nemotron + auditor de outra família;
    Opção B: gerador gpt-oss/Muse + auditor Nemotron) em DECISOES-PENDENTES, com
    evidência, riscos e plano de reversão. Preview/early access nunca como principal.
  - Reranker e modelo de visão: só no ROADMAP, sem implementar.

======================================================================
R3. SITE PREPARADO PARA TUDO ISSO
======================================================================
No mesmo estilo do site (regra 8), visível só para admin:
  - Tela "IA": status de cada modelo (verde/amarelo/vermelho), última resposta,
    taxa de sucesso e latência das últimas 24 h e 7 dias, alertas de
    descontinuação, qual modelo atendeu cada função hoje.
  - Tela "Fila": tarefas do noturno (pendente, rodando, aguardando nova tentativa,
    concluída, descartada com motivo), botão "tentar de novo agora".
  - Tela "Benchmark": tabela do BENCHMARK-MODELOS com acerto x disponibilidade por
    modelo e por disciplina; quando a proposta estiver pronta, botão "Aprovar
    corrente" que aplica a configuração (com confirmação e "desfazer").
  - Painel do aluno: um selo discreto "Banco atualizado esta noite: +N questões",
    e nas funções na hora (tutor, redação) mensagem amigável quando a IA estiver
    ocupada ("O lobo está pensando… tentando outro modelo") em vez de erro.
  - Tela "Pendências do dono": lista viva do DECISOES-PENDENTES com links diretos
    para Figuras, Glossário de Vendas, Benchmark e Calibragem de similaridade.
Commit + push + prints dessas telas em docs/telas/.

======================================================================
R4. DEPOIS, SIGA O PROMPT-VIAGEM
======================================================================
Etapa 2 (leis) em diante, com as mesmas regras de economia (R0). As etapas de IA
usam a corrente nova; as de código seguem normalmente mesmo se a NVIDIA cair.
```
