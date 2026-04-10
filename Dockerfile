# =============================================================================
# Build Stage
# =============================================================================
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile --shamefully-hoist

COPY . .
RUN pnpm exec prisma generate --config prisma/prisma.config.ts && pnpm run build

# =============================================================================
# Production Stage
# =============================================================================
FROM node:22-alpine AS production

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

WORKDIR /app

COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma

USER nestjs

ENV NODE_ENV=production
ENV PORT=3014

EXPOSE 3014

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:3014/api/healthz || exit 1

CMD ["sh", "-c", "npx prisma migrate deploy --config prisma/prisma.config.ts && node dist/main.js"]
