# Deploying Family Battle (runbook)

Written to be followed step by step, by a person or by the Claude agent on the VPS.
Target: `https://battle.example.com`, Docker + Caddy + Authelia.

> **Week 1 opened Sun Oct 4 at 00:00 Oslo time.** Do steps 1–6 first, generating week 1
> alone, so the family can play as soon as possible. Generate the rest of the season afterwards.

## How the pieces fit

```
browser ──► Caddy (battle.example.com)
              ├─ forward_auth → Authelia: logged in and in an allowed group?
              │                 copies Remote-User / Remote-Name / Remote-Groups onto the request
              └─ reverse_proxy → familybattle:3000 (Docker network only, no published port)
                                    └─ SQLite at /data/league.db (named volume)
```

**The security model rests on one rule.** The app trusts the `Remote-*` headers, so it must be
reachable **only through Caddy**, and Caddy must **overwrite** those headers on every request.
Step 7 verifies both.

## 1. Authelia: groups and access rule

Create two groups in Authelia's user backend (in the file backend, add them to users in
`users_database.yml`; in LDAP, create the groups):

| Group                | Who                                                                |
| -------------------- | ------------------------------------------------------------------ |
| `familybattle`       | every player                                                       |
| `familybattle-admin` | the admin (Sondre). Admins can also play, so no need to be in both |

Different names are fine. If you use them, set `PLAYER_GROUP` / `ADMIN_GROUP` in `.env` (step 3).

Add an access-control rule **above** any broader rule that would match the domain:

```yaml
access_control:
  rules:
    - domain: battle.example.com
      policy: one_factor # match the policy the other family-facing sites use
      subject:
        - 'group:familybattle'
        - 'group:familybattle-admin'
```

Reload Authelia. The app also checks the groups itself, so this rule is defense in depth: it
stops non-players at the login page.

## 2. Get the code

```sh
git clone https://github.com/sonhal/FamilyBattle.git /opt/familybattle
cd /opt/familybattle
git checkout claude/implementation-plan   # until it is merged to the default branch
```

## 3. Configure `.env`

```sh
cp .env.example .env
openssl rand -hex 32   # use as PROXY_SECRET (recommended)
```

Edit `.env`:

- `PROXY_SECRET=<the value above>`
- `PROXY_NETWORK=<name of the Docker network Caddy is attached to>`. Find it with
  `docker inspect <caddy-container> --format '{{json .NetworkSettings.Networks}}'`.
  The default is `caddy`.
- Change `PLAYER_GROUP` / `ADMIN_GROUP` only if step 1 used other names.
- Don't put `ANTHROPIC_API_KEY` in `.env`. Pass it on the command line in step 5.

**If Caddy runs on the host rather than in Docker:** in `docker-compose.yml`, replace the
`networks:` block of the `familybattle` service with `ports: ["127.0.0.1:3000:3000"]`, and use
`localhost:3000` as the upstream in step 6. Never publish on `0.0.0.0`.

## 4. Get the images and start the app

CI (`.github/workflows/ci.yml`) publishes two images to GitHub Container Registry on every push
to the default branch and on every `v*` tag:

| Image                               | Contents                             |
| ----------------------------------- | ------------------------------------ |
| `ghcr.io/sonhal/familybattle`       | the app                              |
| `ghcr.io/sonhal/familybattle-tools` | the CLI (generator, `sql`, `backup`) |

Each image is tagged `latest`, `sha-<commit>`, and `X.Y.Z` / `X.Y` for version tags.

