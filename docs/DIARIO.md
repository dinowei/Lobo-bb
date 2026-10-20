# Diário do modo autônomo

Uma entrada por item: data/hora, o que fez, números, problemas e solução.

---

## 16/10/2026 — Etapa 0: fechar o que estava aberto

**0.1 Crase (item 1 do pedido anterior)**
- Feito: desempate às cegas pelo Ultra quando o auditor por frase discorda do banco de regras (registrado em `auditoria.desempates`); escritor de Português com reserva (`ESCRITOR_PT_MODEL_RESERVA=deepseek-v4.1-flash`, cai para a reserva depois de 1 nova tentativa); sorteio de regras conta só as aprovadas e não repete as regras da última aprovada; fila de um job de IA por vez (`src/fila.ts`, trava no MongoDB; a CLI espera, o servidor pula).
- Teste da fila: 2 processos concorrentes — o segundo esperou o primeiro; o "servidor" pulou sem esperar; nenhuma trava sobrou.
- Rodada de 10: **2/10 aprovadas**, 999 s em média. Motivo: provedor NVIDIA instável na madrugada — 5 falhas por timeout do GLM **e** da reserva DeepSeek; 3 descartes porque o desempate do Ultra deu timeout/503 (desempate que falha = descarta, por segurança). Desempates bem-sucedidos: 0 (todos os 4 pedidos falharam no provedor). Reescritas pedidas pela trava: 2 (ambas passaram). Escritor usado nas aprovadas: GLM.
- Leitura: a lógica funciona; o gargalo é a disponibilidade do provedor gratuito. Repetir em horário de menos carga.

**0.2 Vendas** — `docs/FONTES-VENDAS.md` com (a) normas públicas e (b) conceitos de doutrina, cada um ligado às questões oficiais. Vendas entrou na lista de "só gera com fonte" (`DISCIPLINAS_COM_FONTE_OBRIGATORIA`) e na regra 3 do `CLAUDE.md`.

**0.3 Normas revogadas** — pesquisado: Res. CMN 4.949/2021 (art. 12) revoga a 3.694/2009 e a 4.539/2016, vigência 01/03/2022; Res. CMN 4.658/2018 revogada pela 4.893/2021. Vigentes: Carta Circular 4.001/2020 (alterada em 2026), Res. CMN 4.860/2020 (alterada pela 5.182/2024), Leis 8.078 e 13.146. Marcadas `desatualizada` com nota: 2023 nº 33; 2021 nº 67 e 68. Elas saem do treino, continuam no caderno de erros e mostram o selo "Norma atualizada" com a nota.

**0.4 2021 nº 23** — recuperada com o novo comando `recuperar` (mesmas travas da ingestão: disciplina da capa, conferência literal); gabarito B; explicada (a IA acertou às cegas).

## 16/10/2026 — Etapa 1, Fase 1: inventário de figuras

- Operadores do PDF (imagens e desenhos vetoriais com posição) + texto. A imagem 263×263 em todas as páginas é marca d'água do site.
- 5 figuras reais: 4 tabelas (2023 nº 18, 19, 60; 2021 nº 27) e 1 planilha-imagem (2023 nº 41). Nenhum gráfico, tela de programa ou diagrama.
- Meta nas geradas (`data/figuras-meta.json`): Matemática 20% tabela, Mat. Financeira 10% tabela, Informática 5% planilha, Vendas 5% tabela. Detalhes em `docs/FIGURAS-INVENTARIO.md`.

## 16/10/2026 — Etapa 1, Fase 2: figuras das provas (cópia fiel)

- `src/figuras.ts`: recorte da página renderizada (unpdf + @napi-rs/canvas, escala 2), extração da **imagem original** embutida (2023 nº 41, sem perda), tabela reconstruída pelas posições do texto (colunas por centros; célula vazia fica vazia — a 2023 nº 18 saiu com as 7 colunas certas).
- Configuração por figura em `data/figuras-oficiais.json` (texto antes/depois, largura total, ou região fixa — a caixa "Dados" com os expoentes da 2021 nº 27 fica ao lado das alternativas).
- Problemas e soluções: o PDF quebra linhas em vários itens ("Na" + "célula C10…") → comparação contra a linha inteira; "é" decomposto → normalização NFKC; tabela de largura total → opção `larguraTotal`.
- Avaliador de planilha em português (`shared/planilha.ts`, sem eval): 5 testes, incluindo a 2023 nº 41 (CONT.SE com "<=R$ 10,00" = 3, gabarito B).
- Tela **Figuras** (Ajustes → Conferir figuras): figura desenhada × recorte original, "OK, está igual", "Ajustar recorte" (arrastar sobre a página) e "Fora do treino". Testada no navegador: 5 figuras listadas; rota do recorte respondendo. **Nenhuma aprovada por mim** — todas aguardam o seu OK.
- O site desenha figuras conferidas na questão (enunciado, texto de apoio ou alternativas).
- Pendente: a 2023 nº 60 (tabela) teve a figura extraída, mas a questão ainda não está no banco (a cópia da IA não bateu com o PDF).

## 17/10/2026 — Etapa 1, Fase 3: figuras nas questões geradas

- 4 templates por construção com figura (`src/construcaoFiguras.ts`), só tipos do inventário: fórmula em planilha (SOMA, MÉDIA, CONT.SE, SOMASE, amplitude, PROCV; célula-alvo vazia; distratores = fórmulas erradas avaliadas pelo código), sistema linear em tabela (linha pedida com "?"), série de depósitos (Juros compostos) e taxa de abandono (Vendas). Proporção de `figuras-meta.json` no sorteio.
- Checagens: alternativas intactas, dados literais, resposta fora do enunciado, figura não entrega a resposta (tabela), nenhum número fora dos dados/figura. O auditor recebe a figura descrita em texto.
- Testes: 22/22 (200 montagens por tipo; sorteio na proporção ±4 pp; limpeza de tabela copiada).
- Rodada real: planilha **1/5** (1 `numero_alterado`, 3 timeouts), sistema linear **1/5** (4 timeouts); 492 s e 711 s em média. Quase toda perda foi o provedor.
- Problema: nas 2 aprovadas a IA **copiou a tabela no enunciado** ("| Agência | Contas |…"). Correção: prompt mais explícito + `tirarTabelaCopiada` no pipeline antes das checagens (teste cobre o "|x|" de módulo). As 2 já salvas ficaram com a cópia: a gravação no banco por script foi bloqueada pela checagem de permissões; vai para DECISOES-PENDENTES com script pronto.
- Prints: `docs/telas/figuras/` (4 tipos × 5 amostras + as 2 questões reais, desktop e celular), pela aba nova Figuras → "Geradas (amostra)" (código monta na hora, sem IA, nada salvo).

## 17/10/2026 — Etapa 1, Fase 4: anti-repetição

- `src/similaridade.ts`: antes do auditor, cosseno do embedding (enunciado + correta) contra o mesmo tópico e as oficiais da disciplina; trechos de 4 palavras (Jaccard, pega cópia com palavra trocada; texto curto não conta); impressão estrutural (tipo, contexto, parâmetros) nas por construção e na Crase, checada **antes** de chamar a IA. "parecida" → descarta e pede outro cenário 1 vez; "duplicada" e "paráfrase de oficial" → descarta.
- Cenários (`data/cenarios.json`, 3 grupos): perfil + situação, sem número e sem produto (o produto vem do contexto, regra 11); sorteia o menos usado no tópico, nunca um dos 15 últimos (que vão ao gerador como proibidos). O auditor rejeita cenário irreal.
- Coleção `geracoes`: toda tentativa registrada → teto diário `GERACAO_MAX_DIA` (regra A7, padrão 60) e descartes por repetição no `status` (colunas "cenários" e "desc. repetição").
- Calibragem: `similaridade indexar` (162 embeddings) + `similaridade calibrar` → 657 pares, 650 abaixo de 0,80. O único acima de 0,90 (0,939) é a mesma questão de Juros com outro capital; o seguinte (0,871) é diferente. Limites: duplicada 0,97, parecida 0,93, oficial 0,93, trechos 0,60. Os 20 pares estão em `docs/CALIBRAGEM-SIMILARIDADE.md` para você classificar.
- Achado da calibragem: o template de sistema linear usava o cenário da oficial 2023 nº 19 (armários, mesas, cadeiras). Corrigido: 6 conjuntos de itens × 4 compradores, sem o da oficial.
- Testes: 29/29. Rodada real (Juros, 3): **1/3** aprovada, 113 s em média; 1 reprovada na revisão (erro de português do gerador ao reescrever o cenário, pego pelo auditor), 1 `numero_alterado`. Nenhum descarte por repetição.

## 17/10/2026 — Etapa 1.5 (R2): corrente de modelos grátis

- **R2.1 Catálogo:** os 9 candidatos aparecem para a chave e como "Free Endpoint" em build.nvidia.com. Sondagem (36 chamadas curtas): Lightning, Super, Super VL, gpt-oss-20b, Muse, Step 5 e GLM-flash respondem JSON certo; **Ultra 503** e **DeepSeek timeout** (temporariamente fora). `reasoning_budget` só nos Nemotron; Muse, Step e GLM recusam (400); `reasoning_effort` funciona no gpt-oss, Muse, Step e GLM. **glm-5.3 (sem flash) descontinua em ~11 dias; não afeta o flash.** Detalhes em `docs/CATALOGO-MODELOS.md`.
- **R2.2 Infra (sem trocar a produção):** `data/modelos.json` + `src/catalogo.ts` (famílias, correntes por função, regra de família, validação); `src/corrente.ts` (corrente aprovada > `.env` > legado; pula desativado e quem falhou 3× seguidas por 10 min; sem candidato elegível → "aguardando_modelo"); `src/llm.ts` (espera exponencial com variação, Retry-After até 60 s, erro permanente desativa o modelo, parâmetro de raciocínio do catálogo); `src/telemetria.ts` (coleção `chamadas_modelo`, mediana e p95); `src/noturno.ts` (fila `tarefas` que sobrevive a reinício: infraestrutura volta 3× com 10/30/90 min, qualidade descarta com motivo); verificação semanal (`verificar-modelos`) com alerta.
- **R2.3 Benchmark:** código pronto (`src/benchmark.ts`, `benchmark auditor|juiz|escritor|relatorio`): amostra estratificada de 60 oficiais às cegas (teste garante que o gabarito não vaza), juiz com as armadilhas "à ela", "à Vossa Senhoria", "recorreu a gerência", escritor pela trava de posição; Wilson 95% e "sem vencedor" quando os intervalos se sobrepõem. Rodada pendente (provedor instável agora).
- Teste de fumaça do legado pela corrente nova: Crase descartada (Ultra 503 no desempate, igual a antes; o juiz aceitou "recorreu a garantia", a armadilha do benchmark); Descontos com 4 timeouts do Lightning → `provedor_falhou` (volta para a fila no noturno). Testes 42/42.
- Regra de família: o legado (Lightning + Super) fere. Registrado como PRIORIDADE ALTA em DECISOES-PENDENTES; a proposta sai do benchmark.

## 17/10/2026 — R3: tela Admin e cartão do banco (com o adendo)

- Uma tela **Admin** com 4 abas (IA, Fila, Benchmark, Pendências), só para o admin (modo servidor até o login): status por modelo (verde/amarelo/vermelho/cinza, com o motivo), 24 h e 7 dias, quem atendeu cada função hoje, alertas; fila com "tentar de novo agora", relatório da noite e progresso até 1.200; benchmark com IC e "Aprovar corrente" (confirmação + desfazer); pendências lidas do `DECISOES-PENDENTES.md` com atalhos e visor de documentos (markdown sem HTML cru).
- Painel do aluno: cartão **"Banco de questões"** (total, inéditas por disciplina, "+N esta noite"), regra em `shared/motor.ts` (servidor e demo).
- Aluno não vê menção a IA: "Inédita · revisada", "Traiçoeira: essa engana muita gente", avisos com "o lobo está preparando".
- Conferido no navegador: as 4 abas carregam, o visor abre a calibragem, o cartão mostra 150 questões e "+1 esta noite". Prints ficam para depois do benchmark (a aba Benchmark ainda está vazia).

## 17/10/2026 — Etapa 2.1 (em andamento): leis e normas oficiais

