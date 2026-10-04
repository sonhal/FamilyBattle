# AGENTS.md

Guidance for AI coding agents working in this repository (`CLAUDE.md` imports it).

## Read this first

- **Language.** Everything players see is Norwegian (Bokmål), generated puzzles included.
  Code, comments, config, commit messages and docs are English.
- **Before every push, run the CI checks locally:** `pnpm lint`, `pnpm check`, `pnpm test`,
  `pnpm build`. CI runs the same and fails on any of them.
- **Commit subjects and PR titles are Conventional Commits.** PRs are squash-merged, so the
  PR title becomes the commit subject on `main`, and that subject alone decides whether a
  release is cut. See [Releases](#releases).
- **Don't merge.** Push the branch, get CI green, and leave merging to the owner unless asked.
- **Never reveal puzzle answers** in logs, PR text or output. The admin also plays.
- **Keep the docs in step.** Behaviour changes update `docs/PLAN.md` (decisions),
  `docs/DEPLOY.md` (operations) and `README.md`.

## Project

SvelteKit 3 (adapter-node) + SQLite (better-sqlite3), pnpm 10, Vitest. Players log in
through Authelia; Caddy's `forward_auth` passes `Remote-User` / `Remote-Name` /
`Remote-Groups`, and `src/hooks.server.ts` fails closed without them. Puzzles come from
`scripts/generate-puzzles.ts` (Claude API).

| Path                                        | What                                                             |
| ------------------------------------------- | ---------------------------------------------------------------- |
| `src/lib/server/schedule.ts`                | Season calendar (Europe/Oslo): open Sun–Wed, review Thu–Sat      |
| `src/lib/server/game.ts`                    | Guess evaluation (pure)                                          |
| `src/lib/server/scoring.ts`                 | Weekly ranking, points, season standings (pure, derived on read) |
| `src/lib/server/views.ts`                   | The only builder of board data sent to the browser (no answers)  |
| `src/lib/server/repo.ts`, `db.ts`           | All SQL; migrations are embedded in `db.ts` and append-only      |
| `src/lib/server/puzzle-*.ts`                | Puzzle validation and the independent review pass                |
| `src/routes/`                               | `/` play, `/uke/[n]` results and voting, `/stilling` standings   |
| `scripts/`                                  | Generator, `sql`, `backup`, `seed-sample`, `next-version.sh`     |
| `docs/PLAN.md`, `DEPLOY.md`, `VPS-AGENT.md` | Design decisions, runbook, instructions for the VPS agent        |

SvelteKit 3 specifics: imports use `#lib/...` with the `.ts` extension (`$lib` is gone),
`$app/env` replaces `$app/environment`, the `Handle` type comes from `@sveltejs/kit/hooks`, and
the config lives in `vite.config.ts`.

## Local development

```sh
pnpm install
pnpm seed:sample 1
DEV_USERS="sondre:admin,anna,bob" NOW_OVERRIDE="2026-10-04T10:00:00Z" pnpm dev
```

`DEV_USERS` fakes the Authelia headers (`?as=anna` switches user) and `NOW_OVERRIDE` pins the
clock. Both are ignored in production builds.

## Releases

Adapted from sonhal/nyttig. After a push to `main` passes CI, the **Tag release** job runs
`scripts/next-version.sh`, which reads the Conventional Commits subjects since the latest
`v*` tag and takes the largest bump:

| Subject                                                  | Release                 |
| -------------------------------------------------------- | ----------------------- |
| `feat: ...` / `feat(scope): ...`                         | minor                   |
| `fix: ...`, `perf: ...`                                  | patch                   |
| `type!: ...` or a `BREAKING CHANGE:` footer              | major (minor while 0.x) |
| `docs:`, `ci:`, `chore:`, `build:`, `refactor:`, `test:` | none                    |

A plain title ("Add admin page") cuts **no release**. When a PR is created with a title you
didn't pick, rename it to a conventional subject before it merges. Scopes in use: `web`,
`scoring`, `generator`, `admin`, `deploy`, `ci`. Dependabot's `build(deps):` titles never release.

The tag run publishes `ghcr.io/sonhal/familybattle` and `familybattle-tools` as `X.Y.Z`, `X.Y`
and `latest`, with provenance attestations, then creates a GitHub Release. The VPS pins
`FAMILYBATTLE_VERSION`; see `docs/DEPLOY.md` → Upgrading. Moving to 1.0.0 is a deliberate
step: push `v1.0.0` by hand.

## Working in the Claude cloud sandbox

- npm 10 crashes on this dependency tree (`reading 'edgesOut'`); use pnpm.
- `pkill -f "vite dev"` matches and kills your own shell. Use `pkill -f "[v]ite dev"`.
- `ss` isn't installed.
- The git proxy refuses branch deletion; ask the owner to delete merged branches.
- Docker works after starting `dockerd`, but image builds need the sandbox CA and proxy:
  build from a copy of the Dockerfile that adds `COPY --from=ca ca-bundle.crt /ca.crt` and
  `NODE_EXTRA_CA_CERTS`, with `--build-context ca=/root/.ccr --network host --build-arg HTTPS_PROXY`.
- There is no Anthropic API key. Test the generator against a local mock of the Messages
  streaming API via `ANTHROPIC_BASE_URL`.
