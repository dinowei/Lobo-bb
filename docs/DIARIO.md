# Diário do modo autônomo

Uma entrada por item: data/hora, o que fez, números, problemas e solução.

---

## 16/10/2026 — Etapa 0: fechar o que estava aberto

**0.1 Crase (item 1 do pedido anterior)**
- Feito: desempate às cegas pelo Ultra quando o auditor por frase discorda do banco de regras (registrado em `auditoria.desempates`); escritor de Português com reserva (`ESCRITOR_PT_MODEL_RESERVA=deepseek-v4.1-flash`, cai para a reserva depois de 1 nova tentativa); sorteio de regras conta só as aprovadas e não repete as regras da última aprovada; fila de um job de IA por vez (`src/fila.ts`, trava no MongoDB; a CLI espera, o servidor pula).
- Teste da fila: 2 processos concorrentes — o segundo esperou o primeiro; o "servidor" pulou sem esperar; nenhuma trava sobrou.
- Rodada de 10: **2/10 aprovadas**, 999 s em média. Motivo: provedor NVIDIA instável na madrugada — 5 falhas por timeout do GLM **e** da reserva DeepSeek; 3 descartes porque o desempate do Ultra deu timeout/503 (desempate que falha = descarta, por segurança). Desempates bem-sucedidos: 0 (todos os 4 pedidos falharam no provedor). Reescritas pedidas pela trava: 2 (ambas passaram). Escritor usado nas aprovadas: GLM.
- Leitura: a lógica funciona; o gargalo é a disponibilidade do provedor gratuito. Repetir em horário de menos carga.

**0.2 Vendas** — `docs/FONTES-VENDAS.md` com (a) normas públicas e (b) conceitos de doutrina, cada um ligado às questões oficiais. Vendas entrou na lista de "só gera com fonte" (`DISCIPLINAS_COM_FONTE_OBRIGATORIA`) e na regra 3 do `CLAUDE.md`.

**0.3 Normas revogadas** — pesquisado: Res. CMN 4.949/2021 (art. 12) revoga a 3.694/2009 e a 4.539/2016, vigência 01/03/2022; Res. CMN 4.658/2018 revogada pela 4.893/2021. Vigentes: Carta Circular 4.001/2020 (alterada em 2026), Res. CMN 4.860/2020 (alterada pela 5.182/2024), Leis 8.078 e 13.146. Marcadas `desatualizada` com nota: 2023 nº 33; 2021 nº 67 e 68. Elas saem do treino, continuam no caderno de erros e mostram o selo "Norma atualizada" com a nota.

**0.4 2021 nº 23** — recuperada com o novo comando `recuperar` (mesmas travas da ingestão: disciplina da capa, conferência literal); gabarito B; explicada (a IA acertou às cegas).

## 16/10/2026 — Etapa 1, Fase 1: inventário de figuras

- Operadores do PDF (imagens e desenhos vetoriais com posição) + texto. A imagem 263×263 em todas as páginas é marca d'água do site.
- 5 figuras reais: 4 tabelas (2023 nº 18, 19, 60; 2021 nº 27) e 1 planilha-imagem (2023 nº 41). Nenhum gráfico, tela de programa ou diagrama.
- Meta nas geradas (`data/figuras-meta.json`): Matemática 20% tabela, Mat. Financeira 10% tabela, Informática 5% planilha, Vendas 5% tabela. Detalhes em `docs/FIGURAS-INVENTARIO.md`.

## 16/10/2026 — Etapa 1, Fase 2: figuras das provas (cópia fiel)

- `src/figuras.ts`: recorte da página renderizada (unpdf + @napi-rs/canvas, escala 2), extração da **imagem original** embutida (2023 nº 41, sem perda), tabela reconstruída pelas posições do texto (colunas por centros; célula vazia fica vazia — a 2023 nº 18 saiu com as 7 colunas certas).
- Configuração por figura em `data/figuras-oficiais.json` (texto antes/depois, largura total, ou região fixa — a caixa "Dados" com os expoentes da 2021 nº 27 fica ao lado das alternativas).
- Problemas e soluções: o PDF quebra linhas em vários itens ("Na" + "célula C10…") → comparação contra a linha inteira; "é" decomposto → normalização NFKC; tabela de largura total → opção `larguraTotal`.
- Avaliador de planilha em português (`shared/planilha.ts`, sem eval): 5 testes, incluindo a 2023 nº 41 (CONT.SE com "<=R$ 10,00" = 3, gabarito B).
- Tela **Figuras** (Ajustes → Conferir figuras): figura desenhada × recorte original, "OK, está igual", "Ajustar recorte" (arrastar sobre a página) e "Fora do treino". Testada no navegador: 5 figuras listadas; rota do recorte respondendo. **Nenhuma aprovada por mim** — todas aguardam o seu OK.
- O site desenha figuras conferidas na questão (enunciado, texto de apoio ou alternativas).
- Pendente: a 2023 nº 60 (tabela) teve a figura extraída, mas a questão ainda não está no banco (a cópia da IA não bateu com o PDF).

