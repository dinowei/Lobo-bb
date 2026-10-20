# BB Estudos

Banco de questões para o concurso do Banco do Brasil que cresce sozinho: provas oficiais, questões novas geradas por IA a partir de fontes primárias e auditadas por um segundo modelo, explicação de cada alternativa e revisão espaçada.

> Começando agora? Leia o **docs/MESTRE.md** (estado, como rodar e publicar, e o que fazer se quebrar).

## O site

```bash
npm run setup     # instala servidor e site
npm run dev       # API em :3333 + site em http://localhost:5173
```

Sem servidor (ou sem `.env`), o site entra no **modo demo** com questões de exemplo. Com o servidor de pé, usa o seu banco e pede questões novas à IA quando um tópico fica com estoque baixo. Para produção: `npm run build && npm start` serve tudo em :3333.

## Primeiro dia (≈ 30 min)

```bash
npm install
cp .env.example .env        # preencha as chaves
npm run bb -- testar        # testa as IAs e mostra o EMBED_DIM → coloque no .env
npm run bb -- indice        # cria o índice vetorial no Atlas (uma vez só)
npm run bb -- topicos data/topicos.json
```

O banco é o **MongoDB Atlas**: o cluster gratuito serve para começar e tem Vector Search.

## Alimentando o banco

### 1. Provas oficiais (o ouro: ensinam o estilo da banca)

```bash
npm run bb -- prova provas/bb-2023-agente-comercial.pdf \
  --gabarito provas/bb-2023-gabarito.pdf \
  --nome "BB 2023 — Escriturário Agente Comercial" --banca cesgranrio --ano 2023

npm run bb -- explicar      # a IA escreve a explicação de cada alternativa
```

- Use sempre o **gabarito definitivo** (pós-recursos) e o do **mesmo tipo de caderno** da prova.
- Se o gabarito em PDF for uma tabela que o leitor não entende, crie um `gabarito.txt` com uma linha por questão: `1 A`, `2 C`… (anulada: `7 X`). **O gabarito nunca passa por IA.**
- Questões com gráfico ou tabela que não vem legível no texto ficam de fora (o relatório mostra quantas).
- Na explicação, a IA primeiro resolve a questão às cegas. Quando erra, a questão é marcada como **traiçoeira**: são essas que mais valem a sua revisão.

Onde achar as provas: no site da banca e em portais de provas como o PCI Concursos. Pegue as do BB e de outras bancárias da mesma banca (Caixa, BASA, BNB).

### 2. Fontes primárias (a verdade das matérias normativas)

```bash
npm run bb -- fonte fontes/lei-4595.pdf --tipo lei \
  --titulo "Lei nº 4.595/1964 (Sistema Financeiro Nacional)" --disciplina conhecimentos_bancarios --ano 1964

npm run bb -- fonte fontes/regulamento-pix.pdf --tipo norma_bacen_cmn \
  --titulo "Regulamento do Pix" --orgao BACEN --disciplina conhecimentos_bancarios
```

- Leis: planalto.gov.br. Normas: a busca de normas do site do Banco Central. Salve como PDF ou HTML.
- `--disciplina` deixa a classificação por tópico bem mais certeira.
- PDF escaneado (imagem) precisa de OCR antes, e o script avisa quando detecta um.
- **Norma mudou?** `npm run bb -- revogar "Regulamento do Pix"` tira a fonte antiga da busca e as questões geradas a partir dela de circulação. Depois é só ingerir a nova.

### 3. Gerar questões infinitas

```bash
npm run bb -- gerar --assunto "Pix" --n 3   # teste um tópico
npm run bb -- estoque --min 30              # completa todos os tópicos (rode em cron)
npm run bb -- status                        # raio-x: trechos e questões por tópico
```

Conhecimentos Bancários e Atualidades **só geram questões com fonte ingerida**. Português, Inglês, Matemática e Estatística geram sem fonte, e o auditor confere o conteúdo e as contas.

## Arquitetura

| Arquivo | Papel |
|---|---|
| `src/models.ts` | Esquema: tópicos, fontes, trechos (com índice vetorial), questões, tentativas, revisão, contestações |
| `src/extrair.ts` | PDF/TXT/HTML → páginas → trechos; leitura determinística do gabarito |
| `src/ingestao.ts` | Tópicos, fontes, provas, explicações, revogação, status |
| `src/prompts.ts` | Gerador, auditor (cego + revisão), extrator de provas, explicador |
| `src/pipeline.ts` | Gera → checa → audita às cegas → revisa → salva |
| `src/estudo.ts` | API de estudo no servidor: próxima questão, correção, simulado, erros, painel |
| `src/server.ts` | Rotas `/api/*` e o site compilado |
| `src/cli.ts` | Os comandos acima |
| `shared/` | Tipos da API e motor de progressão (XP, níveis, SM-2, conquistas), usados pelo site e pelo servidor |
| `web/` | Site React: painel, prática, revisões, simulados, caderno de erros, conquistas |
