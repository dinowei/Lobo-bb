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

## Noturno no Windows (PC local)

O script `scripts/noturno-windows.ps1` inicia `node --import tsx src/cli.ts noturno --ate 05:30` com **dois trabalhadores de IA** (`NOTURNO_TRABALHADORES=2`), usa o `.env` da raiz e grava em `logs/noturno/AAAA-MM-DD.log`. Ele mascara chaves, URI Mongo, bearer tokens e e-mails antes de gravar; `logs/` está no `.gitignore`. A janela é 01:00–05:30 BRT; se o PC acordar depois, o script registra e sai. Um arquivo com compartilhamento exclusivo impede duas instâncias locais.

### Criar a tarefa

1. Confirme que Node.js está instalado, `node_modules/` existe e o `.env` está na raiz `C:\projetos\Lobo-bb`. Não copie o `.env` para os argumentos da tarefa nem para o Git.
2. A tarefa criada é `Lobo Binho - Noturno Local`, diária às **01:00 BRT**. Confira o fuso `E. South America Standard Time` e o próximo horário no Agendador.
3. Em **Ações**, escolha **Iniciar um programa**:
   - Programa: `C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`
   - Argumentos: `-NoLogo -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "C:\projetos\Lobo-bb\scripts\noturno-windows.ps1"`
   - **Iniciar em**: `C:\projetos\Lobo-bb`
4. Em **Condições**, marque **Reativar o computador para executar esta tarefa** e habilite **Permitir despertadores** nas Opções de Energia. A tarefa está configurada para iniciar e continuar também na bateria; ela acorda da suspensão, mas não liga um PC desligado.
5. Em **Configurações**, marque **Executar assim que possível após um início agendado perdido**, **Não iniciar uma nova instância** e limite de **4h30**. O XML atual confirma `WakeToRun=true`, `StartWhenAvailable=true`, `MultipleInstances=IgnoreNew` e `ExecutionTimeLimit=PT4H30M`.

**Limite confirmado do Windows neste PC:** a tarefa atual ainda usa `InteractiveToken`, então só roda enquanto a conta estiver conectada. A tentativa de trocar para execução sem login/S4U foi negada pelo Windows (`0x80070005`), e `schtasks /Create ... /NP` pediu a senha e terminou em acesso negado. Para habilitar a execução sem login, abra as propriedades desta tarefa → **Geral** → **Executar independentemente de o usuário estar conectado** e informe a senha da conta diretamente na janela local do Agendador. A senha não deve ser escrita no script, `.env`, argumento, log ou Git. Não use a conta `SYSTEM`.

O teste manual `scripts/noturno-windows.ps1 -SmokeTest` passou: mascarou valores sintéticos, encerrou um processo de teste no timeout e não deixou processo filho. O teste disparado pelo Agendador não concluiu: tanto o smoke como uma tarefa curta `cmd /c exit` ficaram em estado `Em execução`; as tarefas de teste foram encerradas e removidas. A rodada integral com `META_APROVADAS_NOITE=2` não foi feita, pois escreveria questões novas no Atlas de produção sem rollback seguro. Portanto, ainda falta comprovar uma execução noturna real.

O Agendador mantém o PC acordado enquanto a tarefa com a opção de reativação está em execução; isso depende de o Windows e o hardware aceitarem despertadores no estado de energia selecionado ([documentação da propriedade WakeToRun](https://learn.microsoft.com/en-us/windows/win32/taskschd/tasksettings-waketorun)). A opção `-WindowStyle Hidden` oculta a janela do PowerShell.

### Conferir pela manhã

1. Rode `schtasks /query /tn "Lobo Binho - Noturno Local" /v /fo LIST` e confira `Last Run Time`, `Last Result` e o próximo horário.
2. Abra `logs\noturno\AAAA-MM-DD.log`; confirme início, fim, status de saída e que os valores sensíveis aparecem mascarados.
3. Em Admin → Fila, registre aprovadas, tentativas e descartes agrupados pelo motivo exibido no relatório da noite.

## Backup do Atlas

`npm run bb -- backup` grava em `backups/AAAA-MM-DD/` um `manifest.json` e um `.json.gz` por coleção. O comando do noturno executa esse backup depois de salvar o relatório da noite. A pasta `backups/` está ignorada pelo Git; no Windows, o script limita a ACL à conta atual e, nos demais sistemas, usa permissão `0700` (arquivos `0600`). Se não conseguir restringir a pasta, o backup falha sem declarar sucesso.

O pacote contém contas, tentativas, revisão SM-2, redações, rating e apenas a configuração aprovada da corrente. A senha da conta fica como hash scrypt para permitir recuperação; sessões e tokens não são incluídos. XP, progresso e conquistas são calculados a partir das tentativas, então não têm coleção separada. O manifesto registra banco, data, coleção, quantidade, bytes gzip e SHA-256; o terminal mostra só contagens. A retenção mantém os 14 diretórios diários mais recentes. Um erro de leitura/escrita remove o diretório temporário e não marca backup como concluído.

Para conferir um backup sem alterar o banco:

```text
npm run bb -- restaurar backups/AAAA-MM-DD --simular
```

A simulação verifica o manifesto, hashes, gzip e contagens e mostra somente contagens atuais e esperadas. Para restaurar:

```text
npm run bb -- restaurar backups/AAAA-MM-DD --confirmar
```

O comando pede a frase `RESTAURAR <banco> <data>` antes de escrever, salva um snapshot local do estado atual e só então substitui as coleções incluídas. Se a restauração falhar, tenta repor o snapshot; seu diretório `rollback-*` fica preservado para recuperação manual. O código não foi executado contra o Atlas de produção neste sprint; a exportação, a simulação e o rollback foram testados com um banco falso em memória. Nunca rode `--confirmar` em produção sem verificar a simulação e o snapshot local.

Para desfazer uma restauração concluída, ou continuar uma recuperação se o rollback automático também falhar, simule primeiro o diretório `backups/rollback-*` e depois use `restaurar <pasta-rollback> --confirmar`; o comando também guardará o estado atual antes de aplicar esse snapshot. Não apague o diretório de rollback antes de validar o banco restaurado.

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
