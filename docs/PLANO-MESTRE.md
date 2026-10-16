# Plano mestre — Lobo (estudos para o concurso do BB)

Documento único de navegação. Os prompts longos ficam nos arquivos citados; os curtos estão aqui mesmo.
**Regra de uso:** um prompt por vez → testar → commit → próximo.

---

## 1. Onde estamos (15/10/2026)

| Área | Situação |
|---|---|
| Site (painel, prática, revisões, simulados, erros, conquistas) | ✅ funcionando, modo demo + servidor |
| MongoDB Atlas + NVIDIA (gerador, auditor, embeddings) | ✅ integrados |
| Robustez (novas tentativas, timeout, reparo de JSON, auditor reserva) | ✅ |
| Matemática por construção (código faz a conta) | ✅ Juros compostos com 80% de aprovação |
| Variedade por sorteio + tabela de compatibilidade tipo × contexto | ✅ |
| Crase por construção (escritor GLM + regras em código + trava do "à") | ✅ 3/3; falta enunciado e variedade |
| Provas oficiais 2021 e 2023 (Etapa C) | 🟡 gabaritos conferidos; ingestão em andamento |
| Informática e Vendas (30 das 70 questões) | ⚠️ qualidade da geração nunca medida |
| Leis e normas (Bancários e Atualidades) | ⏳ |
| Geração noturna sob medida | ⏳ prompt pronto |
| Estudo (simulado fiel, redação, teoria…) | ⏳ `PROMPTS-MELHORIAS.md` |
| Produto (login, proteção, app, pagamento) | ⏳ `PROMPT-PROTECAO.md` |

---

## 2. Resposta imediata ao Claude Code (Crase)

```
Sim para o ESCRITOR_PT_MODEL, com estes ajustes:

1. Escritor de Português = modelo diferente do auditor. Teste o
   llama-3.1-nemotron-70b-instruct (ou outro forte disponível, que não seja o Super).
   Rode 3 de Crase e me mostre a tabela frase/regra/esperado/auditor.

2. Explicação vem da REGRA, não do auditor: como o código sabe qual regra cada
   alternativa aplica ou viola, a explicação de cada alternativa deve partir do
   texto da regra no banco (src/portugues.ts). A IA só adapta para a frase.
   Motivo: na questão aprovada, o veredito da C estava certo, mas a justificativa
   ("artigo masculino plural os") estava errada, e é a explicação que o aluno lê.

3. Trava "frase fora da regra": antes do auditor, confira por código que cada
   frase tem (ou não tem) o "à" exatamente onde a regra sorteada manda.
   Frase que não bate → descarta e pede só aquela frase de novo (1 tentativa).

4. Pela terceira vez os escapes de regex se perderam ao editar por script.
   A partir de agora: edite código SEMPRE pelo editor, nunca por script.
   Adicione isso ao CLAUDE.md.

Commit no fim.
```

---

## 3. Roteiro completo

**Ordem de execução:** A1 → A2 → **A2b (figuras + anti-repetição, seção 5.8)** → A3 → A3b → **C1 → C2 (login) → C3 (nuvem)** → A4 (noturno já na nuvem) → A5 → Fase B.
Login vem antes da nuvem porque um site público sem login fica aberto para qualquer um.
O noturno vem depois da nuvem para nascer como tarefa agendada do servidor, sem agendador do Windows para refazer depois.

### Fase A — Banco de questões funcionando sozinho *(agora)*

| # | Etapa | Onde está o prompt |
|---|---|---|
| A1 | Crase com o escritor de Português | seção 2 acima |
| A2 | **Etapa C:** provas 2023 e 2021 (renomear, gabarito conferido por você) | `INTEGRACAO.md` + adendo do gabarito |
| A3 | Leis e normas: Lei 4.595, Pix, Lei 9.613, LC 105, CDC | `INTEGRACAO.md`, Etapa C, item 4 |
| A3b | Medir Informática e Vendas: 10 geradas de cada, taxa de aprovação e revisão por amostra | pedir direto ao Claude Code |
| A4 | Geração noturna sob medida + agendamento | prompt "noturno" (seção 5.1) |
| A5 | Construção em outras matérias: Descontos, Amortização, Probabilidade, Concordância, Regência, Pontuação | seção 5.2 |

