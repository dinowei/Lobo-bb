# Prompts de melhoria — um por vez

**Como usar**
- Cole **um** prompt, espere terminar, teste no site e faça commit. Só então cole o próximo.
- Pré-requisito: Etapa C do `docs/INTEGRACAO.md` feita (com prova oficial no banco). Vários itens usam as questões oficiais como referência.
- Se o Claude Code propuser algo que contradiz uma regra do `CLAUDE.md`, a regra vence.
- Ordem pensada: **1 → 2 → 3 → 4 → 5 → 6**. O 4 (dificuldade) vem antes do 5 (diagnóstico) porque o diagnóstico alimenta o nível calibrado; e o plano (6) usa tudo o que veio antes.

Todos os prompts terminam com o mesmo fechamento. Ele já está incluído em cada um.

---

## 1. Simulado fiel à prova

```
Leia o CLAUDE.md. Antes de codar, me mostre um plano curto (arquivos e mudanças) e siga.

OBJETIVO: o simulado tem que reproduzir a prova real do BB, não a quantidade de tópicos.

1. Crie data/estrutura-prova.json com a estrutura do último concurso (Escriturário, Cesgranrio):
   - 70 questões objetivas
   - Conhecimentos Básicos (25): lingua_portuguesa 10, lingua_inglesa 5, matematica 5, atualidades_mercado_financeiro 5
   - Conhecimentos Específicos (45): matematica_financeira 5, conhecimentos_bancarios 10, informatica 15, vendas_negociacao 15
   - redacao: { tipo: "dissertativo-argumentativo", pontos: 100, minimo: 70 }
   - pesos por bloco e duração da prova: null (não confirmados; NÃO invente)
   - "conferido": false e "fonte": "raio-x de portais de concurso; conferir no edital"
   Se uma disciplina do data/topicos.json não estiver na estrutura (ex.: probabilidade_estatistica),
   marque como "fora do edital atual": continua praticável, mas sai dos simulados e cai para
   prioridade baixa no treino inteligente.
2. Em shared/motor.ts: troque cotasPorDisciplina para usar a estrutura (proporcional quando o
   simulado for menor que 70). A prioridade do treino passa a usar a cota da disciplina dividida
   pelo nº de tópicos dela (enquanto questoesNaProva do tópico estiver vazio). Escreva testes:
   as cotas de 70 somam exatamente 70 e batem com o JSON.
3. Simulado "Prova completa": 70 questões nas cotas exatas, cronômetro regressivo com a duração
   configurável em Ajustes (padrão vazio → cronômetro progressivo), sem correção até entregar.
4. Mistura de dificuldade: se houver ≥ 30 questões oficiais com dificuldade, use a distribuição
   delas; senão use 20% fácil (1–2), 50% média (3), 30% difícil (4–5) e mostre "estimativa".
5. Resultado: acertos por bloco e por disciplina comparados à cota, nota ponderada quando houver
   pesos, e linha de corte configurável em Ajustes.
6. Atualize servidor (src/estudo.ts) e modo demo (web/src/api/demo.ts) juntos.

FECHAMENTO: rode "npm run typecheck" e os testes, rode um simulado completo no site,
atualize CLAUDE.md e docs/ROADMAP.md e faça commit com mensagem clara.
```

---

## 2. Redação

```
Leia o CLAUDE.md. Antes de codar, me mostre um plano curto e siga.

OBJETIVO: treinar a redação (dissertativo-argumentativa, 100 pontos, mínimo 70 para aprovação),
que hoje o app não cobre e que pode eliminar mesmo com objetiva boa.

1. Modelo Redacao no Mongo: tema, proposta, textosMotivadores[], texto, tempoSeg, linhas,
   correcao { criterios[{nome, nota, max, comentario, trechos[]}], notaTotal, pontosFortes[],
   melhorias[], paragrafoReescrito }, status, timestamps.
2. Gerador de temas (comando "npm run bb -- temas --n 10" + geração sob demanda): temas no estilo
   da banca (sociedade, tecnologia, sistema financeiro, cidadania), com proposta e 2–3 textos
   motivadores CURTOS escritos pela própria IA (nunca copie artigos reais).
3. Tela "Redação" (nova entrada na sidebar, ícone de traço como os outros): escolher tema,
   escrever com contador de linhas (limite de linhas configurável; padrão 30, marcado como
   "confira no edital"), cronômetro, rascunho salvo automaticamente no navegador.
4. Correção pelo AUDITOR_MODEL com rubrica em JSON (cada critério 0–25):
   adequação ao tema e ao tipo textual / estrutura e coesão / argumentação / norma-padrão.
   Ele deve citar o trecho exato de cada problema. Corrija DUAS vezes; se as notas diferirem
   mais de 15 pontos, faça uma terceira e use a mediana. Valide com zod.
5. Resultado: nota total com a linha dos 70 destacada, critérios, trechos marcados no texto,
   um parágrafo reescrito como exemplo e histórico de notas. Sempre mostrar o aviso
   "Nota estimada por IA; use como treino, não como garantia."
6. Conquistas novas: "Primeira redação" e "Acima da linha" (≥ 70).
7. No modo demo: tela funciona com 1 tema de exemplo e explica que a correção precisa do servidor.

Adicione ao CLAUDE.md a regra: "Nota de redação é estimativa da IA, sempre sinalizada."

FECHAMENTO: typecheck, teste uma redação real de ponta a ponta, atualize CLAUDE.md e
ROADMAP, commit.
```

