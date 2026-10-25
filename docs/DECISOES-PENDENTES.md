# Decisões pendentes (precisam de você)

Itens que o modo autônomo preparou até o último passo possível. Cada um diz o que é, por que
precisa de você, as opções e a minha recomendação. Em ordem de prioridade.

---

## Decisão 2026-10-25a — Crase: a regra "erro_tratamento" (à Vossa Senhoria) trava a aprovação

- **Fato (20 Crase pedidas em 25/10, com o Ultra desempatando):** **0 de 20 aprovadas.** 15 caíram em `auditor_por_frase_discordou` e **as 15 têm a mesma frase de erro: "à Vossa Senhoria"** (regra `erro_tratamento`, `src/portugues.ts`). O auditor (Muse) diz que a frase está correta, e no desempate o Ultra também diz. A gramática está do lado do banco de regras: pronome de tratamento não aceita artigo.
- **O código fez o certo:** pela regra 13, só aprova se o auditor marcar "correta" exatamente na frase do gabarito; não aprovou nenhuma. Nada errado entrou no banco.
- **Efeito:** toda questão que sorteia `erro_tratamento` entre as 4 de erro (quase metade) está condenada antes de começar. Isso custa ~5 min de IA por tentativa e explica a maior parte das reprovações.
- **Também apareceu (escritor):** 2 frases de erro saíram sem o erro, ex.: "O gerente enviou a proposta de crédito ao cliente no balcão". A trava de posição não pegou porque a regra delas não pede "à" num lugar fixo. Isso eu posso consertar sem mudar regra aprovada; fica na fila.
- **Opções:**
  1. Tirar `erro_tratamento` do sorteio até um juiz acertá-la no benchmark (o banco de regras fica igual; só não é sorteada). **Recomendo.**
  2. Manter e aceitar a perda (~metade das tentativas de Crase).
  3. Mudar a frase da regra para "à Sua Excelência" ou "à Vossa Excelência". Duvido que ajude: o erro do juiz é o mesmo.
- **Por que precisa de você:** o banco de regras da Crase foi aprovado por você, e tirar uma regra do sorteio muda a variedade das questões.

---

## Decisão 0 — Juiz de Português sem modelo funcionando (24/10/2026) — RESOLVIDO 25/10/2026

> **Decisão do dono (25/10):** `juiz_pt` e Redação = Ultra → Muse, sem `reasoning_budget` no Ultra; Super fora até nova sondagem provar estabilidade. Ativo com `npm run bb -- corrente definitiva` (commit `02e5e4d`); reverter com `corrente desfazer`. O texto abaixo é o histórico da proposta.

- **Fato:** o `nemotron-3-super` (1º do `juiz_pt` e da Redação na corrente definitiva) responde 404 "Function not found for account" desde 22/10. Sondado de novo em 24/10: 404 nos 4 modos. O 2º, Ultra, está marcado "fora" desde 17/10 (503).
- **Efeito:** a Crase e as outras de Português por construção não têm desempate. Desde 24/10 elas ficam `pendente / aguardando_auditoria_independente` (antes eram descartadas). A Redação está caindo no Muse (3º da corrente).
- **Evidência (benchmark do juiz, 46 frases, `docs/BENCHMARK-MODELOS.md`):** Ultra 96% (6 s, 100% disponível em 24/10, só recusa `reasoning_budget`); Muse 96% (27 s); step-5-preview 93% (preview); gpt-oss-20b 87%; glm-5.3-flash 100%, mas com 107 s e timeouts (e é o escritor). Os intervalos se sobrepõem: sem vencedor claro.
- **Proposta:** `juiz_pt` = Ultra → Muse, com o Ultra marcado "ativo" e sem `reasoning_budget` (o código só manda o que o catálogo aceita).
  - Independência: o escritor é glm → gpt → Muse. Quando o Muse escreve, julga o Ultra; quando o Ultra falhar e quem escreveu foi o Muse, a frase fica aguardando.
  - Redação: Ultra → Muse.
  - Step-5-preview continua só em teste.
