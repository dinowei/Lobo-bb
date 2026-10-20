# Lobo Binho: documento mestre

Este é o único documento de estado do projeto. As regras de código e o mapa estão no `CLAUDE.md`. O histórico completo dos docs antigos está na tag git `docs-antes-da-limpeza`.

Marcas usadas:
- [CONFIRMADO]: medido no banco, código, teste ou commit, com data.
- [HISTÓRICO]: fato antigo.
- [PENDENTE]: ainda falta medir.

---

## 1. O que é + regras de ouro

App de estudo para o concurso de Escriturário do Banco do Brasil, para o dono e alguns amigos. Tem:
- banco de questões: provas oficiais + geradas e auditadas;
- explicação de cada alternativa;
- revisão espaçada;
- simulado fiel ao edital, redação, aulas, cartões e chat por tópico;
- gamificação, com o mascote Binho e a voz da Lo.

Não é produto à venda. A infraestrutura é só a que já existe: Render free, Atlas M0, NVIDIA grátis e o PC do dono à noite.

Regras de ouro (detalhe no `CLAUDE.md`, regras 1 a 19):
- Gabarito oficial nunca passa por IA. Questão gerada só é aprovada se o auditor acertar sem ver o gabarito.
- Quem confere nunca é da família de quem escreveu (regra de família).
- Bancários, Atualidades e Vendas só com fonte oficial ingerida e citação literal.
- O chat do Binho diz "não achei" em vez de chutar.
- Só modelos grátis da NVIDIA.
- Leis só de planalto.gov.br, bcb.gov.br (inclui a API pública) e in.gov.br.
- Nunca imprimir nem commitar chave ou `MONGODB_URI`.
- Push só com o repositório privado.
- Nunca apagar progresso, tentativas, contas ou redações.
- Um job de IA por vez; nenhum entre 00:45 e 05:30 fora do noturno.
- Visual fixo: escuro, laranja #ff5b1f, Inter.

## 2. Estado em números

| Item | Valor | Marca |
|---|---|---|
| Questões | 374: 294 aprovadas, 73 rejeitadas, 4 desatualizadas, 2 `precisa_imagem`, 1 contestada | [CONFIRMADO 20/10/2026, `bb -- status`] |
| Origem | 137 oficiais, 237 geradas | [CONFIRMADO 20/10/2026] |
| Meta do banco | 1.200 aprovadas | [HISTÓRICO, decisão do dono] |
| Atlas | 198,9 de 512 MB (39%), 1.560 trechos, 42 fontes ativas | [CONFIRMADO 20/10/2026, `bb -- uso-banco`] |
| 1ª noite pelo Agendador (20/10) | 343 tarefas, 100 aprovadas; o backup não rodou (o prazo do wrapper venceu antes) | [CONFIRMADO, DIARIO F1] |
| Backup no fim da noite | corrigido (`--ate 05:25` + 5 min de folga); ainda não houve noite com backup automático | [PENDENTE: noite de 21/10] |
| Chat do Binho, golden de 12 | 0 invenções aceitas; "não achei" 1/1; úteis com base 6/8 (meta 7) | [CONFIRMADO 20/10/2026, DIARIO F2] |
| Bancários (20 oficiais) | 8 confirmadas, 1 "mudou" (esperando OK), 11 pendentes | [CONFIRMADO 20/10/2026, DIARIO F3] |
| Gerador (8 tópicos de maior peso) | n=1: 1/8; n=2 nos 7 que falharam (prompt novo): 3/14; motivo nº 1 `reprovada_na_revisao` | [CONFIRMADO 20/10/2026, `bb -- eval-gerador`] |
| Testes | suíte `npm test` sem falhas; isolamento entre contas 4/4 (`ISOLAMENTO=1`) | [CONFIRMADO 20/10/2026] |
| Lighthouse (celular) | Acessibilidade 100, Boas práticas 100, Desempenho 96 calibrado | [HISTÓRICO 18/10/2026] |

## 3. Funciona / quase / falta

