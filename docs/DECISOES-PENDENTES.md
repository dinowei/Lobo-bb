# Decisões pendentes (precisam de você)

Itens que o modo autônomo preparou até o último passo possível. Cada um diz o que é, por que
precisa de você, as opções e a minha recomendação. Em ordem de prioridade.

---

## Decisão 1a — BB 2021, Q51 (Segurança da informação): manter no treino

- **Decisão do dono aplicada em 19/10/2026:** recusada a proposta de desatualização. A Q51 é uma classificação conceitual de controle de segurança em Informática; a Resolução CMN 5.274/2025 não altera esse conceito.
- A questão permanece `aprovada` e `situacaoFonte: confirmada`. O motivo e a data da recusa foram guardados junto ao histórico da mudança proposta.
- Na tela Admin → Pendências, cada mudança pendente agora oferece **Manter questão**. A ação pede o motivo, confirma a fonte e preserva o status atual; aprovar a mudança continua sendo uma ação separada.

---

## Corrente de modelos — RESOLVIDO 18/10/2026: corrente definitiva (benchmark do auditor, 60 amostras)

> **Decisão do dono**, ativa com `npm run bb -- corrente definitiva` (`CORRENTE_DEFINITIVA` em `src/catalogo.ts`;
> `corrente desfazer` volta à anterior). A regra de família continua valendo.
>
> | Função | Corrente |
> |---|---|
> | Gerador | gpt-oss-20b → muse-glimmer-30b → lightning (último) |
> | Auditor | muse-glimmer-30b → nemotron-3-super → nemotron-3-ultra |
> | Escritor PT | glm-5.3-flash → gpt-oss-20b → muse-glimmer-30b (DeepSeek saiu) |
> | Juiz PT | nemotron-3-super → nemotron-3-ultra |
> | Tutor | gpt-oss-20b → muse-glimmer-30b → lightning (último) |
> | Redação | nemotron-3-super → nemotron-3-ultra → muse-glimmer-30b |
>
> - Step 5 Preview continua fora (preview).
> - **Descanso por taxa:** o modelo com menos de 20% de sucesso em 24 h (com 5+ chamadas) fica 1 h fora da corrente. Depois disso, só as chamadas novas contam. Se toda a corrente estiver descansando, tenta assim mesmo.
>
> O texto abaixo é o histórico da decisão.

### (histórico) Gerador e auditor da mesma família (Nemotron)

- **O que é:** a regra nova diz que o auditor nunca é da família de quem gerou (e o juiz de Português nunca
  é da família do escritor). Hoje o gerador é o Lightning e o auditor é o Super: os dois são Nemotron (NVIDIA).
- **O que já está pronto:** catálogo (`data/modelos.json`), correntes por função com 3 opções, a regra de
  família testada (`src/catalogo.ts`, `src/corrente.ts`), telemetria por modelo, e o benchmark
  (`docs/BENCHMARK-MODELOS.md`). Enquanto você não aprovar, o app segue no **legado** (os modelos do `.env`,
  sem trocar nada), e a tela IA mostra o alerta "Regra de família ferida".
- **Por que precisa de você:** trocar modelo de produção é decisão sua (PROMPT-RETOMADA R2).
- **Opções:** A) gerador Nemotron + auditor de outra família; B) gerador gpt-oss/Muse + auditor Nemotron.
  A proposta com evidência, riscos e plano de reversão entra aqui quando o benchmark terminar.
- **Como aprovar:** tela Benchmark → "Aprovar corrente" (com confirmação e "Desfazer"), ou
  `CORRENTE_ATIVA=1` + `CORRENTE_<FUNÇÃO>` no `.env`.

## 12. Fontes atuais de Vendas e Negociação e Segurança da informação — RESOLVIDO por decisão do dono (18/10/2026)

