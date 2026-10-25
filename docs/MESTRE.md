# Lobo Binho: documento mestre

Este é o único documento de estado do projeto. As regras de código e o mapa estão no `CLAUDE.md`, e o dia a dia está em `docs/DIARIO.md`. O histórico dos docs antigos fica na tag git `docs-antes-da-limpeza`.

Marcas usadas:
- [CONFIRMADO]: medido no banco, código, teste ou commit, com data.
- [HISTÓRICO]: fato antigo.
- [PENDENTE]: ainda falta medir.

---

## 1. O que é + regras de ouro

App de estudo para o dono e alguns amigos. Prepara para **4 concursos**:
- Escriturário do Banco do Brasil (Cesgranrio);
- Escrevente Técnico Judiciário do TJ-SP (Vunesp);
- Técnico do Banco Central (Cebraspe, referência até o edital sair);
- Agente Executivo da CVM (banca a definir, referência FGV).

O app tem:
- banco de questões: provas oficiais, questões geradas e auditadas, itens Certo/Errado e questões de cursinho (camada C);
- explicação de cada alternativa e revisão espaçada;
- simulado fiel por concurso, Raio-X, plano até a prova, redação, aulas, fichas, cartões e chat por tema;
- gamificação, com o mascote Binho e a voz da Lo.

Não é produto à venda. A infraestrutura é só a que já existe: Render free (com a Vercel na frente), Atlas M0, NVIDIA grátis e o PC do dono à noite.

Regras de ouro (detalhe no `CLAUDE.md`, regras 1 a 19):
- **Gabarito**
  - O gabarito oficial nunca passa por IA, nem o de cursinho: os dois são lidos por código.
  - Questão gerada só é aprovada se o auditor acertar sem ver o gabarito.
- **Quem confere** nunca é da família de quem escreveu (regra de família).
- **Fontes**
  - Bancários, Atualidades, Vendas, leis e normas só valem com fonte oficial ingerida e citação literal.
  - Domínios aceitos para leis: planalto.gov.br, bcb.gov.br, in.gov.br, cvm.gov.br, tjsp.jus.br e al.sp.gov.br.
  - Hierarquia das fontes: A (oficial) > B (material oficial) > C (cursinho). Quando o cursinho diverge da lei, vale a lei.
- **Chat:** o Binho diz "não achei" em vez de chutar.
- **Modelos:** só modelos grátis da NVIDIA.
- **Segurança**
  - Nunca imprimir o `.env` (nem as linhas de comentário), chave ou `MONGODB_URI`.
  - Push só com o repositório privado.
  - Nunca apagar progresso, tentativas, contas ou redações.
- **Atlas:** escrita só com backup verificado → simular → contar → executar → contar. Parar em 80% de uso.
- **IA:** um job por vez; nenhum entre 00:45 e 05:30 fora do noturno.
- **Visual:** regra 8 do `CLAUDE.md`. Binho laranja ensina, Lo turquesa revisa e fala, verde marca resultados e controle. Tema escuro por padrão.

## 2. Estado em números

[PENDENTE: preencher no fechamento da E14 com `bb -- status`, `bb -- uso-banco` e `provas-no-banco`, depois das cadeias de 25/10.]

| Item | Valor | Marca |
|---|---|---|
| Tópicos | 85 no banco; 74 temas na trilha única | [CONFIRMADO 25/10/2026, E1] |
| Tópicos por concurso | bb 58 · tjsp 36 · bacen 59 · cvm 23 | [CONFIRMADO 25/10/2026, E1] |
| Questões | 521 antes das cadeias de 25/10 | [CONFIRMADO 25/10/2026] |
| Oficiais (múltipla escolha) | BB Escriturário 2021 (68) e 2023 (69); Tecnologia 2021 (33) e 2023 (35) | [CONFIRMADO 25/10/2026] |
| Certo/Errado | 27 derivados aprovados de 30 (90%); oficiais na cadeia 2/5 | [CONFIRMADO / PENDENTE] |
| Atlas | 40% (203,7 MB) | [CONFIRMADO 25/10/2026] |
| Testes | 256 ok / 0 falha (7 skip); e2e de fluxos, trilha, concurso, ce, janelas e acordando verdes | [CONFIRMADO 25/10/2026] |

## 3. Como o app se organiza

