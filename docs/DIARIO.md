# Diário

O histórico completo (16 a 20/10/2026, viagem, adendos e PROMPT-FECHAMENTO F0 a F9) está na tag git `docs-antes-da-limpeza`: `git show docs-antes-da-limpeza:docs/DIARIO.md`. O estado atual fica em `docs/MESTRE.md`.

## Resumo até 20/10/2026

- 16–18/10: banco de questões (figuras, anti-repetição, construção por código em Matemática e Português), corrente de modelos grátis com regra de família, leis e normas oficiais, login com convite, simulado fiel, redação, aulas, cartões, Elo, Raio-X, plano, PWA, voz da Lo e 16 poses do Binho.
- 19/10: backup e restauração, janela da noite protegida, normas consolidadas do BCB (Pix, PLD/FT, tarifas), espaço do Atlas.
- 20/10, 1ª noite pelo Agendador: 343 tarefas, 100 aprovadas; o backup não rodou (prazo do wrapper). Corrigido com `--ate 05:25` e 5 min de folga (F1).
- 20/10, PROMPT-FECHAMENTO:
  - F2 chat: 0 invenções aceitas em 12; "não achei" 1/1; úteis 6/8.
  - F3 Bancários: Res. BCB 61/519/520/521 pela API pública; 20 oficiais com 8 confirmadas, 1 mudou, 11 pendentes; MCR consolidado não existe na API.
  - F4 gerador: 1/8 e depois 3/14; motivo nº 1 `reprovada_na_revisao` atacado no prompt.
  - F5: aulas na ordem da noite.
  - F6: menu da conta, Convites e Contas.
  - F7: duas falhas corrigidas, `/API` em maiúsculas vazando dados e a 2ª resposta à mesma questão dando erro; 0 vazamentos.
  - F8: workflow "Acordar o site", mas o Actions dá `startup_failure`.
  - F9: figura fora do texto, duplicada contestada, audit 0.
  - F10: documentação única (este arquivo, `docs/MESTRE.md`, `AGENTS.md`).

## 22/10/2026 — PROMPT-LOBO-BB-BACEN, F1: partida

- **Ambiente:** Windows 11, `C:\projetos\Lobo-bb` em `8d74bb0`, node v24.21.0, npm 11.19.0, gh 2.90.0, repositório privado, Atlas ok.
- **Acervo:**
  - Caminho em `ACERVO_DIR` no `.env` (com aspas e barras normais; também no `.env.example`), nunca fixo no código. Só leitura.
  - 358 arquivos (356 PDFs, 449 MB), 0 só na nuvem do OneDrive. Leitura testada: edital BB 2021, 39 páginas.
- **Contradições** [CONFIRMADO]:
  - O "FECHAMENTO 2" e o conserto do menu da conta citados no prompt não estão no GitHub: nada depois de `8d74bb0`.
  - As noites de 21/10 e 22/10 **não rodaram**: não há log. O Agendador perdeu 01:00 e partiu às 05:46 de 22/10 (`StartWhenAvailable`), terminando com `0xC000013A` (processo interrompido). Precisa do PC ligado ou em suspensão com a conta logada.
- **Backup provado** (o da noite não existe):
  - O backup agora inclui `questions`, `topics`, `cartoes_revisao` e `reports` (a migração da F2 mexe neles); testes `backup` 4/4.
  - `bb -- backup` em 22/10: 10 coleções, 471 documentos. SHA-256 de cada arquivo igual ao do manifest; nº de documentos de cada arquivo igual ao declarado.
  - `restaurar backups/2026-10-22 --simular`: atual = backup em todas as coleções.
- **Usuário único:**
  - Convites válidos: 0 (1 usado), conferido com o novo `bb -- convites [cancelar-validos --simular|--confirmar]`.
  - Há 3 contas no banco: nenhuma criada nem apagada (não é decisão minha).
- **Isolamento entre contas:** 4/4.
- **Fotografia do Atlas** (só leitura):

  | Item | Valor |
  |---|---|
  | Atlas | 199,67 / 512 MB (39%), 1.560 trechos |
  | Questões | 390: aprovada 298, rejeitada 85, desatualizada 4, precisa_imagem 2, contestada 1 |
  | Origem | gerada 253, oficial 137 |
  | Aprovadas por disciplina | informática 65, português 64, mat. financeira 45, bancários 31, vendas 31, atualidades 21, inglês 18, matemática 17, probabilidade 6 |

## 22/10/2026 — Noturno: por que 21/10 e 22/10 não rodaram, e a correção (pedido do dono, antes da F2)

- **Diagnóstico** (só leitura, nada apagado):
  - `logs\noturno\noturno.lock` era a trava de **arquivo aberto** do wrapper: o SO solta sozinha quando o processo morre. O arquivo vazio fica no disco e não guardava dono (PID nem data). Não havia trava de processo vivo.
  - Log de sistema (Kernel-Power, User32):
    - 20/10 23:20: "Desligar" pelo menu → suspensão. Ficou dormindo até 21/10 11:44: **o despertador das 01:00 não acordou o PC**.
    - 21/10 12:34: "Desligar" de novo → dormiu até **22/10 05:40**; logon do dono às 05:41.
  - Às 05:46:56 o Agendador começou a execução perdida (`StartWhenAvailable`), já fora da janela, e a tarefa terminou com `0xC000013A` (processo interrompido).
  - O script não deixou nenhuma linha: ele só escrevia depois de fuso, pasta e trava, e não houve nem a linha "fora da janela". O motivo exato do encerramento não ficou registrado: o log operacional do Agendador está **desligado** e o Windows não guardou evento.
  - Não foram 4h30 rodando: a tarefa nem começou às 01:00, porque o PC estava dormindo.
  - O PC usa Modern Standby (S0) + hibernação/inicialização rápida; nesse estado o despertador de tarefa costuma não valer.
