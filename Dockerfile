# Lasso MCP: én container med MCP-server, delte sider og render-app.
# Samme image kører på Railway nu og på Azure Container Apps / App Service senere.

FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/spec/package.json packages/spec/
COPY packages/ui/package.json packages/ui/
COPY apps/view/package.json apps/view/
COPY apps/server/package.json apps/server/
RUN npm ci --no-audit --no-fund
COPY tsconfig.base.json ./
COPY packages packages
COPY apps apps
# Designguiden (/designguide) læser galleriet og designreglerne ved build.
COPY tools tools
COPY docs/design docs/design
RUN npm run build

FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/spec/package.json packages/spec/
COPY packages/ui/package.json packages/ui/
COPY apps/view/package.json apps/view/
COPY apps/server/package.json apps/server/
RUN npm ci --omit=dev --no-audit --no-fund -w @lasso/server

FROM node:22-slim
ENV NODE_ENV=production
# "Gem som PDF": Chromium tegner PDF'erne (apps/server/src/pdf/). Fontene til render-appen er indlejret
# i view.html; Liberation og Noto dækker tegn, Poppins ikke har (fx pile og symboler).
RUN apt-get update && apt-get install -y --no-install-recommends chromium fonts-liberation fonts-noto-core && rm -rf /var/lib/apt/lists/*
ENV PDF_CHROMIUM_PATH=/usr/bin/chromium
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/apps/server/dist ./dist
COPY apps/server/package.json ./package.json
USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]
