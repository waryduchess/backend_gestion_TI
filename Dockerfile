# syntax=docker/dockerfile:1

# ---------- Base ----------
FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NODE_ENV=development \
    PUPPETEER_SKIP_DOWNLOAD=true
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

# ---------- Dependencias ----------
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ---------- Desarrollo (hot reload) ----------
FROM base AS development
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.json ./
COPY prisma7.config.ts ./
COPY prisma ./prisma
COPY src ./src
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ---------- Compilacion ----------
FROM base AS builder
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.json ./
COPY prisma7.config.ts ./
COPY prisma ./prisma
COPY src ./src
RUN npx prisma generate && npm run build

# ---------- Produccion ----------
FROM base AS production
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma7.config.ts ./prisma7.config.ts
EXPOSE 3000
CMD ["node", "dist/app.js"]
