# BB Estudos (app "lobo")

App pessoal de estudo para o concurso de Escriturário do Banco do Brasil. Banco de questões que cresce sozinho: provas oficiais + questões geradas por IA e auditadas por um segundo modelo, explicação de cada alternativa, revisão espaçada (SM-2) e gamificação (XP, níveis, conquistas). Usuário único (o dono), em português do Brasil.

## Stack
- Servidor: Node 22+, TypeScript (ESM, NodeNext → imports com `.js`), Express 5, Mongoose 9, MongoDB Atlas (Vector Search), Zod 4, SDK `openai` falando com qualquer API compatível (NVIDIA NIM/Nemotron etc.).
- Site: React 18 + Vite 6 em `web/` (TypeScript, CSS puro em `web/src/estilos.css`, sem framework de UI).
- `shared/`: tipos da API e o motor de progressão — **funções puras usadas pelo servidor e pelo modo demo do site**. Regra de XP, nível, SM-2, domínio ou conquista muda AQUI, nunca duplicada.

## Mapa
- `src/models.ts`: Topic, Source, Chunk (índice vetorial), Question, Attempt, ReviewState, Report
- `src/llm.ts`: clientes de IA, `chatJSON`, embeddings
- `src/prompts.ts`: gerador, auditor (cego + revisão), extrator de provas, explicador
- `src/pipeline.ts`: gera questão → checagens determinísticas → auditor às cegas → revisão → salva
- `src/ingestao.ts` + `src/cli.ts`: comandos `npm run bb -- <comando>`
- `src/estudo.ts`: implementação da interface `Api` (shared/tipos.ts) no servidor
- `src/server.ts`: rotas `/api/*` e serve `web/dist`
- `web/src/api/demo.ts`: a mesma `Api` rodando no navegador (localStorage + `web/src/demo/questoes.ts`)
- `web/src/api/http.ts`: `Api` via fetch; o site cai no demo se `/api/saude` não responder

## Comandos
- `npm run setup`: instala tudo
- `npm run dev`: API :3333 + site :5173 (proxy /api)
- `npm run typecheck`: checa servidor e site
- `npm --prefix web run build:demo`: um HTML único do modo demo (`web/dist-demo/`)
- `npm run bb -- ajuda`: comandos de ingestão e geração (`modelos` lista os ids da NVIDIA)
- Integração com Atlas e NVIDIA: siga `docs/INTEGRACAO.md` etapa por etapa
- Nunca imprima nem faça commit de chaves ou da `MONGODB_URI`

## Regras do projeto (não quebre)
1. **Gabarito oficial nunca passa por IA.** É lido de forma determinística (`lerGabarito`).
2. Questão gerada só vira `aprovada` se o auditor acertar **sem ver o gabarito** e aprovar a revisão.
3. Conhecimentos Bancários e Atualidades **só geram com fonte ingerida**; o `trechoFonte` precisa existir literalmente na fonte.
4. A letra do gabarito é sorteada antes de gerar (evita viés de posição).
5. Questão `aprovada` precisa ter explicação em todas as alternativas (validação no schema).
6. Fonte revogada → trechos saem da busca e questões geradas dela viram `desatualizada`.
7. Contestação tira a questão de circulação na hora (`status: contestada`).
8. Visual: segue o layout de referência (escuro, laranja #ff5b1f, Inter, sidebar com cartão do mascote). O mascote é o lobo de óculos escuros (`web/src/assets/lobo.png`). Não mude o estilo sem o dono pedir.
9. Textos da interface em português, diretos e informais.
10. Em questões de cálculo, o valor correto é verificado por código (mathjs), nunca só pela IA.

## Estado atual
- Tudo compila (`npm run typecheck`). Leitura de PDF, fatiamento, gabarito, validações e motor de progressão foram testados.
- **Ainda não testado contra Atlas e IAs reais**: o primeiro uso real deve passar por `npm run bb -- testar` e pela ingestão de uma prova, conferindo o resultado no banco.
- Próximos passos: `docs/ROADMAP.md`.