- **Decisão do dono:** Informática é conceito técnico → "não se aplica". A exceção é Segurança da informação / proteção de dados: vincular a LGPD (Lei 13.709/2018) e às Resoluções CMN 4.893/2021 e 5.274/2025. Essas fontes também podem fundamentar geração de questões e aulas desse tópico. Conferir as 12 questões pendentes de Segurança da informação.
- **Vendas e Negociação:** baixar somente de `planalto.gov.br` e `in.gov.br` o Decreto 11.034/2022 (SAC), a Lei 10.048/2000, a Lei 12.414/2011 e a Resolução CVM 30/2021 (publicada no DOU). Vincular a LGPD ao tópico Marketing de relacionamento e fidelização. "Técnicas de negociação" fica como "não se aplica".
- Fontes já ingeridas em Vendas: CDC (Lei 8.078, texto compilado), Estatuto da Pessoa com Deficiência (Lei 13.146), Res. CMN 4.949/2021 + 5.117/2024 e Res. CMN 4.860/2020 + 5.182/2024.
- Depois das ligações e ingestões, conferir as 20 questões pendentes de Conhecimentos Bancários.

| Tópico | Fontes aprovadas |
|---|---|---|
| Atendimento, satisfação e experiência do cliente | Res. CMN 4.949, 4.860, CDC, Lei 13.146, Decreto 11.034/2022, Lei 10.048/2000 |
| Ética, conduta e direitos do consumidor | CDC, Res. CMN 4.949 |
| Marketing de relacionamento e fidelização | LGPD, Lei 12.414/2011 |
| Segmentação de mercado e gestão de carteira | Res. CMN 4.949, Resolução CVM 30/2021 |
| Técnicas de negociação | Não se aplica |
| Segurança da informação | LGPD, Res. CMN 4.893/2021 e 5.274/2025 |

- Execução: `baixar-fontes` recebe somente os quatro IDs de Vendas; `ingerir-fontes` recebe esses mesmos IDs. Fontes já ingeridas são ligadas por `vincular-fonte`, que só acrescenta tópicos a trechos vigentes. A conferência aceita `--disciplina` para selecionar exatamente as questões aprovadas pendentes da disciplina desejada.
- Execução concluída: os quatro atos foram baixados somente do Planalto/DOU e ingeridos. A LGPD ficou ligada a Segurança da informação e Marketing; as Res. CMN 4.893/2021 e 5.274/2025 a Segurança; a Lei 12.414 a Marketing. "Técnicas de negociação" teve 3 questões classificadas como "não se aplica".
- Conferência de Segurança (12): 4 confirmadas, 1 marcada "mudou" e 7 sem base normativa suficiente. Conferência de Conhecimentos Bancários (20): 2 confirmadas, 1 marcada "mudou" e 17 sem base normativa suficiente. As 2 mudanças aguardam seu OK em Admin → Pendências; não foram aprovadas automaticamente.

## 1. Revisar o glossário de Vendas (Etapa 2.4)

- **O que é:** `docs/fontes-vendas/glossario.md` (pronto em 18/10/2026): 25 verbetes tirados das 27 oficiais
  de Vendas vigentes (2021 e 2023), cada um citando as questões que o sustentam.
- **Por que precisa de você:** é fonte doutrinária escrita por IA (regra A6 e regra 3 do
  `CLAUDE.md`). Ele **não está no banco**: Vendas por doutrina só gera depois do seu OK.
- **Como fazer:** ler o glossário (Admin → Pendências → "Glossário de Vendas"); se estiver bom,
  `npm run bb -- liberar-fonte "Glossário de Vendas"` (é esse comando que ingere).

## 1b. Três normas do BCB sem texto atualizado (média)

- **O que é:** Res. BCB 1/2020 (Pix), Circular 3.978/2020 (lavagem de dinheiro) e Res. CMN 3.919/2010
  (tarifas). Estão vigentes, mas foram alteradas várias vezes; o DOU só tem o texto original e o texto
  consolidado só existe no site do BCB, que recusou as requisições em 17/10/2026 (inclusive no navegador).
