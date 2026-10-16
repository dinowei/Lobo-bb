# Prompt — Proteção de conteúdo, dados e app de celular

**Quando usar:** quando o app for virar produto (com login e assinantes). Antes disso, só confira se o repositório do GitHub está **privado**.

**Como usar:** cole o prompt inteiro. Ele trabalha em 4 fases e para no fim de cada uma para você testar e aprovar.

```
Leia o CLAUDE.md. Vamos preparar o app para usuários pagantes, protegendo o conteúdo
(questões e explicações) e os dados. Trabalhe em 4 FASES. No fim de cada fase:
typecheck, testes, commit, e PARE para eu testar e aprovar antes da próxima.
Antes de começar cada fase, me mostre um plano curto.

==================== FASE 1 — CONTAS E SEGURANÇA DO SERVIDOR ====================
1. Autenticação: cadastro e login por e-mail + senha (bcrypt) e opção de link
   mágico por e-mail. Sessão em cookie httpOnly + secure + sameSite.
   Remover o ALUNO_ID fixo: tentativas, revisões, redações e simulados passam a
   pertencer ao userId real. Migração: os dados atuais vão para a minha conta.
2. Uma sessão por conta: login novo derruba a sessão anterior (evita senha
   compartilhada). Registrar dispositivo e IP de cada login.
3. Papéis: "admin" (eu) e "aluno". Comandos de ingestão e rotas de administração
   só para admin.
4. Segurança básica: helmet, CORS restrito ao domínio, validação zod em TODAS as
   rotas, segredos só no .env, nenhum segredo no front.
5. LGPD: coleta mínima; rotas para exportar e apagar a conta; rascunho de Termos
   de Uso e Política de Privacidade em docs/ (eu reviso com advogado).

==================== FASE 2 — CONTEÚDO QUE NÃO VAZA EM MASSA ====================
6. A API nunca entrega o banco: /proxima devolve UMA questão sem gabarito e sem
   explicações; gabarito e explicações só em /responder, e só da questão que o
   usuário acabou de receber. Nenhuma rota lista questões em massa.
7. Rate limit por usuário (configurável no .env): ex. 120 questões/hora e 600/dia.
   Ao passar de 80%: alerta no log e numa coleção "alertas". Ao estourar:
   bloqueio temporário com mensagem amigável.
8. Detecção de robô: padrões não humanos (tempo de resposta < 2 s em sequência,
   atividade 24h, muitas contas no mesmo IP) geram alerta para o admin.
9. Marca d'água visível: e-mail do usuário em diagonal, baixa opacidade, repetido
   sobre a área da questão e das explicações (em CSS, sem atrapalhar a leitura).
10. Marca d'água invisível: caracteres de largura zero no texto da questão
    codificando o userId. Comando "npm run bb -- rastrear" que recebe um texto
    colado (de um vazamento) e diz de qual usuário veio.
11. Cópia casual no site: desativar seleção de texto, menu de contexto, arrastar e
    o evento de copiar na área da questão e das explicações. NÃO bloquear campos
    de digitação (redação, contestação, busca).

==================== FASE 3 — APP ANDROID E iOS (CAPACITOR) ====================
12. Empacotar o site React (web/) com Capacitor para Android e iOS, reaproveitando
    o mesmo código. App id: br.com.lobo.estudos (eu confirmo depois). Ícone e
    splash com o mascote (web/src/assets/lobo.png).
13. Android: ativar a tela segura (FLAG_SECURE) em todas as telas, para print e
    gravação saírem pretos. Use um plugin mantido (verifique o mais atual, por
    exemplo um "privacy screen" da comunidade Capacitor) ou implemente
    nativamente na MainActivity.
14. iOS: a Apple não permite bloquear print. Então:
    - ao detectar print: borrar a questão por 3 s, mostrar aviso
      ("conteúdo protegido, este print foi registrado") e registrar o evento
      no servidor (userId, data, questão);
    - durante gravação ou espelhamento de tela: esconder o conteúdo;
    - no seletor de apps (multitarefa): mostrar tela com o mascote, não a questão.
15. Dentro do app: seleção e cópia desligadas na área de conteúdo.
16. Regra de acesso: no CELULAR, as questões só abrem pelo app. Se alguém acessar
    o site por navegador de celular, mostrar a tela "Baixe o app" (com o lobo).
    No computador, o site continua liberado, com marca d'água.
    Deixe isso configurável no .env (CONTEUDO_MOBILE_SO_APP=true).
17. Me explique o passo a passo para gerar o APK de teste e para rodar no
    simulador do iPhone (se eu não tiver Mac, diga as alternativas).

==================== FASE 4 — PAINEL DO ADMIN ====================
18. Tela de admin: usuários, alertas de abuso, prints registrados no iOS,
    vazamentos rastreados, e botões para suspender e reativar conta.
19. Atualize o CLAUDE.md com as regras novas:
    - "A API nunca entrega gabarito antes da resposta nem lista o banco."
    - "Todo conteúdo exibido leva marca d'água do usuário."
    - "No celular, conteúdo só pelo app."
```

## O que esperar
- **Android:** print e gravação de tela saem pretos.
- **iPhone:** o print acontece (a Apple não deixa bloquear), mas é detectado, registrado e a questão é borrada. Gravação de tela vê tela vazia.
- **Computador:** sem bloqueio de print, mas cada tela carrega o e-mail do aluno, visível e invisível.
- **Foto da tela com outro celular:** ninguém impede. A marca d'água é o que identifica quem vazou.
