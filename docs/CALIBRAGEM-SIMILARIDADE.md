# Calibragem do filtro de similaridade

Gerado em 17/10/2026, 20:59:02 por `npm run bb -- similaridade calibrar`.

**Limites atuais** (`.env`, conservadores): duplicada ≥ 0,970 · parecida ≥ 0,930 · paráfrase de oficial ≥ 0,930 · trechos (Jaccard) ≥ 0,600.

**Base:** 156 questões (fora as rejeitadas), 657 pares comparados (mesmo tópico + geradas × oficiais da disciplina), 657 com embedding nos dois lados.

| cosseno | pares |
|---|---|
| < 0,80 | 650 |
| 0,80–0,85 | 5 |
| 0,85–0,90 | 1 |
| 0,90–0,93 | 0 |
| 0,93–0,95 | 1 |
| 0,95–0,97 | 0 |
| ≥ 0,97 | 0 |

Maior sobreposição de trechos: 0,523.

**Como classificar:** marque `repetida` se um aluno sentiria que já fez essa questão; `ok` se são questões diferentes.
Depois, ajuste `SIMILAR_DUPLICADA` e `SIMILAR_PARECIDA` no `.env` para que as "repetidas" fiquem acima do limite e as "ok" abaixo.

## Perto do limite "duplicada" (0,970)

### 1. cosseno 0,939 · trechos 0,523 · Juros compostos

> **gerada 6ad090cff648279cd1b7605c** — Um cliente deseja aplicar R$ 4.000,00 em um investimento que rende juros de 4% ao ano, capitalizados anualmente, por 8 anos. Considerando que 1,04^8 = 1,3686, qual será o montante final? Resposta: R$ 5.474,40
>
> **gerada 6ad0921d7e82740f59004d5f** — Um cliente deseja aplicar R$ 5.000,00 em um investimento que rende juros de 4% ao ano, capitalizados anualmente, por 8 anos. Considerando que 1,04^8 = 1,3686, qual será o montante (valor futuro) ao final do período? Resposta: R$ 6.843,00

- [ ] repetida  - [ ] ok

### 2. cosseno 0,871 · trechos 0,068 · Razão, proporção, regra de três e porcentagem

> **BB 2023 — Escriturário Agente Comercial nº 19** — Três novas agências de um banco estão sendo criadas, e alguns poucos materiais ainda precisam ser comprados. A Tabela a seguir mostra esses materiais e suas respectivas quantidades, pedidas por cada uma dessas agências. Sabe-se que todos os armários são idênticos e têm o mesmo preço, o mesmo ocorrendo com as mesas e com as cadeiras. Armário Mesa Cadeira Custo total (R$) Agência X 4 7 10 7500 Agência Y 1 2 3 2080 Agên…
>
> **gerada 6ad2255834220f3eb6eea79e** — Considere a Tabela a seguir, que relaciona a quantidade de armários, mesas e cadeiras adquiridas por três agências (X, Y e Z) ao custo total da compra em reais. | | Armário | Mesa | Cadeira | Custo total (R$) | | Agência X | 2 | 5 | 5 | 7210 | | Agência Y | 2 | 2 | 4 | 4520 | | Agência Z | 6 | 12 | 14 | ? | Qual o custo total da compra para a Agência Z, em reais? Resposta: R$ 18.940,00

- [ ] repetida  - [ ] ok

### 3. cosseno 0,842 · trechos 0,049 · Juros compostos

> **gerada 6ad090cff648279cd1b7605c** — Um cliente deseja aplicar R$ 4.000,00 em um investimento que rende juros de 4% ao ano, capitalizados anualmente, por 8 anos. Considerando que 1,04^8 = 1,3686, qual será o montante final? Resposta: R$ 5.474,40
>
> **gerada 6ad092a07e82740f59004d60** — Um cliente aplica R$ 3.000,00 em uma aplicação que rende juros de 5% ao ano, capitalizados anualmente, por 4 anos. Considerando que 1,05^4 = 1,2155, qual é o montante ao final do período? Resposta: R$ 3.646,50

