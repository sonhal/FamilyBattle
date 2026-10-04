# Family Connections League: Implementation Plan

Based on the concept doc "Family Connections League: Concept". The concept rules (weekly cycle,
gameplay, scoring, voting, data model) are not repeated here; this plan covers how to build them.

## Decisions

| Topic    | Decision                                                                                               |
| -------- | ------------------------------------------------------------------------------------------------------ |
| Stack    | SvelteKit (`@sveltejs/adapter-node`), TypeScript, Vite for dev, Vitest for tests                       |
| Deploy   | One Docker container on the VPS, behind the existing reverse proxy                                     |
| Database | SQLite (`better-sqlite3`) on a Docker volume, migrations embedded in `db.ts`                           |
| Auth     | Existing forward-auth proxy. The app reads identity from request headers                               |
| Admin    | Membership in an Authelia group (`ADMIN_GROUP`, default `familybattle-admin`)                          |
| Players  | Membership in an Authelia group (`PLAYER_GROUP`, default `familybattle`)                               |
| Proxy    | Caddy `forward_auth` → Authelia, site `battle.sonhal.no`                                               |
| Client   | Mobile-first PWA                                                                                       |
| Language | Norwegian (Bokmål) for everything players see, puzzles included. English for code, config and docs     |
| Timezone | `Europe/Oslo` for all phase boundaries (Luxon); each player sees deadlines in their own local time     |
| Puzzles  | A CLI script generates all 13 weeks plus 2 reserves up front with the Claude API, run by the VPS agent |
| Launch   | Week 1 opens **Sun Oct 4, 00:00 Oslo**, so features ship in stages (see Milestones)                    |

Defaults for the concept doc's remaining open items. Scoring is derived on read, so any of these can
change later without a data migration:

- App name shown to players: **Ordkampen**.
- Each player's **2 worst weeks are dropped**: the season total is the best
  `13 − voided − 2` weeks. Until a player has more weeks than that, all weeks count, so the drop
  only changes totals from week 12 on.
- Season tiebreaker: most weekly wins, then best single week, **over counted weeks only**, then shared.
- No final-week multiplier.
- "N av M har spilt": M is the number of players with at least one attempt this season.
- A voided week shortens the season. A reserve puzzle can be scheduled as a bonus week if the family wants one.
- No notifications. The admin posts in the family chat.
- No service worker for now.

## Season calendar

Week `n` (1–13) opens on `2026-10-04 + 7·(n-1)` days at 00:00 Oslo time.

| Phase  | Start          | End (exclusive) |
| ------ | -------------- | --------------- |
| open   | Sun 00:00      | Thu 00:00       |
| review | Thu 00:00      | next Sun 00:00  |
| closed | next Sun 00:00 | —               |

- The phase is **computed** from `week` and the current time, never stored. `schedule.ts` exposes
  `phaseOf(week, now)` and `currentWeek(now)`.
- DST: Norway leaves summer time on Sun Oct 25 at 03:00. The 00:00 boundaries are unaffected,
  and Luxon handles the offset.
- Week 13 opens Dec 27 and its review ends Sun Jan 3. The concept doc says "final week closes Wed
  Dec 30", which is the end of the _open_ phase. Standings are final once week 13's review ends.
- Testing: a `NOW_OVERRIDE` env var (ignored when `NODE_ENV=production`) lets you check each phase locally.

## Architecture

```
Browser (PWA) ──► reverse proxy + forward-auth ──► sveltekit container :3000 ──► /data/league.db
                  sets Remote-User / Remote-Groups   (only reachable via proxy)
```

```
src/
  hooks.server.ts            identity from headers → upsert player → event.locals.player
  lib/server/config.ts       header names, groups, DB path, season, (dev) NOW_OVERRIDE
  lib/server/auth.ts         header → identity, fail closed (pure, unit-tested)
  lib/server/db.ts           better-sqlite3 connection, WAL mode, embedded migrations on boot
  lib/server/schedule.ts     week/phase math (pure, unit-tested)
  lib/server/game.ts         guess evaluation (pure, unit-tested)
  lib/server/scoring.ts      weekly ranking, points, season totals (pure, unit-tested)
  lib/server/shuffle.ts      seeded shuffle (mulberry32 over a hash of playerId:puzzleId)
  lib/server/puzzle-schema.ts  puzzle validation, shared by the generator and the DB layer
  lib/server/repo.ts         all SQL in one place
  lib/server/views.ts        the only place client page data for the board is built (tested for leaks)
  routes/
    +page.server.ts / +page.svelte        this week: board, or "played: 4 of 6" while open
    week/[n]/+page.server.ts / .svelte    review: answers, weekly ranking, your vote
    standings/+page.server.ts / .svelte   season table
    admin/+page.server.ts / .svelte       vote totals, void/unvoid
scripts/generate-puzzles.ts  puzzle generator (Claude API)
scripts/sql.ts, backup.ts    hand fixes and backups (the image has no sqlite3 CLI)
scripts/seed-sample.ts       fixed sample puzzle for local dev
Dockerfile                   stages: base → deps → tools (CLI) / build; prod-deps + build → app
docker-compose.yml           app service + `tools` profile sharing the data volume
static/manifest.webmanifest, icons
```

