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

RETOMAR AQUI: PROMPT-LOBO-BB-BACEN, F2 (concurso e banca como dado; migração com backup 2026-10-22). Código da F2 já começado no working tree (shared/concursos.ts, data/bancas, data/concursos, models, migracaoConcursos.ts), ainda sem commit.