- **Por que precisa de você:** a corrente definitiva é decisão sua, e a V2 diz para manter o Ultra fora "enquanto persistirem recusas de parâmetros ou 503". A recusa de `reasoning_budget` persiste, mas é um parâmetro que o código não precisa mandar.
- **Como reverter:** `npm run bb -- corrente desfazer`.

---

## Decisão 1a — BB 2021, Q51 (Segurança da informação): manter no treino

- **Decisão do dono aplicada em 19/10/2026:** recusada a proposta de desatualização. A Q51 é uma classificação conceitual de controle de segurança em Informática; a Resolução CMN 5.274/2025 não altera esse conceito.
- A questão permanece `aprovada` e `situacaoFonte: confirmada`. O motivo e a data da recusa foram guardados junto ao histórico da mudança proposta.
- Na tela Admin → Pendências, cada mudança pendente agora oferece **Manter questão**. A ação pede o motivo, confirma a fonte e preserva o status atual; aprovar a mudança continua sendo uma ação separada.

---

## Decisão 1b — BB 2023, Q40: histórica por mudança legal

- **Aprovação do dono já registrada na tela:** a atribuição do CMN de autorizar a emissão de papel-moeda foi revogada do art. 4º, I, da Lei 4.595/1964 pela LC 179/2021.
- Conferência do banco em 19/10/2026: status `desatualizada`; a consulta do simulado fiel usa apenas `status: aprovada`, então Q40 não é elegível. A questão continua acessível pelo histórico/ID e o DTO entrega o aviso legal; a tela mostra “Norma atualizada · essa questão saiu do treino”.

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
- **Por que precisa de você:** trocar modelo de produção é decisão sua.
- **Opções:** A) gerador Nemotron + auditor de outra família; B) gerador gpt-oss/Muse + auditor Nemotron.
  A proposta com evidência, riscos e plano de reversão entra aqui quando o benchmark terminar.
- **Como aprovar:** tela Benchmark → "Aprovar corrente" (com confirmação e "Desfazer"), ou
  `CORRENTE_ATIVA=1` + `CORRENTE_<FUNÇÃO>` no `.env`.

## 13. Bancários: 11 oficiais sem base atual (média) — PROPOSTA (20/10/2026, F3)

- **Situação** (`npm run bb -- fontes-atuais relatorio --disciplina conhecimentos_bancarios`): das 20 oficiais, 8 confirmadas, 1 "mudou" (BB 2023 Q40, esperando seu OK em Admin → Pendências) e 11 pendentes. Motivo do conferente em todas: "sem fonte atual ingerida sobre o assunto".
- **Feito no F3:**
  - Res. BCB 61/2021 (Copom), 519/2025, 521/2025 (originais nunca alterados) e 520/2025 (compilada v2, 30/9/2026) vieram da API pública do BCB e foram ingeridas: +201 trechos, Atlas 191,4 → 198,8 MB.
  - Elas reforçam Copom e Atualidades (criptoativos), não os tópicos das 11.
  - MCR consolidado **não existe** na API (ver `data/fontes-oficiais.json`, `mcr-pronaf-2026`).
- **Proposta por tópico** (só planalto.gov.br, bcb.gov.br, in.gov.br; nada baixado sem o seu OK):

| Tópico (questões pendentes) | Proposta |
|---|---|
| Mercados financeiros: monetário, de crédito, de capitais e de câmbio (BB 2021 Q32, Q38, Q39; BB 2023 Q34, Q35, Q36, Q39) | Na maioria é conceito de mercado (doutrina), não norma: marcar "não se aplica", como Informática. As de câmbio: ligar a Lei 14.286/2021 (já ingerida) ao tópico |
| Mercado de capitais e fundos de investimento (BB 2021 Q35, Q40) | Resolução CVM nº 175/2022 (fundos), publicada no DOU (in.gov.br); a Lei 6.385/1976 já está ingerida |
| Títulos públicos e Tesouro Direto (BB 2021 Q33) | Conceito de mercado: "não se aplica" (o regulamento do Tesouro Direto não está nos domínios permitidos) |
| Produtos bancários (BB 2021 Q36) | Conferir a questão; se for tarifa, já há a Res. CMN 3.919 (ingerida); senão, "não se aplica" |
| Autorregulação bancária e ética (BB 2023 Q32) | Autorregulação é norma privada (FEBRABAN), fora dos domínios oficiais: "não se aplica" |
| MCR (recortes 3-5 e 10-6) | Abrir o MCR no site do BCB e importar só esses recortes (`fonte <arquivo> --tipo norma_bacen_cmn`) |

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