- [ ] repetida  - [ ] ok

### 4. cosseno 0,827 · trechos 0,095 · Juros compostos

> **gerada 6ad0921d7e82740f59004d5f** — Um cliente deseja aplicar R$ 5.000,00 em um investimento que rende juros de 4% ao ano, capitalizados anualmente, por 8 anos. Considerando que 1,04^8 = 1,3686, qual será o montante (valor futuro) ao final do período? Resposta: R$ 6.843,00
>
> **gerada 6ad092a07e82740f59004d60** — Um cliente aplica R$ 3.000,00 em uma aplicação que rende juros de 5% ao ano, capitalizados anualmente, por 4 anos. Considerando que 1,05^4 = 1,2155, qual é o montante ao final do período? Resposta: R$ 3.646,50

- [ ] repetida  - [ ] ok

### 5. cosseno 0,811 · trechos 0,433 · Regência verbal e nominal e crase

> **gerada 6ad0cfba76f20551f6117884** — Ao revisar mensagens de uma agência bancária (aplicação em CDB), um escriturário analisou as frases a seguir. O uso ou a ausência do acento indicativo de crase está de acordo com a norma-padrão da língua portuguesa em: Resposta: O cliente dirigiu-se à gerente para solicitar o empréstimo
>
> **gerada 6ad168c7ce505acc3ca4701b** — Ao revisar comunicados de uma agência bancária sobre caderneta de poupança, um escriturário analisou as frases a seguir. O uso ou a ausência do acento indicativo de crase está de acordo com a norma-padrão da língua portuguesa em: Resposta: O cliente referiu-se àquela caderneta de poupança aberta em janeiro pela agência

- [ ] repetida  - [ ] ok

### 6. cosseno 0,804 · trechos 0,400 · Regência verbal e nominal e crase

> **gerada 6ad0cfba76f20551f6117884** — Ao revisar mensagens de uma agência bancária (aplicação em CDB), um escriturário analisou as frases a seguir. O uso ou a ausência do acento indicativo de crase está de acordo com a norma-padrão da língua portuguesa em: Resposta: O cliente dirigiu-se à gerente para solicitar o empréstimo
>
> **gerada 6ad16986ce505acc3ca4701c** — Ao revisar comunicados de uma agência bancária sobre financiamento imobiliário ou de veículo, um escriturário analisou as frases a seguir. O uso ou a ausência do acento indicativo de crase está de acordo com a norma-padrão da língua portuguesa em: Resposta: O gerente começou a analisar o contrato de financiamento do veículo do cliente.

- [ ] repetida  - [ ] ok

### 7. cosseno 0,802 · trechos 0,413 · Regência verbal e nominal e crase

> **gerada 6ad16a3bce505acc3ca4701d** — Ao revisar comunicados de uma agência bancária sobre desconto de duplicata por uma empresa (PJ), um escriturário analisou as frases a seguir. O uso ou a ausência do acento indicativo de crase está de acordo com a norma-padrão da língua portuguesa em: Resposta: O sócio da empresa dirigiu-se à gerência para negociar o desconto das duplicatas.
>
> **gerada 6ad1df18c64538681c03623c** — Ao revisar comunicados de uma agência bancária sobre desconto de duplicata por uma empresa (PJ), um escriturário analisou as frases a seguir. O uso ou a ausência do acento grave está de acordo com a norma-padrão em: Resposta: O banco mantém os títulos à disposição da empresa que solicitou o desconto das duplicatas.

- [ ] repetida  - [ ] ok

### 8. cosseno 0,791 · trechos 0,389 · Regência verbal e nominal e crase