- **Por que precisa de você:** treinar com o texto de 2020 do Pix ensinaria regra velha.
- **Como fazer:** num navegador onde o site do BCB abra, em "Busca de normas", baixe o PDF do texto
  atualizado de cada uma e grave em `fontes/res-bcb-1-2020/`, `fontes/circ-bcb-3978-2020/` e
  `fontes/res-cmn-3919-2010/`; depois `npm run bb -- fonte <arquivo.pdf> --tipo norma_bacen_cmn --titulo "<título>" --disciplina conhecimentos_bancarios`.
  Ou rode `npm run bb -- baixar-fontes` outro dia (se o BCB voltar a responder, eu adapto o download).

## 2. Conta de administrador (Etapa 4)

- **O que é:** criar a sua conta real de login. O login está pronto (Etapa 4), mas **só liga quando
  existe a primeira conta**: até lá o site funciona como sempre, sem pedir senha.
- **Por que precisa de você:** o modo autônomo não cria conta com seus dados nem escolhe sua senha.
- **Como fazer:** `npm run bb -- criar-admin <seu-email>` (pede nome e senha no terminal, sem mostrar a
  senha, e leva todo o seu progresso atual para essa conta). Depois, `npm run bb -- convite` gera um código
  de uso único para cada amigo; `npm run bb -- senha <email>` dá uma senha provisória a quem esquecer.

## 3. Classificar os 20 pares da calibragem de similaridade (média)

- **O que é:** `docs/CALIBRAGEM-SIMILARIDADE.md` traz a distribuição do cosseno em 657 pares do
  banco e 20 pares perto dos limites para você marcar "repetida" ou "ok".
- **Por que precisa de você:** o que é "repetida" para um aluno é julgamento seu (regra A6).
- **Como está agora:** limites conservadores (duplicada 0,97; parecida 0,93; paráfrase de oficial
  0,93; trechos 0,60). O único par acima de 0,90 (0,939) é a mesma questão de Juros compostos com
  outro capital: com 0,93 ela seria descartada; a mais próxima depois disso (0,871) é uma questão diferente.
- **Como fazer:** marque os pares; se alguma "repetida" ficar abaixo do limite, baixe `SIMILAR_PARECIDA`
  no `.env`; depois `npm run bb -- similaridade calibrar` de novo.

## 4. Questões geradas antigas: repetição e paráfrase de oficial (baixa)

- **O que é:** o filtro novo só vale para questões novas. No banco já existem:
  (a) `6ad090cff648279cd1b7605c` e `6ad0921d7e82740f59004d5f`: a mesma questão de Juros compostos com
  outro capital (cosseno 0,939); (b) `6ad2255834220f3eb6eea79e` (sistema linear em tabela) usa o
  cenário da oficial 2023 nº 19 (armários, mesas e cadeiras de três agências). O template já foi
  corrigido e não repete mais o cenário de oficial.
- **Por que precisa de você:** tirar questão aprovada do treino é decisão sua (regra A8).
- **Recomendação:** contestar (botão "Contestar" na questão) uma das duas de (a); manter (b), que é
  uma variação numérica útil para treinar, ou contestar se preferir só questões originais.

## 5. Duas questões com figura que repetem a tabela no texto (baixa)

- **O que é:** as 2 primeiras questões geradas com figura (`6ad2141444b319b9b25921e0`, planilha;
  `6ad2255834220f3eb6eea79e`, sistema linear) foram aprovadas com a tabela copiada no enunciado
  ("| Agência | Contas |…"), além da figura desenhada. Conteúdo e gabarito estão certos; só fica feio.
- **Por que precisa de você:** corrigir exige gravar no banco por script, e a checagem de
  permissões do modo autônomo bloqueou essa gravação. As novas já saem limpas (o pipeline tira a cópia).
- **Como fazer:** `npx tsx scripts/limpar-figura-no-texto.ts` mostra o antes/depois;
  `npx tsx scripts/limpar-figura-no-texto.ts --gravar` corrige.
- **Recomendação:** rodar com `--gravar` (só remove o trecho entre o primeiro e o último "|").