### Decisão aplicada: dois tópicos doutrinários de Vendas

- **Atendimento, satisfação e experiência do cliente** e **Segmentação de mercado e gestão de carteira** ficam como `nao_se_aplica` para fonte atual, exceto questão que cite expressamente SAC/Decreto 11.034, suitability/Resolução CVM 30 ou CDC.
- Na conferência do banco, a Q57 da BB 2023 (Segmentação) cita o CDC: ficou `confirmada`, ligada ao trecho do art. 6º, III, da Lei 8.078/1990. Por decisão posterior do dono, a Q58 da BB 2023 (Atendimento) fica `confirmada` com a Res. CMN 4.860/2020, art. 3º, I: sua resposta sobre Ouvidoria está diretamente coberta pela norma vigente; a referência está ligada ao trecho literal. Não havia questão que citasse suitability/Resolução CVM 30.
- As demais questões dos dois tópicos foram classificadas `nao_se_aplica`; a classificação não altera o status de treino. A questão histórica que cita norma revogada mantém o aviso e o status histórico.

## Decisão 1d — proposta de fontes para as 17 pendências de Conhecimentos Bancários

**Proposta em 19/10/2026; nenhuma fonte nova foi baixada ou ingerida.** Fontes listadas vêm somente do Planalto ou do Banco Central. A conferência de 20 questões deixou 17 sem base atual suficiente. A projeção usa a calibração de `uso-banco`: **38,1 KB por chunk novo**, incluindo o índice vetorial estimado; cada intervalo é aproximado pelo tamanho e pelo recorte que seria ingerido. Fontes que já estão no banco têm **0 MB incrementais**.

### Cobertura direta das 17

| Questão | Assunto da questão | Fonte que responderia diretamente |
|---|---|---|
| BB 2021 Q32–33 | Fuga de capitais e desvalorização do real | Sem norma direta: explicação macroeconômica conceitual |
| BB 2021 Q34 | Compras de títulos durante a pandemia | EC 106/2020, art. 7º — 1/17; histórica e temporária |
| BB 2021 Q35 | CDB | Lei 13.986/2020, arts. 30–33 — 1/17 |
| BB 2021 Q36 | Linha Pronaf Agroindústria | MCR, capítulos 3, seção 5, e 10, seção 6 — 1/17 |
| BB 2021 Q37 | Garantia por alienação fiduciária de veículo | Decreto-Lei 911/1969, texto compilado — 1/17 |
| BB 2021 Q38 | Paridade do Big Mac | Sem norma direta: conceito de paridade do poder de compra |
| BB 2021 Q39 | Depósitos em espécie atípicos | Carta-Circular BCB 4.001/2020, versão vigente — junto com BB 2023 Q31, 2/17 |
| BB 2021 Q40 | Código de Ética do Banco do Brasil | Sem fonte nos domínios autorizados; é documento institucional do BB |
| BB 2023 Q31 | Perfil financeiro incompatível e monitoramento | Carta-Circular BCB 4.001/2020, versão vigente — cobertura conjunta acima |
| BB 2023 Q32 | Código de Ética do Banco do Brasil | Sem fonte nos domínios autorizados; é documento institucional do BB |
| BB 2023 Q33 | Controles de segurança cibernética | Res. CMN 4.893/2021, já no banco — 1/17 |
| BB 2023 Q34 | Depreciação cambial e exportações | Sem norma direta: relação econômica conceitual |
| BB 2023 Q35 | Receitas e despesas administrativas de tesouraria | Sem norma direta: prática/contabilidade bancária conceitual |
| BB 2023 Q36 | Paridade relativa de poder de compra | Sem norma direta: relação entre inflação e câmbio |
| BB 2023 Q37 | Recolhimentos e M1 | Lei 4.595/1964, art. 10, XII, já no banco — 1/17 |
| BB 2023 Q39 | Paridade de juros com câmbio fixo e mobilidade de capital | Sem norma direta: conceito macroeconômico |

