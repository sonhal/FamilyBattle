# Family Battle

A weekly Connections-style puzzle league for the family: one puzzle per week, played
asynchronously Sunday to Wednesday, scored across the season. Built with SvelteKit 3,
SQLite and the Claude API (for puzzle generation).

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