- `npm run bb -- baixar-fontes` (`src/baixar.ts` + `data/fontes-oficiais.json`): só planalto.gov.br, bcb.gov.br e in.gov.br (lista de hosts no código, inclusive depois de redirecionamento). Grava `fontes/<id>/<id>.txt` (texto limpo) + `.original.html` e `fontes/LEIAME.json` (data, sha256, vigência, atos do DOU que citam a norma).
- 1ª rodada: 18/24 baixadas. O site do BCB recusou tudo (400, até no navegador): resoluções e circulares vêm do DOU.
- Vigência conferida: 4.935 (art. 8º revogado pela Res. Conjunta 17/2025) e 4.753 (art. 12 revogado pela 4.949) saem sem esses artigos; 4.656 trocada pela 5.050/2022; 4.949, 4.860 e 4.893 alteradas por 5.117/2024, 5.182/2024 e 5.274/2025 (entram junto). **Pendentes** (só há texto consolidado no BCB): Res. BCB 1/2020 (Pix, alterada até 2026), Circular 3.978 (alterada em 30/09/2026), Res. CMN 3.919/2010.
- Correção na ingestão: texto riscado do Planalto (revogado) não entra mais; entidades HTML decodificadas.

## 18/10/2026 — Etapa 2.2 e 2.4: normas no banco e glossário de Vendas

- `baixar-fontes` de novo: 24 fontes (12 leis do Planalto, 12 atos do CMN/BCB pelo DOU) + 3 pendentes (Pix, Circular 3.978, Res. 3.919: só há texto atualizado no site do BCB; em DECISOES-PENDENTES).
- `ingerir-fontes`: 1.006 trechos. Problema: a maioria ficava **sem tópico** (similaridade tópico × artigo abaixo de 0,3) e sumiria da busca. Solução: com a disciplina declarada, o trecho vai para o tópico mais próximo dela; as já ingeridas foram reclassificadas pelo embedding salvo. Todo tópico de Bancários, Atualidades e Vendas tem trecho (de 3 a 179). Res. 4.656 revogada no banco (troca pela 5.050).
- Glossário de Vendas: 25 verbetes das 27 oficiais vigentes, cada um citando as questões. Não está no banco: `liberar-fonte "Glossário de Vendas"` é o seu OK.
- Prints do Admin em `docs/telas/admin/`.

## 18/10/2026 — Etapa 4: login

- Contas (`User`), sessão em cookie httpOnly/SameSite=Lax (Secure em produção) com só o hash do token no banco, 1 dia ou 30 dias com "lembrar de mim", senha com scrypt (node:crypto, sem dependência nativa; o plano dizia bcrypt), cadastro só com convite de uso único (7 dias), 10 tentativas por IP a cada 15 min, mesma mensagem para e-mail inexistente e senha errada, rotas de admin só para o papel admin (403).
- **O login só liga quando existe a primeira conta**: sem conta, o site segue no modo dono único (você não fica trancado do lado de fora). `criar-admin` cria a sua e leva o progresso (tentativas, revisões, contestações) para ela; `convite`; `senha` (provisória).
- Tela Entrar/Criar conta no estilo do site: mostrar/ocultar senha, aviso de Caps Lock, força da senha (mesma regra no servidor, `shared/senha.ts`), erro no campo certo com foco nele, Enter envia, foco inicial, autocomplete certo, convite conferido enquanto digita. Sessão que acaba no meio volta ao login e depois à mesma tela. Minha conta (Ajustes): nome, senha, sair, sair de todos os aparelhos.
- Testes: 6 de login (inclui "dois usuários não enxergam o progresso um do outro" e a migração) + `scripts/e2e-login.ts` (7 fluxos no Edge, rotas de login simuladas: nenhuma conta real criada). Prints em `docs/telas/login/`.
- Etapa 2.3 rodando: Lightning dando timeout (4 × 180 s por questão); a corrente de hoje não tem gerador reserva.

## 18/10/2026 — Decisões do dono aplicadas

- **Corrente PROVISÓRIA (aprovada pelo dono antes do fim do benchmark):** gerador Lightning → gpt-oss-20b → Muse Glimmer 30b; auditor Super → Ultra → Muse → gpt-oss-20b, recalculado pela regra de família (gerador NVIDIA → Muse; gerador OpenAI ou Meta → Super/Ultra). Ativada com `npm run bb -- corrente provisoria` (fica no banco, como o botão "Aprovar corrente"); `corrente desfazer` volta ao legado. A escolha definitiva continua esperando o OK do dono depois do benchmark.
- E2E de login: passou (7/7) na última tentativa. A bateria e2e completa roda de uma vez na Etapa 9, com os jobs de IA parados (com a máquina ocupada, o servidor de desenvolvimento demora a compilar).

## 18/10/2026 — Etapa 5: pronto para a nuvem (sem publicar)

- `docs/DEPLOY.md`: Render × Railway × Fly.io com preços das páginas oficiais; recomendação Render (Blueprint com site + noturno, health check, ~US$ 8/mês sempre ligado; plano B Railway Hobby US$ 5). Passo a passo de 20 min e checklist pós-publicação.
- `Dockerfile` (uma imagem para site e noturno), `.dockerignore` (sem `.env`, `provas/`, `fontes/`), `render.yaml` (segredos com `sync: false`, cron 01h de Brasília).
- Servidor: helmet com CSP, HSTS, compressão, cache de 1 ano nos arquivos com hash e `no-cache` no `index.html`, `/api/saude` com 503 sem banco, `trust proxy`.
- Conferido rodando em produção local (porta 3401): CSP/HSTS/nosniff presentes, JS com gzip, cache certo, rotas do site e API ok. Corrigido: o build do site quebrava ao incluir os testes de `shared/` (exclude no `web/tsconfig.json`).
- A imagem Docker não foi construída aqui: o Docker Desktop estava desligado (não liguei programa do sistema). O Render constrói no primeiro deploy.

## 18/10/2026 — Etapa 6: noturno com banco grande (código; teste real espera a fila)

- Meta de 1.200 aprovadas (oficiais contam) pela cota de cada disciplina na prova (`data/estrutura-prova.json`, lida das provas 2021 e 2023: LP 10, LI 5, MAT 5, ATU 5, MF 5, CB 10, INF 15, VN 15) e, dentro dela, igual entre os tópicos. Depois da meta, o tópico só ganha questão se o aluno com menos inéditas cair abaixo de 20% da meta, ou se alguém dominou o tópico (dificuldade 4–5). Prioridade: estudado nos últimos 7 dias > peso na prova > tamanho da falta. Vendas por doutrina fica fora até o glossário ser liberado.
- Tetos da noite separados do diário: `GERACAO_MAX_TENTATIVAS_NOITE` (200) e `META_APROVADAS_NOITE` (100), o que vier primeiro.
- Paralelo dentro de UM job: até 3 trabalhadores, cada um começa por um gerador diferente da corrente (o auditor sai pela regra de família), trava por tópico, balde de fichas global (`NVIDIA_RPM_MAX`=30, junto com o Retry-After), filtro de similaridade refeito antes de salvar (sem nova chamada de embedding).
- Pré-geração: "me explica de outro jeito" para cada aprovada que não tem (tutor escreve, auditor de outra família confere contra gabarito e explicações salvas); ganchos de aula (8.5) e tema (8.4) prontos no tipo de tarefa.
- Relatório de cada noite na coleção `relatorios`; cartão do painel com "descartadas por repetição".
- De dia não gera mais (`GERACAO_DE_DIA=0`): tópico sem questão pronta avisa que chegam de noite.
- Testes: 54/54 (plano pela meta, trava por tópico, balde de fichas, parecida salva por outro trabalhador).
- Agendamento: cron do Render às 01h00 de Brasília (`render.yaml`, `TZ=America/Sao_Paulo`), não às 03h00 do plano: com a meta de 100 aprovadas por noite, a janela 01h–05h30 rende mais.
- Corrente provisória confirmada em uso: na Etapa 2.3, Lightning deu timeout 2× e o gpt-oss-20b assumiu.

## 18/10/2026 — Etapa 7 (parte por código): Amortização, Taxas, Combinatória, Probabilidade

- `src/construcaoMais.ts` (utilidades em `src/construcaoUtil.ts`): 16 templates novos com números e distratores de erros clássicos. Amortização: parcela, juros e saldo no SAC, prestação Price com fator dado, SAC × Price. Taxas: efetiva da nominal, equivalentes, proporcionais, real × aparente. Combinatória: arranjo, combinação, anagramas, senhas. Probabilidade: condicional em tabela, independentes, binomial.
- Tabela de compatibilidade: tipos de Combinatória e Probabilidade e 4 contextos novos (equipes, sorteio de brindes, senhas, pesquisa com clientes); duas etapas marcadas.
- Testes: **1.000 montagens por tipo** (33 tipos), todas conferidas por mathjs; 70/70 no total. Primeira rodada: 7 tipos não montavam para toda letra (faltavam distratores de um lado); acrescentei erros clássicos (ex.: "dividiu o produto por 2", "deixou qualquer letra em qualquer posição").
- Um commit para os quatro assuntos (o plano pede um por assunto): estão no mesmo arquivo e foram testados juntos.
- Rodadas reais de 3 por assunto: esperam a fila (benchmark rodando). Português por construção (Concordância, Regência, Pontuação) vem a seguir.

## 18/10/2026 — Etapa 7 (parte por código): Concordância, Regência, Pontuação

- `src/regrasPT.ts`: bancos de regras no molde da Crase. Concordância 16 regras (8 certas, 8 erros: haver/fazer impessoais, existir, sujeito posposto, "se" apassivador, meio, é proibida a, anexas), Regência 14 (assistir, obedecer, preferir, implicar, chegar, esquecer-se, aspirar), Pontuação 9 (aposto, vocativo, enumeração, ou seja; vírgula entre sujeito e verbo, entre verbo e complemento, aposto sem fechar, vocativo sem vírgula, vírgula antes do "e").
- Nada facultativo: concordância proíbe "a maioria de", "parte de", "um dos que", "mais de um", "cerca de"; regência usa substantivo masculino no ponto da regra (sem crase no meio) e evita verbos com duas regências aceitas; pontuação exige que a frase só tenha as vírgulas do trecho.
- Explicação, pegadinha, correção ("O certo seria…") e explicação geral vêm do banco (regra 14); juiz de cada área julga só o seu aspecto.
- Pipeline: o caminho da Crase virou `gerarPorRegras(área)`; a Crase usa exatamente as mesmas funções e prompts de antes (área "crase" aponta para eles).
- Testes: 87/87 (cada regra tem um exemplo que passa na própria trava; 1.000 montagens por área; correção do erro sai da forma errada; vírgula a mais e concordância facultativa barradas).
- Rodadas reais de 3 por área: esperam a fila.

## 18/10/2026 — Etapa 8.1: simulado fiel

- `shared/estruturaProva.ts` (servidor e demo): dois blocos lidos das provas BB 2021/2023 — Básicos (LP 10, Inglês 5, Matemática 5, Atualidades 5) e Específicos (MF 5, Bancários 10, Informática 15, Vendas 15) = 70. Pesos por bloco e duração: `null` até o edital. Probabilidade e Estatística fica fora dos simulados e com peso baixo no treino.
- Cotas por maiores restos: a prova completa sai **exatamente** nas cotas; simulados menores na mesma proporção, entre as disciplinas que têm questão.
- Peso do tópico no treino: o do edital ou cota da disciplina ÷ tópicos dela.
- Mistura de dificuldade: a das oficiais quando há ≥ 30 com dificuldade, senão 20/50/30 (estimativa, avisada na tela). Hoje sai das 130 oficiais: **72% fáceis, 27% médias, 2% difíceis** — a dificuldade das oficiais é estimada pelo explicador, e parece baixa demais (anotado em DECISOES-PENDENTES).
- Tela: contagem regressiva quando há duração em Ajustes (proporcional nos menores; zerou, entrega sozinho), senão cronômetro; resultado por bloco; nota ponderada só com pesos confirmados; linha de corte configurável (padrão 70%).
- Testes: 94/94 (7 novos: 70 exatas nas cotas, soma n em qualquer tamanho, só disponíveis, faixas somam k, por bloco). Conferido no navegador (tela e início do simulado; não entreguei para não gravar tentativas no seu progresso).

## 18/10/2026 — Etapa 2.3: 10 geradas com fonte (Bancários e Atualidades)

- **3 de 10 aprovadas** (Drex, concorrência bancária, risco socioambiental e climático).
- 5 caíram por **timeout do provedor** (~750 s cada; as primeiras rodaram antes da corrente provisória entrar), 1 por `trecho_fonte_inventado` (Open Finance/consentimento) e 1 reprovada na revisão (o auditor pegou que a questão misturou a Res. 4.893 com a 4.935 — a trava funcionou).
- Leitura: o gargalo é a disponibilidade do gerador, não a qualidade. A corrente definitiva (benchmark rodando) é o que resolve.

## 18/10/2026 — Etapa 8.2: diagnóstico do tipo de erro

