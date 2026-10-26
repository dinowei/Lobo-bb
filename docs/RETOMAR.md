# Retomar o Lobo Binho (versão v1.0-estudo)

Versão congelada em 26/10/2026, tag `v1.0-estudo`. As regras estão no `CLAUDE.md`; o estado e os números, no `docs/MESTRE.md`.

## Subir no PC
1. `npm run setup` (só na primeira vez). Use Node 22.
2. `.env` a partir do `.env.example`. **Nunca** commitar nem imprimir o `.env`.
3. `npm run dev`: API em :3333 e site em :5173.
4. Conferir: `npm run typecheck`, `npm test` e `npx tsx scripts/smoke-local.ts` (servidor de produção num banco em memória, ~30 s).

## Publicar
- **Render** (API e site): painel → serviço → *Manual Deploy* → *Deploy latest commit*. O health check é `/api/saude`, que mostra a versão (commit) e o último noturno.
- **Vercel** (frente rápida): passo a passo em `docs/VERCEL.md`. O `web/vercel.json` já traz o rewrite, a CSP, o cache e o `npm ci`.
- **Depois de publicar:** `SMOKE_URL=https://<site> SMOKE_EMAIL=... SMOKE_SENHA=... npm run smoke`. Leva menos de 2 min: responde 1 questão e a desfaz.

## Voltar para a versão anterior
- **Render:** painel → *Events/Deploys* → escolha o deploy da tag anterior → *Rollback*. Ou, pelo código: `git checkout v1.0-estudo` e *Deploy* desse commit.
- **Vercel:** painel → *Deployments* → o deploy anterior → *Promote to Production*.
- **Banco:** a versão do código não mexe nos dados. Para restaurar dados, ver "Backups" abaixo.

## Se algo der errado
- **O site caiu no modo demo** (selo "modo demo"):
  1. Abra `/api/saude`. Se não responder, o Render dorme ou caiu; espere ~1 min.
  2. Se responder e mesmo assim ficar no demo, olhe o cookie de login. Ele é `HttpOnly; SameSite=Lax; Secure`, sem `Domain`, e pelo rewrite da Vercel fica no domínio do site. Não aponte o site direto para a URL do Render: use sempre o `/api` do próprio site.
- **O noturno parou:** veja Admin → selo "noturno atrasado" (mais de 36 h) e Admin → Janelas.
  1. Rode `schtasks /query /tn "Lobo Binho - Noturno Local" /v /fo LIST`.
  2. A tarefa precisa de: acordar o PC, rodar se perdido e parar em 5 h.
  3. O PC precisa estar em **suspensão** (não desligado), na tomada, com a conta logada.
  4. Logs em `logs\noturno\<data>.log`, guardados por 14 dias. Para trava presa: `npm run bb -- limpar-trava-orfa <pid>`.
- **O Atlas lotou:** o relatório diário avisa acima de 70%, e a escrita para em 80%.
  1. Rode `npm run bb -- uso-banco` (o que pesa).
  2. Depois `npm run bb -- uso-banco ajustar` (TTL da telemetria e teto do áudio).
  3. Nada de plano pago.
- **A IA para no meio do dia:** pode ser o teto diário global (`IA_TETO_DIA`, padrão 300 chamadas) ou o disjuntor (5 falhas seguidas → o modelo fica 30 min fora). Os dois aparecem em Admin → Erros.

## Backups
- **Onde ficam:** `backups/<data>[-HHmm]/`, fora do Git, um por noite. Guardam 14 dias.
- **O que cobrem:** contas, tentativas, revisões, redações, ratings, questões, tópicos, cartões, contestações, respostas C/E, simulados, Espaço da Lo, itens C/E e fichas.
- **Provar que restaura:** `npm run bb -- backup-testar` restaura numa base temporária, compara coleção por coleção e apaga a temporária. Último teste: `backups/2026-10-26-0859`, 15/15 coleções iguais.
- **Restaurar de verdade:** `npm run bb -- restaurar backups/<pasta> --simular`, conferir as contagens, depois `--confirmar` (cria um rollback antes).

## Pendências por prioridade
1. **(Dono)** Publicar: Vercel (`docs/VERCEL.md`) e deploy no Render. Depois, rodar `npm run smoke` com a sua conta.
2. **(Dono)** O `render.yaml` declara `plan: starter`, que é **pago**, no site e no cron. Confira no painel do Render se está no free. O noturno roda no PC, então o cron do Render não é necessário.
3. **(Dono)** BNB 2024 item 17; gabaritos do TJ-SP 2023 e do CNU 2024; cotas do edital do TJ-SP; os 72 arquivos por tema.
4. Fichas que o material do acervo não sustenta: Interpretação, Pontuação e Coesão. Elas precisam de material com teoria (mapa do acervo) ou do OK do dono para cursinho.
5. Lotes de provas da E10 (Cesgranrio, Cebraspe, FGV), amostra de 80 da classificação e golden set do chat de 30 casos: os comandos estão prontos e ainda não rodaram.
6. Livros CVM/BCB por capítulo.
7. `fast-uri` (moderada, só em dependência de desenvolvimento).
