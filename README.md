# Family Battle

A weekly Connections-style puzzle league for the family: one puzzle per week, played
asynchronously Sunday to Wednesday, scored across the season. Built with SvelteKit 3,
SQLite and the Claude API (for puzzle generation).

- `docs/PLAN.md`: design and implementation plan
- `docs/DEPLOY.md`: deployment runbook (Docker, Caddy, Authelia)

## Local development

```sh
npx npm@11 install                     # npm 10 crashes on this tree; see docs/PLAN.md
npm run seed:sample -- 1               # sample puzzle as week 1 in ./data/league.db
DEV_USERS="sondre:admin,anna,bob" NOW_OVERRIDE="2026-10-04T10:00:00Z" npm run dev
```

There is no Authelia in dev. `DEV_USERS` fakes the identity headers, and `?as=anna` switches
user. `NOW_OVERRIDE` pins the clock so you can test each phase. Both are ignored in production.

```sh
npm test          # unit tests (schedule, game rules, auth, page-data leaks)
npm run check     # svelte-check / TypeScript
npm run lint      # prettier
```

## Puzzle generation

```sh
ANTHROPIC_API_KEY=... npm run generate -- --weeks 1-13 --reserves 2 --quiet
```

See `scripts/generate-puzzles.ts` for options (`--replace`, `--dry-run`, `--language`).
