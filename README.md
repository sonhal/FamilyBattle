# Family Battle

A weekly Connections-style puzzle league for the family: one puzzle per week, played
asynchronously Sunday to Wednesday, scored across the season. Built with SvelteKit 3,
SQLite and the Claude API (for puzzle generation).

Players see Norwegian (Bokmål), puzzles included. Code, config and documentation are in English.

- `docs/PLAN.md`: design and implementation plan
- `docs/DEPLOY.md`: deployment runbook (Docker, Caddy, Authelia)
- `docs/VPS-AGENT.md`: instructions for the Claude agent that operates the VPS
- `AGENTS.md`: conventions for coding agents (commits, releases, sandbox quirks)

## Local development

```sh
pnpm install
pnpm seed:sample 1                     # sample puzzle as week 1 in ./data/league.db
DEV_USERS="sonhal:admin,anna,bob" NOW_OVERRIDE="2026-10-04T10:00:00Z" pnpm dev
```

There is no Authelia in dev. `DEV_USERS` fakes the identity headers, and `?as=anna` switches
user. `NOW_OVERRIDE` pins the clock so you can test each phase. Both are ignored in production.

```sh
pnpm test         # unit tests (schedule, game rules, auth, page-data leaks)
pnpm check        # svelte-check / TypeScript
pnpm lint         # prettier
```

## Puzzle generation

```sh
ANTHROPIC_API_KEY=... pnpm generate --weeks 1-13 --reserves 2 --quiet
```

See `scripts/generate-puzzles.ts` for options (`--replace`, `--dry-run`, `--language`).

## CI

`.github/workflows/ci.yml` runs on every pull request and push to `main`:

1. **verify**: `pnpm lint`, `pnpm check`, `pnpm test`, `pnpm build`
2. **images**: builds the `app` and `tools` images (nothing is published)
3. **tag** (push to `main`): if the Conventional Commits since the last release call for one
   (`scripts/next-version.sh`), tags `vX.Y.Z` and runs the pipeline on the tag
4. **publish-images** and **release** (tags): push `ghcr.io/sonhal/familybattle` and
   `familybattle-tools` as `X.Y.Z`, `X.Y` and `latest` with provenance, then a GitHub Release

PR titles must be Conventional Commits (`feat: ...`, `fix: ...`); see `AGENTS.md`. Actions are
pinned to commit SHAs, and Dependabot keeps actions, npm packages and base images up to date.
