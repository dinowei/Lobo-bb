# Prompt: Claude Code assume o trabalho que o Codex deixou

**Como usar:** coloque este arquivo (e o POST-IT-GERAL.md) em `docs\` e mande ao Claude Code:
`Leia docs/PROMPT-SYNC-CODEX.md e execute.`
**NÃO clique em "Commit" no VS Code antes:** quem revisa e commita é o Claude Code.

```
Leia o CLAUDE.md, docs/DIARIO.md (principalmente a última linha "RETOMAR AQUI"),
docs/ROADMAP.md, docs/DECISOES-PENDENTES.md e docs/POST-IT-GERAL.md.

CONTEXTO
Outro agente (Codex, no VS Code) trabalhou neste repositório desde o seu último
turno, seguindo os mesmos prompts e regras. Ele parou no limite de uso e só volta
em 17/11, então a partir de agora você é o ÚNICO agente no projeto.
O que ele fez (commits já feitos):
  - affadce: corrente.ts sem cache de 60 s e sem cair em silêncio no legado
    quando a leitura do Mongo falha (+ teste).
  - bcd585b: prova real da corrente: Lightning 2x timeout → gpt-oss-20b gerou →
    nemotron-3-super auditou. Questão aprovada 6ad4f8566d4a59052747bac3.
  - 52d092e: Fase B 8.3 (calibragem da confiança).
  - c164762: Fase B 8.4 (redação com fila persistente de correção; E2E real deu 87/100).
O que ele deixou SEM COMMIT (cerca de 21 arquivos):
  - Fase B 8.5: src/aulas.ts, src/aulas.test.ts (novos), mais mudanças em cli.ts,
    estudo.ts, models.ts, noturno.ts, outroJeito.ts, prompts.ts, server.ts,
    shared/tipos.ts, web (demo.ts, http.ts, Praticar.tsx). Aulas com fonte
    citada literalmente, tutor com auditor de outra família e limite diário, 3 aulas
    escritas à mão no demo, rodada única de reparo quando a citação não é literal.
  - Etapa 9: carrossel do painel (Painel.tsx, estilos.css), conferido em 360 e 1440 px.
  - Docs: DIARIO, ROADMAP, CLAUDE.md, .env.example, BENCHMARK-MODELOS e o
    ADENDO-BINHO-VOZ (novos).
Último estado dele: 24/24 testes focados (aulas, corrente, noturno) e typecheck do
servidor e do web passando. A geração real de 3 aulas ANTES do reparo descartou as 3
(o modelo parafraseou a citação). O reparo foi feito e testado, mas a geração real
ainda NÃO foi repetida.

======================================================================
S1. SINCRONIZAR (sem perder nada)
======================================================================
- git status, git log --oneline -15, git diff --stat. NUNCA use git checkout,
  reset, stash ou clean nas mudanças do Codex: o trabalho dele é para ser mantido.
- Revise o diff por partes (grep e trechos, não arquivos inteiros) e confira:
  * nenhuma chave, MONGODB_URI ou valor de segredo no diff (.env.example só com
    NOMES de variáveis, valores vazios ou de exemplo);
  * as mudanças no CLAUDE.md não contradizem as regras do projeto;
  * nenhum timeout de diagnóstico (120 s) ficou gravado como padrão
    (rg "120_000|120000" src): o padrão continua 180 s;
  * nada fora do estilo atual (regra 8) no carrossel e nas telas.
- Se encontrar algo errado, corrija e registre no DIARIO o que era.

======================================================================
S2. VALIDAR E COMMITAR
======================================================================
Dicas do ambiente (Windows, descobertas pelo Codex):
  - typecheck e testes NUNCA ao mesmo tempo (o tsc estoura memória);
  - o typecheck do web via "npm --prefix web exec" trava: rode o binário direto
    (web\node_modules\.bin\tsc.cmd --noEmit -p web/tsconfig.json);
  - se o compilador estourar memória, limite os núcleos.
