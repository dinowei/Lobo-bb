# Publicar o lobo na nuvem

Tudo pronto para publicar, **sem publicar**: criar conta no provedor, informar cartão e apertar
"Deploy" são passos seus. Preços conferidos nas páginas oficiais em 18/10/2026 (podem mudar).

## Comparação

| | **Render** | Railway | Fly.io |
|---|---|---|---|
| Plano grátis | Web grátis que **dorme** após 15 min sem uso (~1 min para acordar), 750 h/mês | US$ 1/mês de uso grátis; teste de US$ 5 por 30 dias | Não tem; teste de 2 h ou 7 dias |
| Sempre ligado | ~US$ 7/mês (Starter, conferir no painel) | Hobby US$ 5/mês com US$ 5 de uso incluso (RAM ~US$ 10/GB/mês) | 512 MB ~US$ 3,69/mês |
| Noturno (cron) | Cron nativo, cobrado por segundo, mínimo US$ 1/mês, até 12 h por execução | Agendamento do serviço, cobrado pelo uso | Máquina agendada (mais configuração) |
| Cartão | Só nos pagos | Não no teste | Sim, depois do teste |
| Deploy | Do GitHub, com este `render.yaml` (Blueprint) | Do GitHub, com o `Dockerfile` | `flyctl` + `fly.toml` (linha de comando) |
| Esforço para você | **Menor**: um arquivo descreve site + noturno | Baixo | Maior |

## Recomendação: Render

O `render.yaml` já descreve o site (com health check em `/api/saude`) e o noturno (cron às 01h de Brasília),
usando o mesmo `Dockerfile`. Custo estimado: ~US$ 7 (site sempre ligado) + ~US$ 1 a 2 (noturno) por mês.
Para testar de graça: troque `plan: starter` do serviço web por `plan: free` (aceitando que ele dorme);
o cron não tem plano grátis.

Plano B mais barato: Railway Hobby (US$ 5 com US$ 5 de uso incluso; o site com 512 MB fica perto disso).

## Passo a passo (uns 20 minutos)

1. **Atlas → Network Access:** adicione `0.0.0.0/0` (o Render não tem IP fixo de saída nos planos simples).
   A segurança fica no usuário e senha do banco. (2 min)
2. **render.com:** crie a conta entrando com o GitHub (passo seu). (3 min)
3. **New → Blueprint →** escolha o repositório `Lobo-bb`. O Render lê o `render.yaml` e mostra o serviço
   `lobo` e o cron `lobo-noturno`. (3 min)
4. **Preencha os segredos** do grupo `lobo-segredos` (copie do seu `.env`, no painel do Render, nunca no chat):
   `MONGODB_URI`, `GERADOR_API_KEY`, `AUDITOR_API_KEY`, `EMBED_API_KEY`, `ALUNO_ID`. (5 min)
5. **Apply.** O primeiro build leva uns 5 minutos. (5 min)
6. Abra `https://lobo.onrender.com/api/saude`: tem que mostrar `{"ok":true}`. (1 min)
7. Antes de chamar amigos: no seu PC, `npm run bb -- criar-admin <seu-email>` (o banco é o mesmo) e depois
   `npm run bb -- convite` para cada amigo. (2 min)

## Variáveis de ambiente (sem valores)

| Variável | Para quê |
|---|---|
| `MONGODB_URI` | banco no Atlas (segredo) |
| `GERADOR_API_KEY`, `AUDITOR_API_KEY`, `EMBED_API_KEY` | chave da NVIDIA (segredo; pode ser a mesma) |
| `ALUNO_ID` | seu progresso de antes do login |
| `*_BASE_URL`, `*_MODEL`, `*_MODEL_RESERVA`, `EMBED_DIM`, `EMBED_INPUT_TYPE`, `VECTOR_INDEX` | modelos (já no `render.yaml`) |
| `LLM_*`, `*_PENSAR`, `*_RACIOCINIO` | limites de raciocínio e timeout |
| `GERACAO_MAX_DIA`, `GERACAO_MAX_NOITE`, `SIMILAR_*`, `EMBED_MIN_SIM` | tetos e limites de qualidade |
| `NODE_ENV=production` | cookie de login `Secure` |
| `PORT` | o Render define sozinho |

A corrente de modelos aprovada (inclusive a provisória) fica no banco: vale igual no PC e na nuvem.

## O que já vem no código

- Uma imagem só (`Dockerfile`): API + site compilado; o noturno usa a mesma imagem com outro comando.
- Cabeçalhos de segurança (helmet com CSP), compressão, cache de 1 ano nos arquivos com hash e
  `no-cache` no `index.html`, `trust proxy` (IP real no limite de tentativas de login).
- `/api/saude` devolve 503 sem banco: o Render não troca para uma versão quebrada.
- Login liga sozinho quando existir a primeira conta (`criar-admin`).

## Checklist depois de publicar

- [ ] `/api/saude` responde `{"ok":true}`
- [ ] O site abre e pede login (depois do `criar-admin`); entrar e sair funcionam
- [ ] Responder uma questão e ver o XP subir
- [ ] Convite: um amigo cria conta e **não** vê o seu progresso
- [ ] Aba Admin só aparece para você
- [ ] Na manhã seguinte: Admin → Fila mostra o relatório da noite; Render → `lobo-noturno` → Logs sem erro
- [ ] Render → Settings: alerta de e-mail para deploy que falhar
- [ ] Atlas: backup ligado (Cloud Backup) e alerta de uso de disco