All game actions are **SvelteKit form actions** (`?/guess`, `?/vote`, `?/void`), not JSON endpoints.
The reasons:

- SvelteKit's built-in CSRF Origin check covers form actions.
- They work without JS and are progressively enhanced with `use:enhance`.
- All server code lives in `+page.server.ts` and `$lib/server/*`, which SvelteKit refuses to bundle for the client.

## Data model (SQLite)

```sql
CREATE TABLE players (
  id           INTEGER PRIMARY KEY,
  auth_user    TEXT NOT NULL UNIQUE,      -- value of the user header
  display_name TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE puzzles (
  id         INTEGER PRIMARY KEY,
  week       INTEGER UNIQUE,              -- 1..13; NULL = reserve
  groups     TEXT NOT NULL,               -- JSON: [{category, color, words[4]}] x4
  status     TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','voided')),
  void_note  TEXT,                        -- why it was voided, fed back into generation
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE attempts (
  id            INTEGER PRIMARY KEY,
  puzzle_id     INTEGER NOT NULL REFERENCES puzzles(id),
  player_id     INTEGER NOT NULL REFERENCES players(id),
  groups_solved INTEGER NOT NULL DEFAULT 0,
  mistakes      INTEGER NOT NULL DEFAULT 0,
  guesses       TEXT NOT NULL DEFAULT '[]', -- JSON: [{words[4], verdict, at}]
  started_at    TEXT NOT NULL,              -- server time
  finished_at   TEXT,                       -- set at 4 groups or 4 mistakes
  UNIQUE (puzzle_id, player_id)
);

CREATE TABLE puzzle_votes (
  puzzle_id  INTEGER NOT NULL REFERENCES puzzles(id),
  player_id  INTEGER NOT NULL REFERENCES players(id),
  is_bad     INTEGER NOT NULL CHECK (is_bad IN (0,1)),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (puzzle_id, player_id)
);
```

`groups_solved` and `mistakes` are denormalized from `guesses` to keep queries simple. They are
written in the same transaction, and a `recount` admin script can rebuild them from `guesses` if a
hand edit gets them out of sync.

## Identity and auth (forward-auth headers)

`hooks.server.ts`:

1. Read the user, display-name and groups headers (Authelia). The names are configurable, with these defaults:
   `AUTH_USER_HEADER=Remote-User`, `AUTH_NAME_HEADER=Remote-Name`,
   `AUTH_GROUPS_HEADER=Remote-Groups` (comma-separated), `ADMIN_GROUP=league-admin`.
2. **Fail closed.** No user header means a 401 and nothing else runs. (Requests for static assets and the manifest are allowed.)
3. Upsert the player by `auth_user`, refreshing `display_name`. This happens on every request, which is cheap in SQLite.
4. `locals.player = {id, name, isAdmin}`. `isAdmin` comes from the groups header on each request and is never stored.
5. Optional `ALLOWED_USERS` / `PLAYER_GROUP` restricts which accounts can play, so other VPS users don't
   show up as league players.

**Security: header trust is the whole model.** Anyone who can reach the container directly can send
`Remote-User: sondre` and become you. So:

- Publish the container port on host loopback only (`127.0.0.1:7080`), where the host's Caddy
  reaches it, as nyttig does on the same VPS.
- Check that the proxy **overwrites** client-supplied `Remote-*` headers. Authelia with Traefik or
  Caddy `forward_auth` copies the auth response headers over the request headers, which handles this.
  Confirm it with `curl -H 'Remote-User: someone-else'` through the proxy while logged in as yourself.
- Any local process can still reach the loopback port, so the proxy adds
  `X-Proxy-Secret: <random>` and the app rejects requests without it (`PROXY_SECRET`, required
  in production per `docs/DEPLOY.md`).