## 17/10/2026 — Etapa 1, Fase 3: figuras nas questões geradas

- 4 templates por construção com figura (`src/construcaoFiguras.ts`), só tipos do inventário: fórmula em planilha (SOMA, MÉDIA, CONT.SE, SOMASE, amplitude, PROCV; célula-alvo vazia; distratores = fórmulas erradas avaliadas pelo código), sistema linear em tabela (linha pedida com "?"), série de depósitos (Juros compostos) e taxa de abandono (Vendas). Proporção de `figuras-meta.json` no sorteio.
- Checagens: alternativas intactas, dados literais, resposta fora do enunciado, figura não entrega a resposta (tabela), nenhum número fora dos dados/figura. O auditor recebe a figura descrita em texto.
- Testes: 22/22 (200 montagens por tipo; sorteio na proporção ±4 pp; limpeza de tabela copiada).
- Rodada real: planilha **1/5** (1 `numero_alterado`, 3 timeouts), sistema linear **1/5** (4 timeouts); 492 s e 711 s em média. Quase toda perda foi o provedor.
- Problema: nas 2 aprovadas a IA **copiou a tabela no enunciado** ("| Agência | Contas |…"). Correção: prompt mais explícito + `tirarTabelaCopiada` no pipeline antes das checagens (teste cobre o "|x|" de módulo). As 2 já salvas ficaram com a cópia: a gravação no banco por script foi bloqueada pela checagem de permissões; vai para DECISOES-PENDENTES com script pronto.
- Prints: `docs/telas/figuras/` (4 tipos × 5 amostras + as 2 questões reais, desktop e celular), pela aba nova Figuras → "Geradas (amostra)" (código monta na hora, sem IA, nada salvo).

## 17/10/2026 — Etapa 1, Fase 4: anti-repetição

- `src/similaridade.ts`: antes do auditor, cosseno do embedding (enunciado + correta) contra o mesmo tópico e as oficiais da disciplina; trechos de 4 palavras (Jaccard, pega cópia com palavra trocada; texto curto não conta); impressão estrutural (tipo, contexto, parâmetros) nas por construção e na Crase, checada **antes** de chamar a IA. "parecida" → descarta e pede outro cenário 1 vez; "duplicada" e "paráfrase de oficial" → descarta.
- Cenários (`data/cenarios.json`, 3 grupos): perfil + situação, sem número e sem produto (o produto vem do contexto, regra 11); sorteia o menos usado no tópico, nunca um dos 15 últimos (que vão ao gerador como proibidos). O auditor rejeita cenário irreal.
- Coleção `geracoes`: toda tentativa registrada → teto diário `GERACAO_MAX_DIA` (regra A7, padrão 60) e descartes por repetição no `status` (colunas "cenários" e "desc. repetição").
- Calibragem: `similaridade indexar` (162 embeddings) + `similaridade calibrar` → 657 pares, 650 abaixo de 0,80. O único acima de 0,90 (0,939) é a mesma questão de Juros com outro capital; o seguinte (0,871) é diferente. Limites: duplicada 0,97, parecida 0,93, oficial 0,93, trechos 0,60. Os 20 pares estão em `docs/CALIBRAGEM-SIMILARIDADE.md` para você classificar.
- Achado da calibragem: o template de sistema linear usava o cenário da oficial 2023 nº 19 (armários, mesas, cadeiras). Corrigido: 6 conjuntos de itens × 4 compradores, sem o da oficial.
- Testes: 29/29. Rodada real (Juros, 3): **1/3** aprovada, 113 s em média; 1 reprovada na revisão (erro de português do gerador ao reescrever o cenário, pego pelo auditor), 1 `numero_alterado`. Nenhum descarte por repetição.

RETOMAR AQUI: Etapa 1.5 (PROMPT-RETOMADA R2): sondar os 9 modelos (R2.1), depois catálogo/correntes/telemetria (R2.2; `src/catalogo.ts` e `data/modelos.json` já escritos, sem commit).