**Funciona:**
- treino, revisão, simulado fiel (cotas exatas, 5 h, pontos da banca), Raio-X e plano até a prova;
- caderno de erros com "Estudar ouvindo", redação (25 a 30 linhas, nota estimada), cartões, Elo;
- login com convite, menu da conta, Admin (IA, Fila, Benchmark, Pendências, Convites, Contas);
- noturno no Agendador, backup e restauração simulada, PWA e modo offline;
- isolamento entre contas, testado.

**Quase:**
- Chat do Binho: seguro (invenção zero), mas útil em 6 de 8 casos com base.
- Aulas: poucas aprovadas por noite (DECISOES nº 9).
- Bancários: 11 oficiais sem base atual (DECISOES nº 13).
- Site acordado: o workflow existe, mas toda execução do Actions dá `startup_failure` sem job (conta/cobrança do GitHub; ver seção 5).

**Falta:**
- conta de admin do dono;
- 1ª noite com backup automático confirmado;
- MCR consolidado (não existe na API do BCB);
- glossário de Vendas liberado.

## 4. Decisões abertas

Abertas (detalhe em `docs/DECISOES-PENDENTES.md`, que a tela Admin → Pendências lê):
- **nº 1** Glossário de Vendas: ler e liberar com `bb -- liberar-fonte "Glossário de Vendas"`.
- **nº 2** Conta de administrador: só o dono cria (senha dele).
- **nº 3** Classificar os 20 pares de similaridade (`docs/CALIBRAGEM-SIMILARIDADE.md`).
- **nº 9** Aulas com poucas aprovações: trocar escritor ou restringir a tópicos com fonte curta.
- **nº 13 / 1d** Bancários: 11 oficiais sem base. Proposta: "não se aplica" para conceito de mercado, CVM 175/2022 para fundos, MCR manual.
- **1b** BB 2023 Q40 "mudou": a aprovação já está registrada; conferir em Pendências.

Resolvidas (uma linha cada):
- corrente definitiva (18/10);
- Informática "não se aplica" e fontes de Vendas (18/10);
- voz Louise/Lo e poses (18/10);
- linhas e aviso da redação (18/10);
- mistura do simulado 20/50/30 (18/10);
- Lighthouse (18/10);
- espaço do Atlas (19/10);
- matemática por construção (19/10);
- normas do BCB Pix/PLD/tarifas (19/10);
- Q51 BB 2021 mantida (19/10);
- figura no texto e duplicada (20/10, F9).

## 5. Pendências do dono (passo exato)

1. **Publicar no Render:** painel do Render → serviço `lobo-binho` → *Manual Deploy* → *Deploy latest commit*. Depois abra `https://lobo-binho.onrender.com/api/saude` e confira `{"ok":true}`.
2. **Criar sua conta de admin:** no PC, `npm run bb -- criar-admin <seu-email>`. Ela pede a senha e leva o seu progresso. A partir daí o site pede login; convide amigos em Admin → Convites.
3. **GitHub Actions** (site acordado): abra `https://github.com/dinowei/Lobo-bb/actions` logado e veja o motivo do `startup_failure` em "Acordar o site". Em geral é cobrança ou limite da conta; em *Settings → Billing* confirme os minutos de Actions.
4. **Glossário de Vendas:** Admin → Pendências → ler; se ok, `npm run bb -- liberar-fonte "Glossário de Vendas"`.
5. **MCR (recortes 3-5 e 10-6):** abrir o MCR no site do BCB, salvar o recorte vigente e rodar `npm run bb -- fonte <arquivo> --tipo norma_bacen_cmn --titulo "MCR 3-5 e 10-6" --disciplina conhecimentos_bancarios`.
6. **Pendências da tela Admin:** a mudança "mudou" (BB 2023 Q40) e os 20 pares de similaridade.

## 6. Rodar, publicar, montar do zero

- **Rodar no PC:**
  - `npm run setup` uma vez;
  - `npm run dev` (API :3333 + site :5173);
  - `npm test` e `npm run typecheck`: nunca os dois juntos; tsc com `GOMAXPROCS=2`.
- **Publicar:**
  - Render, deploy manual: a imagem do `Dockerfile` roda `node --import tsx src/server.ts` e abre a `PORT` antes de conectar no banco.
  - Segredos só no painel do Render.
  - Smoke: `/api/saude` deve devolver 200.
