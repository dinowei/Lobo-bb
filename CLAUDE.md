# BB Estudos (app "lobo")

App pessoal de estudo para concursos: Escriturário do Banco do Brasil, Escrevente Técnico Judiciário do TJ-SP, Técnico do Banco Central e Agente Executivo da CVM (uma aba por concurso; lista única em `shared/concursos.ts` + `data/concursos/*.json`). Banco de questões que cresce sozinho: provas oficiais + questões geradas por IA e auditadas por um segundo modelo, explicação de cada alternativa, revisão espaçada (SM-2) e gamificação (XP, níveis, conquistas). Usuário único (o dono), em português do Brasil.

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
- `src/esteiraPT.ts` + `src/moldesPT.ts` + `data/moldes-crase.json` + `src/languagetool.ts`: esteira de Português em lote (moldes → posição → LanguageTool local → anti-repetição → amostra 1/10)
- `src/esteiraConteudo.ts` + `src/cobertura.ts` + `shared/cobertura.ts`: esteira de conteúdo (meta por tema: ≥ 15 novas + ficha + áudio da ficha; trabalha no tema mais próximo do dia; ordem de fonte oficial → C/E → cursinho → geração), Admin → Cobertura e relatório diário (`bb -- esteira`, `bb -- esteira relatorio`)
- `src/capacidade.ts` + `shared/orcamento.ts`: orçamento por modelo (balde no ritmo medido, `bb -- capacidade`); `GERACAO_MAX_DIA` só vale se definido no `.env`
- `src/verificacao.ts`: confere a conta com mathjs (regra 10)
- `src/similaridade.ts` + `src/cenarios.ts` + `data/cenarios.json`: filtro anti-repetição (regra 16) e cenário (perfil + situação) sorteado, o menos usado no tópico
- Coleção `geracoes` (model `Geracao`): toda tentativa de gerar; dá o teto diário `GERACAO_MAX_DIA` e os descartes no `status`
- `src/ingestao.ts` + `src/cli.ts`: comandos `npm run bb -- <comando>`
- `src/estudo.ts`: implementação da interface `Api` (shared/tipos.ts) no servidor
- `src/aulas.ts` e `src/outroJeito.ts`: aulas curtas por tópico auditadas e tutor alternativo com pré-geração, cache e cota diária
- `src/cartoes.ts`: cartões de normas (trecho literal) e vocabulário de Inglês, auditados, com revisão espaçada própria
- `src/espacoLo.ts` + `shared/espacoLo.ts`: Espaço da Lo (seu dia e recados por código, playlist do tema do dia, biblioteca de áudios, posição do áudio por aluno na coleção `espaco_lo`)
- `src/rating.ts` + `shared/rating.ts`: Elo de questão e aluno (`rating-migrar`, `calibragem`)
- `shared/`: `estruturaProva.ts` (cotas da prova, mistura), `aprendizado.ts` (motivo do erro, calibragem da confiança, horas líquidas), `diagnostico.ts` (Raio-X), `plano.ts` (plano até a prova), `redacaoLinhas.ts` (linhas da folha, 25 a 30)
- `src/corrente.ts` + `data/modelos.json`: corrente de modelos grátis por função (regra de família); `src/noturno.ts`: fila persistente da noite
- `src/server.ts`: rotas `/api/*` e serve `web/dist`
- `web/src/api/demo.ts`: a mesma `Api` rodando no navegador (localStorage + `web/src/demo/questoes.ts`)
- `web/src/api/http.ts`: `Api` via fetch; o site cai no demo se `/api/saude` não responder

