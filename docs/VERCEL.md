# Site rápido: Vercel na frente, Render atrás (F13 / E12)

[DECLARADO] Preparado em 25/10/2026. **Ninguém criou o projeto na Vercel nem mexeu em DNS**: quem publica é o revisor/dono.

## O que já está no repositório

- `web/vercel.json`:
  - rewrite `/api/*` → `https://lobo-binho.onrender.com/api/*`: o cookie de login fica no domínio do site (mesmo site, sem CORS);
  - volta para `index.html` nas rotas do app;
  - cabeçalhos de segurança: `nosniff`, `DENY` para iframe, `Referrer-Policy`, `Permissions-Policy` (microfone só no próprio site) e HSTS;
  - cache: `/assets/*` por 1 ano (`immutable`; o nome tem hash). `index.html` e `sw.js` com `no-cache`.
- PWA com versão: o build grava a versão (`__VERSAO__`) e registra `/sw.js?v=<versão>`. O service worker usa um cache por versão e apaga os antigos ao ativar, então **deploy novo nunca serve JS velho**.
- Abertura instantânea (`VITE_SERVIDOR_REMOTO=1`):
  - **com um painel já guardado neste aparelho**, o site abre na hora com ele e o aviso "Acordando o servidor". Ele não cai no modo demo e, quando o Render responde (até ~1 min), entra de verdade;
  - **sem nada guardado** (primeira visita no aparelho), mostra "Carregando…" até o servidor responder;
  - as respostas dadas sem conexão vão para a fila e são enviadas sozinhas.
  - Prova: `scripts/e2e-acordando.ts` (servidor `bb-web-remoto`, porta 5183), com prints em `docs/telas/acordando/`.

## Passo a passo (para o dono/revisor)

1. Vercel → *Add New Project* → importar `dinowei/Lobo-bb` (repositório privado).
2. **Root Directory: `web`**. Deixe ligado *Include files outside the root directory*: o site importa `../shared` e `../data`.
3. *Framework*: Vite. O build e a pasta (`npm run build`, `dist`) já vêm do `vercel.json`.
4. *Environment Variables* (Production e Preview): `VITE_SERVIDOR_REMOTO` = `1`. **Não** defina `VITE_API_URL`: o rewrite cuida do `/api`.
5. Deploy. Depois confira:
   - `https://<projeto>.vercel.app/api/saude` → `{"ok":true}` (pode levar ~1 min se o Render estiver dormindo);
   - entrar com a conta do dono e ver o cookie no domínio da Vercel;
   - recarregar com o Render dormindo: o painel aparece na hora com o aviso.
6. Medir: Lighthouse (celular) na página inicial e o tempo até a primeira questão com o servidor dormindo (meta < 2 s com painel guardado).
7. Domínio próprio: só se o dono quiser, pelo painel da Vercel (DNS é do dono).

## Rotas longas

Correção de redação e chat longo já respondem por pedido + acompanhamento (fila do servidor). Pelo rewrite, o limite de tempo da Vercel vale para a resposta de cada pedido, não para o trabalho na fila.
