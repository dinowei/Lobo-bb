# Relatório da viagem (16 a 18/10/2026)

Entrega final do `PROMPT-VIAGEM` / `PROMPT-RETOMADA`, com os adendos (Banco Grande, Fontes Atuais, Binho e Voz)
e as mensagens do dono. O detalhe de cada passo, com números e problemas, está no `docs/DIARIO.md`. O que
depende de você está no `docs/DECISOES-PENDENTES.md` e no fim deste relatório.

## 1. O que foi feito

**Banco de questões e qualidade**
- Figuras:
  - inventário das provas (5 figuras reais);
  - cópia fiel conferida na tela Figuras (nenhuma aprovada sem o seu OK);
  - 4 tipos desenhados por código nas geradas.
- Anti-repetição: embedding, trechos em comum e impressão estrutural, mais cenários sorteados.
  - Calibrada em 657 pares; os 20 pares duvidosos estão em `CALIBRAGEM-SIMILARIDADE.md`.
- Corrente de modelos grátis:
  - catálogo, regra de família, telemetria e benchmark com IC;
  - corrente provisória com gpt-oss-20b primeiro, conforme a sua decisão.
- Leis e normas, só de sites oficiais: 24 fontes e 1.006 trechos, todos ligados a um tópico.
  - O glossário de Vendas está pronto e espera o seu OK.
- Por construção (Etapa 7): Amortização, Taxas, Combinatória e Probabilidade (16 templates) e Concordância, Regência e Pontuação (bancos de regras).
  - 1.000 montagens por tipo conferidas por mathjs.
  - Rodada real: **12/21 aprovadas**.
- Noturno com banco grande:
  - meta de 1.200 pela cota da prova;
  - 3 trabalhadores e balde de fichas;
  - fila que sobrevive a reinício;
  - pré-geração de explicações, aulas, cartões, temas e áudio.
  - Primeira noite curta: **12 aprovadas**. Depois o banco foi a 166 de 1.200.
- Fontes atuais: camada "de onde veio / vale hoje / mudou desde a prova", com 199 questões migradas. "Mudou" só entra com o seu OK.

**Estudo (Fase B)**
- Simulado fiel ao edital:
  - cotas exatas e 5 h;
  - pontos como a banca conta e se a nota eliminaria;
  - dificuldade 20/50/30.
- Diagnóstico do tipo de erro, com ações por motivo. Calibragem da confiança.
- Redação:
  - tema e correção com citações literais;
  - linhas da folha, zero abaixo de 25 e corte em 30;
  - aviso "Nota estimada (correção automática; pode variar da banca)".
- Aulas curtas auditadas: a primeira foi aprovada. Tutor "me explica de outro jeito" com cache e cota.
- Cartões (normas e Inglês), treino misturado, horas líquidas, rating Elo, Raio-X e plano até a prova.

**Contas, nuvem e acabamento**
- Login com convite e scrypt. Só liga quando existir a primeira conta.
- Pronto para o Render (Dockerfile, `render.yaml`, CSP/HSTS), sem publicar.
- Acabamento:
  - error boundary, offline com fila de respostas e atalhos;
  - PWA, "Desfazer" e carrossel de matérias;
  - Lighthouse: Acessibilidade 100, Boas práticas 100, Desempenho 96 (calibrado para esta máquina).

**Binho e Lo (ADENDO-BINHO-VOZ e a última mensagem)**
- **Binho = mascote; Lo = assistente e voz da narração.**
  - Voz Louise (Magpie TTS da NVIDIA), com cache em MP3 e pré-geração noturna.
  - 🔊 "Ouvir com a Lo", mini-player da Lo em turquesa discreto e "Estudar ouvindo".
  - "Voz da Lo" em Ajustes.
  - Normalizador de fala com 77 casos.
- 16 poses (11 do Binho, 5 da Lo), recortadas por código, uma por tela.
  - WebP + PNG, lazy e alt em português.
  - O pulinho só aparece em comemoração.
- Ícone novo laranja:
  - PWA, maskable, apple e favicon;
  - lobo solto recortado pelo contorno escuro, com borda de adesivo;
  - nome "Lobo Binho".
- **Pergunte ao Binho** por tópico (aba Aula do Praticar):
  - Usa a aula conferida e os trechos de fonte mais ligados à pergunta.
  - O tutor responde e um auditor de outra família confere.
  - Em Bancários, Atualidades e Vendas, a resposta só sai com citação literal conferida por código. Sem base, ele diz que não sabe; fora do edital, recusa.
  - Cache por aluno, tópico e pergunta, mais a cota `CHAT_BINHO_MAX_DIA`.
  - O áudio é "Ouvir resposta com a Lo".
  - Também na CLI: `npm run bb -- binho --assunto "<tópico>" --pergunta "<texto>"`.
- Admin → IA: linha "Voz da Lo" com chamadas e falhas (24 h e 7 dias, por tipo), cache (áudios, MB, minutos) e última falha.

## 2. Testes

- Unitários: **153** (`npm test`), todos passando. Typecheck do servidor e do site ok.
- E2E no Edge:
  - fluxos 6/6: responder, revisão, simulado, contestar, offline e redação;
  - login 7/7.
- Rodadas reais com a IA:
  - Etapa 7: 12/21;
  - Etapa 2.3: 3/10 (perdas por timeout do provedor);
  - noite curta: 12 aprovadas;
  - redação ponta a ponta: 87/100, com citações conferidas;
  - fontes atuais: 1 confirmada e 5 pendentes;
  - chat do Binho: ver o DIARIO (rodada de 18/10).
- Prints: `docs/telas/` (desktop 1440 e celular 390). O "antes" do Binho está em `docs/telas/antes-binho/`.

## 3. O que ficou com você

Por prioridade (detalhes e comandos no `DECISOES-PENDENTES.md`):
1. **Corrente definitiva de modelos.** A provisória está em uso; reavalie quando o benchmark completo rodar.
2. **Glossário de Vendas:** ler e liberar com `liberar-fonte "Glossário de Vendas"`. Sem isso, Vendas por doutrina não gera.
3. **Três normas do BCB** (Pix, Circular 3.978, Res. 3.919): baixar o texto atualizado no site do BCB (ele recusou o download automático).
4. **Criar a sua conta de admin** com `criar-admin <email>`. Só então o login liga; depois, `convite` para os amigos.
5. **Publicar no Render.** Exige conta e pagamento, que são seus; passo a passo no `docs/DEPLOY.md`.
6. Conferir as **5 figuras oficiais** (tela Figuras) e os **20 pares de similaridade**.
7. Baixa prioridade:
   - duas questões antigas repetidas ou com tabela copiada (comandos prontos);
   - manchinha de chão em 3 poses;
   - "mudou desde a prova" pendente na tela Pendências.

## 4. Limites conhecidos

- O provedor grátis da NVIDIA tem timeouts e 429 em alguns horários. A fila repete sozinha, mas o rendimento por noite varia.
- Aulas: 1 aprovada até agora. As travas seguram citação parafraseada, e a âncora literal entrou depois.
- Reconhecimento de voz: não há ASR grátis em pt-BR na NVIDIA, então o 🎤 usa o do navegador.