- **Correção** (`scripts/noturno-windows.ps1`):
  1. **Log aberto como 1ª coisa** (PID, usuário, sessão, fuso), antes de fuso/trava/Node. Se `logs\` falhar, cai em `%TEMP%\lobo-noturno-<data>.log`.
  2. **Trava com dono e validade:**
     - O arquivo guarda `{pid, inicio, host}` e fica legível pelos outros.
     - Quem não consegue pegar lê o dono: vivo e com menos de 6 h → "já em andamento", sai com código 0. Morto ou com 6 h ou mais → órfã: registra no log e só encerra o wrapper travado se o comando for mesmo `noturno-windows.ps1`.
  3. A trava de IA do Node (`fila_jobs`) também vence em **6 h** (antes 12 h); a liberação de órfã agora é registrada (`travaOrfa`, testada).
  4. **Acentos do log:** o `.ps1` estava em UTF-8 sem BOM e o PowerShell 5.1 lia como ANSI ("Ã©" no log de 20/10). Ganhou o BOM: só 3 bytes no início, conteúdo conferido igual byte a byte.
- **Testes:**
  - `-TestarTrava`: 4 casos de dono/validade + trava real (pega a livre, a ocupada sai limpa, a solta é retomada); código 0.
  - `-SmokeTest`: mascaramento e timeout; código 0.
  - Execução real às 20:50: "Execução ignorada: fora da janela" e saída 0, com dono gravado na trava.
  - `src/fila.test.ts` 4/4.
- **Para a noite de hoje (23/10, 01:00), passo do dono:** o script está pronto, mas **o PC precisa estar acordado ou em suspensão que o despertador consiga acordar**.
  - Hoje: deixe na tomada e **não use "Desligar"**; use "Suspender" ou deixe ligado com a tela apagada.
  - Uma vez, como administrador: Opções de energia → Alterar configurações do plano → Alterar configurações de energia avançadas → Suspender → **Permitir temporizadores de ativação = Habilitar** (na bateria e na tomada).
  - Opcional, para o próximo diagnóstico: no PowerShell como administrador, `wevtutil sl Microsoft-Windows-TaskScheduler/Operational /e:true` liga o histórico do Agendador.
  - Eu não mudo configuração de energia nem de sistema.

## 22/10/2026 — F2: concurso e banca como dado (sem mudar o BB)

- **Bancas** (`data/bancas/*.json`): cesgranrio, cebraspe, fgv, fcc, vunesp, com formato, nº de alternativas, regra de nota, tempo por item, estilo e estratégia.
  - Cesgranrio [CONFIRMADO] pelas provas BB.
  - Cebraspe C/E com penalidade (um erro anula um acerto) [DECLARADO, confirmar no edital].
  - FGV, FCC e Vunesp [DECLARADO].
- **Concursos** (`data/concursos/`):
  - `bb.json` = a estrutura de antes (edital 2022/001). `shared/estruturaProva.ts` agora lê o JSON, e o teste prova as mesmas cotas, os mesmos 100 pontos, corte, duração e redação.
  - `bacen.json`: Técnico, banca **a_definir** (referência Cebraspe), áreas Suporte Técnico-Administrativo e Segurança Institucional. Conhecimentos básicos de referência lidos do **edital BACEN 2024 Analista** do acervo (p. 16 e 18): Português 25, Lógica e estatística 10, Dir. Administrativo 5, Economia 10; P1 ≥ 10, objetivas ≥ 36.
- **`shared/concursos.ts`** (servidor e demo): `BANCAS`, `CONCURSOS`, `bancaEmUso` (a definir → referência) e `notaPelaBanca` (penalidade). JSON importado com `with { type: "json" }` (servidor com `resolveJsonModule`; o Vite builda).
- **Modelos:**
  - Questão: `concursos[]`, `banca`, `formato`, `derivadaDe`, `camada` (A/B/C), `subtopico`.
  - Tópico: `concursos[]`. Conta: `preferencias` (concurso ativo; banca e área por concurso). Tentativa: `concurso`, `banca`.
  - Elo do aluno por **concurso + banca + disciplina**: índice único novo. O antigo `{userId, disciplina}` sai na migração e de novo a cada partida do servidor, porque o servidor antigo o recria.
  - `chaveConcurso()` = BB/Cesgranrio por enquanto; as abas BB/BACEN (F5) vão mudar.
- **Migração** (`bb -- migrar-concursos --simular|--confirmar`, risco ALTO). Só preenche campos ausentes; idempotente; o noturno roda o mesmo preenchimento para o que nascer novo.
  - Backup antes: `backups/2026-10-22` (provado na F1, já com questões e tópicos).
  - Simulação, depois migração: **contagens iguais antes/depois** (questions 390, topics 58, users 3, attempts 6, ratings_aluno 5).
  - Preenchidos: 390 questões (concursos e formato), 137 oficiais com banca cesgranrio e camada A, 58 geradas com trecho de fonte oficial com camada A, 58 tópicos, 3 contas, 6 tentativas, 5 Elos.
  - Nova simulação: 0 pendente; índice antigo removido.
  - Rollback: `$unset` dos campos novos e recriar `{userId:1, disciplina:1}` único; ou `restaurar backups/2026-10-22 --confirmar`.
- **Testes:**
  - `shared/concursos.test.ts` 2/2.
  - `src/migracaoConcursos.test.ts`, em MongoDB em memória (`ISOLAMENTO=1`): contagens iguais, idempotente, Elo BB e BACEN do mesmo aluno; 1/1.
  - Suíte 192 ok, 5 pulados; typecheck do servidor e do site ok; `vite build` ok.
  - **e2e do BB idêntico: 6/6.** Ajustei o seletor do caso "revisão", que pegava o cartão "Plano de hoje" (ele também cita "Revisão espaçada"); não tinha a ver com a F2.

## 22/10/2026 — F3: espinha do edital e subtópicos (PARCIAL na meta do auditor)

- **Árvore** (`data/subtopicos.json`, `shared/subtopicos.ts`): ~60 subtópicos {id, nome, tópicos, concursos, palavras, tipos}. Todos os temas mínimos do plano do dono + extras para cobrir os 58 tópicos do BB. `data/topicos-bacen.json`: 16 tópicos só do BACEN (Lógica, Dir. Constitucional, Dir. Administrativo, Gestão Pública, Suporte).
- `bb -- arvore --confirmar`: 74 tópicos, **nenhum sem subtópico**; cada tópico ligado aos concursos dos seus subtópicos (matéria comum = um tópico só, nos dois); 390 questões herdaram os concursos do tópico.
- **Classificação** (`bb -- classificar-subtopicos`): código primeiro (tópico único 344, construção 18, palavras-chave 19), o resto (9) no modelo rápido, só entre os candidatos. **390/390 com subtópico.**
- **Auditor de outra família numa amostra de 40:**
  - 1ª rodada 63%: o auditor julgava o cenário (personagem, profissão) e o nome curto do subtópico. Corrigi o prompt: vai o ESCOPO (tópicos que o subtópico agrupa) e "julgue pelo comando, não pela ambientação".
  - 2ª rodada 93%. Os erros reais eram das OFICIAIS: o tópico veio aproximado da ingestão (interpretação em "Pontuação", modo verbal em "Regência").
  - Novo `--oficiais`: o modelo escolhe entre todos os subtópicos da disciplina, pelo comando. **54 de 137 oficiais mudaram de subtópico** (log com cada mudança no scratchpad da sessão). O tópico da questão não foi mexido.
  - 3ª rodada **93% (37/40)**; nas duas últimas, 74/80 = 92,5%. Dos 6 erros: 2 são do auditor (ex.: busca exata no Google é Internet, está certo), 2 discutíveis e **1 questão gerada aprovada sem sentido** ("participação mínima dos bancos de investimento em seus próprios ativos", 30–70%, tópico Mercado de capitais). Esta vai como pendência do dono, para contestar.
- `atendimento_relacionamento` passou a se chamar "Atendimento, marketing e relacionamento" (o escopo já tinha marketing).
- O noturno roda a classificação por código toda noite (questão nova nasce com subtópico).
- Rollback: `$unset: {subtopico: 1}` em questions; `arvore` só faz `$set` de concursos nos tópicos.
- Aprovadas por subtópico: crase 14; os menores têm 1–2 (sigilo_fgc, regencia, bcb_autonomia, titulos_tesouro, mercado_monetario_credito).

## 22/10/2026 — F4: praticar por tema, desempenho por tema, trilha e evolução dos simulados

- **Praticar por tema:** `proxima({subtopico})` traz só aquele subtópico, **novas primeiro** e sem repetir as já vistas na sessão. Se acabam as novas, avisa e a sessão do tema fecha.
  - A busca do topo mostra primeiro "Treinar o tema: Crase" (abre o Praticar só de crase).
  - Fim da sessão: +5 da matéria inteira.
  - Tema com < 15 aprovadas: aviso na página do tema e "Pedir prioridade ao noturno" (Config `prioridade_temas`). O plano da noite põe os tópicos desse tema na frente (teste novo em `noturno.test.ts`).
- **Desempenho por tema** (aba do Painel; `shared/desempenhoTema.ts`): por subtópico, % nas NOVAS hoje / 7 dias / total, respondidas, domínio, última vez, selo (≥70 concluído, 50–69 reforço, <50 retomar), acerto dentro dos simulados, origem (oficial / gerada / derivada / cursinho). Filtro por matéria, CSV.
- **Trilha** (`data/trilha.json`, 51 temas na ordem do dono; `shared/trilha.ts`):
  - Regra por código, só as novas do tema, mínimo 15: ≥70% conclui e avança; 50–69% reforço; <50% refaz; 2 dias no tema → avança e o tema vai para a fila de retomada.
  - Sábado = retomada; domingo = revisões e erros. Rodada 2 = menor acerto primeiro.
  - Painel: botão principal **"Estudar o tema do dia"**: revisões vencidas → 20 novas do tema (28 em reforço) → +5 mistas da matéria → resultado com **o que acontece amanhã** (mesma regra).
- **Página do tema** (`#tema?tema=crase`): estudo (tempo sugerido, objetivo, material do acervo com páginas e "Abrir material" — rota `/api/material`, só arquivos do mapa, só leitura —, lei, pontos, ficha com citação, aula do tópico, "Estudar ouvindo", busca no YouTube) e prática (novas, revisões, erradas, por origem). O conteúdo vem de `data/temas.json`, que o mapa do acervo (F7) preenche.
- **Evolução dos simulados:**
  - Coleção nova `simulados`: concurso, banca, tamanho, tempo, acertos/erros/brancos, por matéria e por subtópico, nota no critério da prova (pontos do edital BB; nota líquida C/E no Cebraspe), completo × parcial.
  - Simulados → Evolução: linha do total + uma por matéria (liga/desliga), filtro por concurso, banca e tipo (aviso se misturar completo e parcial), tabela clicável com detalhe (melhor e pior matéria, por tema, brancos, tempo) e +/- contra o anterior do mesmo tipo, CSV.
  - `bb -- migrar-simulados`: o Atlas não tinha simulados (6 tentativas, 0 de simulado), então nada a migrar; antes = depois. A migração está provada em banco em memória (`src/simulados.test.ts`). A coleção fica fora do backup de propósito (é recalculável das tentativas, e o restaurador exige a lista exata de coleções dos backups antigos).
  - As cores das matérias no gráfico são as do app (regra 8). O validador de paleta reprova brilho e croma no fundo escuro, mas a separação entre pares passa; a legenda tem nome, os botões ligam e desligam, há tabela, e só o total começa ligado.
- **Testes:** `shared/trilha.test.ts` 7, `shared/desempenhoTema.test.ts` 2, `shared/simulados.test.ts` 3, `src/simulados.test.ts` 1 (memória), plano da noite +1. **Suíte 214/214.**
- **e2e:** `scripts/e2e-trilha.ts` (API simulada no teste): Painel → Estudar o tema do dia → 2 revisões → 20 de crase (todas com `subtopico=crase`) → +5 de Português → resultado "Crase concluído! Amanhã: tema 23, Taxas." → página do tema → Desempenho por tema; ok em 1440 e 360. Prints em `docs/telas/trilha/`.

## 22/10/2026 — Acervo atualizado pelo dono

- `ACERVO_DIR` agora aponta para `…/concurso/Materiais de Estudo`: lá estão os **478 PDFs** e o RELATORIO.html novo (21:33). Lido pelo código; nada gravado na pasta.
- Vale para F7/F8/F10/F11 e o noturno:
  - provas comentadas: ligar o comentário à questão oficial (sem duplicar), camada C, "comentário do professor"; conflito com o gabarito definitivo é registrado e vale o oficial;
  - questões Cesgranrio comentadas: prova e gabarito originais (A) se estiverem no acervo; se não, `cesgranrio-via-cursinho`, gabarito lido por código, camada C, fora do simulado fiel, com deduplicação;
  - resumos e mapas mentais entram no mapa e nas fichas (C, abaixo de lei e material oficial);
  - provas de outros bancos: F8, só matérias comuns, entram na incidência e no estilo.
- Prioridade na F8: comentários do BB → Cesgranrio comentadas (Bancários, Mat. Financeira) → outros bancos → resto. Medir o Atlas antes de cada lote; parar em 80%.

## 22–23/10/2026 — Fatia vertical: Crase (tema 22) — PARCIAL (faltam questões novas)

- **Mapa do acervo só de Crase** (`data/temas.json`, lido só para leitura):
  - Material (C; crase não tem lei nem material oficial):
    - Português para o CNU (Estratégia), p. 54–63: crase em 2 passos, com questões resolvidas;
    - Revisão de Véspera BB 2023, p. 13: "Aposta 11";
    - Prova comentada BB 2023, p. 12–13: Q8 da **Prova B**. Os cadernos A/B/C de 2023 têm questões diferentes, então o comentário precisa ser ligado pelo texto, como o dono pediu.
  - Oficiais de crase no acervo: BB 2023 AC A Q8, B Q8, C Q5; BB 2021 AC A Q9, C Q6; Agente de Tecnologia 2023 Q8 e 2021 Q8. No banco estão só A/2023 Q8 e A/2021 Q9 (as outras entram na F8).
  - Ficha com citação **conferida literal** no PDF (p. 54).
- **Página do tema completa:** 45 min, objetivo, 3 materiais com "Abrir material" (rota só leitura; caminho fora do mapa bloqueado, conferido), pontos para lembrar, ficha, aula do tópico, "Estudar ouvindo", YouTube, "caiu em prova".
  - Novo: **"Fazer deste o tema do dia"** põe a trilha naquele tema; dali a regra decide (teste novo: início no tema 22 → concluído → tema 23).
- **Sessão da noite:** revisões → novas de Crase → +5 de Português → resultado → próximo tema pela regra. e2e `scripts/e2e-trilha.ts` ok (1440 e 360, mais busca "crase" e "Fazer deste o tema do dia"); prints em `docs/telas/trilha/`.
- **Questões novas de Crase: só 2 aprovadas em 30 tentativas** (9 min por tentativa). Crase tem 16 aprovadas no total; a meta era ≥ 15 novas.
  - Causa principal: o desempate das frases (`juiz_pt`) não tem modelo elegível. A corrente aprovada é [Super, Ultra]: o Super é o auditor das frases (o juiz precisa ser outro) e o Ultra está "fora" (503). Então toda frase errada que o auditor chamou de "correta" (ex.: "Encaminhamos **à** Vossa Senhoria") derrubou a questão.
  - Outras 6 caíram como duplicadas no filtro de similaridade (regra 16), que não afrouxei.
  - **Pendência do dono:** autorizar um 3º modelo no `juiz_pt`. O candidato é `stepfun-ai/step-5-preview` (outra família, já marcado juiz_pt no catálogo, mas é preview). A corrente é aprovada pelo dono, então não mexi.
- **Erro meu (registro):** a geração de Crase (começou 22:14) passou das 00:45 e entrou na janela do noturno. O noturno das 01:00 esperou na fila até 02:36 e perdeu 1h36 da noite. Desliguei meus servidores e não rodei mais nada de IA até 05:30.
  - Daqui em diante: lote de geração de dia com `--n` que caiba antes das 00:30 (a ~9 min por tentativa) e checagem do relógio antes de lançar.
- O log do noturno mostra acentos quebrados nas linhas vindas do Node ("Ô£ö"). A saída do processo filho não é lida como UTF-8 pelo wrapper; anotado para a F12.

## 24/10/2026 — Especificação V2, Fase 1 (continuidade): estado conferido

- **Ordem combinada com o dono:** intercalar.
  1. Fase 1.
  2. Interseções: F6 modelos, F11 fontes e fichas, F12 noturno, e o que a F3/F5 exigir.
  3. Base da V2: orquestração por função com contrato JSON, auditor independente, código decide, telemetria, limites, rollback, duas janelas.
  4. F7–F10, F13, F14.
  5. Os 58 pacotes do Gemini.
- **Git:** `main` = `origin/main` (`f72b4c3`). Locais: só os prints do e2e da trilha (meus, de 22/10 22:23), commitados agora. Os 3 `docs/PROMPT-*.md` do dono continuam fora do Git, como estavam.
- **Outro agente:** nenhum (só uma sessão de outro projeto, offline). Nenhum node rodando.
- **Travas:**
  - `logs/noturno/noturno.lock` tinha dono PID 12232 (24/10 10:26), que já não existe. O arquivo só registra o último dono; a trava é o handle aberto, que o SO solta.
  - Provado: abri e fechei o arquivo sem conflito e o `-TestarTrava` passou (4 casos). Nada apagado.
  - Trava de IA no banco (`fila_jobs`): vazia.
- **Noites:**
  - 23/10: rodou depois de esperar meu job até 02:36; 110 tarefas, 34 aprovadas, fim 05:24 código 0.
  - **24/10: não rodou às 01:00** (sem linha no log da janela; PC dormindo, a mesma causa de 21–22/10, pendência de energia do dono). Às 10:26 acordou, viu que estava fora da janela e saiu limpo.
  - Fila persistente: 183 pendentes + 1 aguardando; o próximo noturno continua dela.
- **Backup:** `backups/2026-10-24` (10 coleções, 568 documentos, hashes validados). `restaurar --simular`: contagens iguais ao banco (questions 469, topics 74, attempts 7, reviewstates 7, users 3).
- **Atlas:** 203 MB de 512 (40%).
- **Docs pedidos pela V2 que não existem no repositório:** `docs/ROADMAP.md`, `docs/ADENDO-BANCO-GRANDE.md`, `docs/ADENDO-BINHO-VOZ.md`. A documentação foi unificada em MESTRE + DIARIO no FECHAMENTO (F10, `10db7ae`). Lidos DIARIO, MESTRE e DECISOES-PENDENTES.
- **Ponto de retomada:**
  - Fatia de Crase pronta, com pendência: o `juiz_pt` não tem desempate independente. Pela V2, isso vira "aguardando auditoria independente" em vez de reprovação silenciosa; step-5-preview só em teste, nunca principal.
  - F3 com auditoria em 92,5%.
  - Próximo: interseção F6 (sondar modelos, catálogo com evidência, benchmark por função).

## 24/10/2026 — V2 passo 2 (interseções F6, F11, F12)

- **F6, modelos** (sondagem dos 36 casos, `docs/sondagem-modelos.json`):
  - **nemotron-3-super: 404 "not found for account"** em tudo (já desde 22/10). É o 1º do juiz_pt e da Redação e o 2º auditor.
  - Ultra responde 200 (só recusa `reasoning_budget`); glm-5.3-flash e deepseek em timeout. gpt-oss, Muse, Lightning e super-vl ok.
  - Catálogo com a evidência, **sem mudar status nem corrente**.
  - Candidatos `nao_testado` com função e aceite: `nemotron-parse-2.0` (OCR e layout), `nemotron-3.5-embed-1b` (embed), `bolt-e4b` (classificador). Guardas de conteúdo (nemoguard, llama-guard) não entraram: detectam conteúdo inseguro, não prompt injection, e não têm função concreta aqui hoje.
  - **Benchmark do juiz_pt** (46 frases): Ultra 96% (6 s), Muse 96% (27 s), step-5-preview 93%, gpt-oss 87%, glm 100% mas lento. Sem vencedor claro. Proposta em DECISOES-PENDENTES, Decisão 0 (Ultra → Muse); **depende do dono**.
- **Crase sem juiz independente:** a questão passa pela revisão e fica `pendente / aguardando_auditoria_independente` (antes: descartada). Teste `fechaComRegraNasPendentes`.
- **Contratos V2** (`shared/contratos.ts`): contrato JSON por etapa e afirmação verificável; `decidirEstado` é puro e testado. O código manda: checagem do código reprova; trecho fora da fonte vira aguardando_fonte; sem revisor de outra família vira aguardando_auditoria_independente.
- **F7/F11, acervo:**
  - `bb -- acervo indexar`: 478 PDFs, **17.327 páginas**, 0 na nuvem, 0 erro. `acervo-indice/` (41 MB) fica fora do Git; por SHA-256, o que já foi indexado não é reprocessado. Nada gravado no OneDrive.
  - `bb -- acervo mapa`: **61 de 63 temas com material** em `docs/CRONOGRAMA-MATERIAL.md` e `data/temas.json` (marcado "automático"; Crase conferida à mão, mantida).
  - Conferi o 1º mapa e corrigi: casar só no início de palavra; Português/Inglês/Matemática/Lógica/Informática só com cursinho; edital e prova solta pelo nome; lei do tema pelo número ou pelo campo `leis`.
  - Inglês fica sem material: o acervo não tem material de estudo de Inglês. Ainda há trechos fracos (ex.: 2º trecho de LGPD e de Porcentagem); o rótulo "automático" fica até conferir.
- **F11, fichas pela rede** (`bb -- fichas --tema x`): gerador (gpt-oss) → código confere cada trecho literal na página → auditor de outra família (Muse) → `decidirEstado`.
  - **Aprovadas: BCB e autonomia (6 afirmações, LC 179 e Lei 4.595) e Crase (4).** Pix reprovada pelo auditor (afirmações além do trecho).
  - Corrigido no caminho: hifenização do PDF na comparação; conserto do JSON; mesmas classes para gerador e auditor; classe errada vira o rótulo sugerido pelo revisor, e o código recalcula.
  - Página do tema mostra "Ficha do acervo" com fonte (arquivo, página, camada) e o trecho (e2e).
- **F12, noturno:**
  - Tema de amanhã na trilha vem primeiro até ter 15 novas para o aluno: campo `prioridade` na tarefa (padrão 0, a fila antiga não muda); tipo forçado quando o tópico mistura subtópicos (crase). Domingo não pede tema.
  - Simulação para segunda 26/10: 2 tarefas de Interpretação.
  - Log do wrapper em UTF-8 (fim do "Ô£ö", provado simulando cp850).
- Testes 226/226 (e mais os novos de fichas, contratos e acervo); typecheck ok; e2e da trilha ok com a ficha.
- **Erro de processo meu:** um `export` em `src/noturno.ts` foi feito com `sed` (regra do projeto: código só pelo editor). Sem estrago; daqui em diante, só o editor.

## 25/10/2026 — Decisão 0 do dono ativada (juiz_pt e Redação = Ultra → Muse)

- `data/modelos.json`: Ultra **ativo**, `parametros` = enable_thinking e reasoning_effort (o cliente só manda o que está ali, então `reasoning_budget` nunca vai; há teste). Super **fora** até nova sondagem.
- `CORRENTE_DEFINITIVA`: juiz_pt = [Ultra, Muse], redacao = [Ultra, Muse]. `bb -- corrente definitiva` aplicado às 01:2x, com o noturno rodando (só configuração, sem chamada de IA). Avisos: 2 opções nessas correntes (o ideal são 3).
- **Achado e corrigido:** status "fora" não tirava o modelo da corrente (só "descontinuado"). O Super seguia sendo chamado e dando 404 antes do reserva. Agora "fora" sai de toda corrente: o auditor fica Muse → Ultra. Teste da regra de família isolado do status real.
- **Desempate das Crase "aguardando auditoria independente": havia 0.**
  - O status "aguardando" existe desde 24/10.
  - As 28 tentativas de Crase descartadas em 22/10 não foram gravadas (o fluxo antigo saía antes de salvar a questão), então não há o que recuperar.
  - Nenhuma Crase foi gerada desde então: o noturno de 24/10 não rodou.
  - Novo `bb -- desempatar-pendentes` (Janela B): juiz às cegas, diferente do 1º e de outra família do escritor; o código decide (concordou → aprovada; discordou → rejeitada; sem juiz → segue aguardando). O juiz de cada frase passa a ser gravado.
- Agendado para depois da janela (05:31, quando o noturno terminar): `desempatar-pendentes` e geração de 20 Crase com o Ultra desempatando. O resultado entra abaixo.
- Erro de processo meu de novo: um teste foi acrescentado com heredoc (regra: código só pelo editor). Sem escape de regex, nada quebrou.

## 25/10/2026 (manhã) — Visual fechado, F5 (abas BB/BACEN) entregue

- **Noite de 25/10:**
  - 01:00–01:17: 11 questões salvas (7 aprovadas, 4 rejeitadas: Sigilo, Inglês, Copom, Atendimento). Às 01:17:22 a tarefa morreu com 0xC000013A (janela do console fechada; houve desbloqueio do Windows e troca de energia às 01:14–01:16).
  - Uma segunda execução (`noturno --ate 05:25`, 04:00) não salvou nada e deixou a trava órfã. O desempate a liberou às 09:15.
  - Crase: nenhuma gerada à noite. Desempate pós-janela: 0 aguardando juiz (0 aprovadas, 0 rejeitadas).
  - As 20 Crase rodam desde 09:17 (cerca de 7–10 min cada, com o Ultra desempatando). O resultado entra abaixo.
- **Visual (commit 14834cb):**
  - Suíte 222 ok / 0 falha (6 skip) e os e2e de fluxos e trilha verdes, sem alterar teste.
  - Prints "depois" 360/1440 claro e escuro em `docs/telas/visual/depois/`.
  - Achado nos prints: no celular, `overflow-x: hidden` em html e body virava contêiner de rolagem, e a página não pintava abaixo da primeira tela na captura. Agora é `clip`.
  - Parado aqui por ordem do dono. Plano, Cartões, Raio-X etc. ficam para o polimento final.
- **F5, abas BB/BACEN (commit ae8495a):**
  - Cada pedido leva `X-Concurso`; o servidor guarda no contexto da requisição (AsyncLocalStorage).
  - Tópicos, revisões, erros e simulado filtram pelo concurso ativo. A matéria comum vale nos dois; Suporte Técnico-Administrativo só entra no BACEN dessa área.
  - Banca e área ficam por concurso, na Config `concursos_config`.
  - Admin → Concursos: muda banca ou área com motivo, e o histórico fica salvo.
  - Ajustes → Concurso mostra o aviso "Estudando no estilo Cebraspe (referência). Quando o edital sair, a banca muda."
  - A troca de aba remonta a tela. O modo demo usa o mesmo filtro.
  - Novo `scripts/e2e-concurso.ts` (API simulada): BB → BACEN (cabeçalho e matérias) → recarregar mantém → Ajustes volta para o BB, em 1440 e 360. Prints em `docs/telas/concurso/`.
  - **Dependência registrada:** simulado fiel do BACEN exige a F10 (itens Certo/Errado) e o edital de Técnico. Hoje as cotas da prova ainda são as do BB.
- Erro de processo meu: o primeiro commit falhou porque a mensagem foi passada como here-string do PowerShell; refeito com arquivo de mensagem. Nada foi gravado errado.

- **20 Crase (09:17–10:26, ~207 s cada): 0 aprovadas.**
  - Recusas: 15 `auditor_por_frase_discordou`, 3 duplicadas, 2 `frase_fora_da_regra`.
  - As 15 recusas do auditor têm a frase de erro "à Vossa Senhoria" (regra `erro_tratamento`). O auditor (Muse) e o Ultra no desempate a julgam correta. O código recusou certo (regra 13).
  - Decisão pedida ao dono em `docs/DECISOES-PENDENTES.md` (recomendo tirar a regra do sorteio até um juiz acertá-la).
  - 2 frases de erro saíram sem erro (escritor). Fica para corrigir.
- **F8 (código):**
  - Leitores de gabarito por banca: 82 de 87 gabaritos do acervo lidos.
    - Recusados: BNB 2024 com "1 7- B" no PDF oficial (o dono confirma o item 17), 2 comunicados da FGV e ESAF 2010.
    - Acervo: "PROVA A - GABARITO 1" é caderno, não gabarito.
  - Incidência (`bb -- incidencia`, `docs/INCIDENCIA.md`) e peso no noturno: peso × (1 + incidência na banca).

- **F6 (tabela em `docs/CATALOGO-MODELOS.md`, evidência em `docs/sondagem-f6/`):**
  - Reranker: não há grátis (os dois endpoints deram 410, fim de vida).
  - OCR: `nemotron-parse` v1 passou no aceite: 10/10 páginas do acervo com ≥ 95% das palavras, 2–7 s cada. O 2.0 está "DEGRADED".
  - Classificador: `bolt-e4b` ficou abaixo do aceite (92,3% × 94,9% do tutor, em 39 casos ambíguos), mas é 5× mais rápido.
  - Visão: `llama-3.2-11b` como candidato. O 90b alterou o texto e foi descartado.
  - Embedding: `3.5-embed-1b` aceita 1024 dimensões (metade do espaço). A troca é do dono.
  - Nenhuma corrente mudou.
- Segurança: um comentário do `.env` contém a chave da NVIDIA e apareceu na saída de um comando meu (eu não filtrei as linhas de comentário). O `.env` nunca foi para o Git. Recomendei ao dono trocar a chave.

- **Decisões do dono (25/10, tarde):**
  - Crase: `erro_tratamento` fora do sorteio (`FORA_DO_SORTEIO`), com pendência de benchmark próprio (≥ 95%, 20 frases). Novas 20 Crase rodando.
  - OCR: `nemotron-parse` v1 ativo, só para páginas sem texto.
  - Classificador e embedding de 1024 dimensões seguem como candidatos.
  - BNB 2024, item 17: o dono vai conferir no PDF.
  - Chave da NVIDIA trocada. Regra: nunca imprimir o `.env`, nem as linhas de comentário.
- **Crase de novo, sem `erro_tratamento` (11:0x–11:46, ~164 s cada): 5/20 aprovadas** (antes 0/20).
  - Recusas: 8 duplicadas (filtro da regra 16; agora é o gargalo), 3 `auditor_por_frase_discordou`, 3 `frase_fora_da_regra` e 1 reprovada na revisão.
  - Próximo ganho provável: mais variedade de contexto/estrutura na Crase, para não cair na impressão estrutural repetida. Não mexi no filtro.
- **F8 (código):** `ingerirProva` aceita `--caderno` e `--questoes 1-35`. Grava `banca`. Recusa gabarito só com C/E lido como múltipla escolha. Atlas em 40% (203,7 MB).
- **F10 (código):**
  - Motor em `shared/certoErrado.ts`: nota com penalidade, "em branco" e derivação.
  - Coleções `itens_ce` e `respostas_ce`. Comando `bb -- derivar-ce` (ainda não rodado).
  - Tela "Certo ou Errado" (servidor + demo + `scripts/e2e-ce.ts`), com filtro por tema.

- **Quatro concursos (decisão do dono, 25/10):** o BB continua e entram TJ-SP (Escrevente Técnico Judiciário) e CVM (Agente Executivo), além do BACEN.
  - Lista única em `IDS_CONCURSO` (`shared/concursos.ts`); schemas, cabeçalho, abas e demo leem dela. Concurso novo = uma linha + o json.
  - `data/concursos/tjsp.json`: Vunesp, 100 questões, 5 h, matérias pelas seções do caderno de 2023. A cota por matéria fica **pendente** (o edital não está no acervo).
  - `data/concursos/cvm.json`: banca a definir, referência FGV. O edital CVM 2024 só teve Inspetor e Analista; usei o Módulo I como referência (LP 10, Mercado de Valores Mobiliários 10, Fundamentos de Direito 10, Fluência em Dados 5, Raciocínio Lógico 5).
  - 8 matérias novas no `DISCIPLINAS`.
  - A aba sem matérias mostra "as matérias ainda estão chegando".
  - Os **72 arquivos (um por tema)** do dono entram quando ele avisar (pasta `72 FONTES/`).

- **Trilha única + abas como lentes (decisão de arquitetura do dono, 25/10):**
  - Catálogo único de temas: 74 = 63 + 8 do TJ-SP (ids do dono) + 3 da CVM (ids `cvm_` provisórios). Os temas comuns ganharam `tjsp`/`cvm` pelas matérias da referência.
  - Ordem por código (`bb -- trilha-ordenar`): nº de concursos (comuns primeiro), peso no edital × (1 + incidência), pré-requisitos. `data/trilha.json` passou de 51 para 74 temas; nenhum saiu.
  - Avanço por tema, uma vez só, sem depender da ordem. O início da trilha grava o subtópico. Migração: backup validado, 0 registros antigos, 0 → 0.
  - "Prontidão para X" (`shared/prontidao.ts`). Testes do dono: o domínio de Crase sobe todos os concursos que a cobram; a aba do TJ-SP só mostra matérias do TJ-SP.
  - Aba "Geral" (padrão) = visão do todo; BB/TJ-SP/BACEN/CVM = lentes.
    - Na Geral, o simulado pede o concurso e o C/E usa a Cebraspe.
    - Histórico de simulados por concurso na lente.
    - Questões do tema de qualquer banca, com filtro de banca e selo "banca · formato".
  - `cvm.json` corrigido: tirei Bancários e Dir. Administrativo, que eu tinha posto e que não estão no Módulo I.
  - **Falta no banco (precisa de embedding, depois da cadeia):** `bb -- arvore --confirmar` cria os 11 tópicos novos e liga os concursos. A simulação mostrou 36 tópicos ganhando tjsp/cvm, nada sai. Fazer com backup antes.
- **Cadeia F8/F10 (em andamento):**
  - BB Tecnologia 2023 ingerida.
  - 2021 falhou (JSON inválido numa janela, nada salvo) e BNDES 2024 falhou (timeout). Repetir.
  - Causa de fundo: a extração usa o auditor do `.env`, que ainda aponta para o Super (fora pela Decisão 0, dá 404) e cai sempre na reserva Ultra. Trocar no `.env` é decisão do dono.
- **TJ-SP Vunesp:** o acervo só tem o caderno de 2023, sem o gabarito. O leitor de gabarito Vunesp fica para quando o gabarito chegar (o formato de pares/grade já é lido pelo `lerGabaritoOficial`).

## 25/10/2026 (tarde) — PROMPT-FECHAMENTO, E1–E14 (substitui a ordem anterior)

- Etapa 1: SIM. Backup verificado antes. Tópicos 74 → 85 (11 novos do TJ-SP e da CVM); por concurso bb 58 → 58, tjsp 0 → 36, bacen 59 → 59, cvm 0 → 23; questões 521 → 521 (iguais). 52 questões sem o campo `concursos` passaram a contar no BB (469 → 521).
- Etapa 2: SIM (`ffede37`). Auditor = Muse → Ultra (`corrente definitiva`; `.env` trocado sem imprimir). A extração passa pela corrente (`auditorJSON`); JSON com barra inválida é reparado (`parseTolerante`); janela que falha é refeita página a página. BB Tecnologia 2021 refeita: 37 extraídas, 33 salvas, 2 não bateram com o PDF (nº 18 e 29, fórmula), 2 sem gabarito. BNDES 2024 rodando na cadeia 2.
- Etapa 3: em andamento. A amostra auditada de 80 roda no fim da cadeia 4, depois da classificação com IA.
- Etapa 4: código SIM (`baf7ba1`): 10 contextos de escrita e 8 estruturas de enunciado em `variacoes.json`, sorteados pelo código (regra 11). As 20 Crase novas rodam na cadeia 2; o resultado entra aqui.
- Etapa 5: SIM (`f8f66fb`). Os 20 primeiros temas da trilha estão conferidos à mão. Ortografia e Números e operações ficam "sem material", com o motivo registrado. Inglês também fica sem material.
- Etapa 6: código SIM (`f1ad12a`, `10310fc`). Estilo por banca: o JSON da banca mais 3 oficiais reais da banca no tema. O noturno roda backup → acervo → ingestão → classificação → fila (com reserva de 45 min) → derivação C/E → fichas → relatório com as etapas → backup. A noite real é a de hoje; o relatório entra amanhã.
- Etapa 7: código SIM (`cad6ac3`). Derivação: 30 itens, 27 aprovados (90%). BACEN 2024 C/E repetido na cadeia 2. Cursinho: na cadeia 4, entram 3 livros Cesgranrio (88 + 66 + 103 gabaritos lidos no ensaio) e as 100 Inéditas BB (C/E, 100 itens).
- Etapa 8: SIM (`0480720`). A Janela B tem horário configurável (18:00–19:00 por padrão), teto próprio de chamadas e tela em Admin → Janelas, com e2e e prints. Agendar no Windows é do dono.
- Etapa 9: código SIM (`c0d8cf4`). 12 leis baixadas só de fonte oficial (~2,4 M caracteres, todas vigentes). A ingestão roda uma por vez na cadeia 3, com o Atlas medido. A tabela fonte → trechos → temas entra quando a cadeia terminar.
- Etapa 12: SIM (`0e3ad53`). `web/vercel.json` faz o rewrite de /api para o Render. O site abre na hora com o Painel guardado e mostra a faixa "acordando o servidor" (e2e: 1,0 s no celular). PWA com versão. O passo a passo está em `docs/VERCEL.md`; o projeto não foi criado e o DNS não foi tocado.
- Etapa 13: PARCIAL (só `web/src`, nada de lógica).
  - Plano: a semana atual é o destaque laranja com cartão branco por dentro; cada atividade tem um ponto colorido com legenda (questões = Binho, revisão e erros = Lo, redação e simulado = verde).
  - Cartões: moldura laranja com o "papel" branco, termo grande em Sora, tecla Espaço e números em pílulas.
  - Raio-X: o convite usa o mesmo destaque do "Plano de hoje"; no celular o mascote sai para não cobrir o título.
  - Conquistas: desbloqueada tem fundo do Binho e selo; bloqueada tem contorno tracejado e mostra o %.
  - Tema: os 3 números ficam lado a lado (novas = Binho; revisões e erros = Lo).
  - Login: marca "Lobo Binho" igual à da barra lateral, com os 4 concursos.
  - Player da Lo: o botão que está tocando agora é turquesa (era laranja; áudio é da Lo).
  - Prints antes/depois (claro e escuro, 360 e 1440) em `docs/telas/visual-final/`, gerados por `scripts/prints-visual.ts`.
  - Mesmos testes, sem alterar nenhum: suíte 256 ok / 0 falha, e2e fluxos, trilha, concurso, ce e janelas verdes.
  - ~~BLOQUEADO~~ → feito com a especificação do dono (abaixo).
- **Espaço da Lo (E13, especificação do dono 25/10):** tela nova no grupo "Com a Lo", turquesa.
  - Regras puras em `shared/espacoLo.ts`, usadas pelo servidor e pelo demo, com 9 testes:
    - "Seu dia" montado por código dos relatórios das janelas A/B, da trilha, da ficha, da aula, do áudio e das revisões, incluindo "o noturno não rodou e a Janela B recuperou";
    - "Recados": selo que mudou (reforço → concluído), ficha ou prova nova nos seus temas desde a última visita, apostila × lei;
    - posição do áudio: "ouvido" a partir de 90%, retomada uma frase (ou 3 s) antes;
    - filtro da biblioteca.
  - Lógica nova como funcionalidade, com teste:
    - Coleção `espaco_lo` por aluno, com a posição de cada áudio e a base dos recados.
    - Rotas `GET /api/espaco-lo` e `POST /api/espaco-lo/posicao` (id validado).
    - Isolamento entre contas cobre as duas rotas.
    - No demo, fica no `localStorage`.
  - "Ouvir no almoço": playlist do tema do dia com transcrição (frase atual destacada), pausar, repetir, velocidade e "Continuar de onde parei".
    - Só conteúdo aprovado: ficha aprovada, aula aprovada com as travas de fonte, pontos conferidos.
    - Áudio sob demanda com cache (`/api/voz`, `naHora`).
    - O leitor ganhou posição inicial, progresso e troca de velocidade no meio.
  - "Áudios da Lo": o que já tem MP3 no cache ou já foi ouvido, agrupado por matéria, com busca e filtro "ouvido / não ouvido".
  - Voz: Louise padrão. Nesta tela o mini-player do rodapé dá lugar ao player com transcrição.
  - Bug achado pelo e2e e corrigido: "Repetir" só pausava, porque tocar o mesmo id alterna pausa.
  - `scripts/e2e-espaco-lo.ts`:
    - demo (quarta com Crase): toca → pausa → 1,5× → recarrega → continua uma frase antes → repetir → ouvido;
    - servidor simulado: Janela B, 3 recados, posição no POST.
    - Verde em 1440 e 360; prints em `docs/telas/espaco-lo/`.
  - Suíte 265 ok / 0 falha.
- Etapa 10: em fila (cadeia 5, depois da 4).
  - Lote 1 BB/BACEN: BB Escriturário 2021/2023 e Tecnologia 2021/2023 já estão no banco; BACEN 2024 C/E roda na cadeia 2.
  - Lote 2 Cesgranrio: BNDES (de novo), Caixa 2021, Banrisul 2022 e BASA 2022 (16–60, sem Legislação), depois incidência.
  - Lote 3 Cebraspe C/E (matérias comuns): Banrisul 2022, BNB 2022 e 2018, TCU 2025, INSS 2022, SUSEP 2025 e TSE 2024, mais o Banrisul 2025 (múltipla escolha), depois incidência.
  - Lote 4 FGV: CVM 2024 (básicos, perfil 4) e CGU técnico, depois incidência.
  - Todos os gabaritos foram lidos antes por código (sem IA).
  - BLOQUEADO: CNU (o acervo não tem gabarito), TJ-SP 2023 (sem gabarito), BNB 2024 (item 17) e ESAF 2010 (gabarito não lido).
  - Fora por pouca relação com os 4 editais: IBGE.
  - Correções nesta etapa:
    - Com `--questoes 21-35`, o que vem antes da faixa sai antes da checagem do gabarito. O BNDES tinha falhado por isso: 15 de 35.
    - Prova que falha na fila do noturno sai da frente e vai para `fila_ingestao_falhas`; antes, ela travava as noites seguintes. Tem teste.
- **Cadeia 2 (fim 19:44):**
  - BB Tecnologia 2021: 33 salvas.
  - BNDES: falhou pela faixa `--questoes` (corrigido, vai na cadeia 5).
  - BACEN 2024 C/E: 50 lidos, 35 salvos, 1 anulado, 14 com fórmula ilegível (conferir à mão).
  - 20 Crase: só 1 tentativa (duplicada) antes do teto diário de 60 gerações. Refazer amanhã.
  - derivar-ce --n 10: 26 de 50 aprovados (52%); 19 itens saíram por "irmão quase igual" (filtro de repetição) e 5 porque o auditor discordou. No total, 53 itens C/E derivados aprovados.
  - Janela B forçada: backup ok, tema de amanhã com 3 aprovadas, 54 chamadas, dentro do teto.
- **Cadeia 3 (19:45–19:54), Etapa 9 SIM nas leis:**
  - As 12 entraram uma por vez, cada uma simulada antes, com o Atlas medido a cada passo.
  - O Atlas foi de 40% para 57% (291,9 MB; cabem ~3.170 trechos até o alerta de 80%).
  - Fonte → trechos → temas:

    | Fonte | Temas (trechos) |
    |---|---|
    | Dec. 1.171/1994 | Princípios da adm. pública 7 · Agentes públicos 6 · Estatuto SP 1 |
    | Lei 9.784/1999 | Atos e processo adm. 21 · Princípios 11 · Improbidade 1 |
    | Lei 12.527/2011 (LAI) | Princípios 20 · Agentes públicos 9 · Atos e processo 9 · Estatuto SP 2 · Improbidade 2 |
    | Lei 8.429/1992 (com a 14.230) | Improbidade 55 · Agentes públicos 2 · Licitações 1 · Princípios 1 |
    | CF/88 (títulos do edital + arts. 164 e 192) | Adm. pública na CF 35 · Direitos e garantias 26 · Princípios fundamentais 5 |
    | Lei 8.112/1990 | Agentes públicos 80 · Estatuto SP 62 · Improbidade 5 · Atos e processo 4 · Licitações 1 |
    | Lei SP 10.261/1968 | Estatuto SP 68 · Agentes públicos 65 · Improbidade 21 · Atos e processo 14 |
    | Código Penal | Crimes contra a adm. pública 254 · Parte geral 13 |
    | Lei 14.133/2021 | Licitações 221 · Improbidade 23 · Princípios 14 · Atos e processo 8 · Agentes públicos 5 |
    | Lei 6.404/1976 | Mercado de valores mobiliários 297 |
    | CPP | Direito Processual Penal 377 |
    | CPC | Direito Processual Civil 585 |

  - Limite conhecido: o Código Penal inteiro foi para "Crimes contra a administração pública" (254 trechos), incluindo crimes que não são do edital. O chat e as aulas citam só trecho literal, mas o tema fica com trechos a mais. Melhorar com `incluirArtigos` (Parte Geral e arts. 312–359) numa próxima ingestão.
  - Livros da CVM e do BCB por capítulo: não feito (falta escolher os capítulos no acervo).
- **E11, golden set do chat com 30 casos:** os 12 do BB mais 18 das leis novas (Administrativo 7, Constitucional 2, Penal 4, Processo Penal 1, Processo Civil 2, CVM 2). Cada artigo foi conferido no texto oficial baixado; 5 casos são pegadinhas sem base. A rodada (IA, em série) vai depois das cadeias.
- Backup: um segundo backup no mesmo dia ganha o sufixo `-HHmm` (antes era recusado e parava a cadeia). A retenção é por dia. Tem teste.

## 26/10/2026 — Noite real (E6) e esteira de Português em lote

- **Noite de 26/10 (E6: SIM):** rodou sozinha pelo Agendador e terminou às 05:20, com código 0.
  - Etapas: backup ok, acervo ok, ingestão pulada (fila vazia), classificação ok, geração e pré-geração ok, derivação C/E 17 de 20 aprovados.
  - Fichas: "nada a fazer".
  - Banco: 417 aprovadas; backup final com 10 coleções, 812 documentos.
- **Cadeias de 25/10:** a sessão caiu às ~20:45 durante a cadeia 4. Antes disso, o cursinho entrou com 81 questões (Bancários QC) e 57 (Mat. Financeira QC). As cadeias 5 e 6 não chegaram a rodar.
- **Esteira de Português em lote (decisão do dono, 26/10): Crase pronta.**
  - LanguageTool 6.6 + Java Temurin 21, oficiais, em `ferramentas/` (fora do Git); servidor só em `localhost:8081`.
  - O PC tem ~4 GB de RAM: com 1 GB de heap o Java ia para o disco e cada frase levava 5–25 s. Agora sobe com 512 MB e coletor serial (`garantirLT`) e confere as frases em lote (25 por chamada).
  - Moldes em `data/moldes-crase.json`: o código monta frase e gabarito; a IA só amplia o sujeito.
  - Benchmark do LanguageTool (`bb -- lt-benchmark`, `data/lt-benchmark.json`):
    - 15 regras com 100%;
    - "à clientes" (plural) com 0%: fica fora;
    - a falta de crase obrigatória ficou em 100% depois de tirar o molde "foi a", que o LanguageTool não pega;
    - "à Vossa Senhoria" o LanguageTool acerta, mas fica fora por decisão do dono.
  - Lote de prova 1: 15 de 15 aprovadas, mas com defeitos. Rejeitei as 15 (nenhuma tinha sido respondida):
    - o vocabulário da IA trouxe "segundo instruções" e "com os stakeholders" → agora só o sujeito vem da IA, com validação;
    - par certo/errado da mesma estrutura ("frente a frente" × "frente à frente") → regra do núcleo do trecho e regra dos erros espelho (`ESPELHOS`).
  - Lote 2: 6 aprovadas, 4 delas com espelho → rejeitadas.
  - Lote 3 (final): **15 aprovadas num lote só**, em ~10 min.
    - Taxas: 750 frases → posição 0% · LanguageTool 0% (as regras já vêm filtradas pelo benchmark).
    - 18 candidatas → 3 parecidas (17% de repetição).
    - Amostra de IA: 15/15 frases concordam no acumulado.
  - No noturno: etapa "esteira de Português" depois da classificação. Ela só gera se a Crase tiver menos de 15 novas para o dono (hoje são 40).
  - Oficiais primeiro: `proximaDoTema` sorteia nas novas na ordem oficial → cursinho → gerada.
  - A regra 13/14 do CLAUDE.md foi atualizada.
  - Pendências pequenas:
    - às vezes uma palavra se repete entre o sujeito e o complemento ("O correntista … à uma correntista");
    - algumas introduções saem esquisitas ("relatório sobre aviso sobre…").
  - Concordância, Regência e Pontuação continuam no fluxo antigo até ganharem moldes.

## 26/10/2026 (manhã) — Esteira de conteúdo (decisão do dono)

1. **Meta de pronto e Cobertura (commit `b023d8b`):**
   - Pronto = ≥ 15 novas para o dono (múltiplas e itens C/E) + ficha aprovada + áudio da ficha.
   - Admin → Cobertura: cartões por concurso, "Esteira agora", lista com filtros. e2e e prints 1440/360.
   - Dados reais: 0 de 74 prontos, 59 faltando e 15 bloqueados (13 por falta de material do acervo para a ficha, 2 por falta de fonte ou tópico).
2. **Ordem de fonte:**
   - No tema, as novas saem oficial → cursinho → gerada.
   - A esteira deriva C/E do próprio tema antes de gerar.
   - Na Crase, a geração vai pela esteira de Português.
3. **Diversidade:**
   - Derivação C/E com no máximo 3 itens por questão (`CE_ITENS_POR_QUESTAO`): a certa + as erradas cujas explicações menos se parecem.
   - Antes eram 5 por questão, e 19 de 50 caíam como "irmão quase igual".
4. **Capacidade real (`bb -- capacidade`):**
   - Nenhum 429 em 7 dias de telemetria. Com um job por vez, as chamadas saem em série e quem limita é a latência, não o provedor.
   - O orçamento grava só limite visto (minutos com 429); sem isso, 40/min (conta grátis da NVIDIA).
   - O balde fica na corrente: espera curta ou passa a vez ao próximo modelo.
   - `GERACAO_MAX_DIA` deixou de ser teto padrão (só vale se definido no `.env`, que hoje não define).
5. **Amostra 1/10:** só na esteira de Português, o único fluxo com benchmark que o valida (LanguageTool 100%). Derivação C/E, geração e Matemática por construção seguem com auditoria completa, porque nelas o auditor é a única checagem de sentido.
6. **Código Penal por partes:**
   - Parte Geral (arts. 1º a 120): 56 trechos → "Direito Penal: parte geral".
   - Arts. 312 a 359: 47 trechos → "Crimes contra a administração pública".
   - O resto ficou fora; o CP inteiro foi revogado (267 trechos, nada o citava).
   - Novos campos `faixaArtigos` e `assunto` no catálogo de fontes (testados).
   - Livros CVM/BCB por capítulo: ainda não feito.
7. **Primeira rodada real da esteira (`bb -- esteira --n 2`):**
   - Tema 2 (Classes de palavras) ficou **PRONTO**: ficha aprovada e áudio gravado.
   - Tema 1 (Interpretação): ficha pendente (material só de cursinho, abaixo do mínimo de afirmações vigentes). A esteira só tenta de novo depois de 3 dias.
8. **Noite:**
   - A etapa "esteira de conteúdo" vem depois da classificação e deixa 2h30 para a fila de sempre.
   - "Relatório da esteira" no fim: temas prontos × total por concurso, chamadas × capacidade, descarte por motivo.
   - Também roda à mão com `bb -- esteira relatorio`.

## 26/10/2026 — Fechamento de versão v1.0-estudo (congelada)

- Esteira de conteúdo (rodada de 6 temas): Concordância PRONTO (agora são 2 de 74 prontos). Regência e Pontuação chegaram a 15 novas; as fichas de Pontuação, Coesão e Interpretação foram barradas pelo material.
- Item 0: SIM. Backup restaurado num MongoDB local em memória (o usuário do Atlas não cria outras bases), 15/15 coleções iguais. O backup passou a levar respostas C/E, simulados, espaco_lo, itens C/E e fichas; backup antigo continua restaurável (teste). `402a79c`.
- Item 1: SIM. `vercel.json` com CSP igual à do Express (0 violações no build de produção), cache imutável, `index.html` sem cache, `npm ci`, Node 22.x. `66256f3`.
- Item 2: SIM.
  - `npm run smoke`: 31,5 s local, contra o servidor de produção num banco em memória.
  - `/api/saude` mostra a versão e o último noturno.
  - Selo "noturno atrasado" e Admin → Erros, sem dados sensíveis.
  - Commits `fa86dbb` e `2395528`.
  - O cookie não precisou de correção (`SameSite=Lax`, sem `Domain`).
- Item 3: PARCIAL. A vigência só vale para tema normativo; teste escrito antes, falhou, corrigi e passa. A ficha de Interpretação regerada 2x foi rejeitada por outro motivo (só 2 de 5 trechos literais no material). Nenhuma outra ficha caiu pela vigência. `1b4eaf7`.
- Item 4: SIM. `IA_TETO_DIA` (300), disjuntor de 5 falhas → 30 min com registro, e o segundo noturno sai sem fazer nada. Os três têm teste. `120715d`.
- Item 5: SIM. Tarefa com acordar o PC, rodar se perdido e limite de 5 h; idempotência provada (classificação e C/E); logs e backups com 14 dias; alerta do Atlas acima de 70% no relatório. `923cc09`.
- Item 6:
  - Varredura de segredos no histórico: 3 URIs, todas de exemplo (.env.example, teste "fake", teste de limpeza). Nenhum segredo real.
  - `npm audit`: `body-parser` 2.4.0 (alta corrigida sem trocar a versão maior); sobra 1 moderada em dependência de desenvolvimento (`fast-uri`).
  - Tag `v1.0-estudo` e `docs/RETOMAR.md`.

RETOMAR AQUI (26/10/2026): ver `docs/RETOMAR.md` (versão v1.0-estudo congelada). Daqui em diante: só esteira de conteúdo e correções.

## 27/10/2026: v1.1 (estudo sequencial)
- Item 1: SIM. Sessão do tema só traz o tema: revisões do tema → novas do tema; a mistura ficou só em Simulado e Revisões. Teste `shared/sessaoTema.test.ts` + e2e-trilha (0 pedidos sem o tema). `52bc66e`, Render `dep-dbgceufb9u1s73cst1h0` live.
- Item 2: SIM. Grade curricular sem IA (`shared/grade.ts`): 12 matérias, todos os temas da trilha encaixaram.

  | Matéria | Disciplinas |
  |---|---|
  | Português | lingua_portuguesa |
  | Matemática e Financeira | matematica, matematica_financeira, probabilidade_estatistica |
  | Raciocínio Lógico | raciocinio_logico |
  | Informática | informatica, fluencia_dados |
  | Conhecimentos Bancários | conhecimentos_bancarios |
  | Atualidades | atualidades_mercado_financeiro, atualidades |
  | Vendas e Negociação | vendas_negociacao |
  | Direito | constitucional, administrativo, penal, processual civil, processual penal, fundamentos |
  | Inglês | lingua_inglesa |
  | Específicas TJ-SP | normas_corregedoria |
  | Específicas CVM | mercado_valores_mobiliarios |
  | Específicas BACEN | gestao_publica, suporte_tecnico_administrativo |

  - Tema concluído = ≥ 70% nas últimas 20 do tema (`CONCLUIR_ACERTO`/`CONCLUIR_ULTIMAS`; tema com < 20 aprovadas fecha com todas, mínimo 5). Testado.
  - Tela Grade (grupo Binho): aba por matéria, status, % nas últimas, próximo passo, subtemas do edital, "próximo da sequência" em destaque; lentes de concurso filtram.
  - Plano segue a grade (`filaDaGrade` + item `tema`): matéria por matéria, tema por tema; sem a grade carregada, o rodízio antigo continua igual (nada apagado; o plano é calculado, não guardado).
  - e2e-trilha com Grade e Plano; prints em `docs/telas/v1.1/grade-{desktop,celular}.png`.
- Item 2, ajustes do dono (27/10):
  - "Concluído provisório": tema com < 15 aprovadas que bate a meta (≥ 70% em todas, mínimo 5). Marca discreta, não conta no "x/y" da aba, libera o próximo da sequência. Quando chegam questões novas, a meta passa a ser todas as aprovadas e o tema volta a "em andamento" (e a próximo, se for o primeiro aberto). Vira "concluído" com ≥ 15 aprovadas e ≥ 70% nas últimas 15 (20+ aprovadas: últimas 20).
  - Tema do dia do Painel = próximo da sequência da Grade (mesma fonte do Plano). "Fazer deste o tema do dia" ou "Treinar este tema" fora da sequência = escolha manual (`ajustes.estudando`): o Painel mostra esse tema com "a sequência segue em X · Voltar à sequência"; Grade e Plano não mudam; não chama mais `/api/trilha/inicio`. Tema escolhido que fecha sai sozinho.
  - Testes: `shared/grade.test.ts` (provisório, volta com questão nova, tema do dia manual sem mudar a sequência) e e2e-trilha. Suíte 300 ok / 0 falha.
- Item 3: SIM. Estudo do tema.
  - Fluxo da sessão: aula (aba Aula abre primeiro se ainda não vista) → revisões do tema → novas do tema por subtema do edital, fácil → difícil (empate: oficial, cursinho, gerada) → revisão dos erros do tema (as que ainda estão erradas, até 10, inclusive as de hoje) → resultado com o status do tema pela regra da Grade (concluído / provisório / em andamento + próximo passo).
  - Subtema da questão achado por código (palavras do subtópico do edital no enunciado e alternativas), sem IA; aparece na lateral da sessão.
  - Revisões misturadas e Simulados: só temas concluídos (inclui provisório); se nenhum concluído, os em andamento; nunca tema não iniciado. O Raio-X (diagnóstico) continua olhando tudo. Cache de 60 s no servidor.
  - `shared/estudoTema.ts` (+ testes), `src/estudoTema.test.ts` (servidor em memória: ordem, erros, mistura), e2e-trilha com a etapa de erros (4 erradas voltam, 4/4) e status "concluído".
  - Atenção: o número "revisões para hoje" do Painel ainda conta todas as vencidas; as de temas em andamento continuam vindo dentro da sessão do tema.
- Item 3, ajustes do dono (27/10):
  - Simulado em dois modos: "Prova completa" (padrão: todas as matérias nas cotas da prova, sem restrição de tema) e "Só o que estudei" (temas concluídos/provisórios; se nenhum, os em andamento). Raio-X segue olhando tudo. API: `simulado(n, { modo })`, `?modo=estudado`.
  - Tema escolhido à mão ("estudando") agora fica no servidor, por aluno (`config` `estudando:<aluno>`, rotas `GET/POST /api/estudando`): vale no celular e no PC. No demo, no navegador. O valor que ficou nos ajustes locais (versão da manhã) sobe uma vez para o servidor e sai do navegador.
  - Testes: `src/estudoTema.test.ts` (Mongo em memória: completa inclui tema não iniciado, estudado não; estudando por aluno, A ≠ B, tema inválido recusado) e e2e-trilha (padrão = completa, modo=estudado; outro aparelho vê a escolha; migração). Suíte 305 ok / 0 falha; ISOLAMENTO 205 ok / 0 falha.
- Deploy: os builds do Render de `3d03570` e `c4b0d24` falharam no `tsc` do site (variável `mistura` repetida no simulado do demo; `usuario.id` que não existe no DTO). O `npm run typecheck` não pegou porque `npm --prefix web exec tsc` rodava na raiz e checava o servidor de novo. Script corrigido para `tsc --noEmit && tsc --noEmit -p web`, e `npm --prefix web run build` passa antes do commit. Até este deploy, o ar estava em `363cb7b`.
- Vercel conferido (pedido do dono): produção `lobo-binho-dineilton-s-projects.vercel.app` aponta para `dpl_AyotcfXtpF5P7ZtrnU9irKFXmdvj` = commit `f21f6d4` (Ready). Os builds de `3d03570` (`dpl_4g5Mnm5…`) e `c4b0d24` (`dpl_EeAmaDeb…`) falharam só no `tsc` do site (mesmos erros do Render: `mistura` repetida; `usuario.id`). Regra daqui pra frente: "no ar" = Render live + Vercel Ready.
- Defeito achado na conferência: pelo Vercel, toda rota `/api/<um nível>` (saude, painel, proxima, estudando…) chegava ao Render como `/api/saude*` ("Cannot GET"); as de dois níveis funcionavam. Sem `/api/saude` o site cai no demo. Causa: rewrite `"/api/:path*" → ".../api/:path*"`. Corrigido para regex `"/api/(.*)" → ".../api/$1"`.
- Rota do painel do Vercel: a regra "API para o Render" (criada em 26/10 no dashboard, padrão `/api/:path*`) tinha precedência sobre o `vercel.json` e mandava `/api/saude*` ao Render (o site pelo Vercel abria no demo). Desativada com OK do dono (não apagada; descrição registra o motivo) e publicada. Conferido: `/api/saude` pelo Vercel = `{"ok":true,"versao":"d7ab7fc"}`.
- Item 5: PARCIAL (código pronto; gate BLOQUEADA hoje pelo teto de IA).
  - Dentro do tema (página do tema e sessão do tema), o chat recebe: a ficha aprovada do tema como trechos literais citáveis (título com arquivo, página e camada) e até 5 questões que o aluno ainda está errando no tema, com gabarito e explicação conferidos (regra 19: nunca contradizer; o auditor também confere isso). Fora de tema, o chat geral de sempre. Cache por tema + erros + pergunta.
  - A resposta mostra "Tema X · N trecho(s) da ficha · considerou N questão(ões) que você errou" e as fontes.
  - Gate: `bb -- eval-chat gate` = golden 30 (0 invenções aceitas, ≥ 85% aprovados) + 5 casos do tema (`docs/eval/chat-tema.json`: fonte da ficha no BCB, "não achei" no BCB, crase, gabarito de questão errada, aluno insistindo em outra letra; 0 contradições, ≥ 4/5). Grava `config.chat_tema`. Falha de infraestrutura não decide.
  - Até a gate passar: "Chat do tema em ajuste" (responde pelo tópico, sem ficha e erros).
  - Rodada de hoje: 0/5 com 5 falhas de infraestrutura: o `IA_TETO_DIA` (300) já estava esgotado pela noite e pela esteira. Não contornei o freio. Status: em ajuste.
  - Testes: `src/evalChat.test.ts` (verificador e decisão da gate), `src/estudoTema.test.ts` (contexto do tema e trava, Mongo em memória), e2e-trilha (chat na página do tema leva o tema e mostra o contexto). Suíte 307 ok / 0 falha; ISOLAMENTO 208 ok / 0 falha.

## 27/10/2026 (noite): fechamento v1.1
- Item 1 (teto de IA): SIM. Chamadas por dia (telemetria, sem voz/embed/benchmark): 21/10 0 · 22/10 357 · 23/10 436 · 24/10 21 · 25/10 992 · 26/10 221 · 27/10 343. Maior dos últimos 7 = 992 → `IA_TETO_DIA=1984` (no .env do PC e no Render). Reserva `IA_RESERVA_PRIORITARIA=120`: comando em lote (noturno, esteira, geração) é FUNDO e para em 1864; chat/tutor do aluno (servidor) e a gate (`comPrioridade`) vão até 1984. Leitura adotada: reserva sempre livre (a leitura "fundo só depois de 120 prioritárias" travaria a madrugada). Teste em `src/corrente.test.ts`.
- Item 2 (gate do chat): agendada. 1ª etapa do noturno de 28/10 (01:00): `rodarGateChat` (30 + 5) como prioritária, uma vez por noite e só enquanto não liberado. Resultado vai para `config.chat_tema` com os casos que falharam e por quê, e para a etapa "gate do chat do tema" do relatório da noite.
- Item 3 (prova da aula completa): agendada logo depois da gate. `src/aulaTema.ts`: uma seção por subtema (Concordância: sujeito composto, verbos impessoais, haver e fazer, concordância ideológica; Porcentagem: grandezas proporcionais, regra de três composta, aumentos e descontos sucessivos), escritor "tutor" + auditor de outra família por seção; citação literal por código; origem A/B/C/conceito decidida por código; seção reprovada = "em preparo". Coleção nova `aulas_tema` (nada apagado). Tela do tema mostra a aula com seções navegáveis, contraexemplos da Lo e áudio da Lo por seção. Só a prova (`PROVA_AULA_TEMA`); esteira só depois do OK do dono.
- Item 4 (checagem de liberação): SIM, exceto o smoke com login.
  - typecheck (servidor e site) ok; suíte 310 ok / 0 falha; ISOLAMENTO 211 ok / 0 falha; build do site ok.
  - e2e 360/1440: trilha (com Grade, Plano, tema, aula completa e chat do tema), concurso, cobertura, janelas, espaço da Lo, C/E e fluxos verdes. O e2e de concurso achou um defeito real: com `/api/trilha` nulo (servidor antigo) o Painel quebrava na `useGrade`; corrigido (dado incompleto = sem grade, volta ao plano de antes).
  - `npm run smoke` contra a Vercel: `/api/saude` ok (versão `8a6843c`); para no login. **Precisa da conta do dono** (`SMOKE_EMAIL`/`SMOKE_SENHA`).
  - Backup + backup-testar com o banco parado (nenhum noturno/esteira rodando): `backups/2026-10-27-1714`, 16/16 coleções iguais. O backup passou a incluir `aulas_tema` e `config.estudando:<aluno>` (só o subtópico); backups antigos seguem restauráveis. Teste em `src/backup.test.ts`.
  - Rotas do painel da Vercel: 1 regra, desativada; fonte única = `web/vercel.json`.
  - Varredura de segredos no diff `v1.0-estudo..HEAD` (59 arquivos): nada (URI com credencial, nvapi, sk-, ghp_, chave privada, senha/token literais, `.env`).
- Item 5 (plano de volta): SIM. `docs/RETOMAR.md` com a volta para `v1.0-estudo` em < 5 min (Render rollback `dep-dbfm36gn74is73etrp2g` ~2 min; Vercel Instant Rollback `dpl_2fjxuG55Fbtmo2oeRmcQ8c9RdyCG`; conferir `/api/saude`; `git checkout v1.0-estudo` no PC para o noturno; banco não precisa de nada: a v1.1 só acrescentou). Simulação: worktree da `v1.0-estudo` com as mesmas dependências → build do site ok e `smoke-local` da v1.0 (servidor de produção, banco em memória) ok em 51 s (`/api/saude` = `b65df5e`, Painel do servidor, responde e desfaz). Risco anotado: o rewrite antigo do `vercel.json` da v1.0 pode repetir o `/api/saude*`; o RETOMAR diz o que fazer (manter a frente da v1.1, compatível com o servidor da v1.0).

RETOMAR AQUI (27/10/2026): v1.1 fechada (tag `v1.1`). Noturno de 28/10, 01:00: gate do chat (1ª etapa) e prova da aula completa (Concordância e Porcentagem). De manhã: ler o relatório da noite (etapas "gate do chat do tema" e "aula completa (prova)"), tirar os prints da aula e pedir o OK do dono. v1.2 (visual) começa com perguntas.

## 28/10/2026: relatório da noite e decisões da manhã
- Noite de 28/10: 11 etapas, nenhuma falhou (01:04–04:55); 342 de 1984 chamadas; 29 questões aprovadas de 54 planejadas (63 descartadas); banco 476 → 506; cobertura 4/74 (eram 2); Admin → Erros vazio. Noites seguidas OK: 1/5 (27/10 teve "fichas" falhou).
- Gate na noite: INDEFINIDA (35 respostas "ocupado"): dentro do noturno o chat recusa trabalho (fila ocupada pelo próprio noturno e janela 01:00–05:30). Decisão do dono: a trava fica; a gate só roda de dia. Saiu do noturno (a prova da aula também).
- Item 1 (gate de dia, 05:47): NÃO passou → chat do tema segue "em ajuste".
  - Golden: 20/30 aprovados (67%; meta 85%), 0 invenções aceitas, 0 falhas de infra.
  - Tema: 2/5, 0 contradições.
  - Falharam:
    - "não achei" onde havia base: kb-servicos-essenciais-cmn3919, vendas-lgpd-protecao-credito, informatica-phishing, adm-9784-principios, adm-14133-modalidades, ppenal-flagrante, tema-crase-masculino, tema-crase-insiste.
    - Respondeu sem citação conferida: adm-8112-investidura, cf-art1-fundamentos, cvm-6404-companhia.
    - O auditor barrou o art. 316 sem citação: penal-concussao.
    - Explicou o gabarito D certo, mas sem dizer a letra (o verificador exige a letra): tema-concordancia-erro.
- Item 3: contador "noites seguidas OK: N/5" (`shared/noites.ts`, teste) no relatório da noite (etapa própria) e no Admin → Janelas.
- Item 2 (aula completa, desenho novo): PARCIAL. Resultado 5/7 seções aprovadas (71%; meta 80%).
  - Desenho:
    - Material por código: banco de regras `data/aulas/concordancia.json`, com regra = trecho literal do acervo (conferido em acervo-indice) e exemplos das alternativas oficiais (certo/errado pelo gabarito do banco) ou literais do acervo; exemplo certo passa pelo LanguageTool local.
    - Matemática: `src/aulaMatematica.ts` com números, exemplos e resultados conferidos com mathjs; moeda sempre R$.
    - A IA só redige a explicação e o resumo.
    - Checagens por código antes do auditor: moeda, LaTeX cru, frase/exemplo fora do material, número fora do material (Matemática) e [N] inexistente.
    - Auditor com checklist (regra certa, exemplo do tema, pegadinha verdadeira, não contradiz gabarito); até 2 tentativas por seção.
  - Porcentagem 3/3 aprovadas (1.317 palavras).
  - Concordância 2/4 (verbos impessoais, haver e fazer):
    - sujeito composto: a IA escreveu "verbo sempre no plural", contra a regra; o auditor barrou;
    - concordância ideológica: sem material literal no acervo.
  - Erros meus corrigidos no caminho (achados pelo auditor): um contraexemplo oficial ligado à regra errada (núcleos femininos) e um exemplo de porcentagem na seção de grandezas proporcionais.
  - Defeitos que passaram e você vê nos prints: itálico cru (`*haver*`) e uma frase sem sentido em "verbos impessoais".
  - Três rodadas de dia (≈ 60 chamadas). Prints 360/1440 enviados. Não foi para a esteira.
- Item 4 (fichas sem material): nenhuma publicada.
  - Pontuação (3 oficiais): rejeitada 2x; a 1ª por JSON, a 2ª com só 2 afirmações com trecho literal (mínimo 3).
  - Coesão (5 oficiais): o auditor aprovou, mas as afirmações saíram em inglês e rasas. Voltei para "rejeitada" (motivo registrado) e o código passou a barrar afirmação em outra língua (teste).
  - Interpretação (12 oficiais, "escrita pelo Lobo"): rejeitada pelo auditor (só 1 afirmação ficou).
  - `bb -- fichas questoes [lobo] --tema X` e `bb -- ficha-ok <tema>` (OK do dono) ficam prontos.
  - Achado: o acervo tem regras de pontuação com texto literal (ex.: Revisão de Véspera Caixa 2024, pp. 81–82); o mapa do tema aponta para páginas erradas.
- Deslize: editei por script duas vezes (remoção do bloco antigo de prompts em `src/prompts.ts` e uma linha de import em `src/fichas.test.ts`), contra a regra do CLAUDE.md. Conferi no diff: só o bloco/linha mudou, sem escape perdido.
- Verificação: typecheck (servidor e site) ok; suíte 314 ok / 0 falha; ISOLAMENTO 214/214 (uma 1ª rodada teve 4 falhas por falta de memória, com o LanguageTool aberto); build do site ok; e2e trilha e janelas verdes.

## 28/10/2026 (tarde): busca do chat, aula por matéria, auditor, Pontuação
- Item 1 (chat, consertar a BUSCA; meta 85% fica). Causa de cada "não achei" da gate da manhã:

  | Caso | Trecho no banco? | No top-k? | Causa |
  |---|---|---|---|
  | kb-servicos-essenciais-cmn3919 | sim | sim (1º) | a resposta caiu depois, na citação |
  | vendas-lgpd-protecao-credito | sim | sim (1º) | tutor marcou "sem base" |
  | informatica-phishing | não há norma (conceito) | — | tutor marcou "sem base" duas vezes (conceito estável) |
  | adm-9784-principios | sim | não | detector de artigo |
  | adm-14133-modalidades | sim ("Art.\n28.") | 5º, sem prioridade | detector exigia "nada de ponto" depois do número (todo art. ≥ 10) |
  | ppenal-flagrante | sim ("Art. 302.") | sim, sem prioridade | detector + limite de 300 trechos (CPP tem 377) |
  | tema-crase-masculino / insiste | não (ficha sem "masculino"; tópico com 0 trechos) | — | sem base nas fontes; tutor não explicou como conceito |
  | 8.112, CF art. 1º, 6.404 (responderam sem fonte) | sim | sim (1º) | tutor citou [1] certo, mas a frase não tinha palavra "legal" da lista: saía sem a fonte conferida |

  - Correções:
    - busca híbrida: texto exato do artigo/norma em qualquer fonte, vetorial sem filtro de tema/concurso e o tópico inteiro (até 1.500 trechos); k = 8;
    - detector de artigo aceita "Art. 28." e "Art.\n302.";
    - citação tolerante a espaço, quebra de linha, hífen, aspas e travessão do PDF (nunca a sentido);
    - citação conferida do tutor anexada;
    - prompt: dizer a letra do gabarito.
  - Gate de novo, de dia: Golden 23/30 (77%; antes 20/30), 0 invenções; Tema 3/5 (antes 2/5), 0 contradições. NÃO passou: chat do tema segue em ajuste.
  - Ainda falham:
    - kb-pld-comunicacao-lei9613, vendas-lgpd-protecao-credito, informatica-phishing, cf-art37-principios, penal-peculato, penal-concussao e ppenal-flagrante: quase todos em "afirmação sem trecho literal que a sustente" (o trecho certo chega, mas a frase do tutor parafraseia demais para ancorar);
    - os 2 de crase: sem base.
  - Variação: 3 que tinham passado de manhã falharam agora (PLD, art. 37, peculato).
- Item 2 (aula):
  - Matemática: itálico/negrito renderizados no Markdown (`*x*`, `_x_`; "2 * 3" fica como está), com e2e. Prints de Porcentagem 3/3 enviados; esteira de Matemática aguarda o OK.
  - Português: proposta em `docs/PROPOSTA-BANCO-CONCORDANCIA.md`:
    - o que o LanguageTool valida (sonda: 15/32 pares; só as regras de haver/existir, haver-fazer de tempo e "se" apassivador);
    - tamanho: ~4 sessões;
    - 3 perguntas ao dono.
- Item 3 (auditor): `bb -- avaliar-auditor` (20 casos com erro plantado, teste).
  - Pegou 16/20 (80%; meta 90%).
  - 3 dos 4 que passaram foram falha de JSON do próprio auditor nas fichas (não julgou); o único erro que ele deixou passar de fato foi a frase sem sentido.
  - Proposta abaixo do relatório do dia.
- Item 4 (Pontuação): mapa corrigido (Revisão de Véspera Caixa 2024 pp. 81–82, `data/temas.json`) e ficha pelo caminho normal: 6 afirmações com trecho literal achado; o auditor reprovou 5 → rejeitada.
- Item 5: regra registrada (edição só pelo editor; próximo deslize, parar e avisar antes do commit). Hoje à tarde: nenhum código editado por script.
