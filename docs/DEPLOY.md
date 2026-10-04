# Deploying Ordkampen (runbook)

Step by step, for a person or for the Claude agent on the VPS (see also `docs/VPS-AGENT.md`).
Target: `https://battle.sonhal.no`. Docker runs the app; Caddy and Authelia run on the host,
the same way as nyttig on this VPS.

## How the pieces fit

```
browser ──► Caddy on the host (battle.sonhal.no, TLS)
              ├─ forward_auth → Authelia: logged in and in an allowed group?
              │                 copies Remote-User / Remote-Name / Remote-Groups onto the request
              └─ reverse_proxy → 127.0.0.1:7080 (+ X-Proxy-Secret)
                                    └─ container "familybattle" (read-only, no capabilities)
                                         └─ SQLite at /data/league.db (named volume familybattle_familybattle-data)
```

**The security model rests on two rules:**

1. The app trusts the `Remote-*` headers, so only Caddy may talk to it. The port is published
   on **127.0.0.1 only**, and Caddy **strips and overwrites** those headers on every request.
2. Any local process on the VPS can still reach 127.0.0.1:7080. Set `PROXY_SECRET` so the app
   rejects requests that don't carry Caddy's secret header.

Step 7 verifies all of this.

## Releases

CI publishes images only for release tags `vX.Y.Z` (see `AGENTS.md` → Releases):

| Image                               | Contents                             |
| ----------------------------------- | ------------------------------------ |
| `ghcr.io/sonhal/familybattle`       | the app                              |
| `ghcr.io/sonhal/familybattle-tools` | the CLI (generator, `sql`, `backup`) |

Each release is tagged `X.Y.Z`, `X.Y` and `latest`. Pin `FAMILYBATTLE_VERSION=X.Y.Z` in `.env`
and upgrade on purpose. The running version is shown by `curl -s http://127.0.0.1:7080/healthz`.
Release notes: <https://github.com/sonhal/FamilyBattle/releases>.

Verify an image's provenance (optional):
`gh attestation verify oci://ghcr.io/sonhal/familybattle:0.1.0 --repo sonhal/FamilyBattle`

## 1. Authelia: groups and access rule

Create two groups in Authelia's user backend (file backend: add them to the users in
`users_database.yml`; LDAP: create the groups):

| Group                | Who                                                                |
| -------------------- | ------------------------------------------------------------------ |
| `familybattle`       | every player                                                       |
| `familybattle-admin` | the admin (Sondre). Admins can also play, so no need to be in both |

Different names are fine; then set `PLAYER_GROUP` / `ADMIN_GROUP` in `.env`.

Add an access-control rule **above** any broader rule that would match the domain:

```yaml
access_control:
  rules:
    - domain: battle.sonhal.no
      policy: one_factor # match the policy the other family-facing sites use
      subject:
        - 'group:familybattle'
        - 'group:familybattle-admin'
```

Reload Authelia. The app checks the groups too; this rule stops non-players at the login page.

## 2. Get the deploy files

Only `docker-compose.yml` and `.env.example` are needed from the repository:

```sh
git clone https://github.com/sonhal/FamilyBattle.git /opt/familybattle
cd /opt/familybattle
git checkout v0.1.0          # the release you deploy; see the releases page
```

## 3. Configure `.env`

```sh
cp .env.example .env
chmod 600 .env
openssl rand -hex 32         # → PROXY_SECRET
```

Edit `.env`:

- `FAMILYBATTLE_VERSION=0.1.0` (the release, without the `v`)
- `PROXY_SECRET=<the value above>`. The same value goes into Caddy in step 6.
- `FAMILYBATTLE_PORT=7080` unless something else uses that port (nyttig uses 7070 and 7071).
- `PLAYER_GROUP` / `ADMIN_GROUP` only if step 1 used other names.
- Do **not** put `ANTHROPIC_API_KEY` in `.env`. Pass it on the command line in step 5.

## 4. Pull the images and start the app

The GHCR packages are private until made public in their package settings. Until then, log in
once with a GitHub _classic_ personal access token that has only `read:packages`:

```sh
echo <token> | docker login ghcr.io -u sonhal --password-stdin
docker compose pull familybattle
docker compose --profile tools pull tools
docker compose up -d familybattle
docker compose ps                                # STATUS shows (healthy)
curl -s http://127.0.0.1:7080/healthz            # ok v0.1.0
```

To build from the checkout instead (no registry access, unreleased commits):
`docker compose up -d --build familybattle` and `docker compose --profile tools build tools`.

## 5. Generate puzzles

```sh
ANTHROPIC_API_KEY=sk-ant-... docker compose run --rm tools generate --weeks 1 --quiet
ANTHROPIC_API_KEY=sk-ant-... docker compose run --rm tools generate --weeks 2-13 --reserves 2 --quiet
```

- **Always pass `--quiet`.** The admin also plays; quiet mode prints neither the puzzles nor
  the rejection reasons (which quote words).
