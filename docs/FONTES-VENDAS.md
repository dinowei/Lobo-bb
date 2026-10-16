# Fontes para Vendas e Negociação

Levantamento a partir dos 6 tópicos de Vendas em `data/topicos.json` e das 28 questões oficiais
de Vendas (BB 2023 nº 56–70, BB 2021 nº 56–70). Motivo: nas traiçoeiras, 6 de 13 eram de Vendas;
a IA responde pelo senso comum, não pela doutrina que a banca cobra.

Regra 3 do `CLAUDE.md`: Vendas passa a **só gerar com fonte ingerida**.

## (a) Normas públicas — baixar de site oficial

| Norma | Onde | Cai em | Questões oficiais que a usam |
|---|---|---|---|
| Lei 8.078/1990 — Código de Defesa do Consumidor | planalto.gov.br | Ética, conduta e direitos do consumidor | 2023 nº 57; 2021 nº 61 |
| Lei 13.146/2015 — Estatuto da Pessoa com Deficiência (atendimento prioritário, acessibilidade) | planalto.gov.br | Atendimento | 2023 nº 56 |
| Lei 10.048/2000 — atendimento prioritário | planalto.gov.br | Atendimento | (apoio à 2023 nº 56; 2021 nº 59) |
| Resolução CMN 4.949/2021 — relacionamento com clientes (substituiu 3.694/2009 e 4.539/2016) | normativos.bcb.gov.br | Ética; segmentação; atendimento | 2021 nº 67 e 68 (citam as revogadas) |
| Resolução CMN 4.860/2020 — Ouvidoria (alterada pela 5.182/2024) | normativos.bcb.gov.br | Atendimento, pós-venda, ouvidoria | 2023 nº 58 |
| Resolução CVM 30/2021 — dever de verificar a adequação (suitability) | conteudo.cvm.gov.br | Segmentação e perfil do cliente | (tópico "suitability") |
| Lei 13.709/2018 — LGPD (uso de dados do cliente em vendas) | planalto.gov.br | Marketing de relacionamento; ética | 2023 nº 59 (uso indevido de informação) |
| Código de Ética e Normas de Conduta do Banco do Brasil | bb.com.br (documento público) | Ética e conduta | 2023 nº 59 |

## (b) Conceitos de doutrina — precisam de outro tipo de fonte

Livros de marketing são protegidos por direitos autorais: **não** dá para ingerir trechos deles.
A saída escolhida (prompt de viagem, 2.4) é um **glossário próprio** em
`docs/fontes-vendas/glossario.md`, escrito a partir das 28 questões oficiais e das explicações
que **batem com o gabarito oficial**, com cada verbete citando as questões que o sustentam.
Ele entra como fonte "aguardando revisão do dono": Vendas por doutrina só gera depois do seu OK.

| Conceito cobrado | Referência doutrinária usual | Questões oficiais |
|---|---|---|
| Caminho do cliente dos 5As (assimilação, atração, arguição, ação, apologia) | Kotler, Kartajaya e Setiawan — *Marketing 4.0* | 2023 nº 62 |
| Inbound marketing, marketing de conteúdo, copywriting | marketing digital (Kotler 4.0; marketing de conteúdo) | 2023 nº 63; 2021 nº 63, 64 |
| Omnichannel | marketing digital / varejo | 2021 nº 66 |
| Cinco dimensões da qualidade em serviços (confiabilidade, responsividade, segurança, empatia, tangíveis); confiabilidade como medida de resultado | Zeithaml, Bitner e Gremler — *Marketing de Serviços* (SERVQUAL) | 2023 nº 61; 2021 nº 58, 62 |
| Características dos serviços (inseparabilidade etc.); alto contato; atributos de procura, experiência e confiança | Lovelock e Wirtz — *Marketing de Serviços* | 2023 nº 64; 2021 nº 57, 60 |
| Pesquisa de satisfação | qualidade em serviços | 2023 nº 65 |
| Valor percebido e custos não financeiros | Kotler e Keller — *Administração de Marketing* | 2023 nº 66 |
| Segmentação × posicionamento × personalização | Kotler e Keller | 2023 nº 67; 2021 nº 59 |
| Riscos percebidos na pré-compra (funcional, financeiro, social, físico, psicológico, de tempo) | Kotler e Keller | 2023 nº 69 |
| Ambiente interno do sistema de marketing (preço, distribuição) | Kotler e Keller | 2023 nº 70 |
| Gatilhos mentais (escassez, urgência, prova social) | Cialdini — *As armas da persuasão* | 2023 nº 68 |
| Ética na negociação (espionagem, conflito de interesses) | ética empresarial | 2023 nº 59 |
| Vendas sugestivas, uso de banco de dados de clientes (CRM) | marketing de relacionamento | 2021 nº 56, 69 |
| Tripé da sustentabilidade; negócio "reparador" | Elkington (*triple bottom line*) e ESG | 2021 nº 65 |
| Profissionalismo em vendas (qualificação constante) | técnicas de vendas | 2021 nº 70 |
| Técnicas de negociação (ganha-ganha, MAANA/BATNA) | Fisher e Ury — *Como chegar ao sim* | (tópico "Técnicas de negociação") |

Se você tiver resumos próprios ou apostila do cursinho, eles podem entrar com
`npm run bb -- fonte <arquivo> --tipo material_proprio --disciplina vendas_negociacao`.
