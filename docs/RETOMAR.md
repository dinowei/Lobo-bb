# Retomar o Lobo Binho (versão v1.1)

Versão fechada em 27/10/2026, tag `v1.1` (a anterior, `v1.0-estudo`, continua valendo para voltar). As regras estão no `CLAUDE.md`; o estado e os números, no `docs/MESTRE.md`.

## Subir no PC
1. `npm run setup` (só na primeira vez). Use Node 22.
2. `.env` a partir do `.env.example`. **Nunca** commitar nem imprimir o `.env`.
3. `npm run dev`: API em :3333 e site em :5173.
4. Conferir antes de cada commit: `npm run typecheck` (servidor **e** site), `npm test`, `npm --prefix web run build` e `npx tsx scripts/smoke-local.ts` (servidor de produção num banco em memória, ~30 s).

## Publicar ("no ar" = Render live + Vercel Ready, os dois conferidos)
- **Render** (API e site): o push não publica sozinho (autoDeploy desligado). Painel → serviço → *Manual Deploy* → *Deploy latest commit*. Conferir o deploy em *live*.
- **Vercel** (frente rápida): publica sozinho a cada push. Conferir *Ready* no commit (GitHub → commit → status "Vercel").
- **Prova:** `https://lobo-binho-dineilton-s-projects.vercel.app/api/saude` mostra `"versao"` = o commit publicado.
- **Fonte única de rota na Vercel:** só o `web/vercel.json`. A regra "API para o Render" do painel (Project → Routes) está **desativada** desde 27/10: o padrão `:path*` dela mandava `/api/saude*` ao Render e o site caía no demo. Não religar.
- **Depois de publicar:** `SMOKE_URL=https://lobo-binho-dineilton-s-projects.vercel.app SMOKE_EMAIL=... SMOKE_SENHA=... npm run smoke`. O site pede login, então o smoke precisa da sua conta. Ele responde 1 questão e a desfaz.

## Voltar para a v1.0-estudo (menos de 5 minutos)
Alvos já levantados (simulação de 27/10, ver DIARIO):
- Render: deploy `dep-dbfm36gn74is73etrp2g` (commit `b65df5e`, tag `v1.0-estudo`).
- Vercel: deployment `dpl_2fjxuG55Fbtmo2oeRmcQ8c9RdyCG` (commit `b65df5e`).

Passos:
1. **Render (~2 min):** painel → `lobo-binho` → *Events* → deploy de `b65df5e` (26/10, 14:20) → *Rollback*. Reaproveita a imagem; nada é recompilado.
2. **Vercel (instantâneo):** painel → *Deployments* → o de `b65df5e` → *Instant Rollback* (ou *Promote to Production*).
3. **Conferir (~1 min):** `/api/saude` pelo domínio da Vercel deve mostrar `"versao":"b65df5e"`. Se voltar `Cannot GET /api/saude*`, o rewrite antigo da v1.0 não serve sem a regra do painel: refaça o passo 2 para a frente da v1.1 (`dpl_BQGsWPruC287WrvKSsWzxxUKPYiF`, commit `8a6843c` ou o mais novo). A frente da v1.1 funciona com o servidor da v1.0: as rotas novas (`/api/estudando`, `/api/aula-tema`) faltam e a tela segue sem elas.
4. **PC (noturno):** o noturno roda o código do repositório. Para a noite usar a v1.0: `git checkout v1.0-estudo` (e, para voltar, `git checkout main`).
5. **Banco:** nada a fazer. A v1.1 só **acrescentou** (coleção `aulas_tema`; chaves `estudando:<aluno>` e `chat_tema` na `config`); nenhum esquema da v1.0 mudou, e a v1.0 ignora o que é novo. Progresso (tentativas, revisões, XP, Elo) é o mesmo nas duas.

Para voltar à v1.1: Render → *Deploy latest commit*; Vercel → promover o deployment mais novo; `git checkout main` no PC.