> **gerada 6ad16986ce505acc3ca4701c** — Ao revisar comunicados de uma agência bancária sobre financiamento imobiliário ou de veículo, um escriturário analisou as frases a seguir. O uso ou a ausência do acento indicativo de crase está de acordo com a norma-padrão da língua portuguesa em: Resposta: O gerente começou a analisar o contrato de financiamento do veículo do cliente.
>
> **gerada 6ad1a2e2d1efdcfd2398f265** — Ao revisar comunicados de uma agência bancária sobre financiamento imobiliário ou de veículo, um escriturário analisou as frases a seguir. O uso ou a ausência do acento grave está de acordo com a norma-padrão em: Resposta: O cliente preferiu o financiamento do veículo com pagamento a prazo de sessenta meses.

- [ ] repetida  - [ ] ok

### 9. cosseno 0,777 · trechos 0,371 · Regência verbal e nominal e crase

> **gerada 6ad168c7ce505acc3ca4701b** — Ao revisar comunicados de uma agência bancária sobre caderneta de poupança, um escriturário analisou as frases a seguir. O uso ou a ausência do acento indicativo de crase está de acordo com a norma-padrão da língua portuguesa em: Resposta: O cliente referiu-se àquela caderneta de poupança aberta em janeiro pela agência
>
> **gerada 6ad1a1d4d1efdcfd2398f264** — Ao revisar comunicados de uma agência bancária sobre caderneta de poupança, um escriturário analisou as frases a seguir. O uso ou a ausência do acento grave está de acordo com a norma-padrão em: Resposta: O gerente conferirá o saldo da caderneta de poupança às 16 horas de hoje.

- [ ] repetida  - [ ] ok

### 10. cosseno 0,775 · trechos 0,384 · Regência verbal e nominal e crase

> **gerada 6ad0cfba76f20551f6117884** — Ao revisar mensagens de uma agência bancária (aplicação em CDB), um escriturário analisou as frases a seguir. O uso ou a ausência do acento indicativo de crase está de acordo com a norma-padrão da língua portuguesa em: Resposta: O cliente dirigiu-se à gerente para solicitar o empréstimo
>
> **gerada 6ad16a3bce505acc3ca4701d** — Ao revisar comunicados de uma agência bancária sobre desconto de duplicata por uma empresa (PJ), um escriturário analisou as frases a seguir. O uso ou a ausência do acento indicativo de crase está de acordo com a norma-padrão da língua portuguesa em: Resposta: O sócio da empresa dirigiu-se à gerência para negociar o desconto das duplicatas.

- [ ] repetida  - [ ] ok

## Perto do limite "parecida" (0,930)

### 1. cosseno 0,759 · trechos 0,457 · Regência verbal e nominal e crase

> **gerada 6ad168c7ce505acc3ca4701b** — Ao revisar comunicados de uma agência bancária sobre caderneta de poupança, um escriturário analisou as frases a seguir. O uso ou a ausência do acento indicativo de crase está de acordo com a norma-padrão da língua portuguesa em: Resposta: O cliente referiu-se àquela caderneta de poupança aberta em janeiro pela agência
>
> **gerada 6ad16986ce505acc3ca4701c** — Ao revisar comunicados de uma agência bancária sobre financiamento imobiliário ou de veículo, um escriturário analisou as frases a seguir. O uso ou a ausência do acento indicativo de crase está de acordo com a norma-padrão da língua portuguesa em: Resposta: O gerente começou a analisar o contrato de financiamento do veículo do cliente.

- [ ] repetida  - [ ] ok

### 2. cosseno 0,756 · trechos 0,014 · Juros compostos

> **gerada 6ad0c4986d308edf8cfc915c** — Você aplicou R$ 20.000,00 em um CDB que oferece juros compostos em duas etapas consecutivas. Na primeira etapa, a aplicação rende 4% ao mês por 3 meses. Após esse período, os rendimentos são reinvestidos em outro CDB que rende 3% ao mês por 6 meses. Considerando os fatores 1,04³ = 1,1249 e 1,03⁶ = 1,1941, qual é o montante final após as duas etapas? Resposta: R$ 26.864,86
>
> **gerada 6ad0c53e6d308edf8cfc915d** — Em uma operação de financiamento de veículo, o cliente tem o valor total atualizado em duas etapas consecutivas de juros compostos. Na primeira etapa, incide-se 2% ao mês sobre o valor inicial de R$ 6.000,00 por um prazo de 2 meses. Na segunda etapa, aplica-se 5% ao mês sobre o valor acumulado da primeira etapa por mais 4 meses. Sabendo-se que 1,02^2 = 1,0404 e 1,05^4 = 1,2155, qual será o montante final após essas d…

