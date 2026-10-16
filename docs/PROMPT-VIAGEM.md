# Prompt de viagem: modo autônomo

**Como usar:** coloque este arquivo em `docs/` e mande ao Claude Code:
`Leia docs/PROMPT-VIAGEM.md e execute tudo, em ordem, sem me esperar.`

---

```
Leia o CLAUDE.md, o docs/PLANO-MESTRE.md, o docs/ROADMAP.md, o docs/PROMPTS-MELHORIAS.md
e o docs/PENDENTES-FIGURA.md antes de começar.

Vou viajar e NÃO vou responder. Trabalhe sozinho, por vários dias se preciso, seguindo a
ordem do cronograma abaixo. O padrão de qualidade é o de produto de empresa grande (Google,
Microsoft): estados completos, acessibilidade, teclado, celular, testes e nenhum detalhe
largado pela metade.

======================================================================
REGRAS DO MODO AUTÔNOMO (valem para tudo)
======================================================================
A1. NUNCA pare para me perguntar. Se algo precisa de mim (decisão, conferência, conta,
    pagamento, senha), prepare tudo até o último passo possível, registre em
    docs/DECISOES-PENDENTES.md (o que é, por que precisa de mim, opções, sua recomendação)
    e siga para o próximo item.
A2. Diário: ao fim de cada item, acrescente em docs/DIARIO.md: data/hora, o que fez,
    números (testes, aprovação, tempo), problemas e como resolveu. Curto e objetivo.
A3. Cada item termina com: typecheck limpo + testes passando + docs atualizados +
    commit claro + git push. Nunca commite .env, chaves, provas/ ou fontes/.
    Antes do primeiro push, confirme com "gh repo view --json visibility" (ou pela API)
    que o repositório está PRIVADO. Se estiver público, NÃO faça push; registre em
    DECISOES-PENDENTES no topo, em maiúsculas, e siga só com commits locais.
A4. Edite código SEMPRE pelo editor, nunca por script (regra do CLAUDE.md).
A5. Regras do projeto continuam valendo, sem exceção: gabarito oficial nunca passa por IA;
    número nunca depende só da IA; questão só entra se o auditor acertar às cegas;
    explicação nasce da regra ou da fonte; Bancários, Atualidades e Vendas só geram com
    fonte ingerida.
A6. Nada que eu precise conferir entra no meu treino sem o meu OK: figuras extraídas,
    fontes doutrinárias escritas por IA, limites de similaridade. Deixe tudo pronto numa
    tela/lista de conferência e marque como pendente.
A7. Cota da NVIDIA: em testes, rode lotes pequenos (3 a 10 questões). Teto de geração
    por dia via .env (GERACAO_MAX_DIA, padrão 60). Um job pesado por vez (a fila existe).
    Se a cota acabar, siga com as tarefas de código e registre no DIARIO.
A8. Nunca apague tentativas, revisões ou progresso meu. Questões só podem ser apagadas
    se ainda estiverem pendentes e sem nenhuma resposta minha.
A9. Visual: a identidade NÃO muda (regra 8 do CLAUDE.md: escuro, laranja #ff5b1f,
    Inter, lobo). Polimento é de comportamento, acabamento e consistência, não de estilo.
A10. Se um item travar de verdade depois de 3 abordagens diferentes, registre o bloqueio
    em DECISOES-PENDENTES e siga para o próximo. Não fique em loop.
A11. Não fique checando processos em segundo plano: espere o aviso de término.

======================================================================
ETAPA 0: FECHAR O QUE ESTÁ ABERTO
======================================================================
0.1 Crase: termine a rodada de 10, registre os números (aprovação, tempo médio,
    desempates do Ultra, escritor usado, reescritas, regras) e faça o commit do item 1.
0.2 Vendas: grave em docs/FONTES-VENDAS.md a lista de fontes que você levantou,
    separando: (a) normas públicas que você pode baixar de site oficial; (b) conceitos de
    doutrina (Kotler 5As, Zeithaml, Lovelock etc.) que precisam de outro tipo de fonte.
0.3 Normas revogadas: marque como "desatualizada", com nota de atualização, as oficiais
    que citam 4.658/2018, 3.694/2009 e 4.539/2016 (explique o que mudou com a 4.893/2021
    e a 4.949/2021). A questão continua visível no "Caderno de erros"/histórico, mas sai
    do treino. Na tela da questão, mostre um selo "Norma atualizada" com a nota.
0.4 Recupere a 2021 nº 23 com o comando "recuperar".
Commit + push.

======================================================================
ETAPA 1: FIGURAS E ANTI-REPETIÇÃO (PLANO-MESTRE, seção 5.8, fases 1 a 4)
======================================================================
Execute a seção 5.8 inteira, com estas adaptações para o modo autônomo:
- Fase 2: extraia todas as figuras, mas elas ficam com status "aguardando conferência".
  A tela "Figuras" fica pronta para eu aprovar na volta. Nenhuma volta ao treino sozinha.
- Fase 3: renderize 5 figuras geradas por tipo e salve prints em docs/telas/figuras/
  (Playwright, desktop e celular) para eu ver na volta.
- Fase 4: calibre os limites de similaridade com um valor conservador (descarta só o que
  é quase idêntico) e gere docs/CALIBRAGEM-SIMILARIDADE.md com 20 pares perto do limite
  para eu classificar depois. Ajuste fino fica pendente.
Commit por fase.

======================================================================
ETAPA 2: LEIS E NORMAS (A3) + VENDAS
======================================================================
2.1 Baixe SÓ de sites oficiais (planalto.gov.br, bcb.gov.br, normativos do CMN/BCB) as
    normas de Conhecimentos Bancários, Atualidades e as normas públicas de Vendas:
    Lei 4.595/1964, Lei 9.613/1998 (lavagem), LC 105/2001 (sigilo), Lei 8.078/1990 (CDC),
    Lei 13.146/2015 (PcD, partes cobradas), Resolução BCB 1/2020 + regulamento do Pix,
    Resolução CMN 4.949/2021, Resolução CMN 4.893/2021, Circular BCB 3.978/2020
    (PLD/FT), e as demais que aparecem nos tópicos de Bancários em data/topicos.json.
    Salve em fontes/ com data de consulta e hash. Confira a vigência de cada uma.
2.2 Ingira cada uma com "fonte" (tipo lei/norma, disciplina certa). Mostre no DIARIO
    quantos trechos cada uma gerou.
2.3 Gere 5 questões de Bancários e 5 de Atualidades. Me mostre a aprovação no DIARIO.
2.4 Vendas, doutrina: NÃO use livros protegidos. Escreva docs/fontes-vendas/glossario.md,
    um glossário com cada conceito cobrado (5As, dimensões da qualidade, características
    dos serviços, riscos percebidos, funil, segmentação × personalização etc.) construído
    a partir das 28 questões oficiais de Vendas e das explicações que BATEM com o
    gabarito oficial (cada verbete cita as questões que o sustentam). Ingira como fonte
    com status "aguardando revisão do dono": Vendas por doutrina só gera depois do meu OK.
    Vendas por norma (CDC, 4.949) já pode gerar.
Commit + push.

======================================================================
ETAPA 3: MEDIR INFORMÁTICA E VENDAS (A3b)
======================================================================
Gere 10 de Informática e 10 de Vendas (só a parte com fonte liberada). Taxa de aprovação,
motivos de reprovação e 3 exemplos aprovados de cada em docs/QUALIDADE-INF-VENDAS.md.
Se a aprovação for < 60%, investigue a causa, proponha e aplique a correção (prompt,
fonte, construção) e meça de novo. Commit + push.

======================================================================
ETAPA 4: LOGIN PARA MIM E AMIGOS (C2: PLANO-MESTRE seção 5.7)
======================================================================
Execute a seção 5.7 inteira. Acabamento obrigatório:
- Tela de login/cadastro no estilo do site, com: mostrar/ocultar senha, aviso de
  Caps Lock, força da senha, mensagens de erro humanas e específicas no campo certo,
  botão com estado de carregando, Enter envia, foco automático no primeiro campo,
  autocomplete correto (email, current-password, new-password) para gerenciadores de
  senha, "lembrar de mim" (30 dias).
- Código de convite validado ao digitar (válido/expirado/usado).
- Sessão expirada: volta para o login e, depois de entrar, retorna à tela onde estava.
- Minha conta: trocar nome e senha, sair de todos os dispositivos.
- Migração dos meus dados para a conta admin, com teste.
- Sem criar conta real minha: deixe o comando pronto e registre em DECISOES-PENDENTES
  "rodar npm run bb -- criar-admin <email>" com o passo a passo.
Commit + push.

======================================================================
ETAPA 5: PRONTO PARA A NUVEM, SEM PUBLICAR (C3: seção 5.6)
======================================================================
Não crie contas, não informe cartão, não publique. Deixe tudo pronto:
- Compare Render, Railway e Fly.io (preço atual, cron, sono do plano grátis, região
  próxima ao Brasil) e recomende um em docs/DEPLOY.md.
- Dockerfile + arquivo de configuração do provedor recomendado, health check
  (/api/saude), variáveis documentadas (sem valores), build de produção do site,
  cabeçalhos de segurança, compressão, cache dos estáticos.
- Job noturno pronto para rodar como cron do provedor.
- Passo a passo em DEPLOY.md para eu publicar em 20 minutos na volta, com checklist
  pós-publicação. Registre em DECISOES-PENDENTES.
Commit + push.

======================================================================
ETAPA 6: GERAÇÃO NOTURNA (A4: seção 5.1)
======================================================================
Execute a seção 5.1, com o agendamento como cron do provedor (etapa 5), e também um
comando local "npm run bb -- noturno" para eu rodar à mão. Teste com GERACAO_MAX_NOITE=3.
Cartão "Banco de questões" no painel: total por disciplina, não vistas, geradas na
última noite e descartadas por repetição. Commit + push.

======================================================================
ETAPA 7: CONSTRUÇÃO EM OUTRAS MATÉRIAS (A5: seção 5.2)
======================================================================
Execute a seção 5.2. Um assunto por commit. Aprovação por assunto no DIARIO.
Se a cota da NVIDIA estiver curta, faça a parte por código (templates + 1.000 montagens
sem IA) de todos e deixe as rodadas reais de 3 questões para o fim.

======================================================================
ETAPA 8: ESTUDO DE ALTO RENDIMENTO (FASE B)
======================================================================
Na ordem, um commit por item, servidor e modo demo juntos:
8.1 Simulado fiel (PROMPTS-MELHORIAS §1). Use as 132 oficiais para a distribuição de
    dificuldade.
8.2 Diagnóstico do tipo de erro (PLANO-MESTRE 5.3).
8.3 Calibragem da confiança (5.4).
8.4 Redação com correção por IA (PROMPTS-MELHORIAS §2).
8.5 Teoria curta + "me explica de outro jeito" (§3). As aulas de Bancários, Atualidades e
    Vendas só com fonte; as de Vendas por doutrina esperam o meu OK do glossário.
8.6 Flashcards + modo misto + horas líquidas (5.5).
8.7 Dificuldade calibrada por rating (§4).
8.8 Diagnóstico inicial (§5).
8.9 Plano até a prova (§6).

======================================================================
ETAPA 9: ACABAMENTO NÍVEL PRODUTO (passe final em TODAS as telas)
======================================================================
Faça uma auditoria tela por tela e corrija tudo. Checklist obrigatório:

ESTADOS
- Carregando: skeleton no formato do conteúdo (nunca tela vazia ou spinner solto).
- Vazio: mensagem útil com o lobo e a próxima ação ("Nenhuma revisão hoje. Que tal 10
  questões de Juros?").
- Erro: mensagem humana + botão "Tentar de novo"; nunca stack trace ou "Error 500".
- Sem internet: faixa discreta "Você está offline"; resposta dada offline fica na fila e
  é enviada sozinha quando a conexão volta, sem perder nada.
- Error boundary por tela: um erro numa parte não derruba o app inteiro.

TECLADO E ACESSIBILIDADE (WCAG 2.1 AA)
- Atalhos na questão: A–E (ou 1–5) marcam, Enter confirma, → ou N vai para a próxima,
  "?" abre a lista de atalhos. Atalhos não disparam dentro de campos de texto.
- Foco visível em tudo (anel laranja), ordem de Tab lógica, link "pular para o conteúdo".
- Contraste AA em todos os textos (meça o laranja sobre o escuro e ajuste o TOM só onde
  reprovar, sem mudar a identidade).
- aria-live anunciando "Correta"/"Incorreta"; rótulos em todos os botões só de ícone;
  alvo de toque mínimo de 44 px; respeitar prefers-reduced-motion.

CELULAR
- Funciona de 360 px a 1440 px. No celular, a sidebar vira menu recolhível, mantendo a
  identidade. Alternativas fáceis de tocar, nada cortado, teclado virtual não cobre o
  botão de confirmar.
- PWA instalável (manifest, ícone do lobo, theme-color, tela de abertura).

FEEDBACK E DETALHES
- Toasts discretos para confirmações; "Desfazer" por 5 s em ações destrutivas
  (contestar, zerar progresso, sair do simulado).
- Confirmação ao sair no meio de simulado ou redação; rascunho salvo sozinho.
- Cronômetro pausa com a aba oculta (horas líquidas honestas).
- Título da aba dinâmico ("Questão 12/70 · Lobo"), favicon do lobo.
- Números e datas em pt-BR (1.234,56 · "há 2 dias" · 16/10/2026).
- Microcopy revisado: mesmo tom informal em tudo, sem jargão técnico, sem inglês solto.
- Próxima questão pré-carregada: responder → próxima em < 100 ms.

DESEMPENHO E QUALIDADE
- Divisão de código por rota, fonte Inter com font-display: swap, sem bibliotecas
  pesadas desnecessárias.
- Lighthouse (celular) ≥ 90 em Performance, Acessibilidade e Boas práticas. Registre
  as notas no DIARIO.
- Testes ponta a ponta com Playwright dos fluxos: login, responder questão, revisão,
  simulado completo, redação, contestar, offline/online.
- Prints de TODAS as telas (desktop 1440 e celular 390) em docs/telas/ para eu revisar
  pelo celular na viagem.

======================================================================
ENTREGA FINAL
======================================================================
Escreva docs/RELATORIO-VIAGEM.md:
1. Resumo em 10 linhas do que mudou.
2. Tabela de etapas: feito / parcial / bloqueado, com o commit de cada uma.
3. Números: questões no banco por disciplina e origem (oficial/gerada), aprovação por
   assunto, notas do Lighthouse, testes.
4. DECISOES-PENDENTES em ordem de prioridade, cada uma com o que eu preciso fazer em
   1 a 3 passos.
5. O que você recomenda fazer em seguida.
Atualize CLAUDE.md, ROADMAP e PLANO-MESTRE (tabela "Onde estamos"). Commit + push.
```
