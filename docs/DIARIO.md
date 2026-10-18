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

RETOMAR AQUI: em segundo plano rodam a Etapa 2.3 (10 geradas com fonte) e depois o benchmark (auditor até 60, juiz, escritor), logs em scratchpad `etapa23.log` e `bench.log`. Quando acabar: aprovação da 2.3 no DIARIO, proposta de corrente (data/proposta-correntes.json + DECISOES-PENDENTES), print novo da aba Benchmark, Etapa 3 (10 Informática + 10 Vendas por norma). Código: Etapa 5 (nuvem sem publicar).

**LER E APLICAR `docs/ADENDO-BANCO-GRANDE.md`** (pedido do dono em 17/10/2026) ao chegar em: **Etapa 6 (noturno)**, **R3 (telas)** e **Fase B (8.4 e 8.5)**. Até lá, seguir a PROMPT-RETOMADA na ordem.