## 11. Voz padrão e poses — RESOLVIDO 18/10/2026

- **Decisão do dono:** a narração é da **Lo**, assistente do Binho, com a voz **Louise** (`NVIDIA_TTS_VOZ`);
  Diego e Isabela ficam como opção em Ajustes → "Voz da Lo". Binho = mascote; Lo = assistente e voz.
- **Poses:** as 16 (11 do Binho, 5 da Lo) estão no site, uma por tela; ícone novo laranja e nome "Lobo Binho".
- **Microfone:** não há reconhecimento de voz grátis com pt-BR na NVIDIA; o 🎤 usa o do navegador.
- **Para você conferir (baixa):** `lo-e-binho`, `lo-quadro` e `binho-mesa` ficaram com uma manchinha clara de
  chão embaixo dos pés; tirar por cor comia o sapato. Se incomodar, uma versão com fundo transparente
  dessas três resolve.

## 10. Lighthouse (Etapa 9) — RESOLVIDO 18/10/2026: aprovado como devDependency

- **O que é:** a Etapa 9 pede nota ≥ 90 no Lighthouse (celular). A ferramenta não está instalada, e
  eu não instalei pacote novo sem você saber.
- **Como rodar (2 min):** com o site de produção de pé (`npm run build` e depois `npm start`), rode
  `npx lighthouse http://localhost:3333 --form-factor=mobile --only-categories=performance,accessibility,best-practices --view`.
  Ou, no Edge, F12 → Lighthouse → Celular.
- **Já feito para a nota:** divisão de código por rota (bundle principal 70 kB gzip), demo carregado
  só sem servidor, fonte com `display=swap`, contraste do laranja ≈ 6:1, rótulos e foco visível,
  alvo de toque de 44 px, manifest e service worker.
- **Recomendação:** dizer "pode instalar o lighthouse", e eu rodo e registro as notas no DIARIO.

## 9. Aulas curtas (8.5): 0 aprovadas em duas rodadas reais (média)

- **O que aconteceu:** 6 aulas tentadas em 2 rodadas (o Lightning deu timeout e o `gpt-oss-20b`
  escreveu todas), 0 aprovadas. Motivos, todos barrados ANTES do aluno ver:
  - citação parafraseada em vez de literal (3 vezes);
  - JSON fora do formato na 1ª resposta (todas as vezes; o reparo resolveu);
  - lista com itens demais (1);
  - duas reprovações do auditor: uma por "mais de 400 palavras" (erro do auditor, que contou a aula
    inteira) e uma por citar lei ausente das fontes (reprovação correta).
- **O que já mudei (sem afrouxar a regra 18):**
  - citação longa cortada numa palavra;
  - citação parafraseada ancorada na frase literal da fonte com ≥ 60% das palavras;
  - JSON embrulhado desembrulhado por código;
  - listas longas cortadas;
  - fonte não citada retirada;
  - auditor sem critério de extensão.
  Tudo com teste. A citação que chega ao aluno continua sendo literal, e o auditor de outra família
  continua julgando.
- **Próxima prova real:** a noite curta (POST-IT A.1) inclui aulas. O resultado vai para o DIARIO.
- **Se continuar falhando:** (a) testar outro escritor da corrente "tutor" (Muse Glimmer escreveu uma
  e só caiu na citação); (b) deixar as aulas só para tópicos com fonte curta. Não há decisão sua
  agora; anoto aqui para você saber por que o cartão de aula ainda não aparece no servidor.

## 8. Regra de linhas da redação — RESOLVIDO 18/10/2026

> **Decisão do dono:** mantém nota zero abaixo de 25 linhas e desconsidera o que passar de 30.
> **Conferido no edital** (nº 01 – 2022/001, Cesgranrio, cópia em `provas/`): o item 7.3.5 dá nota zero
> só a quem foge ao tipo dissertativo-argumentativo, foge ao tema, escreve sem prosa articulada, se
> identifica ou escreve a lápis. **O edital não fala de número de linhas**; os "25 a 30 linhas" estão
> só na capa do caderno. O app segue a decisão do dono (mais rígido que o edital, de propósito) e passou
> a dar zero também nos casos a–c do 7.3.5, na correção.

