# Decisões pendentes (precisam de você)

Itens que o modo autônomo preparou até o último passo possível. Cada um diz o que é, por que
precisa de você, as opções e a minha recomendação. Em ordem de prioridade.

---

## PRIORIDADE ALTA — Gerador e auditor da mesma família (Nemotron)

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

---

Resolvido: **baixar leis e normas** — autorizado por você em 17/10/2026, só de sites oficiais
(planalto.gov.br, bcb.gov.br, normativos do CMN/BCB, in.gov.br). Fica na Etapa 2.
