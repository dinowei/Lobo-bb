# Integração: MongoDB + IA da NVIDIA

São três etapas, nesta ordem. Em cada uma, você faz a parte de conta e chave (o Claude Code não cria contas por você) e depois cola o prompt no Claude Code.

> **Chaves e senhas:** cole direto no arquivo `.env` com o editor, nunca no chat. O `.env` já está no `.gitignore`, então não vai parar no Git.

Antes de tudo, abra o terminal na pasta `bb-estudos`, rode `npm run setup` e, se ainda não fez, crie o `.env` copiando o `.env.example` (Windows: `copy .env.example .env`; Mac/Linux: `cp .env.example .env`). Depois rode `claude`.

---

## Etapa A — MongoDB Atlas (≈ 15 min)

**Você faz:**
1. Crie uma conta em mongodb.com/atlas e um cluster **gratuito (M0)**.
2. Em **Database Access**, crie um usuário e uma senha (anote a senha).
3. Em **Network Access**, adicione o seu IP (botão "Add current IP").
4. Em **Connect → Drivers**, copie a connection string. Troque `<password>` pela senha e, antes do `?`, coloque o nome do banco: `...mongodb.net/bb-estudos?...`
5. Cole no `.env` como `MONGODB_URI=...`.

**Cole no Claude Code:**
```
Leia o CLAUDE.md e o docs/INTEGRACAO.md (etapa A). Já preenchi o MONGODB_URI no .env.
1. Teste a conexão com o MongoDB sem imprimir a URI nem a senha.
2. Suba o projeto com "npm run dev" e confirme que /api/saude responde {"ok":true}.
3. Me diga como confirmar no navegador que o site saiu do "modo demo".
Se der erro de conexão, diagnostique (IP liberado no Atlas, senha com caractere especial
que precisa de URL-encode, nome do banco) e me diga exatamente o que corrigir no Atlas.
Não altere as regras listadas no CLAUDE.md.
```

**Pronto quando:** `npm run dev` mostra `✔ API em http://localhost:3333` e o selo "modo demo" some do site. O painel vai aparecer vazio, sem tópicos, e isso é normal: os tópicos entram na etapa B.

---

## Etapa B — IA da NVIDIA (≈ 20 min)

**Você faz:**
1. Crie uma conta em **build.nvidia.com**.
2. Em **build.nvidia.com/settings/api-keys**, gere uma chave (começa com `nvapi-`).
3. No `.env`, cole a mesma chave em `GERADOR_API_KEY`, `AUDITOR_API_KEY` e `EMBED_API_KEY`. As URLs já vêm preenchidas.

**Cole no Claude Code:**
```
Leia o CLAUDE.md e o docs/INTEGRACAO.md (etapa B). Já coloquei minha chave da NVIDIA no .env
(GERADOR_API_KEY, AUDITOR_API_KEY e EMBED_API_KEY). Não imprima a chave em nenhum momento.
1. Rode "npm run bb -- modelos --filtro nemotron" e me mostre as opções.
2. Escolha comigo e preencha no .env:
   - GERADOR_MODEL: um Nemotron rápido (ex.: família "lightning" ou "super")
   - AUDITOR_MODEL: o Nemotron mais forte disponível (ex.: "ultra"). Tem que ser DIFERENTE do gerador.
   - EMBED_MODEL: nvidia/llama-3.2-nv-embedqa-1b-v2 (confirme que aparece em "npm run bb -- modelos --filtro embed")
3. Rode "npm run bb -- testar", coloque o EMBED_DIM informado no .env e rode "npm run bb -- indice".
   Espere o índice ficar READY no Atlas (Atlas Search → aba Search Indexes) antes de seguir.
4. Rode "npm run bb -- topicos data/topicos.json".
5. Gere questões de matérias que não precisam de fonte, para testar o pipeline:
   "npm run bb -- gerar --assunto Juros compostos --n 3" e "npm run bb -- gerar --assunto Crase --n 3".
6. Para cada questão aprovada, me mostre o enunciado, as alternativas e o gabarito para eu conferir.
   Para cada reprovada, me explique o motivo (está no campo auditoria do documento).
Se algum modelo falhar na leitura do JSON ou estourar o limite de tokens, ajuste o src/llm.ts
(ex.: max_tokens maior para modelos de raciocínio), sem mexer nas regras do CLAUDE.md.
```

**Pronto quando:** `testar` mostra ✔ nos três e pelo menos uma questão de Matemática Financeira aparece no site como "Inédita · auditada por IA".

**Sobre os modelos:**
- O gerador e o auditor **precisam ser modelos diferentes**. Se forem iguais, o auditor tende a concordar com os próprios erros, e a auditoria às cegas perde o sentido.
- Os Nemotron mais novos "pensam" antes de responder. O código já remove esse raciocínio antes de ler o JSON, mas eles gastam mais tokens e demoram mais. O gerador roda em segundo plano, então não tem problema.
- Se quiser economizar espaço no Atlas, coloque `EMBED_DIMENSOES=1024` **antes** de rodar `testar` e `indice`. Mudou depois? Apague o índice e os trechos e rode tudo de novo.

---

## Etapa C — Material de verdade (≈ 30 min)

**Você faz:**
1. Baixe o PDF da prova do BB (2023 ou 2021, Escriturário) e o **gabarito definitivo**. Coloque em `provas/`.
2. Baixe a Lei nº 4.595/1964 (planalto.gov.br) e o regulamento do Pix (site do Banco Central). Salve como PDF ou HTML em `fontes/`.

**Cole no Claude Code:**
```
Leia o CLAUDE.md e o docs/INTEGRACAO.md (etapa C). Coloquei a prova em provas/ e as normas em fontes/.
1. Ingira a prova com "npm run bb -- prova" (use o nome do arquivo e o gabarito que estão em provas/).
   Se o gabarito não for lido automaticamente, crie provas/gabarito.txt no formato "1 A" a partir do PDF
   e me peça para conferir ANTES de usar. O gabarito nunca pode passar por IA.
2. Confira 5 questões extraídas, sorteadas, contra o PDF original (texto, alternativas e gabarito) e me mostre.
3. Rode "npm run bb -- explicar" e me liste as questões marcadas como traiçoeiras.
4. Ingira as normas com "npm run bb -- fonte" usando --disciplina conhecimentos_bancarios e títulos claros.
5. Rode "npm run bb -- status" e "npm run bb -- gerar --assunto Pix --n 3".
```

**Pronto quando:** o site mistura questões "Oficial · BB 2023" com inéditas de Conhecimentos Bancários, e o `status` mostra trechos e questões nos tópicos.

---

## Se algo der errado

| Sintoma | Causa provável |
|---|---|
| `querySrv ENOTFOUND` / timeout | IP não liberado no Atlas, ou internet/VPN bloqueando |
| `bad auth` | Senha errada, ou caractere especial sem URL-encode (`@` vira `%40`) |
| `401` / `403` na NVIDIA | Chave errada ou expirada; gere outra |
| `404 model not found` | Id do modelo digitado errado: copie da saída de `modelos` |
| `não devolveu JSON válido` | Modelo cortou a resposta: aumente o `max_tokens` daquela chamada |
| `$vectorSearch` erro / 0 resultados | Índice ainda não está READY, ou o EMBED_DIM não bate com o do índice |
| `sem_fontes_para_o_topico` | Normal em Conhecimentos Bancários sem fonte ingerida (etapa C) |
| `429` (muitas requisições) | Limite da conta gratuita; rode o `estoque` com calma ou espere alguns minutos |