- **Trilha única + lentes**
  - Há um catálogo único de temas (`data/trilha.json`, 74 temas). A ordem vem de `shared/trilhaUnica.ts` (`bb -- trilha-ordenar`):
    1. nº de concursos que cobram o tema (comuns primeiro);
    2. peso no edital × (1 + incidência na banca);
    3. pré-requisitos (`data/trilha-regras.json`).
  - O domínio é por tema, uma vez só: estudar Crase sobe a prontidão de todos os concursos que cobram Crase.
  - A aba **Geral** (padrão) mostra o todo e a "Prontidão para X" dos 4 concursos.
  - As abas **BB / TJ-SP / BACEN / CVM** são lentes. Cada uma filtra temas, revisões, desempenho e simulados pelo cabeçalho `X-Concurso`.
- **Hierarquia do material**
  - A = lei, norma ou prova oficial;
  - B = livro e material oficial (CVM, BCB);
  - C = cursinho.
  - Questão de cursinho (`origem: "cursinho"`) fica no treino com o selo "Cursinho · <material>" e nunca entra no simulado fiel.
- **Acervo:** os PDFs do dono são só leitura (`ACERVO_DIR`). O índice local fica em `acervo-indice/`, fora do Git. Mapa por tema em `data/temas.json`: os 20 primeiros temas da trilha estão conferidos à mão; tema sem material bom fica com `semMaterial` e o motivo.
- **Janelas de IA**
  - **A** (noturno): 01:00–05:25, pelo Agendador. Etapas: backup → acervo → ingestão (uma prova da fila por noite) → classificação → fila de geração → derivação C/E → fichas → relatório → backup.
  - **B**: 18:00–19:00 por padrão, com horário e teto de chamadas em Admin → Janelas. Se a A não rodou, faz o essencial; se rodou, recupera as pendentes. Comando: `bb -- janela-b`.
  - O relatório de cada janela lista as etapas, com ok, pulada ou falhou.
- **Formatos:** múltipla escolha (Cesgranrio, FGV, Vunesp) e Certo/Errado (Cebraspe: nota com desconto, "em branco" e recomendação).
  - Na Geral, o C/E usa a Cebraspe.
  - Na lente, cada concurso usa a sua banca.
- **Como adicionar um concurso**
  1. Uma linha em `IDS_CONCURSO` e `SIGLA_CONCURSO` (`shared/concursos.ts`).
  2. `data/concursos/<id>.json`: banca, nº de questões, tempo e cota por matéria (do edital).
  3. Matérias novas em `DISCIPLINAS` e temas com o campo `concursos` em `data/trilha.json`.
  4. Rodar `bb -- arvore --simular`, depois `--confirmar` (com backup), e depois `bb -- trilha-ordenar`.
  5. Ingerir as provas da banca e rodar `bb -- incidencia`. A aba aparece sozinha.

## 4. Funciona / quase / falta

**Funciona:**
- treino, revisão, simulado fiel, Raio-X, plano, caderno de erros com "Estudar ouvindo", redação, cartões e Elo;
- trilha única com lentes, prontidão por concurso e Certo/Errado com nota Cebraspe;
- login com convite, Admin (IA, Fila, Janelas, Concursos, Pendências, Convites, Contas);
- noturno com etapas e Janela B, backup (o segundo do dia ganha o sufixo `-HHmm`), PWA com versão;
- abertura instantânea com o Painel guardado enquanto o Render acorda (`web/vercel.json`, `docs/VERCEL.md`).

**Quase:**
- fichas para todos os temas (o noturno faz uma à frente do dono);
- golden set do chat com 30 casos;
- provas Cebraspe/FGV em lotes (cadeia 5 de 25/10).

**Falta (do dono):** ver a seção 6.

## 5. Decisões abertas

Abertas (detalhe em `docs/DECISOES-PENDENTES.md`, lido pela tela Admin → Pendências):
- Glossário de Vendas: ler e liberar.
- Conta de administrador: só o dono cria.
- Pares de similaridade para classificar.
- Crase: `erro_tratamento` fica fora do sorteio até um juiz acertar ≥ 95% em 20 frases.
- Candidatos: classificador `bolt-e4b` e embedding de 1024 dimensões.
- "Espaço da Lo" e "Áudios da Lo": falta a especificação.

Resolvidas (uma linha cada):
- corrente com auditor Muse → Ultra (25/10);
- trilha única + lentes (25/10);
- 4 concursos (25/10);
- OCR `nemotron-parse` v1 só para página sem texto (25/10);
- identidade visual final (25/10).

## 6. Pendências do dono (passo exato)

1. **BNB 2024, item 17:** abrir o gabarito oficial (BNB 2024 Cesgranrio, GABARITO FINAL) e dizer a letra do item 17. O PDF traz "1 7- B".
2. **TJ-SP 2023**
   - Colocar o gabarito oficial da Vunesp na pasta `13_TJ-SP/Provas e Gabaritos`.
   - Mandar o edital, para a cota por matéria de `data/concursos/tjsp.json`.
