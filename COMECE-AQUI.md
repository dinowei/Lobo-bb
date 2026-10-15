# Comece aqui

Guia do zero até estudar com questões de verdade. Faça na ordem.

## O que tem nesta pasta

```
bb-estudos/
├── COMECE-AQUI.md        ← você está aqui
├── CLAUDE.md             ← contexto para o Claude Code (ele lê sozinho)
├── README.md             ← referência dos comandos
├── docs/INTEGRACAO.md    ← MongoDB + NVIDIA, com prompts para o Claude Code
├── docs/ROADMAP.md       ← o que já existe e o que vem depois
├── .env.example          ← modelo das chaves (copie para .env)
├── data/topicos.json     ← tópicos do edital (RASCUNHO: confira com o edital)
├── shared/               ← regras usadas pelo site E pelo servidor (XP, níveis, revisão)
├── src/                  ← servidor: banco, IA, ingestão, API
└── web/                  ← site (React)
```

## Passo 1 — Instalar (10 min)

Precisa de **Node.js 22 ou mais novo** (nodejs.org) e **Git**.

```bash
cd bb-estudos
git init && git add . && git commit -m "projeto inicial"
npm run setup          # instala servidor e site
```

## Passo 2 — Ver o site funcionando (2 min)

```bash
npm --prefix web run dev
```

Abra http://localhost:5173. Sem servidor, ele entra no **modo demo** com 33 questões de exemplo e salva o progresso no navegador. Serve pra testar a experiência antes de configurar o banco.

## Passo 3 — Contas e chaves (20 min)

> Passo a passo detalhado, com prompts prontos para o Claude Code: **docs/INTEGRACAO.md**.

1. **MongoDB Atlas** (mongodb.com/atlas): crie um cluster gratuito, um usuário e libere seu IP. Copie a connection string.
2. **IA geradora** (barata): por exemplo, NVIDIA NIM (build.nvidia.com), com um modelo Nemotron. Pegue a API key.
3. **IA auditora** (forte): qualquer provedor compatível com a API da OpenAI.
4. **Embeddings**: a NVIDIA também tem modelos de embedding.

```bash
cp .env.example .env    # e preencha
npm run bb -- testar    # testa tudo e mostra o EMBED_DIM → coloque no .env
npm run bb -- indice    # cria o índice vetorial (uma vez)
```

## Passo 4 — Alimentar o banco (1 h, depois vira rotina)

```bash
npm run bb -- topicos data/topicos.json
npm run bb -- prova provas/bb-2023.pdf --gabarito provas/bb-2023-gabarito.pdf --nome "BB 2023 — Agente Comercial" --ano 2023
npm run bb -- explicar
npm run bb -- fonte fontes/lei-4595.pdf --tipo lei --titulo "Lei nº 4.595/1964" --disciplina conhecimentos_bancarios
npm run bb -- status
```

Detalhes de cada comando estão no README.

## Passo 5 — Estudar de verdade

```bash
npm run dev             # servidor + site juntos
```

Abra http://localhost:5173. O selo "modo demo" some e tudo passa a vir do seu banco. Quando um tópico fica com poucas questões, o servidor pede mais para a IA sozinho.

## Usando o Claude Code no seu PC

Sim, use. É a melhor forma de continuar este projeto.

1. Instale o Claude Code (instruções em docs.claude.com).
2. Abra o terminal **dentro da pasta `bb-estudos`** e rode `claude`.
3. Ele lê o `CLAUDE.md` e já entende o projeto inteiro. Comece pedindo:
   - "Rode o projeto e me ajude a configurar o .env e o Atlas."
   - "Ingeri a prova do BB 2023. Confira no banco se as questões vieram certas."
   - "Implemente o próximo item do docs/ROADMAP.md."
4. Faça commits pequenos (`git commit`) a cada coisa que funcionar. Se algo quebrar, dá pra voltar.

## Antes de confiar no conteúdo

- Confira o `data/topicos.json` com o edital e preencha `questoesNaProva`.
- Revise as questões oficiais marcadas como **traiçoeiras** (a IA errou às cegas).
- Use o botão **Contestar** sem dó: a questão sai de circulação na hora.