- Depois de errar (fora do simulado), 1 toque opcional: Não sabia · Confundi com outra coisa · Li errado/desatenção · Chutei. Fica na tentativa (`motivoErro`).
- Ações (regras em `shared/aprendizado.ts`, servidor e demo):
  - **não sabia**: o tópico sobe na fila por 14 dias (+50% por erro, teto no dobro) e aparece o atalho "Treinar só este tópico". A aula curta entra na 8.5.
  - **confundi**: a próxima é uma questão do mesmo tópico e do mesmo tipo (`variacao.tipo`, que nas por construção é a mesma regra), inédita primeiro.
  - **desatenção**: a questão volta na revisão com tempo-alvo de 2:30 até ser acertada, e a tela mostra o que decidia (palavras da certa que faltam na marcada; se as palavras são as mesmas em outra ordem, onde a ordem muda).
  - **chutei**: a revisão é antecipada para daqui a 10 minutos.
- Painel: cartão "Por que você erra", com barras de motivos por disciplina.
- Testes: 98/98 (+ palavras decisivas, janela do "não sabia", agregação). Conferido no modo demo (porta 5180, configuração `bb-demo` no launch.json), sem tocar no seu progresso real: desatenção, confundi sem par e o cartão do painel.

RETOMAR AQUI: o benchmark roda em segundo plano (auditor até 60, juiz, escritor), log em scratchpad `bench.log`. Quando acabar: proposta de corrente (data/proposta-correntes.json + DECISOES-PENDENTES), print novo da aba Benchmark, Etapa 3 (10 Informática + 10 Vendas por norma). Código: Etapa 8.3 (calibragem da confiança).

**LER E APLICAR `docs/ADENDO-BANCO-GRANDE.md`** (pedido do dono em 17/10/2026) ao chegar em: **Etapa 6 (noturno)**, **R3 (telas)** e **Fase B (8.4 e 8.5)**. Até lá, seguir a PROMPT-RETOMADA na ordem.

## 18/10/2026 — Corrente provisória: atualização entre processos

- Causa do comportamento legado: `correnteAtiva()` guardava o resultado por 60 s em cache local. A aprovação feita pela CLI/painel grava no Mongo, mas não invalida o cache de outro processo; um job iniciado nesse intervalo continuava usando Lightning sozinho durante toda a chamada longa. Erros de leitura do Mongo também eram convertidos silenciosamente em configuração ausente.
- Correção: ler a configuração aprovada a cada chamada e propagar falha de leitura, sem degradar para o legado. O log agora identifica o modelo/família que atendeu e a reserva, incluindo a família excluída ao escolher auditor.
- Teste direcionado: 11/11 em `src/corrente.test.ts`, incluindo atualização entre chamadas no mesmo processo e erro de leitura sem fallback silencioso. Typecheck concluído.
- Geração real de Juros compostos aprovada: `nvidia/nemotron-3.5-lightning-30b-a3b` falhou duas vezes por timeout, `openai/gpt-oss-20b` assumiu e a questão foi aprovada; o auditor `nvidia/nemotron-3-super-120b-a12b` atendeu duas vezes, explicitamente fora da família OpenAI. Questão `6ad4f8566d4a59052747bac3`, em 314 s.

## 18/10/2026 — Etapa 9 (acabamento): carrossel de matérias do painel

- Transformar os cartões hero de matérias em carrossel conforme a regra visual 8: arraste com o dedo e scroll-snap no celular; setas laterais no hover, roda do mouse e arraste no computador; esmaecido nas bordas e bolinhas de posição; teclado ←/→, foco visível e `aria-label` nas setas.
- Clique no cartão abre Praticar daquela disciplina. Ordenar por prioridade do treino (peso na prova × fraqueza), incluir barra fina de domínio (%) e respeitar `prefers-reduced-motion`.
- Verificar visualmente em 360 px e 1440 px.
- Implementado: carrossel horizontal com snap, setas no desktop, navegação por roda/arrasto/teclado, esmaecimento, bolinhas, foco visível, domínio por disciplina e preferência por movimento reduzido.
- Conferência visual e funcional: 360 px (sem overflow horizontal da página, snap ativo e setas ocultas) e 1440 px; teclado avançou até a posição 4, seta e bolinhas levaram ao fim/início e clique em “Vendas e Negociação” abriu Praticar nessa disciplina.

## 18/10/2026 — Etapa 8.3: calibragem da confiança

- `shared/aprendizado.ts` calcula acertos em certeza, dúvida e chute no geral e por disciplina, exclui simulados e sinaliza ilusão de domínio quando a certeza fica abaixo de 85% com pelo menos 10 respostas.
- Servidor e demo usam o mesmo motor. O Painel mostra o resumo geral e alertas por disciplina; Conquistas mostra a tabela completa com taxas e amostras.
- Testes direcionados: 6/6 em `shared/aprendizado.test.ts`. Typecheck concluído.

## 18/10/2026 — Etapa 8.4: redação (concluída, E2E real)

- Modelo de temas e redações, geração de tema por comando/sob demanda, rubrica de quatro critérios, citações literais verificadas, duas avaliações e terceira com mediana quando a diferença passa de 15 pontos.
- Tela Redação no servidor e no demo: tema, textos motivadores, limite de linhas configurável, cronômetro, rascunho local, correção, trechos marcados, histórico e conquistas. O noturno pré-gera a meta de 40 temas.
- Ajuste do adendo: correções de redação com falha de infraestrutura permanecem na fila persistente, com intervalo crescente, até a IA voltar.
- `npm run typecheck` passou; `npx tsx --test src/corrente.test.ts src/noturno.test.ts` passou 18/18; tela demo conferida no navegador.
- E2E no app: tema "A responsabilidade das fintechs na prevenção de fraudes digitais" gerado com `openai/gpt-oss-20b` após dois timeouts do Lightning; redação sintética de 2.073 caracteres enviada, salva com 5 linhas e 76 s.
- Correção real concluída e persistida no histórico: 87/100 (22, 20, 22 e 23 nos quatro critérios), acima da linha de 70. Duas avaliações do auditor Super; todos os trechos citados passaram na validação literal e aparecem marcados no texto. Redação `6ad4fa75108c0380e4a8e026`; tema `6ad4f9dc108c0380e4a8e025`.

## 18/10/2026 — Sincronização: Claude Code assume o trabalho do Codex (PROMPT-SYNC-CODEX)

- Revisado o que o Codex deixou sem commit (8.5, carrossel, docs). Não havia chave nem `MONGODB_URI` no diff; `.env.example` só ganhou nomes (`AULAS_NOITE`, `EXPLICACOES_MAIS_MAX_DIA`); as regras 18 e 19 novas do CLAUDE.md não contradizem as anteriores. O timeout padrão continua 180 s (`LLM_TIMEOUT_SEG`); o único `120_000` em `src/` é o da sondagem de modelos, que já existia antes do Codex.
- Corrigido: `.aula-topico h3` usava `#ffb08c`, fora da paleta (regra 8) → `var(--laranja-forte)`. O demo dizia "O tutor por IA precisa do servidor" (aluno não vê menção a IA) → "O tutor precisa do servidor".
- Para o dono decidir: a tela de Redação mostra "Nota estimada por IA". A regra 17 manda sinalizar que a nota é estimativa, e o adendo diz que o aluno não vê menção a IA. Mantive o texto atual (a regra 17 é a mais específica). Anotado em DECISOES-PENDENTES.
- Validação: typecheck do servidor e do web passaram (cada um sozinho, binário direto no web); testes focados 24/24 (aulas, corrente, noturno); suíte completa 109/109.
- Commits separados: `1d75f8c` (8.5 aulas + tutor, com só o trecho de CSS das aulas), `c233dc3` (carrossel) e este, de docs.
- O benchmark em segundo plano (`bmuzpinm9`) não chegou ao fim antes de a sessão anterior terminar; a retomada das amostras gravadas fica para a madrugada (POST-IT A.3).

## 18/10/2026 — POST-IT A.3 e A.4 (sem IA)

- **Benchmark, limite de 5 falhas (A.3):** a causa foi achada nos registros do banco. O GLM tem só 2 respostas no `juiz-pt-v1`, ambas `timeout` com ~750 s cada. O contador contava ITENS, mas cada item escondia até 4 chamadas, porque o retry interno do `chamar()` repete o timeout 3 vezes (2 s, 6 s, 18 s, cada uma esperando 180 s). Assim, 2 itens já davam os 8 timeouts seguidos vistos na telemetria, com o contador parado em 2. Correção: no benchmark cada item é UMA chamada (`novasTentativas: 0`; o retry entre rodadas já existe em `jaFeito`, que aceita 2 falhas por item). O contador virou a classe `PausaPorFalhas`, com teste. Commit `68ad24a`.
- **Redação (A.4):**
  - (a) As linhas eram contadas por quebra de parágrafo. Agora são linhas da folha, estimadas em 70 caracteres com quebra por palavra (`shared/redacaoLinhas.ts`, igual no servidor e na tela). O texto do E2E (2.073 caracteres em 5 parágrafos) dá ~30 linhas, não 5; então o 87/100 não era absurdo, o erro estava na contagem.
  - (b) Regra das provas BB 2021 e 2023 (capa): "de 25 a 30 linhas". A penalidade não está na prova (o edital não está em `provas/`) → DECISOES-PENDENTES nº 8, com a regra mais conservadora.
  - (c) Abaixo de 25, a nota é zero por código, antes da IA, e o envio nem gera tarefa de correção. Acima de 30, só o texto até a linha 30 vai para a correção, como prefixo literal, e o resultado avisa. Testes com texto curto, no limite (25), normal e longo. Commit `43a7d82`.
- Também: `new: true` (deprecado no Mongoose) → `returnDocument: "after"` em 7 lugares (`53452fe`).

## 18/10/2026 — 8.5: geração real de aulas (S3)

- 1ª rodada (3 aulas, código anterior ao commit `dda51ef`), com o Lightning em timeout e o tutor `gpt-oss-20b` como reserva:
  - aula 1 descartada por formato (JSON sem `pontosChave`, `comoABancaCobra`…); só havia reparo para citação não literal;
  - aula 2 (Drex) reprovada pelo auditor Super, de outra família: "mais de 400 palavras" (o código já confere o campo `conteudo`; o auditor contou a aula inteira) e menção à Lei 14.478 sem apoio nos trechos (reprovação correta).
- Ajustes (`dda51ef`): uma rodada de reparo de formato; auditor sem critério de extensão (já conferida por código); proibição explícita de citar número de lei, resolução ou circular ausente dos trechos.

- 2ª rodada (última pelo S3): 0/3 de novo. Duas por citação parafraseada e uma por lista com mais de 7 itens. O formato já foi reparado sozinho nas três. Depois dela: citação parafraseada passa a ser ancorada na frase literal da fonte (≥ 60% das palavras), JSON embrulhado é desembrulhado e listas longas são cortadas por código (`4e00646`, `14474f9`). Registrado em DECISOES-PENDENTES nº 9; a prova real seguinte é a noite curta.
- Tela conferida no demo: cartão de aula (Juros compostos), "Já sei, ir para as questões" (grava `lobo-aula-vista:<tópico>` e abre a aba Questões) e "Me explica de outro jeito" (no demo avisa que precisa do servidor; o rótulo "Nova resposta conferida" aparecia sem resposta e foi corrigido). No real, o cartão só aparece com aula aprovada, e ainda não há nenhuma.

## 18/10/2026 — Fase B 8.6 a 8.9 (código, servidor e demo)

- **8.6** (3 commits):
  - Cartões: normas com trecho literal, número do verso dentro do trecho; vocabulário de Inglês dos textos das provas. Auditor de outra família, revisão espaçada própria (errou → 10 min), 20 novos por dia, noturno `CARTOES_NOITE`, comando `cartoes`. Fonte revogada tira os cartões de circulação (regra 6).
  - Treino misturado: disciplina sorteada no peso da prova, nunca a mesma da anterior.
  - Horas líquidas: relógio só com a aba visível, teto de 10 min por questão, ciclo 25/5 ou 50/10 e gráfico semanal no painel.
- **8.7** Elo (`shared/rating.ts`):
  - K 32/16; chute certo vale meio acerto.
  - Dificuldade exibida pelo rating com 5+ respostas.
  - O treino escolhe perto do seu rating + 50.
  - O painel mostra o nível estimado por disciplina.
  - `rating-migrar` (rodou: o banco real ainda não tem tentativas) e `calibragem`.
- **8.8** Raio-X:
  - 30 questões médias na proporção da prova, sem correção até o fim e sem tempo.
  - Define o nível inicial por disciplina e mostra 3 fortes e 3 focos.
  - Evolução entre Raio-X e convite no painel a cada 30 dias; conquista "Raio-X feito".
  - Feito um Raio-X no demo. Achado e corrigido: simulado e Raio-X completavam vagas com Probabilidade e Estatística (fora do edital).