## Se algo der errado
- **O site caiu no modo demo** (selo "modo demo"):
  1. Abra `/api/saude` pelo domínio da Vercel. Se voltar `Cannot GET /api/saude*`, alguma regra de rota do painel da Vercel foi religada: desative (ver "Publicar").
  2. Se não responder, o Render dorme ou caiu; espere ~1 min.
  3. Se responder e mesmo assim ficar no demo, olhe o cookie de login. Ele é `HttpOnly; SameSite=Lax; Secure`, sem `Domain`, e pelo rewrite da Vercel fica no domínio do site. Não aponte o site direto para a URL do Render: use sempre o `/api` do próprio site.
- **O noturno parou:** veja Admin → selo "noturno atrasado" (mais de 36 h) e Admin → Janelas.
  1. Rode `schtasks /query /tn "Lobo Binho - Noturno Local" /v /fo LIST` (roda às 01:00).
  2. A tarefa precisa de: acordar o PC, rodar se perdido e parar em 5 h.
  3. O PC precisa estar em **suspensão** (não desligado), na tomada, com a conta logada.
  4. Logs em `logs\noturno\<data>.log`, guardados por 14 dias. Para trava presa: `npm run bb -- limpar-trava-orfa <pid>`.
- **O Atlas lotou:** o relatório diário avisa acima de 70%, e a escrita para em 80%.
  1. Rode `npm run bb -- uso-banco` (o que pesa).
  2. Depois `npm run bb -- uso-banco ajustar` (TTL da telemetria e teto do áudio).
  3. Nada de plano pago.
- **A IA para no meio do dia:**
  - Teto diário global `IA_TETO_DIA` = 1984 (2 × o maior dia dos últimos 7, conta de 27/10).
  - Reserva `IA_RESERVA_PRIORITARIA` = 120: noturno, esteira e comandos em lote param em 1864; chat e tutor do aluno vão até 1984.
  - Disjuntor: 5 falhas seguidas tiram o modelo por 30 min.
  - Tudo aparece em Admin → Erros. Os dois tetos ficam no `.env` do PC **e** nas variáveis do Render.
- **Chat do tema "em ajuste":** a gate (`npm run bb -- eval-chat gate`: golden 30 + 5 casos do tema) ainda não passou. O noturno roda a gate como 1ª etapa, uma vez por noite, até passar. O resultado e os casos que falharam ficam no relatório da noite.

## Backups
- **Onde ficam:** `backups/<data>[-HHmm]/`, fora do Git, um por noite. Guardam 14 dias.
- **O que cobrem:**
  - contas, tentativas, revisões, redações e ratings;
  - questões e tópicos;
  - cartões, contestações, respostas C/E e simulados;
  - Espaço da Lo, itens C/E e fichas;
  - (v1.1) aula completa por tema e o tema escolhido à mão.

  Backups antigos (15 coleções) continuam restauráveis.
- **Provar que restaura:** `npm run bb -- backup-testar` restaura numa base temporária, compara coleção por coleção e apaga a temporária. Último teste: ver DIARIO (fechamento v1.1).
- **Restaurar de verdade:** `npm run bb -- restaurar backups/<pasta> --simular`, conferir as contagens, depois `--confirmar` (cria um rollback antes).

## Pendências por prioridade
1. **(Dono)** Rodar `npm run smoke` contra a Vercel com a sua conta (o site pede login; eu não entro com senha).
2. **(Dono)** OK (ou não) para a aula completa entrar na esteira, depois de ver a prova de Concordância e Porcentagem.
3. **(Dono)** Health check do Render vazio: configure `/api/saude` em *Settings → Health Check Path*.
4. **(Dono)** BNB 2024 item 17; gabaritos do TJ-SP 2023 e do CNU 2024; cotas do edital do TJ-SP; os 72 arquivos por tema.
5. Fichas que o material do acervo não sustenta: Interpretação, Pontuação e Coesão.
6. v1.2: visual das telas novas (Grade, aula completa), com perguntas ao dono antes.
7. `fast-uri` (moderada, só em dependência de desenvolvimento).
