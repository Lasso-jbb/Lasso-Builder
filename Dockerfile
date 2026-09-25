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
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/apps/server/dist ./dist
COPY apps/server/package.json ./package.json
USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]