## Comandos
- `npm run setup`: instala tudo
- `npm run dev`: API :3333 + site :5173 (proxy /api)
- `npm run typecheck`: checa servidor e site
- `npm --prefix web run build:demo`: um HTML único do modo demo (`web/dist-demo/`)
- `npm run bb -- ajuda`: comandos de ingestão e geração (`modelos` lista os ids da NVIDIA)
- Montar do zero (Atlas, NVIDIA, tópicos, provas, normas): `docs/MESTRE.md`, seção 6
- Nunca imprima nem faça commit de chaves ou da `MONGODB_URI`
- **Edite código SEMPRE pelo editor (ferramentas Edit/Write), nunca por script** (sed, node -e, heredoc que reescreve arquivo): os escapes de regex (`\s`, `\d`, `\p{L}`) já se perderam três vezes assim. Script só para LER arquivos ou gerar dados.
- `provas/` e `fontes/` ficam fora do Git (PDFs e gabaritos oficiais só no PC).

## Regras do projeto (não quebre)
1. **Gabarito oficial nunca passa por IA.** É lido de forma determinística (`lerGabarito`).
2. Questão gerada só vira `aprovada` se o auditor acertar **sem ver o gabarito** e aprovar a revisão.
3. Conhecimentos Bancários, Atualidades e Vendas e Negociação **só geram com fonte ingerida**; o `trechoFonte` precisa existir literalmente na fonte. Fonte doutrinária escrita por IA (ex.: glossário de Vendas) só vale depois do OK do dono.
4. A letra do gabarito é sorteada antes de gerar (evita viés de posição).
5. Questão `aprovada` precisa ter explicação em todas as alternativas (validação no schema).
6. Fonte revogada → trechos saem da busca e questões geradas dela viram `desatualizada`.
7. Contestação tira a questão de circulação na hora (`status: contestada`).
8. Visual (identidade final, decisão do dono 25/10/2026): toda cor é token em `web/src/estilos.css`, nunca valor solto. Personagens: **Binho laranja #FF6B35** (ensinar: Painel, Plano, Praticar antes da resposta, aulas, chamadas), **Lo turquesa #19B8B0** (Revisões, Erros, correção depois da resposta, contraexemplos, áudio), **verde institucional #C6EF4E** (resultados de Simulado e Redação, gráficos, Ajustes, Admin, conta, metas). Texto sobre essas três cores é sempre escuro; texto pequeno colorido usa os tons `-texto` (contraste em `docs/CONTRASTE-VISUAL.md`). Semânticas (sucesso/atenção/erro/informação) são separadas das de personagem. Layout da referência "Lobo Binho": barra lateral preta com grupos Binho / Com a Lo / Controle (só ícones até 1279 px, barra inferior no celular), cartões arredondados, destaques em cor sólida com cartão branco por dentro, player da Lo no rodapé. Gráficos: radar lima preenchido com contorno escuro da comparação; linha suave com ponto lima e balão escuro. Tema escuro é o padrão; claro em Ajustes. Inter no texto; títulos em fonte gratuita (Sora ou Outfit, escolha do dono; a Atyp Display da referência é paga). Mascotes: o Binho (lobo de óculos escuros) e a Lo. Não mude o estilo sem o dono pedir.
9. Textos da interface em português, diretos e informais.
10. Em questões de cálculo, o valor correto é verificado por código (mathjs), nunca só pela IA.
11. Variedade é decidida pelo código: tipo e contexto são sorteados de `data/variacoes.json` e só saem pares permitidos na tabela de compatibilidade. Contexto novo ou tipo novo entra na tabela antes de ser usado.
12. Questões por construção (Matemática e Crase): números, alternativas, gabarito e dificuldade vêm do código (dificuldade = nº de etapas + 1). A IA só escreve o texto e não pode alterar número nem a regra atribuída a cada alternativa.
13. Português por construção (decisão do dono, 26/10/2026) roda na **esteira em lote** (`src/esteiraPT.ts`, `bb -- esteira-pt`), começando pela Crase. As questões oficiais do tema vêm primeiro; a esteira só gera para o dono ter ≥ 15 novas (`ESTEIRA_PT_NOVAS`), com teto diário próprio (`ESTEIRA_PT_MAX_DIA`, fora do `GERACAO_MAX_DIA`).
    - **Gatilho:** o juiz obrigatório de cada frase é o **LanguageTool local** (`src/languagetool.ts`, servidor em `ferramentas/`, nunca serviço externo). Ele conta como família independente.
    - **Divergência:** se o LanguageTool e a regra do código discordam, a frase é descartada sem ir à IA. A frase certa tem de sair limpa; a de erro tem de ser apontada exatamente no "a/à" do trecho e em nenhum outro lugar.
    - **Quais regras entram:** só as que o LanguageTool acerta em ≥ 95% no benchmark (`bb -- lt-benchmark`, `data/lt-benchmark.json`) e que não estão em `FORA_DO_SORTEIO`. A regra de pronome de tratamento continua fora, por decisão do dono.
    - **Juiz de IA:** passa a fazer **auditoria por amostra**. 1 em cada 10 aprovadas é julgada frase a frase, às cegas; uma frase que discorda descarta a questão. Se a concordância acumulada cair abaixo de 95% (com ≥ 10 frases), a esteira PARA e registra. Para liberar: `bb -- esteira-pt --retomar`.
    - **Relatório:** traz a taxa de cada filtro (posição, LanguageTool, repetição, amostra).
