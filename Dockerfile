# syntax=docker/dockerfile:1

# ---- deps: install everything, compiling the native better-sqlite3 module ----
# The full (non-slim) image already has python3, make and g++ for node-gyp.
FROM node:22-bookworm AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- tools: source + dev dependencies, for the puzzle generator CLI ----
FROM deps AS tools
COPY . .
ENV NODE_ENV=production \
	DATABASE_PATH=/data/league.db
RUN mkdir -p /data && chown node:node /data
# Same uid as the app, so files it creates in /data stay writable by the app.
USER node
ENTRYPOINT ["npm", "run", "--silent"]
CMD ["generate"]

# ---- build: compile the app, then drop dev dependencies ----
FROM deps AS build
COPY . .
ARG APP_ORIGIN=https://battle.sonhal.no
RUN APP_ORIGIN=$APP_ORIGIN npm run build && npm prune --omit=dev

# ---- app: what runs behind Caddy ----
FROM node:22-bookworm-slim AS app
ENV NODE_ENV=production \
	PORT=3000 \
	DATABASE_PATH=/data/league.db
WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/build ./build
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 3000
CMD ["node", "build"]