- [ ] repetida  - [ ] ok

### 3. cosseno 0,747 · trechos 0,452 · Regência verbal e nominal e crase

> **gerada 6ad1a031d1efdcfd2398f263** — Ao revisar comunicados de uma agência bancária sobre empréstimo pessoal, um escriturário analisou as frases a seguir. O uso ou a ausência do acento grave está de acordo com a norma-padrão em: Resposta: O gerente acompanha dia a dia o pagamento das parcelas do empréstimo pessoal.
>
> **gerada 6ad1a1d4d1efdcfd2398f264** — Ao revisar comunicados de uma agência bancária sobre caderneta de poupança, um escriturário analisou as frases a seguir. O uso ou a ausência do acento grave está de acordo com a norma-padrão em: Resposta: O gerente conferirá o saldo da caderneta de poupança às 16 horas de hoje.

- [ ] repetida  - [ ] ok

### 4. cosseno 0,745 · trechos 0,438 · Regência verbal e nominal e crase

> **gerada 6ad168c7ce505acc3ca4701b** — Ao revisar comunicados de uma agência bancária sobre caderneta de poupança, um escriturário analisou as frases a seguir. O uso ou a ausência do acento indicativo de crase está de acordo com a norma-padrão da língua portuguesa em: Resposta: O cliente referiu-se àquela caderneta de poupança aberta em janeiro pela agência
>
> **gerada 6ad16a3bce505acc3ca4701d** — Ao revisar comunicados de uma agência bancária sobre desconto de duplicata por uma empresa (PJ), um escriturário analisou as frases a seguir. O uso ou a ausência do acento indicativo de crase está de acordo com a norma-padrão da língua portuguesa em: Resposta: O sócio da empresa dirigiu-se à gerência para negociar o desconto das duplicatas.

- [ ] repetida  - [ ] ok

### 5. cosseno 0,741 · trechos 0,000 · Juros compostos

> **gerada 6ad0c3746d308edf8cfc915a** — João aplicou R$ 8.000,00 em um CDB no Banco do Brasil. A instituição oferece duas formas de cálculo de rendimento para o mesmo prazo de 6 meses a 4% ao mês: uma com juros simples e outra com juros compostos. Informamos que, para juros compostos, considera-se 1,04^6 = 1,2653, e para efeitos de projeções maiores, 1,04^8 = 1,3686. Qual será a diferença entre o montante final da aplicação com juros compostos e a com juro…
>
> **gerada 6ad0c4986d308edf8cfc915c** — Você aplicou R$ 20.000,00 em um CDB que oferece juros compostos em duas etapas consecutivas. Na primeira etapa, a aplicação rende 4% ao mês por 3 meses. Após esse período, os rendimentos são reinvestidos em outro CDB que rende 3% ao mês por 6 meses. Considerando os fatores 1,04³ = 1,1249 e 1,03⁶ = 1,1941, qual é o montante final após as duas etapas? Resposta: R$ 26.864,86

- [ ] repetida  - [ ] ok

### 6. cosseno 0,736 · trechos 0,235 · Regência verbal e nominal e crase

> **gerada 6ad16a3bce505acc3ca4701d** — Ao revisar comunicados de uma agência bancária sobre desconto de duplicata por uma empresa (PJ), um escriturário analisou as frases a seguir. O uso ou a ausência do acento indicativo de crase está de acordo com a norma-padrão da língua portuguesa em: Resposta: O sócio da empresa dirigiu-se à gerência para negociar o desconto das duplicatas.
>
> **gerada 6ad1aac9d1efdcfd2398f266** — Ao revisar comunicados de uma agência bancária sobre cliente pessoa jurídica negociando com o gerente, um escriturário analisou as frases a seguir. O uso ou a ausência do acento grave está de acordo com a norma-padrão em: Resposta: O banco passou a negociar condições especiais de crédito para empresas de pequeno porte.

