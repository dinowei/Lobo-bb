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
- `src/variacao.ts` + `data/variacoes.json`: sorteio de tipo e contexto compatível (tabela de pares permitidos) e cota de 40% de duas etapas em cálculo
- `src/construcao.ts`: Matemática por construção (Juros compostos, Descontos): o código sorteia números e distratores
- `src/portugues.ts`: Português por construção (Crase): banco de regras; o código sorteia 1 regra correta + 4 de erro
- `src/verificacao.ts`: confere a conta com mathjs (regra 10)
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
- **Edite código SEMPRE pelo editor (ferramentas Edit/Write), nunca por script** (sed, node -e, heredoc que reescreve arquivo): os escapes de regex (`\s`, `\d`, `\p{L}`) já se perderam três vezes assim. Script só para LER arquivos ou gerar dados.
- `provas/` e `fontes/` ficam fora do Git (PDFs e gabaritos oficiais só no PC).

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
11. Variedade é decidida pelo código: tipo e contexto são sorteados de `data/variacoes.json` e só saem pares permitidos na tabela de compatibilidade. Contexto novo ou tipo novo entra na tabela antes de ser usado.
12. Questões por construção (Matemática e Crase): números, alternativas, gabarito e dificuldade vêm do código (dificuldade = nº de etapas + 1). A IA só escreve o texto e não pode alterar número nem a regra atribuída a cada alternativa.
13. Crase por construção só é aprovada se o auditor, julgando cada frase isoladamente e sem saber a regra, disser "correta" para exatamente uma frase, a do gabarito. Depois passa pela revisão completa.
14. Nas questões por construção de Português, explicação, pegadinha, correção e explicação geral vêm do banco de regras (`src/portugues.ts`), nunca da IA. As frases são escritas pelo `ESCRITOR_PT_MODEL`, que precisa ser diferente do auditor. Cada frase passa pela trava de posição (o "à" exatamente onde a regra manda) antes do auditor; a que não bate é reescrita uma vez.

## Estado atual
- Tudo compila (`npm run typecheck`). Leitura de PDF, fatiamento, gabarito, validações e motor de progressão foram testados.
- Atlas e NVIDIA conectados e testados: gerador `nemotron-3.5-lightning` (pensamento limitado por `GERADOR_RACIOCINIO`), auditor `nemotron-3-super` com reserva `nemotron-3-ultra`, embeddings `nemotron-3-embed-1b` (2048 dim). Ainda falta ingerir uma prova oficial e as fontes (etapa C do `docs/INTEGRACAO.md`).
- Por construção: Juros compostos, Descontos e Crase. Os demais tópicos de cálculo ainda usam geração livre + verificação mathjs.
- `npm run bb -- gerar --assunto "<tópico>" --n 3 [--tipo "<tipo>"]` força um tipo de `data/variacoes.json` (ex.: `--tipo "crase (por construção)"`).
- Próximos passos: `docs/ROADMAP.md`.
