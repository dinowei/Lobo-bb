# BB Estudos (lobo): API + site compilado numa imagem só. O mesmo container roda o noturno
# (comando diferente). Variáveis de ambiente vêm do provedor: nada de .env dentro da imagem.
FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NODE_ENV=production

# dependências primeiro (cache de camada); tsx roda o TypeScript direto, então fica instalado
COPY package.json package-lock.json ./
COPY web/package.json web/package-lock.json web/
RUN npm ci --include=dev --no-audit --no-fund \
 && npm --prefix web ci --include=dev --no-audit --no-fund

COPY . .
RUN npm --prefix web run build \
 && npm prune --omit=dev --no-audit || true

# tsx é dev, mas é quem roda o servidor: reinstala só ele depois do prune
RUN npm install --no-save --no-audit --no-fund tsx@4

ENV PORT=3333
EXPOSE 3333
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s CMD node -e "fetch('http://localhost:'+(process.env.PORT||3333)+'/api/saude').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["npx", "tsx", "src/server.ts"]