---

## 3. Teoria antes da questão

```
Leia o CLAUDE.md. Antes de codar, me mostre um plano curto e siga.

OBJETIVO: o app ensina só pelo erro. Quero uma aula curta por tópico e um tutor por questão.

1. Modelo Aula: topicId, conteudo em markdown (máx. ~400 palavras), pontosChave[],
   comoABancaCobra, pegadinhasComuns[], exemplos[], fontes[], status, auditoria.
2. Geração ("npm run bb -- aulas [--assunto X]"):
   - Disciplinas normativas (Bancários, Atualidades) SÓ com fontes ingeridas, citando o trecho;
     sem fonte → não gera (mesma regra das questões).
   - Use questões oficiais do tópico como referência de "como a banca cobra".
   - O AUDITOR revisa a aula contra as fontes e reprova afirmação sem base.
3. No site: ao entrar num tópico pela primeira vez, mostra o cartão da aula com
   "Já sei, ir para as questões". Aba "Aula" sempre acessível na tela Praticar.
   Renderize markdown com segurança (sem HTML cru).
4. Botão "Me explica de outro jeito" em toda questão corrigida:
   rota POST /api/explicar-mais { questaoId, duvida? } → explicação mais simples, com analogia.
   A IA recebe o gabarito e as explicações salvas e NUNCA pode contradizê-los.
   Cache por questão + dúvida. Limite de 20 pedidos/dia (configurável).
5. Modo demo: aula de exemplo escrita à mão para 3 tópicos; o tutor mostra que precisa do servidor.

FECHAMENTO: typecheck, gere aulas de 3 tópicos e me mostre uma para eu revisar,
atualize CLAUDE.md e ROADMAP, commit.
```

---

## 4. Dificuldade calibrada (rating tipo xadrez)

```
Leia o CLAUDE.md. Antes de codar, me mostre um plano curto e siga.

OBJETIVO: a dificuldade hoje é o chute da IA. Quero calibrar com dados reais e escolher
questões no meu nível.

1. Sistema de rating Elo (puro, em shared/rating.ts, com testes):
   - Questão: rating inicial a partir da dificuldade (1→1000, 2→1150, 3→1300, 4→1450, 5→1600).
   - Eu: rating por disciplina, inicial 1200.
   - A cada resposta, atualiza os dois (K=32 para mim, K=16 para a questão; chute certo conta
     meio acerto). Simulado também atualiza.
2. Dificuldade exibida (1–5) passa a vir do rating da questão quando ela tiver ≥ 5 respostas.
3. Treino inteligente: dentro do tópico escolhido, prefira questões com rating perto do meu
   (alvo = meu rating + 50, para puxar levemente para cima). Revisões não mudam.
4. Painel: mostrar "nível estimado" por disciplina (barra de rating) na lista de disciplinas.
5. Relatório no CLI ("npm run bb -- calibragem"): onde a IA mais erra a dificuldade que rotula,
   para ajustar o prompt do gerador.
6. Migração: calcular ratings a partir das tentativas já existentes.
7. Servidor e modo demo juntos.

FECHAMENTO: typecheck + testes do rating, atualize CLAUDE.md e ROADMAP, commit.
```

---

## 5. Diagnóstico inicial

```
Leia o CLAUDE.md. Antes de codar, me mostre um plano curto e siga.

OBJETIVO: descobrir meu ponto de partida para não gastar tempo onde já sei.

1. Diagnóstico de 30 questões, distribuídas pela estrutura da prova (data/estrutura-prova.json),
   dificuldade média, sem correção até o fim, sem limite de tempo.
2. No fim: resultado por disciplina, que inicializa o rating por disciplina (item 4) e as
   prioridades do treino. Mostre "seus 3 pontos fortes" e "seus 3 focos".
3. O painel convida para o diagnóstico enquanto ele não foi feito (cartão com o lobo).
   Pode refazer a cada 30 dias; guarde o histórico e mostre a evolução entre diagnósticos.
4. Conquista "Raio-X feito".
5. Servidor e modo demo.

FECHAMENTO: typecheck, faça um diagnóstico no site, atualize CLAUDE.md e ROADMAP, commit.
```

---

## 6. Plano até a prova

```
Leia o CLAUDE.md. Antes de codar, me mostre um plano curto e siga.

OBJETIVO: transformar "estudar infinito" em um plano com linha de chegada.

1. Ajustes: data da prova (já existe), horas por dia e dias da semana disponíveis.
2. shared/plano.ts (puro, com testes) gera o plano semanal:
   - Sem data: ciclo de estudos contínuo (rodízio por peso × fraqueza).
   - Com data: fases "Base" (até cobrir todos os tópicos), "Aprofundamento" e "Reta final"
     (últimas 3 semanas: só revisão, caderno de erros, redação e 2 simulados por semana).
   - Distribui tempo por cota da disciplina na prova × (1 − domínio) × rating (itens 1 e 4).
   - Inclui 1 redação por semana e 1 simulado por semana fora da reta final.
3. Painel: a Agenda passa a mostrar o "Plano de hoje" (tópicos, nº de questões, redação ou
   simulado do dia) e o hero mostra "Semana X de Y".
4. Tela "Plano": semanas, o que foi cumprido, e replanejamento automático se eu atrasar
   (sem me culpar; só redistribui).
5. Servidor e modo demo.

FECHAMENTO: typecheck + testes do plano, atualize CLAUDE.md e ROADMAP, commit.
```