Resultado da cobertura direta: **8/17** podem ser respondidas por normas oficiais específicas: 6 questões nas fontes novas propostas e 2 em fontes já existentes. A EC 106 é histórica e temporária; **9/17** são conceituais ou dependem de código interno do BB e não ganhariam resposta direta com norma dos domínios permitidos.

### Normas e espaço projetado

| Fonte proposta | Questões cobertas entre as 17 | Chunks estimados | Espaço projetado no Atlas | Situação |
|---|---:|---:|---:|---|
| [EC 106/2020, art. 7º](https://www.planalto.gov.br/ccivil_03/constituicao/emendas/emc/emc106.htm) | 1 | 5–8 | 0,19–0,30 MB | Nova; texto de medida temporária da pandemia |
| [Lei 13.986/2020, arts. 30–33](https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2020/lei/l13986.htm) | 1 | 2–4 | 0,08–0,15 MB | Nova; recorte somente dos artigos do CDB |
| [MCR atual, cap. 3, seção 5, e cap. 10, seção 6](https://www3.bcb.gov.br/mcr/completo) | 1 | 4–6 | 0,15–0,23 MB | Nova; recorte do Pronaf Agroindústria |
| [Decreto-Lei 911/1969, compilado](https://www.planalto.gov.br/ccivil_03/decreto-lei/1965-1988/del0911compilado.htm) | 1 | 12–18 | 0,46–0,69 MB | Nova |
| [Carta-Circular BCB 4.001/2020, versão vigente](https://normativos.bcb.gov.br/Lists/Normativos/Attachments/50911/C_Circ_4001_v4_L.pdf) | 2 | 12–18 | 0,46–0,69 MB | Nova; uma fonte responde às Q39 e Q31 |
| [Res. CMN 4.893/2021](https://www.bcb.gov.br/estabilidadefinanceira/exibenormativo?numero=4893&tipo=Resolu%C3%A7%C3%A3o+CMN) | 1 | 25 já existentes | 0 incremental (≈0,95 MB estimado existente) | Já no banco |
| [Lei 4.595/1964](https://www.planalto.gov.br/ccivil_03/leis/l4595.htm) | 1 | 58 já existentes | 0 incremental (≈2,21 MB estimado existente) | Já no banco |
| [Lei 4.728/1965, compilada](https://www.planalto.gov.br/ccivil_03/leis/l4728compilado.htm) | 0 | 25–35 | 0,95–1,33 MB | Proposta para contexto de mercado; não responde diretamente nenhuma das 17 |
| [Lei 6.385/1976](https://www.planalto.gov.br/ccivil_03/leis/l6385.htm) | 0 | 53 já existentes | 0 incremental (≈2,02 MB estimado existente) | Já no banco; sem cobertura direta |
| [Lei 14.286/2021](https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14286.htm) | 0 | 29 já existentes | 0 incremental (≈1,10 MB estimado existente) | Já no banco; sem cobertura direta |
| [Regulamento atual do Copom, Res. BCB 61/2021](https://www.bcb.gov.br/estabilidadefinanceira/exibenormativo?numero=61&tipo=Resolu%C3%A7%C3%A3o+BCB) | 0 | 8–12 | 0,30–0,46 MB | Nova; nenhuma das 17 pergunta sobre competências/funcionamento atual do Copom |
| [Lei 14.478/2022](https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2022/lei/l14478.htm) | 0 | 12 já existentes | 0 incremental (≈0,46 MB estimado existente) | Já no banco; contexto do tópico separado de criptoativos |
| [Res. BCB 519/2025](https://www.bcb.gov.br/estabilidadefinanceira/exibenormativo?numero=519&tipo=Resolu%C3%A7%C3%A3o+BCB) | 0 | 12–18 | 0,46–0,69 MB | Nova; autorização de prestadoras de ativos virtuais |
| [Res. BCB 520/2025 consolidada com a Res. 589/2026](https://www.bcb.gov.br/estabilidadefinanceira/exibenormativo?numero=520&tipo=Resolu%C3%A7%C3%A3o+BCB) | 0 | 16–24 | 0,61–0,91 MB | Nova; prestação de serviços por PSAV; considerar vigências de 2026/2027 da Res. 589 |
| [Res. BCB 521/2025](https://www.bcb.gov.br/estabilidadefinanceira/exibenormativo?numero=521&tipo=Resolu%C3%A7%C3%A3o+BCB) | 0 | 6–10 | 0,23–0,38 MB | Nova; câmbio e capitais internacionais ligados a ativos virtuais |

As Leis 4.728, 6.385 e 14.286 não respondem diretamente nenhuma das 17 questões; no P1.1 aprovado, Lei 4.728 foi ingerida como contexto e as Leis 6.385/14.286 foram ligadas ao tópico Mercados. A Lei 14.478 já está ligada ao tópico ativo Criptoativos. As Resoluções BCB 519, 520 e 521 também pertencem a esse tópico e seguem pendentes apenas pela indisponibilidade local do texto vigente. Para a Res. 520, o texto usado deve refletir a alteração da Res. 589/2026, inclusive as vigências futuras previstas nela. O regulamento do Copom é a Res. BCB 61/2021 e segue pendente pelo mesmo bloqueio de acesso ao texto.

Estimativa original antes da autorização: todas as fontes novas acrescentariam **102–153 chunks (≈3,89–5,83 MB)**; projeção de 167,73 MB para aproximadamente **171,62–173,56 MB de 512 MB**, abaixo do alerta de 80% (409,6 MB). A autorização posterior consta em `docs/PROMPT-CODEX-SPRINT-REVISADO.md`; a medição após a ingestão está registrada a seguir.

### Execução P1.1 — fontes aprovadas e conferência (19/10/2026)

- Baixadas somente de Planalto/BCB `normativos` e ingeridas serialmente: EC 106/2020 art. 7º (**2 trechos**), Lei 13.986/2020 arts. 30–33 (**1**), DL 911/1969 (**22**) e Carta-Circular BCB 4.001/2020 v4 (**31**). Lei 4.728/1965 compilada, aprovada como contexto de mercados, acrescentou **70 trechos**. Total: **126 chunks**, projeção aproximada de **4,80 MB**; DL 911 e Carta-Circular excederam suas estimativas iniciais.
- Vínculos conferidos: EC 106 → Títulos públicos; Lei 13.986 → Produtos bancários; DL 911 → Garantias; Carta-Circular → Mercados e PLD/FT; Lei 4.728 → Mercados. Fontes já existentes foram ligadas após simulação: Lei 6.385 (**53**), Lei 14.286 (**10 novos**), Lei 4.595 (**54**) e Res. CMN 4.893 (**25**). A Lei 14.478 já tinha **12/12** trechos ligados a Criptoativos.
- Atlas antes/depois: **168,06 → 172,77 MB**, **904 → 1.030 chunks**, índice vetorial estimado **8,48 → 9,66 MB**. A previsão atual, se os atos ainda inacessíveis forem ingeridos, é **174,52–175,44 MB**, ainda abaixo de **409,6 MB** (80%); a medição estima cerca de **6.365 chunks** de margem.
- Conferência das 17 pendências, com um trabalhador: **4 confirmadas**, **13 ainda pendentes**, **0 novas mudanças**; nenhuma mudança legal foi aprovada automaticamente. Confirmadas nesta rodada: BB 2021 Q37; BB 2023 Q31, Q33 e Q37. Pendentes: BB 2021 Q32–36, Q38–40; BB 2023 Q32, Q34–36 e Q39. Q40 de 2023 permanece histórica/desatualizada conforme decisão anterior.
- Ficaram pendentes por acesso ao texto vigente: MCR 3-5/10-6, Res. BCB 61/2021, e Resoluções BCB 519/520/521 de 2025. Os visualizadores do BCB retornam apenas a página JavaScript ao downloader; buscas em `normativos.bcb.gov.br` não localizaram PDF consolidado (na Res. 61, o resultado encontrado era a Circular 3.868, revogada). Para a Res. 520, importar somente a versão consolidada com a Res. 589/2026 e respeitar as vigências futuras. Links e instruções de importação manual estão em `data/fontes-oficiais.json`.

## Decisão aplicada — matemática por construção (19/10/2026)

- A checagem do sorteio encontrou que ele era uniforme entre os tipos de `data/variacoes.json`, mas **nenhum tipo dos seis assuntos estava livre**: Juros compostos 8/8, Descontos 4/4, Sistemas de amortização 5/5, Taxas de juros 4/4, Análise combinatória 4/4 e Probabilidade 3/3 são cobertos por `tiposConstruidos()`. Portanto, as rodadas anteriores não escolheram tipos livres; as falhas vieram do texto da IA, não da escolha de variante.
- `src/variacao.ts` agora dá preferência de **80% a tipos construídos** quando um pool desses assuntos vier a misturar tipos com e sem construção; com os tipos atuais, a proporção efetiva é 100%. Tipos forçados e as regras de figura/duas etapas continuam respeitados.
- Em questões construídas desses seis assuntos, a resolução das alternativas e a explicação geral são montadas pela resolução calculada em código. Em Amortização, o enunciado passa a declarar SAC/Price e a completar números omitidos em uma frase natural, em vez de perder a questão ou deixar o sistema implícito. Em Taxas, o prompt diferencia taxa mensal efetiva de taxa nominal anual com capitalização.
- Rodadas reais finais, serialmente: **Taxas de juros 3/3 aprovadas** (taxas proporcionais, efetiva a partir da nominal, equivalentes); **Sistemas de amortização 3/3 aprovadas** (saldo SAC, juros SAC, comparação SAC × Price). Antes: Taxas 0/3 por explicações de conta incorretas; Amortização 1/3, com duas perdas por dado numérico ausente. A primeira tentativa intermediária de Amortização expôs também a ambiguidade de SAC quando o auditor não via o sistema; esse caso levou à inclusão explícita do sistema e à frase natural de dados antes da rodada final.

## 1. Revisar o glossário de Vendas (Etapa 2.4)

- **O que é:** `docs/fontes-vendas/glossario.md` (pronto em 18/10/2026): 25 verbetes tirados das 27 oficiais
  de Vendas vigentes (2021 e 2023), cada um citando as questões que o sustentam.
- **Por que precisa de você:** é fonte doutrinária escrita por IA (regra A6 e regra 3 do
  `CLAUDE.md`). Ele **não está no banco**: Vendas por doutrina só gera depois do seu OK.
- **Como fazer:** ler o glossário (Admin → Pendências → "Glossário de Vendas"); se estiver bom,
  `npm run bb -- liberar-fonte "Glossário de Vendas"` (é esse comando que ingere).

## 1b. Três normas do BCB sem texto atualizado — concluído em 19/10/2026

- Resolução BCB nº 1/2020 (Pix): texto compilado vigente, versão 43, datado pelo BCB em 2/10/2026. Fonte oficial: https://www.bcb.gov.br/api/conteudo/app/normativos/exibeversao?p1=51118&p2=43&p3=Compilado. Ingeridos 231 trechos.
- Circular BCB nº 3.978/2020 (PLD/FT): PDF de texto vigente compilado v6_L, do registro oficial 50905. Fonte: https://normativos.bcb.gov.br/Lists/Normativos/Attachments/50905/Circ_3978_v6_L.pdf. Ingeridos 62 trechos.
- Resolução CMN nº 3.919/2010 (tarifas): PDF de texto vigente compilado v7_L, do registro oficial 49514. Fonte: https://normativos.bcb.gov.br/Lists/Normativos/Attachments/49514/Res_3919_v7_L.pdf. Ingeridos 36 trechos.
- Cada fonte foi baixada, simulada e ingerida isoladamente. A coleção Atlas não tinha versão anterior dessas três normas; não havia fonte antiga para marcar como revogada. Nenhum texto antigo foi mantido como vigente. Os arquivos e os metadados de consulta, tamanho e hash ficam em fontes/LEIAME.json (fora do Git). PDFs deram avisos do extrator sobre operadores não suportados, mas a extração passou e as contagens foram conferidas antes da ingestão.

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
- **Próxima prova real:** a noite curta inclui aulas. O resultado vai para o DIARIO.
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
  a regra do banco grande diz que o aluno não vê menção a IA nem a modelos.
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
