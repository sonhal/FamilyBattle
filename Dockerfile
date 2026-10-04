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
RUN pnpm build

# ---- app: what runs behind Caddy ----
FROM node:22-bookworm-slim AS app
# Release version (v0.1.0) stamped by CI; empty for local builds.
ARG VERSION=
# The public URL is not baked in: the app takes the host from the Host header and
# the scheme from Caddy's X-Forwarded-Proto (adapter-node's PROTOCOL_HEADER). Only
# Caddy can reach the app (loopback + PROXY_SECRET), so these headers are trusted.
ENV APP_VERSION=$VERSION \
	PROTOCOL_HEADER=x-forwarded-proto \
	NODE_ENV=production \
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
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
	CMD ["node", "-e", "fetch('http://127.0.0.1:3000/healthz').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "build"]