- Each puzzle is validated, then reviewed by a separate Claude call for words that could fit
  another group, and regenerated if flagged. Expect a few minutes per puzzle.
- Re-running is safe: weeks that already have a puzzle are skipped.
- See what exists without revealing answers:
  `docker compose run --rm tools sql "SELECT id, week, status FROM puzzles"`

## 6. Caddy site (on the host)

Add this to the host's Caddyfile. Copy the Authelia address and `uri` from the existing
protected sites (Authelia ≥ 4.38 uses `/api/authz/forward-auth`).

```caddyfile
battle.sonhal.no {
	header {
		Strict-Transport-Security "max-age=31536000; includeSubDomains"
		?X-Content-Type-Options nosniff
		?Referrer-Policy same-origin
		?X-Frame-Options DENY
	}

	# The home-screen manifest and icons are fetched without cookies by some
	# browsers (iOS for the icon), so they skip Authelia. They hold nothing private.
	@public path /manifest.webmanifest /icon.svg /icon-192.png /icon-512.png /apple-touch-icon.png
	handle @public {
		reverse_proxy 127.0.0.1:7080 {
			header_up X-Proxy-Secret {$FAMILYBATTLE_PROXY_SECRET}
		}
	}

	handle {
		route {
			# Never let a client supply identity headers itself.
			request_header -Remote-User
			request_header -Remote-Groups
			request_header -Remote-Name
			request_header -Remote-Email

			forward_auth 127.0.0.1:9091 {
				uri /api/authz/forward-auth
				copy_headers Remote-User Remote-Groups Remote-Name Remote-Email
			}

			reverse_proxy 127.0.0.1:7080 {
				header_up X-Proxy-Secret {$FAMILYBATTLE_PROXY_SECRET}
			}
		}
	}
}
```

- `route` keeps the directives in the written order, so the stripping happens before
  `forward_auth` sets the real values.
- `{$FAMILYBATTLE_PROXY_SECRET}` is read from Caddy's environment when the Caddyfile is
  loaded. With Caddy under systemd: `sudo systemctl edit caddy`, add
  `[Service]` / `Environment=FAMILYBATTLE_PROXY_SECRET=<value>`, then `sudo systemctl restart caddy`.
  (Pasting the value directly into the Caddyfile also works; keep the file private then.)
- Validate and reload: `caddy validate --config /etc/caddy/Caddyfile && sudo systemctl reload caddy`.

## 7. Verify (do not skip)

```sh
# a) From outside, not logged in: must redirect to Authelia (302/401), never 200,
#    also with spoofed headers.
curl -s -o /dev/null -w '%{http_code}\n' https://battle.sonhal.no/
curl -s -o /dev/null -w '%{http_code}\n' -H 'Remote-User: sondre' -H 'Remote-Groups: familybattle-admin' https://battle.sonhal.no/

# b) The public icon path works without login (200):
curl -s -o /dev/null -w '%{http_code}\n' https://battle.sonhal.no/icon-192.png

# c) The port listens on loopback only (expect 127.0.0.1:7080, never 0.0.0.0 or [::]):
ss -ltn | grep 7080

# d) On the VPS, forged headers without Caddy's secret are refused (expect 401):
curl -s -o /dev/null -w '%{http_code}\n' -H 'Remote-User: x' -H 'Remote-Groups: familybattle' http://127.0.0.1:7080/
```

Then in a browser:

- Log in as a player: "Uke 1 av 13" and a Start button, with your name top right.
- Log in as someone outside the groups: Authelia denies access.

## 8. Backups

The database holds the whole season. Nightly host cron job (`crontab -e`):

```cron
17 3 * * * cd /opt/familybattle && docker compose run --rm tools backup >/dev/null 2>&1 && docker run --rm -v familybattle_familybattle-data:/data -v /var/backups/familybattle:/out alpine sh -c 'cp /data/backups/* /out/ && rm /data/backups/*'
```

To restore: `docker compose stop familybattle`, copy the backup into the volume as
`league.db` (owned by uid 1000, the image's `node` user), then `docker compose start familybattle`.

## Upgrading

```sh
cd /opt/familybattle
git fetch --tags && git checkout vX.Y.Z      # compose file of the new release
$EDITOR .env                                 # FAMILYBATTLE_VERSION=X.Y.Z
docker compose pull familybattle && docker compose --profile tools pull tools
docker compose run --rm tools backup         # migrations run at startup; back up first
docker compose up -d familybattle
curl -s http://127.0.0.1:7080/healthz        # ok vX.Y.Z
```

## Day-to-day operations

| Task                                      | Command                                                                                                  |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Logs                                      | `docker compose logs -f familybattle`                                                                    |
| Inspect data                              | `docker compose run --rm tools sql "SELECT * FROM players"`                                              |
| Void week N (until the admin page exists) | `docker compose run --rm tools sql "UPDATE puzzles SET status='voided', void_note='<why>' WHERE week=N"` |
| Regenerate an unplayed week               | `ANTHROPIC_API_KEY=... docker compose run --rm tools generate --replace N --quiet`                       |
