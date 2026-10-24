# ---------- Etapa 1: compilar ----------
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN --mount=type=secret,id=npm_ca \
    if [ -f /run/secrets/npm_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/npm_ca; fi; \
    npm ci --no-audit --no-fund && test -x node_modules/.bin/tsc
COPY . .
RUN npm run build

# ---------- Etapa 2: imagen final (solo lo necesario para ejecutar) ----------
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN --mount=type=secret,id=npm_ca \
    if [ -f /run/secrets/npm_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/npm_ca; fi; \
    npm ci --omit=dev --no-audit --no-fund && test -d node_modules/@nestjs/core
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/main"]