3. **CNU 2024:** colocar os gabaritos na pasta do CNU (só os cadernos estão lá).
4. **Janela B no Windows:** criar a tarefa "Lobo Binho - Janela B", diária às 18:00, com `npm run bb -- janela-b` na pasta do projeto. Deixe o noturno rodando oculto ("Executar estando o usuário conectado ou não").
5. **Publicar**
   - Seguir `docs/VERCEL.md`: criar o projeto na Vercel apontando para `web/`.
   - Render: *Manual Deploy* → *Deploy latest commit*. Conferir `/api/saude`.
6. **Os 72 arquivos por tema:** pôr em `72 FONTES/` e avisar.
7. **CVM:** os ids `cvm_*` são provisórios até o edital do Agente Executivo.
8. **"Espaço da Lo" e "Áudios da Lo":** descrever o que cada tela deve ter.

## 7. Rodar, publicar, montar do zero

- **Rodar no PC:** `npm run setup` uma vez; `npm run dev` (API :3333 + site :5173); `npm test` e `npm run typecheck`, um de cada vez.
- **Publicar**
  - Render, deploy manual: o `Dockerfile` roda `node --import tsx src/server.ts`.
  - A Vercel serve o site e repassa `/api` para o Render (`web/vercel.json`).
  - Segredos só nos painéis.
- **Montar do zero**
  1. Atlas M0 e `bb -- indice`.
  2. Chave NVIDIA no `.env` (modelo em `.env.example`) e `bb -- testar`.
  3. `bb -- topicos data/topicos.json`, depois `bb -- arvore --confirmar` e `bb -- trilha-ordenar`.
  4. Provas: `bb -- prova <pdf> --gabarito <gab> --nome "<nome>" --banca <b> [--caderno X] [--questoes 1-35]`; Cebraspe: `bb -- prova-ce ...`; cursinho: `bb -- importar-cursinho <pdf> --nome ... [--formato ce]`.
  5. Leis: `bb -- baixar-fontes`, depois `ingerir-fontes <id> --simular|--confirmar`, uma por vez.
  6. `bb -- corrente definitiva`.
  7. O noturno enche o banco; fila de provas: `bb -- fila-ingestao --add itens.json`.

## 8. Modelos, fontes, figuras

- **Corrente definitiva** (`CORRENTE_DEFINITIVA`, `src/catalogo.ts`):
  - gerador e tutor: gpt-oss-20b → Muse → Lightning;
  - auditor: Muse → Ultra;
  - escritor PT: GLM-flash → gpt-oss → Muse;
  - juiz PT e redação: Ultra → Muse.
  - A extração de provas passa pela corrente do auditor (JSON com conserto e janela refeita página a página).
  - Modelo com menos de 20% de sucesso em 24 h descansa 1 h.
- **Estilo por banca:** o gerador recebe o JSON da banca e 3 oficiais reais da banca no tema.
- **Fontes oficiais:** catálogo em `data/fontes-oficiais.json`. Leis dos 4 editais (CF, 8.112, 9.784, 14.133, 8.429, 12.527, Dec. 1.171, 6.404, CP, CPP, CPC, Lei SP 10.261), além das do BB e do BCB.
- **Figuras:** desenhadas por código. As oficiais só entram com o OK do dono (tela Figuras).

## 9. E se quebrar

- **O site não abre:**
  1. Na Vercel ele abre na hora com o Painel guardado e a faixa "acordando o servidor"; espere ~1 min.
  2. `/api/saude` com 503 = sem banco: confira a `MONGODB_URI` e o *Network Access* do Atlas.
  3. Nos logs do Render: "API ouvindo" e depois "Banco conectado".
- **O noturno não rodou:**
  1. Abra Admin → Janelas: o relatório mostra as etapas.
  2. Rode `schtasks /query /tn "Lobo Binho - Noturno Local" /v /fo LIST`. O PC precisa estar ligado ou em suspensão, com a conta logada.
  3. Se a Janela B estiver agendada, ela recupera às 18:00.
  4. Trava presa: `bb -- limpar-trava-orfa <pid>`.
- **Prova travada na fila:** quando uma prova falha, ela vai para a Config `fila_ingestao_falhas`. Corrija e enfileire de novo.
- **A IA está fora:** a corrente pula sozinha. Se cair inteira, as tarefas esperam a próxima janela.
- **O banco está cheio:** `bb -- uso-banco` e `bb -- uso-banco ajustar`; alerta em 80%.
- **Restaurar um backup:** `bb -- restaurar backups/<pasta> --simular`, conferir as contagens, depois `--confirmar`.

## 10. Retomar aqui

Ver o "RETOMAR AQUI" no fim de `docs/DIARIO.md`.