**Option A: pull from GHCR (preferred once CI has published).** The packages are private, so
log in once with a GitHub _classic_ personal access token that has only the `read:packages`
scope (fine-grained tokens can't read GHCR):

```sh
echo <token> | docker login ghcr.io -u sonhal --password-stdin
docker compose pull familybattle
docker compose --profile tools pull tools
```

To pin a release, set `FAMILYBATTLE_TAG=1.2.0` (or `sha-abc1234`) in `.env`. The default is `latest`.

**Option B: build on the VPS** (no registry access needed):

```sh
docker compose build familybattle
docker compose --profile tools build tools
```

Then start it:

```sh
docker compose up -d familybattle
docker compose logs familybattle   # expect: Listening on http://0.0.0.0:3000
```

## 5. Generate puzzles

Week 1 first, so it is playable as soon as possible:

```sh
ANTHROPIC_API_KEY=sk-ant-... docker compose run --rm tools generate --weeks 1 --quiet
```

Then the rest of the season plus two reserves. This takes a while, since each puzzle is a
separate, carefully checked request:

```sh
ANTHROPIC_API_KEY=sk-ant-... docker compose run --rm tools generate --weeks 2-13 --reserves 2 --quiet
```

- `--quiet` hides the answers (the admin also plays). Without it the puzzles are printed.
- Re-running is safe: weeks that already have a puzzle are skipped.
- Check what exists without revealing answers:
  `docker compose run --rm tools sql "SELECT id, week, status FROM puzzles"`

## 6. Caddy site

Add this to the Caddyfile, adapting the Authelia upstream and the `uri` to match the
existing protected sites (Authelia ≥ 4.38 uses `/api/authz/forward-auth`):

```caddyfile
battle.example.com {
	route {
		# Never let a client supply identity headers itself.
		request_header -Remote-User
		request_header -Remote-Groups
		request_header -Remote-Name
		request_header -Remote-Email

		forward_auth authelia:9091 {
			uri /api/authz/forward-auth
			copy_headers Remote-User Remote-Groups Remote-Name Remote-Email
		}

		reverse_proxy familybattle:3000 {
			header_up X-Proxy-Secret {$FAMILYBATTLE_PROXY_SECRET}
		}
	}
}
```

- `route` keeps the directives in the written order, so the stripping happens before
  `forward_auth` sets the real values.
- `{$FAMILYBATTLE_PROXY_SECRET}` is read from Caddy's environment, where it must equal
  `PROXY_SECRET` in the app's `.env`. If you'd rather not touch Caddy's environment, paste the
  value in directly. If you skip the proxy secret entirely, drop the `header_up` line and leave
  `PROXY_SECRET` empty.
- Reload Caddy: `docker exec <caddy-container> caddy reload --config /etc/caddy/Caddyfile`, or the equivalent for your setup.

## 7. Verify (do not skip)

```sh
# a) Not logged in: must redirect to Authelia (302/401), never 200, even with spoofed headers.
curl -s -o /dev/null -w '%{http_code}\n' https://battle.example.com/
curl -s -o /dev/null -w '%{http_code}\n' -H 'Remote-User: sondre' -H 'Remote-Groups: familybattle-admin' https://battle.example.com/

# b) The app port must not be reachable from outside the VPS (expect a connection error):
curl -m 5 http://<public-ip>:3000/ ; echo "exit=$?"

# c) Without Caddy's secret, the app itself refuses (expect 401):
docker run --rm --network <PROXY_NETWORK> curlimages/curl -s -o /dev/null -w '%{http_code}\n' \
  -H 'Remote-User: x' -H 'Remote-Groups: familybattle' http://familybattle:3000/
```

Then in a browser:

- Log in as a player. You should see "Week 1 of 13" and a Start button. Your name appears top right.
- Log in as someone outside the groups. Authelia should deny access.

## 8. Backups

The database holds the whole season. Add a nightly host cron job (`crontab -e`):

```cron
17 3 * * * cd /opt/familybattle && docker compose run --rm tools backup >/dev/null 2>&1 && docker run --rm -v familybattle_familybattle-data:/data -v /var/backups/familybattle:/out alpine sh -c 'cp /data/backups/* /out/ && rm /data/backups/*'
```

Check the volume name with `docker volume ls`. Compose prefixes it with the project directory name.

## Day-to-day operations

| Task                                      | Command                                                                                                                                                                  |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Update the app                            | `docker compose pull familybattle && docker compose up -d familybattle` (Option B: `git pull && docker compose build familybattle && docker compose up -d familybattle`) |
| Logs                                      | `docker compose logs -f familybattle`                                                                                                                                    |
| Inspect data                              | `docker compose run --rm tools sql "SELECT * FROM players"`                                                                                                              |
| Void week N (until the admin page exists) | `docker compose run --rm tools sql "UPDATE puzzles SET status='voided', void_note='<why>' WHERE week=N"`                                                                 |
| Regenerate an unplayed week               | `ANTHROPIC_API_KEY=... docker compose run --rm tools generate --replace N --quiet`                                                                                       |

Update the tools image together with the app: `docker compose --profile tools pull tools`
(Option B: `docker compose --profile tools build tools` after `git pull`).