👉 **Ao terminar a Fase A, comece a estudar de verdade todos os dias.** O que incomodar no uso vira prioridade.

### Fase B — Estudo de alto rendimento

| # | Etapa | Onde |
|---|---|---|
| B1 | Simulado fiel à prova (70 questões, cotas, tempo) | `PROMPTS-MELHORIAS.md` §1 |
| B2 | Diagnóstico do tipo de erro | seção 5.3 |
| B3 | Calibragem da confiança | seção 5.4 |
| B4 | Redação com correção por IA | `PROMPTS-MELHORIAS.md` §2 |
| B5 | Teoria curta + "me explica de outro jeito" | `PROMPTS-MELHORIAS.md` §3 |
| B6 | Flashcards de decoreba + modo misto + horas líquidas | seção 5.5 |
| B7 | Dificuldade calibrada (rating) | `PROMPTS-MELHORIAS.md` §4 |
| B8 | Diagnóstico inicial | `PROMPTS-MELHORIAS.md` §5 |
| B9 | Plano até a prova | `PROMPTS-MELHORIAS.md` §6 |

### Fase C — Você + amigos *(o objetivo real)*

| # | Etapa | Onde |
|---|---|---|
| C1 | Repositório GitHub **privado** | ⚠️ fazer já (1 minuto) |
| C2 | Login por e-mail e senha, cadastro só por convite, progresso separado por pessoa | seção 5.7 |
| C3 | Servidor na nuvem (amigos acessam sem seu PC ligado; o noturno roda lá) | seção 5.6 |
| C4 | "Instalar" no celular como app (PWA, ícone do lobo na tela inicial) | dentro da 5.7 |

### Fase D — Venda *(opcional, só se um dia decidir)*

O login da C2 já nasce com campo de plano, então nada precisa ser refeito.