Histórico:

- **O que está confirmado:** as provas BB 2021 e 2023 (capa, instrução da redação) dizem "O texto
  deverá ter de 25 a 30 linhas".
- **O que NÃO está nas provas:** a penalidade de quem fica abaixo de 25 e quantos caracteres cabem
  numa linha da folha. Os editais não estão em `provas/`.
- **O que o app faz até você confirmar:** a regra mais conservadora. Abaixo de 25 linhas da folha,
  nota zero por código, sem correção. Acima de 30, só o texto até a linha 30 é corrigido. As linhas
  são estimadas em 70 caracteres cada, com quebra por palavra e parágrafo novo em linha nova.
- **Como mudar:** `shared/redacaoLinhas.ts` (`LINHAS_REDACAO`). Se o edital disser "penalidade
  proporcional" em vez de zero, eu troco a regra.

## 7. Aviso da redação — RESOLVIDO 18/10/2026: "Nota estimada (correção automática; pode variar da banca)"

- **O que é:** a regra 17 do CLAUDE.md manda sinalizar que a nota da redação é estimativa da IA; o
  ADENDO-BANCO-GRANDE diz que o aluno não vê menção a IA nem a modelos.
- **Hoje:** a tela mostra "Nota estimada por IA; use como treino, não como garantia."
- **Opções:** (a) manter; (b) trocar por "Nota estimada pelo corretor automático; use como treino,
  não como garantia." (sinaliza a estimativa sem dizer IA).
- **Recomendação:** (b). Basta dizer "troque o aviso da redação".

## 6. Mistura de dificuldade dos simulados — RESOLVIDO 18/10/2026: 20% fácil, 50% média, 30% difícil (treino segue o rating)

> Também conferido no edital: cotas, valor de cada questão (1,5; Inglês e Atualidades 1,0; total 100),
> cortes de 50% (total, Básicos, Específicos, zero numa disciplina) e duração de 5 h. O resultado do
> simulado mostra os pontos como a banca conta e se a nota eliminaria.

- **O que é:** o simulado segue a mistura de dificuldade das 130 oficiais: hoje **72% fáceis, 27%
  médias, 2% difíceis**. Essa dificuldade das oficiais foi estimada na hora de explicar cada questão,
  não veio da banca, e parece baixa para a prova do BB.
- **Opções:** (a) manter como está; (b) usar a estimativa 20% fáceis / 50% médias / 30% difíceis
  até o edital ou até você recalibrar; (c) reavaliar a dificuldade das oficiais com o auditor.
- **Recomendação:** (b), que deixa o simulado mais puxado que a prova em vez de mais fácil. Basta
  dizer "use a mistura padrão".
- **Também espera o edital:** pesos dos blocos e duração da prova (Ajustes → Duração já liga a
  contagem regressiva; sem pesos, o resultado diz "pesos não confirmados").

---

Resolvido: **baixar leis e normas** — autorizado por você em 17/10/2026, só de sites oficiais
(planalto.gov.br, bcb.gov.br, normativos do CMN/BCB, in.gov.br). Fica na Etapa 2.

## Espaço no Atlas M0 — RESOLVIDO por decisão do dono (19/10/2026)

- Usar como referência real o `Data Size: 165,05 MB / 512 MB` mostrado em Project 0 → Overview → Cluster0. O `dbStats` local não inclui o índice vetorial `chunks_vector` nem todo o overhead do cluster/oplog.
- Para estimar o índice: 2.048 dimensões × 4 bytes por float32, com mais 20% para metadados do índice ANN = aproximadamente 9,6 KiB por chunk. O fator é uma estimativa, não uma medição do Atlas.
- A projeção e o alerta de 80% usam a referência calibrada mais a variação do banco e do índice estimado. O detalhe aparece em `npm run bb -- uso-banco` e em Admin → IA.
