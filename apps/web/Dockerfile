FROM node:22-bookworm-slim AS dependencies

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.19.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/api/prisma.config.ts apps/api/prisma.config.ts
COPY apps/api/prisma apps/api/prisma
COPY apps/web/package.json apps/web/package.json

RUN pnpm install --frozen-lockfile

FROM dependencies AS build

COPY . .

RUN pnpm --filter @athlon/web build \
  && pnpm --filter @athlon/web deploy --prod --legacy /app/runtime

FROM node:22-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

COPY --from=build --chown=node:node /app/runtime/node_modules ./node_modules
COPY --from=build --chown=node:node /app/apps/web/dist/web ./apps/web/dist/web

USER node

CMD ["node", "apps/web/dist/web/server/server.mjs"]
