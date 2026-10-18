# Decisões pendentes (precisam de você)

Itens que o modo autônomo preparou até o último passo possível. Cada um diz o que é, por que
precisa de você, as opções e a minha recomendação. Em ordem de prioridade.

---

## 1. Revisar o glossário de Vendas (Etapa 2.4)

- **O que é:** `docs/fontes-vendas/glossario.md`, escrito a partir das 28 questões oficiais.
- **Por que precisa de você:** é fonte doutrinária escrita por IA (regra A6 e regra 3 do
  `CLAUDE.md`). Vendas por doutrina só gera depois do seu OK.
- **Como fazer:** ler o glossário; se estiver bom, `npm run bb -- liberar-fonte "Glossário de Vendas"`.

## 2. Conta de administrador (Etapa 4)

- **O que é:** criar a sua conta real de login.
- **Por que precisa de você:** o modo autônomo não cria conta com seus dados nem escolhe sua senha.
- **Como fazer:** `npm run bb -- criar-admin <seu-email>` (pede a senha no terminal e migra
  todo o seu progresso atual para essa conta).

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