## Gameplay (server)

**Start attempt.** When `+page.server.ts` loads during the open phase, it inserts the attempt with
`INSERT ... ON CONFLICT DO NOTHING`, setting `started_at` to the server time. This means:

- Opening the board starts your clock.
- An attempt that is started but unfinished still counts as played. It ranks on its current groups and mistakes, with no time.

**Data sent to the client** (never the `groups` JSON):

- solved groups so far: `{category, color, words}`
- remaining words in seeded-shuffle order
- the verdict history: `mistakesLeft` and the previous guesses
- `closesAt` (ISO, so the client shows it in local time)

**`?/guess` action.** Everything below runs in one `db.transaction`. better-sqlite3 is synchronous, so
double-taps are serialized for free.

1. Phase must be `open`, the attempt must exist and be unfinished, and the guess must be exactly 4 distinct words, all among the remaining words.
2. Normalize the guess into a sorted lowercase key. If that key is already in `guesses`, return `already_guessed` with no cost.
3. Evaluate it with `game.evaluate(groups, words)`: `correct`, `one_away` (3 in one group), or `wrong`.
4. Append to `guesses` and update the counters. Set `finished_at` when solved reaches 4 or mistakes reaches 4.
5. Cap the attempt at 60 total submissions (repeats included), plus a simple in-memory limit of
   ~2 per second per player.

When an attempt ends with 4 mistakes, the player's own board shows the unsolved groups. (The answers
are now out _to them_, and they can't change their result.) Everyone else's results stay hidden until review.

## Scoring (pure functions, derived on read)

```ts
rankWeek(attempts) -> [{playerId, place, points}]
  sort key: groups_solved DESC, mistakes ASC, solveMs ASC (null = slowest)
  identical keys share a place; points = average of the POINTS[] slots they occupy
  POINTS = [10, 7, 5, 4, 3, 2, 1]   // 8th+ (not expected) gets 1
season(weeks) -> [{playerId, total, wins, bestWeek, perWeek[]}]
  includes only weeks where puzzle.status='active' AND phase != 'open'
```

**Leak to watch for:** standings must exclude the week that is still open. Otherwise totals that move
mid-week reveal who has played and how well.

Unit tests cover: the tie-averaging examples from the concept doc (two tied for 1st get 8.5 each, the
next player is 3rd), missed week = 0, voided weeks excluded, an unfinished attempt ranked below finished
ones with the same key, and the season tiebreak.

## Review, voting, voiding

- `/week/[n]` (phase `review` or `closed`) shows all four groups and the weekly ranking with each
  player's guess grid (the coloured squares).
- `?/vote` is allowed only when the player has an attempt and the phase is `review`. It upserts the vote.
  The page shows only _your_ vote, never tallies.
- `/admin` (`isAdmin` only, enforced in the `load` and in every action):
  - per week: `n of m voted bad`
  - void/unvoid toggle plus a `void_note`
  - **no puzzle contents for future weeks**, to make the honor system easier to keep

## Puzzle generation script

`pnpm generate --weeks 1-13 --reserves 2 [--replace 5]`

- Calls the Claude API (`@anthropic-ai/sdk`, model `claude-opus-5-5`) **one puzzle at a time**. Each
  call passes all previously generated words and categories, plus any `void_note`s, so the season
  doesn't repeat itself.
- Uses structured output (a JSON schema for `{groups:[{category, color, words[4]}]}`). The output is
  still treated as untrusted: strip code fences, then `JSON.parse`, then `puzzle-schema.validate()`
  (16 unique case-insensitive words, 4×4, colours yellow/green/blue/purple each used once, no overlap
  with earlier weeks).
- Retries up to 3 times per puzzle, feeding the validation error back to the model.
- Inserts in a transaction. `--dry-run` prints the puzzles without inserting them.
- `ANTHROPIC_API_KEY` exists only in the environment where the script runs. It never goes in the image or the repo.
- Honor-system note: whoever runs the script can see the answers in the terminal. Use `--quiet` to
  print only validation status. If someone else in the family is willing to run it, even better.

## Client / PWA

- Mobile-first 4×4 grid, with tap to select up to 4 and Submit / Shuffle / Deselect buttons. Shuffle is
  client-side and cosmetic (it reorders the remaining words locally).