| # | Etapa | Onde |
|---|---|---|
| D1 | Conteúdo que não vaza (API, limites, marcas d'água, cópia) | `PROMPT-PROTECAO.md`, Fase 2 |
| D2 | App Android/iOS com Capacitor (bloqueio de print) | `PROMPT-PROTECAO.md`, Fase 3 |
| D3 | Painel do admin completo, LGPD, termos com advogado | `PROMPT-PROTECAO.md`, Fases 1 e 4 |
| D4 | IA paga para produção (o plano gratuito da NVIDIA é para teste) | trocar no `.env` |
| D5 | Cobrança (Mercado Pago/Asaas/Stripe), CNPJ, beta, lançamento antes do edital | a definir |

---

## 4. Segurança: navegador × aplicativo *(só vale para a Fase D, venda)*

Para você e amigos, basta a 5.7: login, convite, limite de tentativas e repositório privado.


| Proteção | Site no computador | Site no celular | App Android | App iPhone |
|---|---|---|---|---|
| Login + 1 sessão por conta | ✅ | ✅ | ✅ | ✅ |
| API entrega 1 questão por vez, sem gabarito antecipado | ✅ | ✅ | ✅ | ✅ |
| Limite de velocidade + detecção de robô | ✅ | ✅ | ✅ | ✅ |
| Marca d'água visível (e-mail do aluno) | ✅ | — | ✅ | ✅ |
| Marca d'água invisível (rastreia vazamento de texto) | ✅ | — | ✅ | ✅ |
| Bloqueio de cópia | parcial (contornável) | — | ✅ total | ✅ total |
| **Bloqueio de print** | ❌ impossível | — | ✅ tela preta | ❌ Apple não permite |
| Print detectado e registrado | ❌ | — | (já bloqueado) | ✅ + borra a tela |
| Gravação de tela | ❌ | — | ✅ tela preta | ✅ conteúdo escondido |
| Tela do multitarefa escondida | — | — | ✅ | ✅ |
| Acesso ao conteúdo | liberado | 🚫 "baixe o app" | liberado | liberado |

**Foto com outro celular:** nenhuma tecnologia impede; a marca d'água identifica quem vazou.
**Proteção dos seus dados:** chaves só no servidor · repositório privado · backup do Atlas · senha com hash · coleta mínima (LGPD).

---

## 5. Prompts curtos

### 5.1 Geração noturna sob medida
```
Leia o CLAUDE.md. Comando "npm run bb -- noturno": para cada tópico, "não vistas" =
aprovadas que eu ainda não respondi. Se >= ESTOQUE_ALVO (padrão 10), não gera.
Se menor, completa. Tópico dominado → dificuldade 4–5. Teto GERACAO_MAX_NOITE (40).
Prioridade: estudados nos últimos 7 dias > maior cota na prova > menor domínio.
Oficiais contam como estoque. No máximo 2 em paralelo. Relatório na coleção
"relatorios". Desligue a geração em segundo plano durante o estudo (de dia só usa
o que está pronto). Agendamento diário às 03:00 como cron job no provedor da
nuvem (seção 5.6), com log consultável. Cartão "Banco de questões" no painel. Teste com GERACAO_MAX_NOITE=3, commit.
```

### 5.2 Construção em outras matérias
```
Leia o CLAUDE.md. Estenda a construção por código, no mesmo padrão de Juros e Crase:
- Matemática Financeira: Descontos (racional/comercial, simples/composto),
  Amortização (SAC e Price), Taxas (equivalente, nominal/efetiva, real/aparente).
- Probabilidade: combinatória, probabilidade condicional, distribuição binomial.
- Português: Concordância (verbal e nominal), Regência, Pontuação (uso da vírgula)
  com banco de regras e auditoria por frase; nada facultativo; explicação a partir
  da regra.
Para cada template: testes em massa sem IA (mínimo 1.000 montagens) e uma rodada
real de 3 questões. Me mostre a taxa de aprovação por assunto. Commit por assunto.
```

### 5.3 Diagnóstico do tipo de erro
```
Leia o CLAUDE.md. Depois de cada erro, peça ao aluno (1 toque, opcional) o motivo:
"não sabia" · "confundi com outra coisa" · "li errado/desatenção" · "chutei".
Salve na tentativa. Ação por tipo:
- não sabia → oferece a aula curta do tópico e prioriza o tópico;
- confundi → próxima questão compara os dois conceitos (escolha uma da mesma regra
  ou um distrator parecido);
- desatenção → marca para treino com tempo e mostra a palavra-chave que decidia a questão;
- chutei → revisão antecipada.
No painel: gráfico de motivos de erro por disciplina. Servidor e demo. Commit.
```

### 5.4 Calibragem da confiança
```
Leia o CLAUDE.md. Com a confiança que já é registrada em cada resposta, calcule e
mostre (painel + tela de conquistas): "quando você diz CERTEZA, acerta X%",
"quando diz DÚVIDA, acerta Y%", "seus chutes acertam Z%" (esperado ~20%), por
disciplina. Alerta quando a certeza acerta menos de 85% ("ilusão de domínio em
<disciplina>"). Função pura em shared/ com testes. Servidor e demo. Commit.
```

### 5.5 Flashcards, modo misto e horas líquidas
```
Leia o CLAUDE.md.
1. Flashcards: cartões frente/verso gerados das leis e normas ingeridas (quem regula
   o quê, prazos, limites, siglas) e vocabulário de Inglês, auditados contra a fonte,
   na mesma revisão espaçada. Tela "Cartões".
2. Modo misto: opção "Treino misturado" que intercala disciplinas a cada questão,
   seguindo as cotas da prova.
3. Horas líquidas: cronômetro de sessão (25/5 ou 50/10, configurável) que só conta
   tempo com a aba ativa e respondendo; gráfico semanal de horas líquidas por
   disciplina no painel.
Servidor e demo. Commit por item.
```

### 5.6 Servidor na nuvem
```
Leia o CLAUDE.md. Prepare o deploy de API + site (Render, Railway ou VPS: compare
custo e me recomende): Dockerfile, variáveis de ambiente no provedor, HTTPS,
domínio próprio, o job noturno rodando no provedor (cron) e backup do Atlas ligado.
Me dê o passo a passo para eu executar e um checklist de verificação pós-deploy.
```

### 5.8 Figuras (provas e geradas) + filtro anti-repetição
```
Leia o CLAUDE.md. Três frentes, em FASES. No fim de cada fase: typecheck, testes,
commit e PARE para eu aprovar. Edite código só pelo editor.

PRINCÍPIO: IA de imagem NUNCA desenha figura (erra número e texto). Toda figura é
DADO estruturado (JSON) desenhado por CÓDIGO no site (SVG/HTML), no tema escuro.
Número que aparece na figura e número da resposta saem do MESMO dado.

==== FASE 1 — INVENTÁRIO DAS FIGURAS DAS PROVAS OFICIAIS ====
1. Percorra as 140 questões oficiais e liste as que dependem de figura: nº, prova,
   disciplina, tipo (tabela | grafico | planilha | tela_programa | diagrama | outro),
   onde a figura está (enunciado, texto-base ou alternativas) e o que ela mostra.
2. Me mostre a tabela-resumo: quantas por tipo e por disciplina, e a proporção
   (ex.: "Informática: 4 de 30 têm figura"). Essa proporção vira a META de figuras
   nas questões geradas de cada disciplina.

==== FASE 2 — FIGURAS DAS PROVAS OFICIAIS (cópia fiel) ====
3. Imagem embutida no PDF (prints de tela, logos): extraia o arquivo da imagem
   original, sem perda.
4. Desenho vetorial (gráficos, diagramas): renderize a página em PNG (2x) e recorte
   a região entre o cabeçalho da questão e o início do enunciado/alternativas,
   usando as posições do texto do PDF.
5. Tabela feita de texto: reconstrua como tabela estruturada (linhas/colunas) a
   partir das posições do texto, e guarde também o recorte em PNG para conferência.
6. Guarde a figura na questão (campo "figura": tipo, dados ou imagem, legenda,
   posição). PNG pequeno pode ir em base64 no Mongo.
7. Tela de conferência "Figuras" (só para mim): questão + figura + recorte da
   página original lado a lado, com botões "OK", "ajustar recorte" (arrastar) e
   "fora do treino". Questão com figura só entra no treino depois do meu OK.
   Mesmo princípio do gabarito: código extrai, eu confirmo.
8. O site exibe a figura na questão (enunciado, texto-base ou alternativa).

==== FASE 3 — FIGURAS NAS QUESTÕES GERADAS (por construção) ====
9. Só os tipos que apareceram no inventário. Para cada um, um esquema JSON + um
   componente que desenha:
   - tabela → tabela HTML;
   - grafico (barras/linhas/pizza) → SVG a partir dos valores;
   - planilha → grade estilo planilha (letras de coluna, números de linha, barra de
     fórmulas, célula selecionada). Fórmulas avaliadas POR CÓDIGO com nomes em
     português (SOMA, MÉDIA, SE, CONT.SE, PROCV, ARRED…), num avaliador próprio com
     testes — nada de resultado escrito pela IA;
   - tela_programa → componente simplificado do que a banca mostrou (janela,
     menu, caixa de diálogo), sem logos de marca.
10. Gerador: quando sorteado "com figura" (na proporção do inventário), a IA
    devolve o esquema JSON da figura + enunciado. Para conta (planilha, gráfico com
    cálculo), o código calcula a resposta e monta os distratores, como em Juros.
11. Checagens determinísticas: valores citados no enunciado existem na figura; a
    resposta bate com o cálculo do código; a figura sozinha não entrega a resposta.
12. O auditor (só texto) recebe a figura convertida em descrição estruturada
    (tabela em texto, valores do gráfico, células e fórmulas) e resolve às cegas.
13. Use as figuras oficiais como referência de estilo (tamanho, quantidade de
    dados, tipo de pergunta) no prompt do gerador.
14. Rode 5 questões com figura por tipo e me mostre as figuras renderizadas.

==== FASE 4 — FILTRO ANTI-REPETIÇÃO E CENÁRIOS NOVOS ====
15. Embedding de toda questão (enunciado + alternativa correta) salvo na questão.
    Antes de aprovar uma gerada, compare (cosseno) com as do mesmo tópico E com as
    oficiais: acima do limite "duplicada" → descarta; na faixa "parecida" → descarta
    e pede outro cenário (1 tentativa).
16. Calibre os limites com dados: me mostre 10 pares perto de cada limite para eu
    dizer "repetida" ou "ok", e ajuste. Limites no .env.
17. Checagem barata extra: sobreposição de trechos de texto (shingles/Jaccard)
    para pegar cópia com palavras trocadas.
18. Impressão digital estrutural nas questões por construção: (tipo, contexto,
    parâmetros principais) não pode se repetir no tópico.
19. Catálogo de cenários por disciplina (perfil de cliente, produto, situação),
    sorteando o MENOS usado; o gerador recebe os últimos 15 cenários do tópico
    como "proibidos". O auditor rejeita cenário irreal ou fora do edital.
20. Proibido parafrasear questão oficial (similaridade com oficial acima do
    limite → descarta).
21. Relatório no "status": por tópico, nº de questões, cenários distintos e
    descartes por repetição.

Atualize o CLAUDE.md com: "Figura é dado desenhado por código, nunca imagem de IA"
e "Questão nova passa pelo filtro de similaridade".
```

### 5.7 Login para você e amigos
```
Leia o CLAUDE.md. Objetivo: o app passa a ter várias pessoas (eu + alguns amigos),
cada uma com seu progresso. NÃO é produto pago; não faça cobrança, marca d'água
nem bloqueio de cópia. Me mostre um plano curto antes e PARE no fim para eu testar.

1. Modelo User: email (único, minúsculo), senhaHash (bcrypt), nome, papel
   ("admin" | "aluno"), plano ("gratuito" por padrão, só o campo, para o futuro),
   criadoEm, ultimoLogin.
2. Login por e-mail + senha. Sessão em cookie httpOnly + secure + sameSite=lax,
   validade de 30 dias. Tela de login e cadastro no MESMO estilo do site
   (escuro, laranja, lobo). Botão "Sair" no menu.
3. Cadastro SÓ com código de convite: comando "npm run bb -- convite" gera um
   código de uso único (validade 7 dias). Sem código, ninguém cria conta.
4. Trocar o ALUNO_ID fixo pelo userId da sessão em TODAS as rotas (tentativas,
   revisões, simulados, conquistas, contestações). Migração: todos os dados atuais
   vão para a minha conta (admin). Banco de questões continua compartilhado.
5. Esqueci a senha (sem serviço de e-mail por enquanto): comando
   "npm run bb -- senha <email>" gera uma senha provisória que eu repasso.
6. Segurança básica: helmet, limite de 10 tentativas de login por 15 min por IP,
   zod em todas as rotas, rotas de admin só para papel "admin", nada de segredo no
   front. Contestação mostra quem contestou (para eu revisar).
7. Recursos que chamam IA na hora (ex.: "me explica de outro jeito", redação):
   limite diário por usuário configurável no .env.
8. PWA: manifest + ícone do lobo, para "Adicionar à tela inicial" no celular.
9. Modo demo continua funcionando sem login.
10. Testes: dois usuários não enxergam o progresso um do outro. Typecheck, commit.
```

---

## 6. Regras de ouro (valem para tudo)

1. Gabarito oficial nunca passa por IA.
2. Número nunca depende só da IA: o código calcula ou confere.
3. Questão só entra se o auditor acertar às cegas.
4. Explicação nasce da regra ou da fonte, não da opinião da IA.
5. Um prompt por vez, teste, commit.
6. Chave e senha só no `.env`; repositório privado.
7. Estudar com o app vale mais que aperfeiçoar o app.
