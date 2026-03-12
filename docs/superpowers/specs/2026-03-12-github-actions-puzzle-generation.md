# GitHub Actions Puzzle Generation

**Date:** 2026-03-12
**Status:** Approved for implementation

## Problem

Puzzle generation currently requires a manual Claude Code session daily. As RabbitHole moves toward an App Store launch and grows its user base, this creates operational risk — missing a day means players have no puzzles. The goal is fully automated, hands-off puzzle generation.

## Solution

Two GitHub Actions workflows:

1. **Daily cron** — runs every night, generates puzzles for the next day across all 20 active domains
2. **Bulk trigger** — manually dispatched, generates puzzles for a configurable date range (default 30 days)

Both workflows use the existing `agent-loop.ts` script unchanged. No pipeline code modifications required, except for a minor fix to `check-today.js` to exit non-zero when gaps are found.

## Workflows

### 1. `daily-puzzle-gen.yml`

**Trigger:** `cron: '0 2 * * *'` (2am UTC daily)

**Steps:**
1. Checkout repo
2. Restore entity cache from `actions/cache` (keyed on weekly epoch so it refreshes weekly)
3. Install Node dependencies (`npm ci` — no `--omit=dev` flag, `ts-node` is a devDependency)
4. Set secrets as environment variables (`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `OPENAI_API_KEY`) on the job via `env:` — the pipeline uses `dotenv` which falls back to `process.env` when no `.env` file is present, so this is sufficient
5. Compute tomorrow's date
6. Run a matrix job with `fail-fast: false` — one job per domain (20 in parallel), each running:
   `npx ts-node src/scripts/agent-loop.ts --domain <domain> --date <date>`
7. Save updated entity cache
8. After matrix: run `node check-today.js <date>` — exit non-zero if any gaps found (requires minor fix to `check-today.js`, see below)

**Matrix domains (20 active):**
`history`, `movies`, `soccer`, `science`, `geography`, `literature`, `philosophy`, `royals`, `military`, `space`, `food`, `comics`, `tv`, `videogames`, `art`, `basketball`, `americanfootball`, `mb_rock`, `mb_hiphop`, `mb_country`

Note: `mb_pop` and `mb_rnb` are inactive and must NOT be included even though they appear in the domain table.

**Runtime estimate:** ~3-5 min with warm cache (restored from `actions/cache`); ~5 min cold on first ever run

---

### 2. `bulk-puzzle-gen.yml`

**Trigger:** `workflow_dispatch` with inputs:
- `start_date` (string, required) — first date to generate, format `YYYY-MM-DD`
- `num_days` (number, default `30`) — how many consecutive days to generate

**Steps:**
1. Checkout repo
2. Restore entity cache from `actions/cache`
3. Install Node dependencies (`npm ci`)
4. Set secrets as `env:` variables
5. Generate list of dates in a shell step, then loop over them sequentially — for each date, run all 20 domains **in parallel using background shell processes**, not a matrix job (GitHub Actions matrix is statically defined and cannot be looped dynamically). Exit codes are collected per-PID to ensure any failing domain fails the step:
   ```bash
   for date in $DATES; do
     pids=()
     for domain in history movies soccer ...; do
       npx ts-node src/scripts/agent-loop.ts --domain $domain --date $date &
       pids+=($!)
     done
     failed=0
     for pid in "${pids[@]}"; do wait "$pid" || failed=1; done
     if [ $failed -ne 0 ]; then echo "One or more domains failed for $date"; fi
   done
   ```
6. Save updated entity cache after all dates complete
7. Run `check-today.js` for each generated date; output a gap summary; exit non-zero if any date has missing puzzles

**Runtime estimate:**
- Day 1 (cold cache, first date): ~5 min — Wikidata fetch per domain runs once
- Days 2-30 (cache warm in same run): ~1-2 min per date — composition + GPT-4o only
- Total for 30 days: ~40-50 min
- Well within GitHub Actions free tier (2,000 min/month for private repos; unlimited for public)

**Note:** `agent-loop.ts` already skips fully-published dates (no `--force` flag). Re-running the bulk trigger is safe — it only generates what's missing.

---

## Required Code Change: `check-today.js`

Currently `check-today.js` always exits with code 0. It needs to exit non-zero when any puzzles are missing so the workflow step fails and GitHub sends a notification email.

Change: add `process.exit(missing > 0 ? 1 : 0)` at the end of `main()`.

---

## Secrets Setup

Add these to the GitHub repo under **Settings → Secrets and variables → Actions**:

| Secret name | Value |
|---|---|
| `SUPABASE_URL` | `https://eaevegumlihsuagccczq.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Supabase service role key (not anon key) |
| `OPENAI_API_KEY` | OpenAI API key used by the pipeline |

These are injected as environment variables via `env:` on the job. The pipeline calls `dotenv.config()` which sets variables only if they aren't already in `process.env`, so existing environment variables take precedence — no `.env` file is needed in CI.

---

## Entity Cache in CI

The `pipeline/.entity-cache/` directory is gitignored and not present on fresh runners. The workflows use `actions/cache` to persist it between runs:

```yaml
- uses: actions/cache@v4
  with:
    path: pipeline/.entity-cache
    key: entity-cache-${{ steps.week.outputs.week }}
    restore-keys: entity-cache-
```

Cache is keyed on the ISO week number so it auto-refreshes weekly, keeping Wikidata data reasonably fresh while avoiding redundant fetches within the same week.

---

## File Structure

```
.github/
  workflows/
    daily-puzzle-gen.yml
    bulk-puzzle-gen.yml
pipeline/
  check-today.js          (minor change: exit non-zero on gaps)
```

---

## Error Handling

- **Domain fails QC after 10 rounds:** `agent-loop.ts` exits with code 1. The background process exits non-zero. The post-loop `check-today.js` call catches the gap, exits non-zero, fails the workflow step, and GitHub sends a notification email.
- **Supabase connection error:** Job fails immediately; workflow fails; notification sent.
- **Partial success:** `fail-fast: false` (daily) / per-PID `wait` loop (bulk) — all domains attempt generation even if one fails. The check step reports exactly which domains/difficulties are missing.
- **Re-run after failure:** Re-trigger the daily workflow manually, or use the bulk trigger for the affected date. Already-published puzzles are skipped automatically.
- **Structural graph failure:** `agent-loop.ts` calls `graph-repair-agent.ts`, which is checked into the repo and available in CI. However, `graph-repair-agent.ts` uses the Claude API to generate new SPARQL subqueries interactively — this requires a `CLAUDE_API_KEY` secret and may not complete reliably unattended. Structural failures are rare and ultimately require a human to review the generated subqueries anyway. If one occurs in CI, the workflow will fail and send a notification — treat it as a manual intervention signal.

---

## GitHub Actions Free Tier

- **Daily cron:** ~5 min/day × 30 days = ~150 min/month
- **Monthly bulk run:** ~50 min
- **Total:** well under 300 min/month — trivial for both private and public repos

---

## Implementation Steps

1. Fix `check-today.js` to exit non-zero on gaps
2. Add `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `OPENAI_API_KEY` as GitHub Actions secrets
3. Create `.github/workflows/daily-puzzle-gen.yml`
4. Create `.github/workflows/bulk-puzzle-gen.yml`
5. Run the bulk trigger for the next 30 days to build the initial buffer
6. Verify with `check-today.js` across all generated dates

---

## Out of Scope

- Slack/webhook notifications (GitHub email notifications are sufficient for now)
- Puzzle quality monitoring dashboard
- Automatic domain deactivation on structural failure