- Colours: yellow, green, blue, purple, all with WCAG-contrast text.
- Your local deadline ("closes Wed 23:59 your time") via `Intl.DateTimeFormat`.
- `manifest.webmanifest`, icons, `theme-color`. The service worker caches only static assets.
  Game pages are always fetched from the network, so no stale boards and no cached answers.
- Svelte escapes text by default, and model-generated text is **never** rendered with `{@html}`.

## Deployment

See `docs/DEPLOY.md` for the step-by-step runbook.

CI (`.github/workflows/ci.yml`): lint, type check, unit tests and build, then both images, on
every PR and push to `main`. Releases follow nyttig: a green push to `main` whose Conventional
Commits ask for a release is tagged `vX.Y.Z` by CI, and the tag run publishes the images to GHCR
and creates a GitHub Release (`AGENTS.md` → Releases).

- Multi-stage `Dockerfile`. The `base` stage uses `node:22-bookworm` (it has the compilers
  better-sqlite3 needs) plus a global pnpm. `prod-deps` installs runtime dependencies only. `tools` adds the source for the CLI scripts. `app` is
  `node:22-bookworm-slim` with only `build/` and production `node_modules`, running as `node`.
- `docker-compose.yml`: a named volume at `/data`, the auth/group env vars from `.env`, the port
  on `127.0.0.1` only, and nyttig's hardening (read-only root, no capabilities,
  `no-new-privileges`, rotated logs). The image has a healthcheck on `/healthz`.
- Migrations run on boot.
- Backups: a nightly host cron job runs `docker compose run --rm tools backup` (better-sqlite3's online
  backup, safe while the app runs) and copies the file off the volume. This matters because the
  DB holds the whole season.
- Hand fixes: `docker compose run --rm tools sql "UPDATE ..."`.

## Implementation notes (SvelteKit 3)

- The config lives in `vite.config.ts` (`sveltekit({ adapter, paths })`); there is no `svelte.config.js`.
- `$lib` is replaced by Node subpath imports: `#lib/server/game.ts` (with the `.ts` extension).
- `$app/env` replaces `$app/environment`; the `Handle` type comes from `@sveltejs/kit/hooks`.
- adapter-node no longer reads an `ORIGIN` env var. The public origin is `paths.origin`, set at
  build time from the `APP_ORIGIN` Docker build arg. SvelteKit's CSRF check compares against it.
- Package manager: pnpm (pinned via `packageManager`). `pnpm-workspace.yaml` allows the build
  scripts of better-sqlite3 and esbuild, which pnpm blocks by default.

## Milestones (rush plan)

Status: **M0 done** (play flow, generator, Docker, runbook in `docs/DEPLOY.md`).
Note: week 1 opened Sun Oct 4 00:00 Oslo time, which was 22:00 UTC on Oct 3.

**M0, tonight (Sat Oct 3) → playable by Sun morning**

1. Scaffold SvelteKit + adapter-node + Vitest. Add migrations, `db.ts` and `hooks.server.ts` with headers.
2. Write `schedule.ts`, `game.ts`, `shuffle.ts` and `puzzle-schema.ts`, with unit tests.
3. Write the generator script. Generate weeks 1–13 plus 2 reserves into the prod DB (or locally, then copy the DB in).
4. Build the play page (board, guess action, finished state) and the "N of M have played" counter.
5. Dockerfile + compose, then deploy and run the header-spoof check through the proxy.
6. Smoke test with two accounts.

**M1, by Wed Oct 7 (review opens Thu 00:00)**

- `scoring.ts` with tests, plus the `/week/[n]` review page, `/standings` and voting.

**M2, by Sat Oct 10 (before week 2 opens)**

- `/admin` with vote totals and void toggle, the PWA manifest and icons, and backup cron.

**Later (optional)**

- Adversarial "does any word fit two groups?" check in the generator, Sunday reminder / "results are in"
  notifications, and a reserve week as a bonus.

## Risks

| Risk                            | Mitigation                                                                                         |
| ------------------------------- | -------------------------------------------------------------------------------------------------- |
| M0 slips past Sunday morning    | Players have until Wed 23:59. A Sunday-afternoon launch costs nothing in game terms                |
| Header spoofing                 | No published port, verified proxy header overwrite, optional proxy secret                          |
| Ambiguous puzzle                | Vote + void. The generator gets the `void_note`                                                    |
| Answers leak via client payload | Groups loaded only in `$lib/server`, and the page data shape is unit-tested to contain no `groups` |
| Standings leak mid-week         | Season query excludes the open week (tested)                                                       |
| Data loss                       | Volume + nightly `.backup`                                                                         |
