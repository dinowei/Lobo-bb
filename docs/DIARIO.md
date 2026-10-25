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

RETOMAR AQUI — ordem do dono (25/10/2026), nesta sequência:
1. FEITO: visual da madrugada testado, com prints, commitado (`14834cb`).
2. AGORA: PROMPT-LOBO-BB-BACEN de F8 até F14. Toda tela nova já nasce no estilo novo (cores, barra lateral, cartões do mockup).
   - F8: ingerir as Cesgranrio, uma por vez, com o Atlas medido antes e parada em 80%: BB Agente de Tecnologia 2021/2023 (`--caderno 1 --questoes 1-35`), BNDES 2024 (só as matérias do BB) e CNU 2024. Depois `classificar-subtopicos --ia` e `incidencia`.
   - F10: rodar `derivar-ce --n 6` (meta: 30 itens com taxa de aprovação). Ingestão das provas C/E da Cebraspe (BACEN 2024): o número e o gabarito vêm do código (`lerGabaritoOficial(..., "certo_errado")`); a IA só copia o texto, que o código confere literalmente; item com símbolo de fórmula ilegível (ᡈ, 㐈) fica para conferir. Importar as questões de cursinho (origem "cursinho", camada C).
   - Depois F9, F11, F12 (estilo por banca; uma noite real com todas as etapas; fichas no noturno), F13 e F14, intercalando o que falta da V2 (Janela B, orquestração por contrato).
3. POR ÚLTIMO: voltar ao PROMPT-VISUAL-FASE-FINAL e terminar Plano, Cartões, Raio-X, Conquistas, Tema, login e player da Lo. Mesma trava: sem mexer em lógica.
