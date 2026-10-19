# BB Estudos (lobo): API + site compilado numa imagem só. O mesmo container roda o noturno
# (comando diferente). Variáveis de ambiente vêm do provedor: nada de .env dentro da imagem.
FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NODE_ENV=production

# dependências primeiro (cache de camada). O tsx é dependência de PRODUÇÃO (roda o TypeScript direto):
# fica na imagem depois do prune e nada é baixado na partida (antes o "npx tsx" baixava a cada início).
COPY package.json package-lock.json ./
COPY web/package.json web/package-lock.json web/
RUN npm ci --include=dev --no-audit --no-fund \
 && npm --prefix web ci --include=dev --no-audit --no-fund

COPY . .
RUN npm --prefix web run build \
 && npm prune --omit=dev --no-audit --no-fund \
 && rm -rf web/node_modules \
 && node --import tsx -e "console.log('tsx ok')"

# o Render passa a porta em PORT; o servidor abre a porta antes de conectar no banco
ENV PORT=3333
EXPOSE 3333
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s CMD node -e "fetch('http://localhost:'+(process.env.PORT||3333)+'/api/saude').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--import", "tsx", "src/server.ts"]