- **8.9** Plano até a prova (`shared/plano.ts`):
  - Ciclo sem data; Base → Aprofundamento → Reta final com data.
  - Tempo por cota × fraqueza × rating.
  - Ajustes de horas por dia e dias da semana; "Plano de hoje" com o que foi cumprido e "semana X de Y"; tela Plano.
  - Recalculado do estado atual, então atrasar só redistribui.
- Testes: 136/136. Typecheck do servidor e do web ok.

## 18/10/2026 — Etapa 6: primeira noite real (curta) — POST-IT A.1

- Comando: `META_APROVADAS_NOITE=10 GERACAO_MAX_TENTATIVAS_NOITE=30 EXPLICACOES_NOITE=5 AULAS_NOITE=3 CARTOES_NOITE=3 META_TEMAS_REDACAO=3 npm run bb -- noturno --ate 20:44`, 3 trabalhadores e a corrente provisória.
- Plano: 30 questões, 5 explicações alternativas, 3 aulas, 3 lotes de cartões e 2 temas.
- **Resultado: 16 tarefas, 12 questões aprovadas, 3 descartadas.** O banco foi a 166 de 1.200.
  - Aprovadas: Planilhas, Banco de dados e SQL, Python e R, Sistemas operacionais, Redes e nuvem, Editores de texto, Segurança da informação, Atendimento ao cliente, Ortografia e acentuação, Concordância, Classes de palavras e Semântica.
  - Descartadas: Ética e direitos do consumidor (`fonte_insuficiente`: falta fonte ingerida, regra 3), Compreensão de textos (o auditor achou erro de português no enunciado gerado) e Colocação pronominal (`ignorou_gabarito_obrigatorio`).
  - `verificar_modelos`: 7 de 9 modelos responderam.
- **Bug achado:** a noite parou inteira ao bater a meta de aprovadas, e explicações, aulas, cartões e temas ficaram pendentes. Corrigido (`871da26`): a meta tira da fila só a geração de questões; o resto segue até acabar ou até a hora limite.
- Aulas e cartões: rodando agora pelos comandos próprios (`aulas --n 3`, `cartoes --n 3`); resultado abaixo quando acabar.

## 18/10/2026 — Etapa 9 (acabamento), até aqui

- (1) `d7f8b58`:
  - error boundary por tela com "Tentar de novo"; esqueleto no carregamento; telas divididas por rota;
  - link "pular para o conteúdo", foco visível laranja, título da aba por tela e por questão;
  - faixa offline e fila de respostas offline enviada sozinha;
  - atalhos → / N / ?;
  - confirmação ao sair de simulado, Raio-X ou redação; cronômetro do simulado pausa com a aba oculta;
  - "Mais" do celular abre todas as telas (antes Cartões, Simulados, Redação e Plano não eram alcançáveis no celular).
- (2) `6254ebe`: PWA instalável (manifest, ícones do lobo provisórios, theme-color, service worker que nunca guarda `/api`). O demo só é baixado sem servidor: o bundle principal foi de 93 para 70 kB gzip. Conferido no build de produção: SW ativo, manifest com 3 ícones.
- (3) `3907098`: "Desfazer" por 5 s ao contestar e ao zerar o progresso; próxima questão pré-carregada (12 ms para trocar no demo); alvo de toque de 44 px em tela de toque.
- Contraste: laranja `#ff5b1f` sobre `#121212` ≈ 6:1 (passa AA), então nada de cor mudou.

## 18/10/2026 — Aulas e cartões (3ª rodada) e decisões do dono

- **Aulas:** 1 de 3 aprovada, a primeira no servidor: "Novos modelos de negócio e marketplaces financeiros", escrita pelo gpt-oss e aprovada pelo Super, com citações literais da Res. de correspondentes. As outras duas caíram por citação parafraseada abaixo de 60% de cobertura.
- **Cartões:** 0 de 3 lotes (trecho não literal; trecho com mais de 240 caracteres). Ganharam a mesma âncora das aulas (`3a1c72e`).
- **Decisões do dono:**
  1. Corrente: gpt-oss-20b primeiro no gerador, aplicada.
  2. Redação: mantém zero abaixo de 25 linhas e desconsidera além de 30. Conferido no **Edital nº 01 – 2022/001** (Cesgranrio, `provas/bb-2022-001-edital.pdf`): o 7.3.5 não fala de linhas. Os casos a–c foram para a correção.
  3. Lighthouse aprovado como devDependency.
  4. Aviso "Nota estimada (correção automática; pode variar da banca)".
  5. Simulado 20/50/30.
- **Do edital também:** as cotas batem; valor por questão; cortes do 7.2.4; 5 h de prova. O simulado agora mostra "pontos como a banca conta" e se a nota eliminaria (`pontuacaoProva`, com teste).

## 18/10/2026 — Lighthouse (celular), Etapa 9

- Lighthouse 13.5 instalado como devDependency (decisão do dono). Build de produção servido pelo `vite preview` (:5181) e auditado no Edge; comando `npm run lighthouse` (com `CHROME_PATH` apontando para o Edge).
- Primeira medida no painel: Desempenho 67 · Acessibilidade 96 · Boas práticas 100.
  - Acessibilidade: o nome do cartão do carrossel não continha o texto visível (WCAG 2.5.3); as bolinhas tinham 7 px de alvo; o mascote não tinha tamanho.
  - Corrigido: nome = texto visível + "Praticar" só para leitor de tela; área de 24 px com a mesma bolinha no meio; `width`/`height` no mascote.
- Desempenho: a fonte do Google bloqueava a primeira pintura. Ela agora carrega com `media="print"` e troca para `all` no `main.tsx` (a CSP não aceita `onload` inline). A Inter continua aplicada (conferido).
- **Notas finais no painel:**
  - **Acessibilidade 100 · Boas práticas 100 · CLS 0.**
  - Desempenho:
    - **96** com a CPU calibrada para esta máquina (×1,3; o benchmark do Lighthouse aqui é 476, contra ~1.500 de um desktop comum: a regra do próprio Lighthouse é ajustar o multiplicador);
    - 82 a 84 com o ×4 padrão em cima da máquina lenta.
  - Ajustes (outra tela): mesmo padrão.

## 18/10/2026 — Etapa 7: rodadas reais de 3 por assunto

- Corrente nova (gpt-oss-20b primeiro): bem mais rápida, de 37 a 290 s por questão.
- **12 de 21 aprovadas.** Amortização 3/3, Combinatória 2/3, Concordância 2/3, Pontuação 2/3, Taxas 1/3, Probabilidade 1/3, Regência 1/3.
- **Barradas pelas travas:**
  - "← CORRETA" escrito pelo modelo dentro de uma alternativa (`numero_alterado`);
  - enunciado sem os números da construção;
  - totais incoerentes nas tabelas de probabilidade (revisão);
  - gênero trocado no enunciado;
  - o juiz por frase discordando do banco (2).
- **Erro real do banco de regras** (o revisor estava certo, regra 14): as explicações das regras de erro traziam um exemplo fixo como se fosse a correção. "O certo é 'chegou ao escritório'" aparecia numa frase que dizia "chegou no banco"; "implica cobrança" aparecia numa frase sobre revisão. Além disso, a correção aplicada só ao trecho ("lojista foram") parecia chamar "lojista" de sujeito.
  - Corrigido: as 9 explicações viraram exemplos explícitos ("por exemplo, …"), e a correção agora é aplicada à **frase inteira** ("O certo seria: 'As duplicatas negociadas pelo lojista foram antecipadas…'").
  - Teste com os dois casos reais e garantia de que nenhuma regra de erro diz "o certo é '…'".
- Máquina sobrecarregada: um `npm run dev` antigo (API + site) tinha ficado órfão depois de o app parar o preview. Encerrado, junto com os previews de teste.

## 18/10/2026 — Etapa 9: bateria e2e completa com os jobs de IA parados (POST-IT C.6)

- Servidores: `bb-estudos` (API + site, para o login), `bb-demo` e `bb-web`. Nenhum job de IA rodando.
- `scripts/e2e-fluxos.ts`: **6/6** (responder, revisão, simulado completo, contestar com e sem Desfazer, offline/online, redação).
  - Na 1ª passada, "responder" deu timeout de 30 s porque o Vite recém-ligado ainda compilava nesta máquina lenta (os casos seguintes, com o servidor aquecido, passaram).
  - Na 2ª passada: 6/6.
- `scripts/e2e-login.ts`: **7/7** (foco no e-mail, erros, mostrar senha, senha errada, criar conta com convite, entrar, sessão expirada).
- Carrossel conferido contra o POST-IT C.7: snap e arraste, setas, esmaecido, bolinhas (agora com 24 px de toque), teclado, clique abre Praticar, ordem por prioridade, barra de domínio, reduced-motion.

## 18/10/2026 — ADENDO-FONTES-ATUAIS e ADENDO-BINHO-VOZ

- **Fontes atuais** (`44c9e59`, `579ed27`):
  - camada nova, sem reescrever nada; migração de 199 questões; conferência na fila com auditor de outra família e checagens por código; "mudou" só com o OK do dono (Admin → Pendências); bloco "Fontes" na correção;
  - 1ª rodada real: o conferente mandava `indice: 0` no pendente e o schema recusava; 2ª: 1 confirmada (trecho literal) e 5 pendentes (Vendas e Informática sem norma ingerida, listadas no relatório).
- **Binho, voz:**
  - (1) `shared/fala.ts`: normalizador de fala, 77 casos.
  - (2) Magpie TTS pt-BR, conferido no `list_voices` (Diego, Isabela, Louise), MP3 com cache no Mongo e amostras em `docs/voz/` para o dono escolher. Um 429 do plano grátis levou ao retry; o cache lia `Binary` do BSON como vazio, corrigido.
  - (3) 🔊 na explicação, na aula e na resposta do Binho; voz e velocidade em Ajustes; pré-geração noturna; `media-src blob:` na CSP.
  - (4) "Estudar ouvindo" no caderno de erros (Media Session).
  - STT: a NVIDIA não tem ASR grátis com pt-BR (Whisper é gRPC de parceiro; o catálogo de ASR não mostra endpoint grátis). O 🎤 usa o reconhecimento do navegador e some onde não há suporte.
- **Falta do Binho:**
  - Parte 1 (poses): `web/src/assets/lobos/` ainda não existe, as poses são do dono. Ícone da cabeça e nome "Lobo Binho" entram junto com elas.
  - Chat "Pergunte ao Binho" por tópico: o da questão já existe (tutor com cota e cache).
  - Telemetria de voz no Admin: as chamadas já vão para `chamadas_modelo` como função "voz"; falta a linha na aba IA.

## 18/10/2026 — Personagem "Lo" (item 1 da mensagem do dono)

