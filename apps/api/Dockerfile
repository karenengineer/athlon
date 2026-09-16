FROM node:22-bookworm-slim AS dependencies

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && corepack prepare pnpm@11.19.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/api/prisma.config.ts apps/api/prisma.config.ts
COPY apps/api/prisma apps/api/prisma

RUN pnpm install --frozen-lockfile

FROM dependencies AS build

COPY . .

RUN pnpm --filter @athlon/api prisma:generate \
  && pnpm --filter @athlon/api build

FROM node:22-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production \
  COREPACK_HOME=/usr/local/share/corepack

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && corepack prepare pnpm@11.19.0 --activate \
  && mkdir -p /app/uploads \
  && chown -R node:node /app

COPY --from=build --chown=node:node /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/apps ./apps

WORKDIR /app/apps/api

USER node

CMD ["node", "dist/src/main.js"]
