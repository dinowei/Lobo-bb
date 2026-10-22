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

RETOMAR AQUI: PROMPT-LOBO-BB-BACEN, F2 (concurso e banca como dado; migração com backup 2026-10-22).
