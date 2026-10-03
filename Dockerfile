# syntax=docker/dockerfile:1

# ---- base: Node + pnpm, with the compilers better-sqlite3 needs ----
# The full (non-slim) image already has python3, make and g++ for node-gyp.
FROM node:22-bookworm AS base
# Installed globally (not via corepack) so every user, including `node`, can run it.
RUN npm install -g pnpm@10.28.0
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./

# ---- deps: all dependencies ----
FROM base AS deps
RUN pnpm install --frozen-lockfile

# ---- prod-deps: runtime dependencies only ----
FROM base AS prod-deps
RUN pnpm install --frozen-lockfile --prod

# ---- tools: source + dev dependencies, for the CLI scripts ----
FROM deps AS tools
COPY . .
ENV NODE_ENV=production \
	DATABASE_PATH=/data/league.db
RUN mkdir -p /data && chown node:node /data
# Same uid as the app, so files it creates in /data stay writable by the app.
USER node
ENTRYPOINT ["pnpm", "--silent", "run"]
CMD ["generate"]

# ---- build: compile the app ----
FROM deps AS build
COPY . .
ARG APP_ORIGIN=https://battle.sonhal.no
RUN APP_ORIGIN=$APP_ORIGIN pnpm build

# ---- app: what runs behind Caddy ----
FROM node:22-bookworm-slim AS app
ENV NODE_ENV=production \
	PORT=3000 \
	DATABASE_PATH=/data/league.db
WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/build ./build
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 3000
CMD ["node", "build"]