- [ ] repetida  - [ ] ok

### 7. cosseno 0,735 · trechos 0,427 · Regência verbal e nominal e crase

> **gerada 6ad16986ce505acc3ca4701c** — Ao revisar comunicados de uma agência bancária sobre financiamento imobiliário ou de veículo, um escriturário analisou as frases a seguir. O uso ou a ausência do acento indicativo de crase está de acordo com a norma-padrão da língua portuguesa em: Resposta: O gerente começou a analisar o contrato de financiamento do veículo do cliente.
>
> **gerada 6ad16a3bce505acc3ca4701d** — Ao revisar comunicados de uma agência bancária sobre desconto de duplicata por uma empresa (PJ), um escriturário analisou as frases a seguir. O uso ou a ausência do acento indicativo de crase está de acordo com a norma-padrão da língua portuguesa em: Resposta: O sócio da empresa dirigiu-se à gerência para negociar o desconto das duplicatas.

- [ ] repetida  - [ ] ok

### 8. cosseno 0,731 · trechos 0,403 · Regência verbal e nominal e crase

> **gerada 6ad1a031d1efdcfd2398f263** — Ao revisar comunicados de uma agência bancária sobre empréstimo pessoal, um escriturário analisou as frases a seguir. O uso ou a ausência do acento grave está de acordo com a norma-padrão em: Resposta: O gerente acompanha dia a dia o pagamento das parcelas do empréstimo pessoal.
>
> **gerada 6ad1aac9d1efdcfd2398f266** — Ao revisar comunicados de uma agência bancária sobre cliente pessoa jurídica negociando com o gerente, um escriturário analisou as frases a seguir. O uso ou a ausência do acento grave está de acordo com a norma-padrão em: Resposta: O banco passou a negociar condições especiais de crédito para empresas de pequeno porte.

- [ ] repetida  - [ ] ok

### 9. cosseno 0,729 · trechos 0,415 · Regência verbal e nominal e crase

> **gerada 6ad1a031d1efdcfd2398f263** — Ao revisar comunicados de uma agência bancária sobre empréstimo pessoal, um escriturário analisou as frases a seguir. O uso ou a ausência do acento grave está de acordo com a norma-padrão em: Resposta: O gerente acompanha dia a dia o pagamento das parcelas do empréstimo pessoal.
>
> **gerada 6ad1a2e2d1efdcfd2398f265** — Ao revisar comunicados de uma agência bancária sobre financiamento imobiliário ou de veículo, um escriturário analisou as frases a seguir. O uso ou a ausência do acento grave está de acordo com a norma-padrão em: Resposta: O cliente preferiu o financiamento do veículo com pagamento a prazo de sessenta meses.

- [ ] repetida  - [ ] ok

### 10. cosseno 0,727 · trechos 0,014 · Redes, internet e computação em nuvem

> **BB 2023 — Escriturário Agente Comercial nº 51** — Uma situação que ocorre no dia a dia da utilização de correio eletrônico é uma pessoa A (emissor), após enviar uma mensagem X para uma outra pessoa B (destinatário), receber uma resposta automática que informa que a caixa de correio do destinatário está cheia. Isso significa que a(o) Resposta: espaço ocupado por mensagens na caixa de correio do destinatário atingiu o limite autorizado.
>
> **BB 2021 — Escriturário Agente Comercial nº 48** — O envio e o recebimento de mensagens de correio eletrônico são atividades corriqueiras, tanto nas organizações quanto no dia a dia da grande maioria da população brasileira. No entanto, há situações em que as mensagens enviadas são devolvidas com um aviso de que não puderam ser entregues ao destinatário. Um dos motivos que justificam a não entrega de uma mensagem de correio eletrônico ao destinatário é porque Respost…

- [ ] repetida  - [ ] ok