Passos: typecheck servidor → typecheck web → testes focados → suíte completa.
Commits SEPARADOS e com mensagem clara:
  1. Fase B 8.5: aulas curtas + tutor;
  2. Etapa 9: carrossel do painel;
  3. docs (DIARIO, ROADMAP, BENCHMARK, adendo, .env.example, CLAUDE.md).
Push só se o repositório continuar privado.

======================================================================
S3. FECHAR A 8.5
======================================================================
- Repita a geração real (aulas --n 3) com o reparo novo, respeitando a trava de
  um job de IA por vez. Meta: pelo menos 2 das 3 aprovadas pelo auditor de outra
  família. Mostre uma aula aprovada no relatório para o dono ler.
- Se reprovarem de novo, leia o motivo gravado, ajuste prompt ou validação e tente
  UMA vez mais; se ainda falhar, registre em DECISOES-PENDENTES e siga em frente.
- Confira na tela (demo e real) o cartão de aula, o botão do tutor e o "Já sei".
- DIARIO + RETOMAR AQUI, commit.

======================================================================
S4. POST-IT GERAL (docs/POST-IT-GERAL.md), parte A
======================================================================
1. Etapa 6: confirme se o noturno já rodou uma NOITE REAL. Se não, rode uma noite
   curta (META_APROVADAS_NOITE=10) e registre o relatório.
2. Etapa 7: confirme Descontos, Amortização SAC/Price, Taxas, Probabilidade. O que
   faltar entra logo depois da Fase B.
3. Benchmark: o limite de 5 falhas seguidas por modelo NÃO funcionou (o GLM
   continuou depois da 5ª; no total foram 8 timeouts seguidos). Ache a causa, corrija
   e cubra com teste. O benchmark completo roda só de madrugada, retomando das
   amostras gravadas (juiz-pt-v1 parou com 2 a 3 por modelo).
4. Redação: o E2E registrou um texto de 2.073 caracteres como "5 linhas válidas" e
   deu 87/100. Confira:
   (a) como as linhas são contadas: devem ser linhas da folha de prova (estimadas por
       caracteres por linha), não quebras de parágrafo;
   (b) o mínimo e o máximo de linhas e a regra de penalidade da Cesgranrio/BB.
       Pegue do edital ou da prova oficial em provas/; se não achar a regra, registre
       em DECISOES-PENDENTES e use a mais conservadora;
   (c) abaixo do mínimo, a nota deve ser zerada ou fortemente penalizada ANTES da IA
       (código, não modelo). Teste com textos curto, no limite e normal.

======================================================================
S5. DEPOIS, SIGA A ORDEM
======================================================================
Fase B 8.6 em diante (PROMPT-VIAGEM) → ADENDO-BANCO-GRANDE na Etapa 6 (se ainda
não aplicado) → telas Admin (R3, uma tela com 4 abas) se ainda não existirem →
resto da Etapa 7 → Etapa 9 (bateria e2e com jobs de IA parados; carrossel só
conferir) → por último, docs/ADENDO-BINHO-VOZ.md.

======================================================================
REGRAS (continuam valendo)
======================================================================
- Um job de IA por vez. Benchmark pode ser parado com SIGINT se segurar a fila por
  mais de 30 min; registre no DIARIO.
- Timeouts menores só em processo de teste, nunca gravados como padrão.
- Só modelos grátis da NVIDIA. Sem chaves no chat, em log ou em commit.
- Gabarito oficial nunca passa por IA. provas/ e fontes/ no .gitignore.
- Economia de uso (R0 do PROMPT-RETOMADA): grep em vez de ler arquivo inteiro,
  testes no fim de cada bloco, commit por item, "RETOMAR AQUI" sempre atualizado.
- Se o limite estiver acabando: pare num ponto limpo, commit e atualize o DIARIO.
```