- **Noturno:**
  - Agendador do Windows "Lobo Binho - Noturno Local", 01:00, `scripts/noturno-windows.ps1`, que roda até 05:25 e deixa relatório e backup.
  - Pela manhã: `schtasks /query /tn "Lobo Binho - Noturno Local" /v /fo LIST`, `logs\noturno\AAAA-MM-DD.log` e Admin → Fila.
- **Montar do zero:**
  1. Atlas M0: criar o cluster, o usuário e liberar o IP; `npm run bb -- indice`.
  2. Chave NVIDIA no `.env` (modelo em `.env.example`); `npm run bb -- testar`.
  3. `npm run bb -- topicos data/topicos.json`.
  4. Provas: `npm run bb -- prova <pdf> --gabarito <gab> --nome "<nome>"`.
  5. Leis e normas: `npm run bb -- baixar-fontes` e depois `ingerir-fontes <id> --simular|--confirmar`, uma por vez.
  6. `npm run bb -- corrente definitiva`.
  7. O noturno enche o banco.

## 7. Modelos, fontes, figuras

- **Corrente definitiva** (`CORRENTE_DEFINITIVA`, `src/catalogo.ts`):
  - gerador e tutor: gpt-oss-20b → Muse → Lightning;
  - auditor: Muse → Super → Ultra;
  - escritor PT: GLM-flash → gpt-oss → Muse;
  - juiz PT: Super → Ultra;
  - redação: Super → Ultra → Muse.
  - Modelo com menos de 20% de sucesso em 24 h descansa 1 h. Step 5 Preview fica fora.
  - Benchmark: `docs/BENCHMARK-MODELOS.md`.
- **Fontes oficiais:** catálogo em `data/fontes-oficiais.json`.
  - Texto vigente: Planalto compilado, DOU, ou API pública do BCB (compilado, ou original nunca alterado).
  - Pendente: o MCR consolidado.
  - Conferência "fonte atual" das questões: `bb -- fontes-atuais conferir|relatorio`.
- **Figuras:**
  - Desenhadas por código (planilha, tabela, sistema linear, série).
  - As oficiais só entram com o OK do dono (tela Figuras).
  - 2 questões ainda `precisa_imagem`.

## 8. E se quebrar

- **O site não abre:**
  1. Espere ~1 min (o Render free dorme).
  2. Abra `/api/saude`: 503 = sem banco; confira a `MONGODB_URI` e o *Network Access* do Atlas.
  3. Nos logs do Render: "API ouvindo na porta" e depois "Banco conectado".
- **O noturno não rodou:**
  1. `schtasks /query /tn "Lobo Binho - Noturno Local" /v /fo LIST`: veja "Last Result"; o PC precisa estar ligado ou em suspensão, com a conta logada.
  2. Leia `logs\noturno\<data>.log`.
  3. Trava presa: `npm run bb -- limpar-trava-orfa <pid>`, só com o processo morto.
- **A IA está fora:**
  1. Admin → IA mostra quem caiu (vermelho).
  2. A corrente pula sozinha: 3 falhas = 10 min fora; menos de 20% em 24 h = 1 h fora.
  3. Se a corrente inteira cair, as tarefas ficam "aguardando" e voltam na noite seguinte; nada é perdido.
- **O banco está cheio:**
  1. Admin → IA → "Uso do banco" (alerta em 80%).
  2. `npm run bb -- uso-banco` mostra o que pesa.
  3. `npm run bb -- uso-banco ajustar`: telemetria de 30 dias e teto de áudio (`AUDIO_MAX_MB`).
- **Restaurar um backup:**
  1. `npm run bb -- restaurar backups/<data> --simular` (só confere).
  2. Leia as contagens.
  3. `npm run bb -- restaurar backups/<data> --confirmar`: cria o rollback e pede confirmação digitada.

## 9. Retomar aqui

- **Próximo:**
  - conferir a noite de 21/10 (relatório + backup automático);
  - aplicar a decisão do dono sobre DECISOES nº 13;
  - religar o "Acordar o site" quando o Actions voltar a iniciar jobs.
- **Últimos commits:** ver `git log --oneline -15` (itens F1 a F10 do PROMPT-FECHAMENTO, 20/10/2026).
