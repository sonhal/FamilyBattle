# Family Battle

A weekly Connections-style puzzle league for the family: one puzzle per week, played
asynchronously Sunday to Wednesday, scored across the season. Built with SvelteKit 3,
SQLite and the Claude API (for puzzle generation).

Players see Norwegian (Bokmål), puzzles included. Code, config and documentation are in English.

- `docs/PLAN.md`: design and implementation plan
- `docs/DEPLOY.md`: deployment runbook (Docker, Caddy, Authelia)

## Local development

```sh
pnpm install
pnpm seed:sample 1                     # sample puzzle as week 1 in ./data/league.db
DEV_USERS="sondre:admin,anna,bob" NOW_OVERRIDE="2026-10-04T10:00:00Z" pnpm dev
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

`.github/workflows/ci.yml` runs on every push and pull request:

1. **verify**: `pnpm lint`, `pnpm check`, `pnpm test`, `pnpm build`
2. **docker**: builds the `app` and `tools` images. Pushes to the default branch and `v*` tags
   also publish them to `ghcr.io/sonhal/familybattle` and `ghcr.io/sonhal/familybattle-tools`,
   with provenance and SBOM attestations. Pull requests only build them.

Actions are pinned to commit SHAs. Dependabot (`.github/dependabot.yml`) keeps actions, npm
packages and base images up to date. Release by pushing a tag such as `v1.0.0`.
