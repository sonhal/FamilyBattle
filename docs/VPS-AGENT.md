# Instructions for the Claude agent on the VPS

Paste this one line into the VPS agent:

> Read https://github.com/sonhal/FamilyBattle/blob/main/docs/VPS-AGENT.md and do the task it
> describes. Report back as it says.

---

## Context

Ordkampen (repo `sonhal/FamilyBattle`) is a weekly Norwegian word-puzzle league for a family. It
runs on this VPS next to nyttig, in the same style: Docker containers published on host
loopback ports, Caddy and Authelia on the host. The season runs Sun Oct 4 – Jan 3. Week 1 is
already open, so getting it playable is urgent.

`docs/DEPLOY.md` in the repository is the runbook. It uses `battle.example.com` as a
placeholder: ask sonhal for the real domain and use it wherever the placeholder appears. Never
write the real domain into the repository, which is public. This file says which parts to do, in what
order, and the rules that apply while you do them.

## Rules

1. **Never reveal puzzle answers.** The admin (sonhal) plays too. Always run the generator with
   `--quiet`. Don't `SELECT groups` from the database, don't print puzzle JSON, and don't open
   the game as a player.
2. **Never expose the app port beyond 127.0.0.1**, and never remove the header stripping or
   `forward_auth` from the Caddy site. The app trusts the `Remote-*` headers.
3. **Don't change other sites.** Add the `battle.example.com` site and the Authelia rule and
   groups; leave existing Caddy sites and Authelia rules untouched. Back up each config file
   before editing it (`cp file file.bak-$(date +%F)`).
4. **Secrets:** `.env` gets `chmod 600`. The Anthropic API key is passed on the command line
   only, never written to a file or a log. Don't paste secrets into your report.
5. **Stop and ask sonhal** if a step fails in a way the runbook doesn't cover, if port 7080 is
   taken, if the Authelia groups or users are unclear, or if any verification in step 7 fails.
   Don't work around a failed security check.

## Task: first deployment

Follow `docs/DEPLOY.md`:

1. **Step 1, Authelia.** Create the groups `familybattle` and `familybattle-admin`. Ask sonhal
   which users go in which group if you don't know. Add the access rule and reload Authelia.
2. **Steps 2–4.** Check out the **latest release tag** listed at
   <https://github.com/sonhal/FamilyBattle/releases> (not `main`), set
   `FAMILYBATTLE_VERSION` to it without the `v`, generate `PROXY_SECRET`, pull and start.
   `curl -s http://127.0.0.1:7080/healthz` must print `ok v<version>`.
3. **Step 6, Caddy.** Add the site, with the Authelia address copied from the existing
   protected sites. Put `FAMILYBATTLE_PROXY_SECRET` in Caddy's environment. Validate, then
   reload.
4. **Step 7, verify.** Run all four checks. Every one must give the expected result.
5. **Step 5, puzzles.** Ask sonhal for the Anthropic API key if it isn't available to you.
   Generate week 1 first, then weeks 2–13 and 2 reserves, all with `--quiet`.
   `SELECT id, week, status FROM puzzles` should then list weeks 1–13 plus 2 rows with an empty week.
6. **Step 8, backups.** Install the nightly cron job and run it once by hand. Check that a file
   appears in `/var/backups/familybattle/`.

## Report back

Write a short report to sonhal:

- the deployed version (the `/healthz` output)
- the result of each step 7 check (status codes, and the `ss` output)
- which weeks have puzzles (from the `SELECT id, week, status` query only)
- anything you changed outside `/opt/familybattle` (files edited, with backup paths)
- anything that needs his decision

## Later: upgrading to a new release

When asked to upgrade, follow "Upgrading" in `docs/DEPLOY.md`: check out the new tag, update
`FAMILYBATTLE_VERSION`, pull both images, back up, restart, and confirm `/healthz` shows the
new version. Read the release notes first. If a release says it needs new `.env` keys or
Caddy changes, apply those too.
