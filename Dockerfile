# =============================================================================
# Build Stage
# =============================================================================
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10.24.0 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile --shamefully-hoist

COPY . .
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" pnpm exec prisma generate --config prisma/prisma.config.ts && pnpm run build

# =============================================================================
# Production Stage
# =============================================================================
FROM node:22-alpine AS production

# npm/corepack/yarn ne servent pas au runtime (demarrage = node + binaires locaux) :
# on retire leurs dependances embarquees (tar, etc.) de l'image
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
           /usr/local/bin/yarn /usr/local/bin/yarnpkg /opt/yarn-*

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

CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy --config prisma/prisma.config.ts && node dist/main.js"]