- **Binho = mascote; Lo = assistente do Binho e voz da narração** (registrado também no topo do ADENDO-BINHO-VOZ).
- `.env`: `NVIDIA_TTS_VOZ` = Louise (só essa linha foi tocada, nada impresso). `VOZES_PT` com Louise primeiro.
- `npm run bb -- voz limpar` (novo): tirou do cache os 6 áudios de outras vozes; o noturno regera com a Louise.
- Ajustes: `vozBinho` virou `vozLo` (padrão Louise), seção "Voz da Lo" com voz e velocidade.
- Textos: 🔊 "Ouvir com a Lo" / "A Lo está lendo… pausar" / "Continuar com a Lo"; aula "Ouvir a aula com a Lo"; tutor "Ouvir resposta com a Lo"; Estudar ouvindo "a Lo lê as explicações dos seus erros".
- Mini-player da Lo (`componentes/MiniLo.tsx`): aparece só enquanto ela lê, com pausar/parar e o título. Turquesa `--lo` (#14B8A6) só nele e na borda de "Voz da Lo"; nada mais mudou (regra 8). Media Session mostra "Lo, assistente do Binho".

## 18/10/2026 — 16 poses do Binho e da Lo (item 2)

- `scripts/binho-recortar.py` agora recorta `binho-*` e `lo-*` (originais em `web/src/assets/lobos/originais/`, intactos), com WebP + PNG em 240/520 px e `dimensoes.json`. Aceita nomes na linha de comando para refazer só algumas.
- Lo: o fundo branco sai igual ao do Binho; o quadro do `lo-quadro` fica (é cercado pela moldura cinza). A tolerância de sombra azulada resolveu o `lo-lendo`, mas comia o sapato em `lo-e-binho` e `lo-quadro`: nesses dois fica uma manchinha clara de chão (mesma limitação do `binho-mesa`).
- `componentes/Pose.tsx`: `<picture>` WebP/PNG, `srcset` 1x/2x, `width`/`height` da proporção (sem pular layout), `loading="lazy"` (eager só no que está no topo), alt em português ("Binho comemorando", "Lo narrando"); pulinho só em comemoração, dentro de `prefers-reduced-motion: no-preference`.
- Onde ficou cada pose (uma por tela):
  - Binho:
    - em-pe: cartão do nível na lateral (~120 px de altura)
    - acenando: 1ª visita ao Painel depois de entrar ("Bem-vindo! O Binho vai estudar com você"), uma vez por conta
    - lendo: Painel quando ainda não respondeu nada ("hora de estudar")
    - andando: Painel com "Continuar estudando" (próxima tarefa)
    - notebook: Praticar (dica lateral) e Cartões
    - mesa: Plano e início do Simulado
    - escrevendo: Redação
    - pensativo: estados vazios, erro de tela, redação na fila, tutor gerando ("O Binho está pensando…")
    - apontando: dica depois da correção (explicação do erro, "Mudou desde a prova") e simulado abaixo da metade
    - comemorando: modal de nível, Conquistas, simulado acima do corte, cartões fechados, caderno limpo
    - confiante: Raio-X e simulado médio
  - Lo:
    - lo-e-binho: tela de login
    - lo-quadro: cabeçalho da aula
    - lo-narrando: mini-player (56 px de largura, ~75 de altura)
    - lo-lendo: Estudar ouvindo
    - lo-acenando: "Voz da Lo" em Ajustes
- No laranja (cartão do nível, dica, modal, Conquistas), contorno branco de adesivo (`.adesivo`) para a blusa laranja do Binho não sumir.
- Prints: antes em `docs/telas/antes-binho/` (inclui o login antigo), depois em `docs/telas/*-desktop.png` e `*-celular.png`.
- Typecheck ok; testes 149/149.

## 18/10/2026 — Ícone novo, laranja (item 3)

- Original do dono em `web/src/assets/originais/lobo-quadrado-laranja.jpg`; o azul antigo foi para `web/src/assets/originais/lobo-azul-antigo.png` e não é usado.
- `scripts/icones.py` (refeito):
  - (a) Ícones do quadrado como está: PWA 192/512, maskable 512 com zona segura de 80%, apple-touch 180, favicon 16/32/48 e `favicon.ico`.
  - (b) Lobo solto `web/src/assets/lobo.png` (+ `.webp`). Não recorta por cor:
    - 1ª passada: o laranja do fundo, das bordas até a borda branca.
    - 2ª passada: a borda branca até o traço escuro.
    - A primeira versão, que só parava no traço, entrava na blusa, porque embaixo ela encosta direto na borda branca. O laranja saturado agora segura a inundação.
    - Por fim, um contorno branco fino de adesivo, conferido no fundo escuro e no laranja.
  - (c) Procura ✦ (mancha pequena cercada pelo fundo laranja): nenhuma neste original.
- Nome "Lobo Binho" (`short_name` "Binho"), `theme-color` #ff5b1f, títulos das abas "· Lobo Binho"; cache do service worker `lobo-v2`. A marca escrita "lobo" da lateral não mudou (regra 8).

## 18/10/2026 — O que faltou do adendo (item 4)

- **Pergunte ao Binho por tópico** (`src/chatBinho.ts`, aba Aula do Praticar, CLI `binho --assunto --pergunta`):
  - Contexto: aula conferida mais trechos do tópico, rankeados por termos da pergunta. O tutor responde e um auditor de outra família confere.
  - Em Bancários, Atualidades e Vendas: citação literal conferida por código, "sem base" quando não há fonte, recusa fora do edital.
  - Cache por aluno, tópico e pergunta normalizada; cota `CHAT_BINHO_MAX_DIA` (15); uma IA por vez. Falhou: "O Binho está ocupado".
  - O áudio é "Ouvir resposta com a Lo".
- **Rodadas reais** (6 perguntas):
  - SFN ×4: todas viraram "não achei nas fontes" (nada errado chegou ao aluno).
    - 1ª: o modelo citou o trecho com o número errado. Agora a frase é procurada em todos os trechos; o título mostrado é o de onde ela está.
    - 2ª e 3ª: o auditor reprovou com razão: "fixa as diretrizes da política monetária" não estava nos trechos, e na lei o CMN age "segundo diretrizes do Presidente da República".
    - A busca só via os 12 primeiros trechos do tópico (a mesma função da aula). Agora vê até 300 trechos.
  - Juros compostos ×2: na 1ª o tutor marcou "sem base" num conceito de matemática. Agora o "sem base" só vale onde a fonte é obrigatória, e o prompt diz isso. Na 2ª, aprovada pelo auditor Muse (Meta) e salva.
- **Admin → IA**: linha "Voz da Lo" com chamadas e falhas em 24 h (por tipo) e 7 dias, cache (áudios, na voz atual, MB, minutos) e última falha (`resumoVoz` em `src/voz.ts`).
- `docs/RELATORIO-VIAGEM.md`: entrega final (o que foi feito, testes, o que fica com o dono). DECISOES-PENDENTES nº 11 resolvido.
- Testes: 153/153. Typecheck ok.

## 18/10/2026 — Espaço no Atlas grátis (pedido do dono)

- Medido com `npm run bb -- uso-banco` (só leitura):
  - 33,9 MB de dados + índices; 59,9 MB de disco + índices. Só o banco `bb-estudos` existe no cluster.
  - Os 165 MB citados pelo dono não aparecem nas estatísticas: falta saber de qual tela do Atlas vieram.
  - Por coleção: chunks 23,4 MB (45 em disco, 28 KB cada: embedding de 2048 números), questões 6,4 MB (33 KB cada), telemetria 0,1 MB, áudio 0.
- Projeção para 1.200 questões, com áudio de toda explicação:
  - questões ~40 MB, chunks ~28 MB;
  - áudio ~250 MB das explicações (~210 KB cada) + ~60 MB das aulas;
  - total ≈ 400 MB antes do disco, ou seja, passa do limite pedido.
- Aplicado:
  - Áudio continua no Mongo, mas a noite só gera o das explicações de questões que alguém **errou** (as mais recentes primeiro) e o das aulas.
    - Teto `AUDIO_MAX_MB=100`: acima dele saem primeiro os menos ouvidos (cada vez que o aluno ouve conta) e a noite não gera áudio novo.
    - Fora do Mongo exigiria conta num armazenamento externo (do dono).
  - Telemetria com TTL de 30 dias. O usuário do Atlas não pode `collMod`, então o índice TTL foi recriado. Aplicado com `uso-banco ajustar`; a noite confere.
  - Admin → IA, "Uso do banco":
    - barra contra 512 MB, as 5 coleções que mais pesam, áudio × teto;
    - alerta a partir de 80%, na aba e nos alertas do admin;
    - conta conservadora: o maior entre dados e disco, mais os índices.
- Testes e typecheck ok.

## 18/10/2026 — Decisões do dono depois do benchmark do auditor (60 amostras)

- **Corrente definitiva** ativa (`npm run bb -- corrente definitiva`; `CORRENTE_DEFINITIVA` em `src/catalogo.ts`, com teste: válida, sem ferir a regra de família, sem preview nem DeepSeek).
  - Gerador e tutor: gpt-oss → Muse → Lightning.
  - Auditor: Muse → Super → Ultra.
  - Escritor PT: GLM → gpt-oss → Muse.
  - Juiz PT: Super → Ultra (único aviso: 2 opções).
  - Redação: Super → Ultra → Muse.
  - DeepSeek saiu também do `.env.example` e do `render.yaml`.
- **Descanso por taxa** (`avaliarTaxas` em `src/corrente.ts`, 3 testes):
  - Com menos de 20% de sucesso em 24 h (5+ chamadas; voz, embed e benchmark não contam), o modelo fica 1 h fora da corrente.
  - Depois, só as chamadas novas contam (2 bastam).
  - Corrente inteira descansando: tenta assim mesmo.
  - A telemetria é relida no máximo a cada 2 min.
- **Fontes atuais:**
  - Informática virou "não se aplica", exceto tópico com lei (Segurança da informação / proteção de dados). 26 pendentes reclassificadas; 12 de Segurança da informação continuam pendentes.
  - Vendas: proposta de normas oficiais por tópico em DECISOES nº 12 (Decreto 11.034/2022 SAC, Lei 10.048/2000, Lei 12.414/2011, Res. CVM 30/2021 e ligar a LGPD já ingerida), sem baixar nada. Técnicas de negociação: proposta "não se aplica".
- **Item 11** das Pendências já estava resolvido (Lo, Louise, 16 poses).
- **Render** (lobo-binho.onrender.com):
  - tsx agora é dependência de produção; a imagem roda `node --import tsx` (nada de `npx`, que baixava o tsx a cada partida). O build confere `tsx ok`.
  - O noturno do `render.yaml` também.
  - O servidor abre `process.env.PORT` (0.0.0.0) **antes** de conectar no Mongo: conferido com `node --import tsx src/server.ts` na porta 3401 ("ouvindo" e depois "Banco conectado"; `/api/saude` 200).
  - O Docker Desktop está desligado aqui: a imagem é construída pelo Render.
- Testes 158/158; typecheck ok.

RETOMAR AQUI: dono publica o deploy manual no Render depois do push. Pendentes dele: DECISOES nº 12 (normas de Vendas e ligar LGPD/4.893 a Segurança da informação), glossário de Vendas, 3 normas do BCB, conta de admin.

RETOMAR AQUI (antigo): Binho, o que falta: chat por tópico; telemetria de voz na aba IA; Parte 1 quando o dono puser as 5 poses em `web/src/assets/lobos/`. A voz padrão espera a escolha do dono (amostras em `docs/voz/`). Depois: ENTREGA FINAL do PROMPT-VIAGEM (RELATORIO-VIAGEM.md).

RETOMAR AQUI (antigo, concluído): ADENDO-FONTES-ATUAIS (POST-IT 5b), em andamento. Já há campos novos em `models.ts` (`referencias`, `situacaoFonte`, `oQueMudou`) e o tipo `FontesQuestaoDTO`, sem commit. Depois, ADENDO-BINHO-VOZ.

RETOMAR AQUI (antigo): esperar `aulas --n 3` e `cartoes --n 3` (logs em scratchpad `aulas3.log` e `cartoes1.log`) e registrar o resultado (mostrar uma aula aprovada, se houver). Depois, Etapa 9: testes ponta a ponta dos fluxos (login, responder, revisão, simulado completo, redação, contestar, offline/online) com os jobs de IA parados; prints de todas as telas (1440 e 390) em docs/telas/; Lighthouse. Depois: rodadas reais de 3 por assunto da Etapa 7 e, por último, ADENDO-BINHO-VOZ.

## 19/10/2026 — revezamento e varredura de segurança

- `gh api repos/dinowei/Lobo-bb --jq .private` retornou `true`; os 6 commits locais foram enviados para `origin/main` (`9999f57`).
- Varredura de `git log -p --all`: nenhuma chave `nvapi-`, URI Mongo com credenciais, valor real de `MONGODB_URI` ou senha literal identificada. Os exemplos de URI encontrados são placeholders/incompletos.
- E-mails não exemplares apareceram em 3 locais de script/teste/configuração e nos metadados de autoria de 72 commits (domínio de provedor pessoal). Valores omitidos neste registro; nenhum endereço foi copiado para logs ou commits.
- O print local `docs/telas/login/entrar-celular.png` segue fora do stage e será preservado.

RETOMAR AQUI: aplicar as fontes atuais aprovadas, fazer as duas conferências por disciplina e registrar os resultados.

## 19/10/2026 — fontes atuais por decisão do dono

- Vendas: baixados e ingeridos somente do Planalto/DOU o Decreto 11.034/2022 (12 trechos), a Lei 10.048/2000 (5), a Lei 12.414/2011 (26) e a Resolução CVM 30/2021 (14). A Resolução CVM foi encontrada no DOU de 12/05/2021, página 176.
- Ligações vigentes: LGPD → Segurança da informação (80 trechos) e Marketing de relacionamento (80); Res. CMN 4.893/2021 → Segurança (25); Res. CMN 5.274/2025 → Segurança (13); Lei 12.414/2011 → Marketing (26). A ligação é aditiva e preserva classificações existentes.
- "Técnicas de negociação": as 3 questões pendentes foram classificadas como "não se aplica" para fonte atual.
- Conferência serial, um trabalhador de IA: Segurança da informação (12) → 4 confirmadas, 1 mudança aguardando OK, 7 sem base atual; Conhecimentos Bancários (20) → 2 confirmadas, 1 mudança aguardando OK, 17 sem base atual. As questões sem base continuam pendentes. Não aprovei automaticamente as 2 mudanças.
- `fontes-atuais conferir` agora aceita `--disciplina`, para não consumir pendências de outra matéria. Typecheck geral permaneceu travado sem saída após 35 s e foi interrompido; os comandos alterados foram executados com sucesso pelo CLI.

RETOMAR AQUI: calibrar o uso do Atlas aos 165,05 MB reais, estimar crescimento do índice vetorial por chunk e incluir a projeção no alerta de 80%.

## 19/10/2026 — uso do Atlas calibrado pela tela do cluster

- Referência observada pelo dono: 165,05 MB de 512 MB em Project 0 → Overview → Cluster0. No momento da calibração havia 847 chunks, 31,6 MB de dados e 2,3 MB de índices no `dbStats`; o `storageSize` era 57,6 MB.
- `uso-banco` agora usa a referência Atlas, adiciona a mudança em dados/índices e estima Vector Search a 9,6 KiB por chunk de 2.048 dimensões (float32 + 20% de metadados ANN). A projeção também soma tamanho médio do chunk e índice B-tree por chunk.
- Após ingerir as quatro fontes aprovadas, o banco tem 904 chunks: uso estimado 167,14 MB (33%), índice vetorial estimado 8,48 MB, crescimento de 38,1 KB por chunk novo; cerca de 6.516 chunks até o alerta de 80% e 9.268 até 512 MB.
- A referência e a estimativa aparecem na aba Admin → IA; o alerta também informa a estimativa vetorial. `npm run bb -- uso-banco` executou e o typecheck do site passou. A projeção é aproximada; o valor mais recente no Atlas pode ser usado para recalibrá-la.

RETOMAR AQUI: testar três perguntas de Conhecimentos Bancários em "Pergunte ao Binho" após a busca de 300 trechos e registrar quantas foram aprovadas; depois criar o script e a instrução do Agendador de Tarefas para o noturno local.

## 19/10/2026 — teste real do "Pergunte ao Binho" após ampliar a busca

- `trechosDoTopico` consulta até 300 chunks vigentes antes da seleção lexical dos 5 trechos enviados ao tutor. Fiz três chamadas reais, em sequência, sem concorrência de jobs.
- Resultado: 1/3 respostas aprovada. A pergunta sobre o dever de sigilo (LC 105/2001) passou com citação literal; a pergunta sobre atribuições do CMN e outra sobre operações/serviços foram reprovadas pelo auditor por incluir detalhes ausentes dos trechos.
- As três foram escritas pelo `gpt-oss-20b`; na primeira, o Muse falhou ao formatar JSON e o Super assumiu como reserva, de família diferente. Não aprovei respostas reprovadas.

RETOMAR AQUI: criar o script e a instrução do Agendador de Tarefas do Windows para rodar o noturno diariamente à 01:00, acordar da suspensão, sem janela e com log em arquivo.

## 19/10/2026 — noturno local no Agendador do Windows

- Criado `scripts/noturno-windows.ps1`: trabalha na raiz do projeto, roda até 05:30, usa um trabalhador de IA, recusa uma inicialização fora da janela 01:00–05:30 e grava um log por noite em `logs/noturno/`.
- O script mascara tokens, URI Mongo, chaves de API e e-mails antes de gravar cada linha; `logs/` foi acrescentado ao `.gitignore`.
- `docs/DEPLOY.md` contém o passo a passo diário às 01:00, ação oculta do PowerShell, execução sem usuário conectado, reativação da suspensão e configuração de despertadores. A sintaxe do `.ps1` passou pelo parser do PowerShell.

## 19/10/2026 — corrente aprovada: diagnóstico e geração real

- `correnteAtiva()` lê `Config.findById("correntes")` a cada chamada; não havia cache do módulo. A leitura segura confirmou `ativa: true` e a corrente definitiva aprovada que consta em `CORRENTE_DEFINITIVA`: gerador/tutor gpt-oss → Muse → Lightning; auditor Muse → Super → Ultra. O motivo do log antigo de três tentativas no Lightning não se reproduziu com a configuração atual.
- `src/corrente.test.ts` cobre a aprovação escrita por outro processo, incluindo a ordem provisória Lightning → gpt-oss e auditor Super, e garante que erro de leitura do Mongo não regrida silenciosamente ao legado. `npx tsx --test src/corrente.test.ts`: 11/11.
- Geração real de uma questão: Lightning foi pulado porque a telemetria o colocou em descanso por taxa baixa; `openai/gpt-oss-20b` gerou e `meta/muse-glimmer-30b` auditou, de outra família. A questão foi reprovada na revisão por exceções ao sigilo; não foi salva como aprovada.
- Portanto, a geração pedida na ordem provisória exata (Lightning falha → gpt-oss assume → Super audita) não foi reproduzida: a corrente aprovada atual é a definitiva, e não forcei uma configuração antiga nem contornei o descanso do Lightning.
- O item 8.2 e os itens 8.3 a 8.9 já constam como concluídos. A retomada segue a ordem atual do ROADMAP: rodadas reais de três por assunto da Etapa 7.

## 19/10/2026 — Etapa 7: rodada real de Sistemas de amortização

- Uma chamada serial `gerar --assunto "Sistemas de amortização" --n 3`: 1/3 aprovada. Aprovada: saldo devedor após k parcelas no SAC. Duas descartadas como `numero_alterado`, pois o enunciado omitiu os dados numéricos da taxa (1% e 3% ao mês).
- As três tentativas usaram `openai/gpt-oss-20b`; as auditorias da questão aprovada foram feitas pelo Muse, de outra família. Lightning permaneceu em descanso por taxa baixa.

## 19/10/2026 — Etapa 7: rodada real de Taxas de juros

- Uma chamada serial `gerar --assunto "Taxas de juros" --n 3`: 0/3 aprovadas. As três passaram pelo gerador e auditor de família diferente, mas foram reprovadas na revisão por explicações matemáticas incoerentes com as alternativas; uma também tinha cenário confuso. Nenhuma foi salva como aprovada.
- As três tentativas usaram `openai/gpt-oss-20b`; auditorias pelo `meta/muse-glimmer-30b`. O Lightning permaneceu em descanso por taxa baixa.

## 19/10/2026 — Etapa 7: rodada real de Análise combinatória

- Uma chamada serial `gerar --assunto "Análise combinatória" --n 3`: 2/3 aprovadas. Uma foi reprovada na revisão por erro de gênero em “dividir o carona”; duas passaram. Houve um timeout/conexão do gpt-oss, resolvido pela repetição automática.
- As três tentativas usaram `openai/gpt-oss-20b`; auditorias pelo `meta/muse-glimmer-30b`, de família diferente. Lightning permaneceu em descanso por taxa baixa.

## 19/10/2026 — Etapa 7: rodada real de Probabilidade

- Uma chamada serial `gerar --assunto "Probabilidade" --n 3`: 1/3 aprovada (`probabilidade condicional em tabela de clientes`). Uma foi reprovada por explicar probabilidade condicional invertendo numerador e denominador; outra tinha enunciado ambíguo e cenário temporal contraditório. Nenhuma das duas foi salva como aprovada.
- As três tentativas usaram `openai/gpt-oss-20b`; auditorias pelo `meta/muse-glimmer-30b`, de família diferente. Lightning permaneceu em descanso por taxa baixa.

## 19/10/2026 — Etapa 7: rodada real de Concordância verbal e nominal

- Uma chamada serial `gerar --assunto "Concordância verbal e nominal" --n 3`: 0/3 aprovadas. Uma foi reprovada por erro conceitual na explicação; outra, porque o auditor aceitou duas alternativas como corretas; a terceira, porque as frases e a reescrita não obedeceram à regra sorteada. Nenhuma foi salva como aprovada.
- A construção das frases foi demorada (328–568 s por questão). O GLM teve timeout em tentativas; a corrente fez fallback para gpt-oss quando necessário. Juiz de Português Super/Ultra e auditor Muse verificaram frases e questão.

## 19/10/2026 — Etapa 7: rodada real de Regência verbal e nominal e crase

- Uma chamada serial `gerar --assunto "Regência verbal e nominal e crase" --n 3`: 0/3 aprovadas. Uma foi descartada por crase antes de infinitivo; outra, por duplicidade (cosseno 0,865); a terceira, por ambiguidade conceitual na distinção entre crase, artigo e regência. Nenhuma foi salva como aprovada.
- As tentativas demoraram 637–725 s cada, com timeout do GLM e fallback do escritor para gpt-oss nas chamadas afetadas. Juiz Super/Ultra e auditor Muse participaram das verificações.

## 19/10/2026 — Etapa 7: rodada real de Pontuação

- Uma chamada serial `gerar --assunto "Pontuação" --n 3`: 3/3 aprovadas. As três passaram pela auditoria frase a frase e pela revisão completa.
- Escritor `z-ai/glm-5.3-flash`, juiz de Português `nvidia/nemotron-3-super-120b-a12b` e auditor `meta/muse-glimmer-30b`, cada um em família diferente quando aplicável.
- Fechamento das sete rodadas reais: 7/21 aprovadas (Sistemas de amortização 1/3; Taxas de juros 0/3; Análise combinatória 2/3; Probabilidade 1/3; Concordância 0/3; Regência/crase 0/3; Pontuação 3/3). Os demais resultados foram descartados pelas auditorias/regras registradas acima.

## 19/10/2026 — Decisão 1a: Q51 mantida e botão de recusa em Pendências

- Q51 da prova BB 2021 (Segurança da informação) foi marcada `confirmada`; continua `aprovada` e no treino. Motivo registrado no histórico: é classificação conceitual de controle de segurança em Informática; a Res. CMN 5.274/2025 não muda o conceito.
- Admin → Pendências ganhou **Manter questão**, por mudança pendente, com registro do motivo e sem alterar o status da questão. A rota valida o motivo e só atua em proposta ainda não aprovada.
- Conferência do banco: `Q51` = `6ad19952d40dcba3f8f47f4d`, BB 2021; status `aprovada`, fonte `confirmada`, recusa registrada.
- O job de benchmark do juiz que estava em andamento foi interrompido ao chegar a nova ordem de prioridades. As respostas parciais persistidas podem ser retomadas; a etapa de escritor não começou. O relatório local tinha sido gerado antes da interrupção e foi descartado por estar desatualizado.

## 19/10/2026 — Decisão 1b: conferência da Q40 da BB 2023

- A aprovação do dono já estava registrada. A Q40 (id `6ad197ae8f365fc168fc0808`) está `desatualizada`, com nota explicando que a LC 179/2021 revogou do art. 4º, I, da Lei 4.595/1964 a atribuição do CMN de autorizar a emissão de papel-moeda.
- Verificação direta: elegibilidade para o simulado fiel (`status: aprovada`) = não; consulta histórica por ID funciona e retorna a nota. A tela exibe o selo “Norma atualizada” e o aviso “essa questão saiu do treino”. Nenhuma alteração adicional foi necessária.

RETOMAR AQUI: item 1c — classificar os dois tópicos doutrinários de Vendas como `nao_se_aplica`, preservando exceções para questões com SAC, suitability ou CDC já presentes no banco.

## 19/10/2026 — Decisão 1c: tópicos doutrinários de Vendas

- Atendimento e Segmentação ficaram `nao_se_aplica` para fonte atual; a classificação não muda `status` nem tira questões do treino.
- Exceção confirmada: Q57 da BB 2023 (Segmentação) cita o CDC e ficou `confirmada`, ligada ao trecho literal do art. 6º, III, da Lei 8.078/1990.
- Após esclarecimento do dono, a Q58 da BB 2023 (Atendimento) também ficou `confirmada`: a resposta sobre Ouvidoria está diretamente coberta pelo art. 3º, I, da Res. CMN 4.860/2020, vigente e ligada ao trecho literal. Não foi localizada questão que citasse suitability/Resolução CVM 30 nesses dois tópicos. A Q68 da BB 2021 segue histórica pela revogação da Res. CMN 4.539/2016.
- No total das 15 questões pendentes desses tópicos: 13 `nao_se_aplica`, 2 `confirmada` (CDC e Res. CMN 4.860). As questões continuam com seus status de treino anteriores.

## 19/10/2026 — proposta de fontes para as 17 pendências de Bancários

- Conferi novamente `uso-banco`: Atlas 167,73/512 MB, 904 chunks; projeção calibrada de 38,1 KB por chunk novo e índice vetorial de 9,6 KB por chunk (2048 dimensões). O alerta de 80% segue em 409,6 MB, com cerca de 6.500 chunks de margem estimada.
- `DECISOES-PENDENTES.md` agora discrimina cada uma das 17 questões, as fontes oficiais permitidas, a cobertura direta e a projeção de espaço. As propostas incluem EC 106/2020, Lei 13.986/2020, recortes do MCR atual, DL 911/1969 e Carta-Circular BCB 4.001/2020; fontes já ligadas — Res. CMN 4.893 e Lei 4.595 — foram identificadas sem custo incremental.
- Cobertura: 8/17 diretas (6 por fontes novas propostas e 2 por fontes já existentes); 9/17 conceituais ou dependentes de código interno do BB. As Leis 4.728, 6.385 e 14.286, a Res. BCB 61 do Copom e o pacote de criptoativos constam como contexto proposto, sem cobertura direta dessas 17.
- Se todas as novas fontes listadas forem aprovadas, estimativa de +102–153 chunks / 3,89–5,83 MB; Atlas projetado em 171,62–173,56 MB, abaixo do alerta. Nenhuma foi baixada ou ingerida; aguardam OK do dono.

## 19/10/2026 — matemática por construção e rodadas de comparação

- A seleção antiga de `data/variacoes.json` era uniforme. A cobertura mostrou que as seis listas já eram 100% construídas: Juros compostos 8/8, Descontos 4/4, Amortização 5/5, Taxas 4/4, Combinatória 4/4 e Probabilidade 3/3. Nenhum tipo livre foi selecionado nas rodadas reais; os “conta errada” vinham de explicações escritas pela IA sobre valores calculados pelo código.
- `sortearPar` passou a preferir tipos por construção com probabilidade de 80% nos seis assuntos quando há tipos livres no pool. Como os tipos atuais têm todos template, a seleção segue em 100% por construção.
- `pipeline` substitui explicações de cálculo construído por explicações baseadas em `montada.resolucao`. Para Amortização, SAC/Price fica explícito e dados omitidos são inseridos como frase do enunciado; os campos numéricos e a conferência de dados continuam sob controle do código. O prompt de Taxas proíbe chamar a taxa mensal de nominal quando os dados não a definem assim.
- Comparação final: Taxas de juros **3/3** aprovadas (antes 0/3); Amortização **3/3** aprovadas (antes 1/3, com duas perdas por falta de dado numérico). Uma tentativa intermediária de Amortização teve 1/3; outra questão perdeu por o auditor tratar “Dados necessários” como metadado, e uma terceira foi marcada Price porque SAC não estava explícito. Esse auditor demorou 512 s e concluiu discordando; a correção passou a inserir dados em frase natural e nomear SAC/Price. A rodada final passou sem falta de dado nem ambiguidade de sistema.

## 19/10/2026 — Etapa 7 encerrada sem repetir assuntos

- O registro de 18/10 confirma 3 tentativas em cada um dos sete assuntos (21 tentativas no total), com 12 aprovadas. Portanto, “12 de 21” era a contagem de aprovações, não 12 assuntos: não havia tópico sem rodada.
- O DIARIO também registra nova rodada real em 19/10 nos mesmos sete assuntos, 7/21 aprovadas. Não repeti as cinco rodadas não matemáticas. As únicas rodadas extras foram as duas explicitamente pedidas no item 2: retestes corrigidos de Taxas (3/3) e Amortização (3/3).
- `ROADMAP.md` agora marca a Etapa 7 como concluída, veta repetição integral e deixa o benchmark noturno como próxima etapa; no bloco da Etapa 9, registra que fluxos e login já passaram e que falta o Lighthouse.

RETOMAR AQUI: item 4 — atualizar o noturno local para dois trabalhadores, conferir `.env.example` e as instruções do Agendador; o relatório da primeira noite só poderá ser registrado depois que ela rodar.

SPRINT CODEX 19/10/2026
1. P0.1: fotografar o Atlas em leitura, reconciliar números por status/ID e sincronizar o estado atual nos documentos.
2. P0.2: tornar o Agendador/noturno confiável, com prioridade da janela, limite de 4h30, log diário e proteção contra duplicidade.
3. P0.3: backup gzip do Atlas com manifest, retenção, simulação de restauração e rollback documentado.
4. P0.4–P0.5: smoke test da produção e correção/testes da voz Louise.
5. P1 e P2: seguir a ordem do sprint; fontes de Bancários aguardam OK explícito do dono.

## 19/10/2026 — P0.1: fotografia somente leitura do Atlas e reconciliação

- Consulta em `bb-estudos.questions` com `$group` por `status`/`origem`, `variacao.tipo` e `prova`; junção somente de `_id` do tópico, disciplina e `ativo`. Trava `fila_jobs/job_de_ia` ausente. A elegibilidade oficial foi calculada como `status: aprovada`, tópico ativo e disciplina com cota no edital, conforme `src/estudo.ts`; nenhuma escrita no banco.
- Para reproduzir no `mongosh` já conectado ao Atlas, executar somente agregações de leitura:

```javascript
db.questions.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }, { $sort: { _id: 1 } }]);
db.questions.aggregate([{ $group: { _id: "$origem", n: { $sum: 1 } } }, { $sort: { _id: 1 } }]);
db.questions.aggregate([{ $match: { "variacao.tipo": { $type: "string", $ne: "" } } }, { $group: { _id: { tipo: "$variacao.tipo", origem: "$origem", status: "$status" }, n: { $sum: 1 } } }, { $sort: { "_id.tipo": 1, "_id.status": 1 } }]);
db.questions.aggregate([{ $match: { origem: "oficial" } }, { $lookup: { from: "topics", localField: "topicId", foreignField: "_id", as: "topic" } }, { $unwind: "$topic" }, { $match: { status: "aprovada", "topic.ativo": true, "topic.disciplina": { $in: ["lingua_portuguesa", "lingua_inglesa", "matematica", "atualidades_mercado_financeiro", "matematica_financeira", "conhecimentos_bancarios", "informatica", "vendas_negociacao"] } } }, { $group: { _id: { prova: "$prova", status: "$status", origem: "$origem" }, n: { $sum: 1 } } }]);
```

- Fotografia: 19/10/2026 20:34 BRT (`2026-10-19T23:34:29Z`), total **226**.

| Grupo | Situação | Quantidade |
|---|---|---:|
| Questões | aprovada / rejeitada / desatualizada / precisa_imagem | 195 / 25 / 4 / 2 |
| Origem | oficial / gerada | 137 / 89 |
| Com `variacao.tipo` (construção) | gerada aprovada / gerada rejeitada | 60 / 23 (83 no total) |
| BB 2021 — oficial | aprovada elegível / precisa_imagem / desatualizada | 65 / 1 / 2 (68 registros) |
| BB 2023 — oficial | aprovada elegível / precisa_imagem / desatualizada | 66 / 1 / 2 (69 registros) |

- Não havia outros valores de `status`; não havia questão oficial `pendente`, `contestada` ou `anulada`. As seis oficiais fora do treino: BB 2021 Q5 `6ad19950d40dcba3f8f47f22` (`precisa_imagem`), Q67 `6ad19952d40dcba3f8f47f5d` e Q68 `6ad19952d40dcba3f8f47f5e` (`desatualizadas`); BB 2023 Q3 `6ad197ad8f365fc168fc07e3` (`precisa_imagem`), Q33 `6ad197ae8f365fc168fc0801` e Q40 `6ad197ae8f365fc168fc0808` (`desatualizadas`). Total oficial elegível: **131**.
- Reconciliação: o ROADMAP antigo contava BB 2023 69 + BB 2021 67 = 136. O Atlas agora tem 69 + 68 = 137; o registro adicional é BB 2021 Q23, id `6ad2049c3638d1c7c41f2924`, criado em 16/10 às 08:03 BRT, aprovado e elegível. O `132` de `PROMPT-VIAGEM.md` é uma contagem histórica de elegibilidade, não a atual. Quatro oficiais desatualizadas correspondem à diferença aritmética 136−132, mas não existe fotografia contemporânea versionada para provar a composição exata daquele 132. Hoje Q3/Q5 `precisa_imagem` também ficam fora, e Q40 está desatualizada por decisão do dono; portanto a elegibilidade atual é 131. Omissões atuais por número: BB 2021 Q17/Q19 e BB 2023 Q60.
- O DIARIO de 18/10 registra 166 após a primeira noite; o prompt revisado declarava aproximadamente 190 sem data/hora de medição. O Atlas está em 226 nesta fotografia; `createdAt` soma 35 registros em 18/10 e 27 em 19/10. Os 166 são históricos e os ~190 não são reproduzíveis sem horário/base da medição.
- `docs/PENDENTES-FIGURA.md` foi reconciliado: Q23 de 2021 está cadastrada; Q27/2021 e Q41/2023 estão aprovadas com figura. ROADMAP, PROMPT-VIAGEM e CLAUDE agora distinguem estado atual de histórico. `docs/RELATORIO-VIAGEM.md` mantém 166 como histórico da primeira noite.

## 19/10/2026 — P0.2: noturno local e Agendador do Windows

- `scripts/noturno-windows.ps1` agora roda com dois trabalhadores, log diário em `logs/noturno/AAAA-MM-DD.log`, mascaramento de segredos/URI/bearer/e-mail, trava local exclusiva, corte antes de 05:30 BRT e encerramento controlado do filho. A limpeza de trava órfã exige host e PID do processo já encerrado (`bb limpar-trava-orfa <pid>`). A fila protege outros jobs de IA entre 01:00 e 05:30 BRT.
- A tarefa `Lobo Binho - Noturno Local` está diária às 01:00, oculta, no diretório do repositório, com `WakeToRun=true`, `StartWhenAvailable=true`, limite `PT4H30M`, `IgnoreNew` e execução também na bateria. Continua em `InteractiveToken`: a troca para S4U foi negada (`0x80070005`) e `schtasks /NP` terminou em acesso negado. Portanto, só executa com a conta conectada; o dono poderá informar a senha localmente nas propriedades do Agendador para habilitar execução sem login, sem salvá-la no projeto.
- Smoke manual do script passou: valores sintéticos mascarados e processo de teste morto no timeout. Pelo Agendador, tanto o smoke quanto uma tarefa mínima `cmd /c exit` ficaram em `Em execução`; ambas foram removidas. Não foi feita geração de IA nem escrita no Atlas de produção. A execução noturna real ainda precisa ser confirmada.
- Verificações: `src/fila.test.ts` passou 3/3; smoke manual PowerShell saiu com código 0; `git diff --check` passou. `tsc --noEmit` terminou sem diagnósticos visíveis após a correção da tipagem em `src/fontesAtuais.ts`.

RETOMAR AQUI: P0.3 — implementar backup gzip do Atlas com manifest, retenção de 14, simulação de restauração e rollback documentado; integrar o backup ao fim do noturno.

## 19/10/2026 — P0.3: backup gzip e restauração protegida

- `npm run bb -- backup` exporta `users`, `attempts`, `reviewstates`, `redacoes`, `ratings_aluno` e somente o documento da corrente aprovada em `config`, em `backups/AAAA-MM-DD/`. Cada arquivo é JSON Extended compactado em gzip; `manifest.json` registra banco, data, contagem, bytes gzip e SHA-256. O write é temporário e atômico; falha parcial remove o diretório temporário e não declara sucesso.
- `backups/` está no `.gitignore`. ACL do Windows fica restrita à conta atual (`icacls`); nos demais sistemas, diretórios ficam em `0700` e arquivos em `0600`. Retenção: 14 diretórios diários; snapshots `rollback-*` de restaurações manuais ficam preservados à parte.
- A configuração usa allowlist (`ativa`, modelos por função, data de aprovação e configuração anterior), excluindo campos arbitrários que poderiam carregar segredo. Sessões e tokens não entram. `senhaHash` é mantido como hash scrypt para recuperar a conta. XP, progresso e conquistas não têm coleção persistida separada: derivam das tentativas.
- `npm run bb -- noturno` agora faz backup após salvar o relatório noturno. `restaurar <pasta> --simular` valida manifesto, hash, gzip e contagens sem mutação. `--confirmar` exige frase exata com banco/data, cria snapshot completo antes da escrita, compara contagens depois e tenta rollback automático em falha; nenhum restore real foi feito no Atlas de produção.
- Testes com banco falso: **4/4** passaram — gzip/hash e contagens, allowlist sem sentinelas de segredo, erro parcial sem pasta final, restauração com rollback e retenção de 14. `npx tsc --noEmit`, `npm run bb -- ajuda` e `git diff --check` passaram. Não foi exportado dado real do Atlas neste sprint.

RETOMAR AQUI: P0.4 — implementar `scripts/smoke-prod.ts` com checks de saúde/login e prova sem escrita; depois concluir P0.5 da voz Louise.

## 19/10/2026 — P0.4: smoke de produção

- Criado `scripts/smoke-prod.ts`: timeout individual de 30 s, respostas e durações por endpoint, verificação de corpo contra padrões de segredo sem imprimir corpo/URL completa. Login usa e-mail `.invalid` e senha sintéticos; não cria conta nem sessão.
- Primeira execução fria: saúde **timeout 30.049 ms**; página **200/22.439 ms**; `/manifest` **200/334 ms**; `/manifest.webmanifest` **200/174 ms**; ícones 192 **200/172 ms**, 512 **200/1.334 ms**, maskable 512 **200/914 ms**; login **401/404 ms**. Resultado **7/8**, falha preservada.
- Segunda execução após o serviço despertar: saúde **200/1.018 ms**; página **200/250 ms**; `/manifest` **200/351 ms**; `/manifest.webmanifest` **200/193 ms**; ícones 192 **200/458 ms**, 512 **200/348 ms**, maskable 512 **200/442 ms**; login **401/324 ms**. Resultado **8/8**, nenhuma falha e nenhum segredo detectado.
- `/manifest` devolve HTTP 200 como fallback da SPA; o arquivo PWA vinculado no HTML e usado para validar ícones é `/manifest.webmanifest`. `npx tsc --noEmit` passou. Nenhum endpoint de escrita foi chamado.

RETOMAR AQUI: P0.5 — investigar e corrigir a escolha/migração/cache da voz Louise e o fallback pt-BR do navegador; provar com testes automatizados.

## 19/10/2026 — P0.5: voz da Lo (Louise)

- ID exato confirmado no `.env` e no catálogo de código: `Magpie-Multilingual.PT-BR.Louise`. O `.env` local já era válido; `vozPadrao` agora valida contra a allowlist e usa Louise quando a variável falta, está vazia ou tem ID inválido. `.env.example` traz o ID explícito.
- Preferência local antiga sem marcador migra para Louise. A tela grava `vozLoManual=true` quando o aluno muda o seletor; preferências explícitas de Diego/Louise/Isabela permanecem após reload. Cache usa hash e filtro com a voz; limpeza automática agora remove só IDs fora das três opções válidas, preservando cache de quem escolheu Diego ou Isabela.
- Fallback do navegador seleciona idioma pt-BR, depois qualquer pt disponível; sem voz pt, deixa o navegador decidir. A seleção não grava nem altera preferência local.
- Testes automatizados: **5/5** passaram (env ausente/inválido, preferência herdada e explícita, fallback pt-BR/pt/padrão sem mutação e chave do cache isolada por voz). `npm run typecheck` passou para servidor e web. Não houve chamada ao serviço TTS.

RETOMAR AQUI: P1.1 — ingerir uma fonte aprovada de Conhecimentos Bancários por vez nos domínios permitidos, depois conferir as 17 questões e registrar antes/depois sem aprovar automaticamente mudanças legais.

## 19/10/2026 — P1.1: fontes de Bancários e conferência de 17 questões

- No Windows, `gh` confirmou o repositório privado (`true`); Node v24.21.0/npm 11.19.0, `schtasks`, `gh`, `node_modules` e conexão Atlas disponíveis. A tarefa do Agendador existe, mas permanece `InteractiveToken` e pronta; execução sem login segue bloqueada por permissão local, conforme P0.2.
- Fotografia antes: Atlas **168,06/512 MB**, **904 chunks**, índice vetorial estimado **8,48 MB**; trava `fila_jobs/job_de_ia` ausente. Após cinco fontes oficiais acessíveis e ligações: **172,77 MB**, **1.030 chunks**, índice vetorial estimado **9,66 MB**. Aumento observado **4,71 MB**, aproximadamente **126 × 38,1 KB** mais vínculos de tópico. Margem projetada até 80%: cerca de **6.365 chunks**.
- Ingeridos um por vez, cada um com `--simular` e `--confirmar`: EC 106 art. 7º (2 trechos), Lei 13.986 arts. 30–33 (1), DL 911 (22), Carta-Circular BCB 4.001 v4 (31) e Lei 4.728 compilada como contexto (70). Fontes verificadas e conectadas aos tópicos pertinentes; vínculos de fontes existentes também passaram por simulação.
- Conferência serial (`--n 17`, um trabalhador): **4 confirmadas, 13 sem base atual, 0 mudanças novas aguardando aprovação**. Confirmadas: BB 2021 Q37; BB 2023 Q31, Q33 e Q37. Pendentes: BB 2021 Q32–36 e Q38–40; BB 2023 Q32, Q34–36 e Q39. A Q40 histórica mantém a classificação anterior; nenhum status de treino ou gabarito foi mudado pela conferência.
- MCR 3-5/10-6 e Resoluções BCB 61, 519, 520 e 521 seguem em `pendente`: os visualizadores do BCB entregam página JavaScript ao downloader; buscas em `normativos.bcb.gov.br` não acharam o texto vigente consolidado. A Res. 520 precisa incluir a Res. 589/2026 e suas vigências. Links exatos e instruções estão em `data/fontes-oficiais.json`; não foi ingerido texto antigo como vigente. Previsão se todos os textos forem baixados: **174,52–175,44/512 MB**.
- Downloader agora aceita hosts oficiais BCB/Normativos, PDF, recortes explícitos de artigos; ingestão individual tem simulação de contagem e confirmação, e remove fonte/trechos novos se a gravação falhar. Vínculo de fonte tem simulação e confirmação aditiva. Testes do módulo: **3/3**. `uso-banco` validou Atlas antes/depois; o primeiro `typecheck` sofreu falha interna de memória do TypeScript 7, mas `npm run typecheck` passou com paralelização limitada (`GOMAXPROCS=2`). `git diff --check` passou.
- Tentativa de abrir os visualizadores no navegador com `@oai/sky` não foi possível: o helper retornou `Computer Use native pipe is unavailable`. Não houve automação de browser nem transmissão de dados.

### 19/10/2026 — P1.2: três normas consolidadas do BCB

- Resolvi o acesso sem usar texto antigo: o BCB publica a Resolução BCB 1/2020 compilada pela API oficial (versão 43, 2/10/2026); o portal Normativos publica a Circular 3.978/2020 compilada v6_L e a Resolução CMN 3.919/2010 compilada v7_L. URL, data, bytes, caracteres e SHA-256 foram gravados em fontes/LEIAME.json.
- Baixadas e ingeridas uma por vez, cada uma com simulação antes da confirmação: Pix 231 trechos (230.331 caracteres extraídos); PLD/FT 62 trechos (61.515 caracteres; 25 páginas); tarifas 36 trechos (36.278 caracteres; 16 páginas). O extrator PDF avisou sobre operadores não suportados, mas as contagens foram confirmadas; não houve falha de ingestão.
- Consulta somente leitura à coleção sources: nenhuma versão anterior dessas normas existia; as três fontes ativas agora são as versões compiladas, sem necessidade de revogação. O texto original de 2020 não foi ingerido.
- Testes do downloader: 4/4 passaram, incluindo validação de versão compilada e rejeição de tipo/data ausente. git diff --check passou. Atlas após: 184,94/512 MB, 1.359 chunks, índice vetorial estimado 12,74 MB, cerca de 6.053 chunks até o alerta de 80%; trava fila_jobs/job_de_ia ausente.

RETOMAR AQUI: P1.3 — criar e executar o golden set fixo de 12 perguntas do chat do Binho; medir base, citações, respostas úteis e invenções.

## 20/10/2026 — F1: Análise da primeira noite real e correção do encerramento com backup

- **Resultado da execução noturna pelo Agendador (20/10/2026)**:
  - **Rodou**: Sim, disparada via `schtasks` às 01:00:01, processo iniciado às 01:00:10 BRT.
  - **Início/Fim**: 01:00:10 BRT → 05:29:39 BRT.
  - **Tarefas**: 343 no total (181 concluídas, 160 descartadas, 2 aguardando, 0 esgotadas).
  - **Questões aprovadas**: 100 (atingiu a meta noturna de 100). Atlas foi de 195 para 295 questões aprovadas (131 oficiais, 164 geradas). Total geral de questões no banco: 374 (295 aprovadas, 73 rejeitadas, 4 desatualizadas, 2 precisa_imagem).
  - **Demais entregas**: 37 explicações alternativas, 28 temas de redação, 9 lotes de cartões, 3 conferências de fonte atual, 2 aulas, 2 áudios de voz.
  - **Descartes por motivo**: 48 reprovada_na_revisao, 28 fonte_insuficiente, 17 fonte_pendente (as 17 de bancários), 13 auditor_discordou, 11 tema_invalido, 10 aula_invalida, 8 outro_jeito_reprovado, 8 conta_nao_confere, 7 sem_trecho_fonte, 4 trecho_fonte_inventado, 2 auditor_por_frase_discordou, 1 aula_reprovada, 1 frase_fora_da_regra, 1 ignorou_gabarito_obrigatorio, 1 numero_alterado.
  - **Falhas de modelos**: fallbacks tratados pela reserva sem interrupção — `meta/muse-glimmer-30b` (5), `nvidia/nemotron-3-super-120b-a12b` (4), `openai/gpt-oss-20b` (3), `z-ai/glm-5.3-flash` (2).
  - **Trava**: Liberada com sucesso às 05:29:39; `limparTravaOrfa` garantiu remoção de trava no MongoDB para o PID encerrado.
  - **Backup na noite**: Não gerou automaticamente porque o wrapper PowerShell atingiu o deadline operacional às 05:29:00 (código 124) enquanto o Node continuava executando `rodarFila` até 05:30:00, impedindo o avanço para a etapa de relatório e backup.
- **Causa e correção com teste**:
  - `scripts/noturno-windows.ps1` ajustado para passar `--ate 05:25` ao Node (4 minutos antes do deadline do wrapper em 05:29).
  - `src/noturno.ts` e `src/cli.ts`: criada e testada a função `calcularAteFila(ate, inicio)`, que garante 5 minutos de folga antes do limite para encerramento gracioso da fila, salvamento do `Relatorio` e execução do `criarBackupAtlas`. Blocos de relatório e backup agora protegidos com try/catch.
  - Teste automatizado adicionado em `src/noturno.test.ts` (9/9 passaram).
  - Backup executado e validado com dados reais: `npm run bb -- backup` concluiu com 6 coleções e 13 documentos em `backups/2026-10-20/`.
  - Simulação de restauração executada: `npm run bb -- restaurar backups/2026-10-20 --simular` confirmou hashes e integridade sem mutação no Atlas.

RETOMAR AQUI: F2 — Chat do Binho sem invenção (golden set completo de 12; meta: 0 invenções, 100% sem base = "não achei", úteis ≥ 7).

## 20/10/2026 — F5: aulas no noturno (Claude Code assumiu o PROMPT-FECHAMENTO do Antigravity)

- [CONFIRMADO] A fila roda na ordem de criação (`sort proximaEm, createdAt`), então a ordem do plano é a ordem da noite.
- A sequência saiu do `cli.ts` para `planejarEtapasDaNoite` com `ORDEM_PRE_GERACAO` (`src/noturno.ts`): questões → explicações alternativas → aulas → cartões → fontes atuais → temas → áudio. O TTL da telemetria e a limpeza do áudio seguem antes de planejar áudio.
- Regra 18 no planejamento: `filtrarTopicosParaAula` (`src/aulas.ts`). Não repete tópico com aula aprovada ou tarefa aberta; Bancários, Atualidades e Vendas só com fonte ingerida e vigente.
- [CONFIRMADO] A noite de 20/10 já planejou e rodou aulas (2 concluídas; 10 `aula_invalida`, 1 `aula_reprovada`, ver F1).
- Testes `src/noturno.test.ts`: 11/11 (2 novos: ordem com aulas na fila e regra 18).

## 20/10/2026 — F8: site acordado nos horários de estudo

- `.github/workflows/acordar.yml`: `GET https://lobo-binho.onrender.com/api/saude` a cada 10 min.
  - Horários: 11:30–13:30 e 18:30–23:30 de Brasília; cron em UTC: 14:30–16:30 e 21:30–02:30, a segunda faixa passa da meia-noite.
  - Também roda manual (`workflow_dispatch`).
  - Sem segredos, `permissions: {}`, timeout de 3 min. Site fora vira aviso, não falha, para não mandar e-mail a cada 10 min.
- Números (estimativa):
  - 13 + 31 = **44 execuções/dia**. O Actions cobra 1 min por job: **~1.320 min/mês** (meta < 1.500; o repositório privado tem 2.000 grátis).
  - Acordado: 2 h + 5 h por dia, mais ~15 min depois do último GET em cada faixa: **~7,5 h/dia ≈ 225 h/mês** (o Render free dá 750 h/mês).
  - O cron do GitHub pode atrasar alguns minutos nos horários de pico; o 1º acesso logo no início da faixa ainda pode pegar o site dormindo.