14. Nas questões por construção de Português:
    - **Explicações:** explicação, pegadinha, correção e explicação geral vêm do banco de regras (`src/portugues.ts`), nunca da IA.
    - **Frases:** o código monta a frase e o gabarito a partir dos **moldes** (`data/moldes-crase.json`, validados por `src/moldesPT.ts`). Molde novo entra na tabela antes de ser usado (regra 11).
    - **Lacunas críticas** (gênero, verbo, hora, nome da norma): só o código preenche.
    - **IA:** só amplia o vocabulário das lacunas **neutras** (sujeito, complemento), validado por código, e nunca mexe na estrutura.
    - **Trava de posição:** toda frase passa por ela (o "à" exatamente onde a regra manda) antes do LanguageTool.
    - **Fluxo antigo:** o escritor por frase (`ESCRITOR_PT_MODEL` + juiz frase a frase) segue só para Concordância, Regência e Pontuação até elas ganharem moldes.
15. Figura é dado desenhado por código (tabela, planilha, gráfico, tela de programa), nunca imagem gerada por IA. A IA não copia a figura no enunciado. Figura oficial extraída do PDF só entra no treino depois do OK do dono (tela Figuras).
16. Questão nova passa pelo filtro de similaridade (`src/similaridade.ts`) antes do auditor: cosseno do embedding contra o mesmo tópico e as oficiais da disciplina, trechos em comum (Jaccard) e, nas por construção, a impressão estrutural (tipo, contexto, parâmetros) que não se repete no tópico. Paráfrase de oficial é descartada. Template não copia o cenário de questão oficial. Limites no `.env` (`SIMILAR_*`).

17. Nota de redação é estimativa, sempre sinalizada para o aluno como "Nota estimada (correção automática; pode variar da banca)" (sem a palavra IA). Nota zero: casos do item 7.3.5 do edital (na correção) e menos de 25 linhas da folha (por código, decisão do dono); além de 30 linhas, o texto é desconsiderado.
18. Aulas só aparecem com auditoria aprovada; Conhecimentos Bancários, Atualidades e Vendas exigem fonte ingerida, citação literal validada e auditor de família diferente da do tutor.
19. O tutor alternativo recebe gabarito e explicações salvas, nunca pode contradizê-los; dúvidas novas são cacheadas por aluno, questão e texto normalizado, com limite diário `EXPLICACOES_MAIS_MAX_DIA`.

## Estado atual
Ver `docs/MESTRE.md`: números do banco, o que funciona, decisões abertas, pendências do dono, como rodar e publicar, e o que fazer se quebrar. O registro do dia a dia fica em `docs/DIARIO.md`.
