# GitHub Actions Puzzle Generation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automate daily puzzle generation via GitHub Actions so puzzles are generated hands-free every night, with a manual bulk trigger to pre-generate up to 30 days at once.

**Architecture:** Two workflows share the same underlying pipeline script (`agent-loop.ts`). The daily workflow uses a GitHub Actions matrix (one job per domain, 20 in parallel). The bulk workflow uses background shell processes per domain within a sequential date loop, since matrix jobs can't be dynamically looped. Both workflows persist the entity cache via `actions/cache` keyed on ISO week number.

**Tech Stack:** GitHub Actions, Node.js 20, `ts-node`, existing `pipeline/src/scripts/agent-loop.ts`, `pipeline/check-today.js`, `actions/cache@v4`, `actions/checkout@v4`, `actions/setup-node@v4`

---

## Chunk 1: Fix check-today.js + create workflow scaffolding

### Task 1: Fix `check-today.js` to exit non-zero on gaps

**Files:**
- Modify: `pipeline/check-today.js`

The script currently always exits 0. We need it to exit 1 when any puzzles are missing so GitHub Actions steps fail and trigger notification emails. It also needs to track a `missingCount` across all categories.

- [ ] **Step 1: Read the current file**

```bash
cat pipeline/check-today.js
```

- [ ] **Step 2: Add missing counter and non-zero exit**

In `pipeline/check-today.js`, replace the `main()` function body so it tracks a `missingCount` and exits non-zero at the end:

```js
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
async function main() {
  const { data: cats } = await sb.from('categories').select('id, name, wikidata_domain').eq('active', true).order('name')
  const date = process.argv[2] || new Date().toISOString().split('T')[0]
  const { data: puzzles } = await sb.from('puzzles').select('category_id, difficulty').eq('date', date).eq('status', 'published')
  const bycat = {}
  for (const p of puzzles || []) {
    if (!bycat[p.category_id]) bycat[p.category_id] = []
    bycat[p.category_id].push(p.difficulty)
  }
  let missingCount = 0
  for (const cat of cats || []) {
    const mb = cat.wikidata_domain.startsWith('mb_')
    const missing = ['easy','medium','hard'].filter(d => !(bycat[cat.id]||[]).includes(d))
    if (missing.length > 0) {
      missingCount += missing.length
      console.log((mb ? '[MB] ' : '     ') + cat.name.padEnd(30) + ' id=' + cat.id + ' domain=' + cat.wikidata_domain + ' | missing: ' + missing.join(','))
    }
  }
  console.log(`done (date: ${date})`)
  process.exit(missingCount > 0 ? 1 : 0)
}
main().catch(console.error)
```

- [ ] **Step 3: Test it manually**

```bash
cd pipeline && node check-today.js 2026-03-12
```

Expected: exits 0 (today is fully published). Try a past unpublished date:

```bash
node check-today.js 2099-01-01
```

Expected: prints missing lines and exits 1. Verify with `echo $?` → `1`.

- [ ] **Step 4: Commit**

```bash
git add pipeline/check-today.js
git commit -m "fix(pipeline): check-today exits non-zero when puzzles missing"
```

---

### Task 2: Create `.github/workflows/` directory and daily workflow

**Files:**
- Create: `.github/workflows/daily-puzzle-gen.yml`

The daily cron workflow runs at 2am UTC, computes tomorrow's date, runs all 20 domains in parallel via matrix, then checks coverage.

**Active domains** (20 — do NOT include mb_pop or mb_rnb):
`history`, `movies`, `soccer`, `science`, `geography`, `literature`, `philosophy`, `royals`, `military`, `space`, `food`, `comics`, `tv`, `videogames`, `art`, `basketball`, `americanfootball`, `mb_rock`, `mb_hiphop`, `mb_country`

- [ ] **Step 1: Create the workflow file**

```yaml
# .github/workflows/daily-puzzle-gen.yml
name: Daily Puzzle Generation

on:
  schedule:
    - cron: '0 2 * * *'   # 2am UTC every day
  workflow_dispatch:        # allow manual trigger for testing
    inputs:
      date_override:
        description: 'Date to generate (YYYY-MM-DD). Defaults to tomorrow.'
        required: false

jobs:
  generate:
    name: Generate (${{ matrix.domain }})
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        domain:
          - history
          - movies
          - soccer
          - science
          - geography
          - literature
          - philosophy
          - royals
          - military
          - space
          - food
          - comics
          - tv
          - videogames
          - art
          - basketball
          - americanfootball
          - mb_rock
          - mb_hiphop
          - mb_country

    env:
      SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
      SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
      OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}

    steps:
      - uses: actions/checkout@v4

      - name: Get ISO week number (for cache key)
        id: week
        run: echo "week=$(date +%Y-W%V)" >> $GITHUB_OUTPUT

      - uses: actions/cache@v4
        with:
          path: pipeline/.entity-cache
          key: entity-cache-${{ steps.week.outputs.week }}-${{ matrix.domain }}
          restore-keys: entity-cache-

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: pipeline/package-lock.json

      - name: Install dependencies
        run: npm ci
        working-directory: pipeline

      - name: Compute target date
        id: date
        run: |
          if [ -n "${{ github.event.inputs.date_override }}" ]; then
            echo "date=${{ github.event.inputs.date_override }}" >> $GITHUB_OUTPUT
          else
            echo "date=$(date -d '+1 day' +%Y-%m-%d)" >> $GITHUB_OUTPUT
          fi

      - name: Generate puzzles
        run: npx ts-node src/scripts/agent-loop.ts --domain ${{ matrix.domain }} --date ${{ steps.date.outputs.date }}
        working-directory: pipeline

  check:
    name: Verify coverage
    runs-on: ubuntu-latest
    needs: generate
    if: always()   # run even if some matrix jobs failed

    env:
      SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
      SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: pipeline/package-lock.json

      - name: Install dependencies
        run: npm ci
        working-directory: pipeline

      - name: Compute target date
        id: date
        run: |
          if [ -n "${{ github.event.inputs.date_override }}" ]; then
            echo "date=${{ github.event.inputs.date_override }}" >> $GITHUB_OUTPUT
          else
            echo "date=$(date -d '+1 day' +%Y-%m-%d)" >> $GITHUB_OUTPUT
          fi

      - name: Check coverage
        run: node check-today.js ${{ steps.date.outputs.date }}
        working-directory: pipeline
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/daily-puzzle-gen.yml
git commit -m "feat(ci): daily puzzle generation workflow"
```

---

### Task 3: Create bulk generation workflow

**Files:**
- Create: `.github/workflows/bulk-puzzle-gen.yml`

The bulk workflow is manually triggered, takes a start date and number of days, and generates puzzles for each date sequentially (domains in parallel via background processes within each date iteration).

- [ ] **Step 1: Create the workflow file**

```yaml
# .github/workflows/bulk-puzzle-gen.yml
name: Bulk Puzzle Generation

on:
  workflow_dispatch:
    inputs:
      start_date:
        description: 'First date to generate (YYYY-MM-DD)'
        required: true
      num_days:
        description: 'Number of consecutive days to generate'
        required: false
        default: '30'

jobs:
  bulk-generate:
    name: Bulk generate ${{ github.event.inputs.num_days }} days from ${{ github.event.inputs.start_date }}
    runs-on: ubuntu-latest
    timeout-minutes: 360   # 6 hour max (GitHub Actions limit)

    env:
      SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
      SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
      OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}

    steps:
      - uses: actions/checkout@v4

      - name: Get ISO week number (for cache key)
        id: week
        run: echo "week=$(date +%Y-W%V)" >> $GITHUB_OUTPUT

      - uses: actions/cache@v4
        with:
          path: pipeline/.entity-cache
          key: entity-cache-${{ steps.week.outputs.week }}
          restore-keys: entity-cache-

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: pipeline/package-lock.json

      - name: Install dependencies
        run: npm ci
        working-directory: pipeline

      - name: Generate puzzles for all dates
        working-directory: pipeline
        run: |
          START="${{ github.event.inputs.start_date }}"
          NUM_DAYS="${{ github.event.inputs.num_days }}"
          DOMAINS="history movies soccer science geography literature philosophy royals military space food comics tv videogames art basketball americanfootball mb_rock mb_hiphop mb_country"

          any_failed=0

          for i in $(seq 0 $((NUM_DAYS - 1))); do
            DATE=$(date -d "$START + $i days" +%Y-%m-%d)
            echo ""
            echo "=============================="
            echo "Generating date: $DATE ($((i+1))/$NUM_DAYS)"
            echo "=============================="

            pids=()
            for domain in $DOMAINS; do
              npx ts-node src/scripts/agent-loop.ts --domain "$domain" --date "$DATE" &
              pids+=($!)
            done

            date_failed=0
            for pid in "${pids[@]}"; do
              wait "$pid" || date_failed=1
            done

            if [ $date_failed -ne 0 ]; then
              echo "WARNING: One or more domains failed for $DATE"
              any_failed=1
            fi
          done

          exit $any_failed

      - name: Verify coverage for all dates
        if: always()
        working-directory: pipeline
        run: |
          START="${{ github.event.inputs.start_date }}"
          NUM_DAYS="${{ github.event.inputs.num_days }}"
          any_missing=0

          for i in $(seq 0 $((NUM_DAYS - 1))); do
            DATE=$(date -d "$START + $i days" +%Y-%m-%d)
            echo "--- $DATE ---"
            node check-today.js "$DATE" || any_missing=1
          done

          exit $any_missing
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/bulk-puzzle-gen.yml
git commit -m "feat(ci): bulk puzzle generation workflow"
```

---

## Chunk 2: Secrets setup + smoke test

### Task 4: Add GitHub Actions secrets

This is a manual step — no code changes needed.

- [ ] **Step 1: Open GitHub repo settings**

Go to your repo on GitHub → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

- [ ] **Step 2: Add each secret**

Add these three secrets (values from your local `pipeline/.env`):

| Secret name | Where to find the value |
|---|---|
| `SUPABASE_URL` | `pipeline/.env` → `SUPABASE_URL` |
| `SUPABASE_SERVICE_KEY` | `pipeline/.env` → `SUPABASE_SERVICE_KEY` |
| `OPENAI_API_KEY` | `pipeline/.env` → `OPENAI_API_KEY` |

- [ ] **Step 3: Verify all 3 secrets appear in the Actions secrets list**

You should see all three listed (values are hidden). No commit needed — secrets live in GitHub only.

---

### Task 5: Smoke test the daily workflow

- [ ] **Step 1: Push the branch to GitHub**

```bash
git push origin main
```

- [ ] **Step 2: Manually trigger the daily workflow with a date override**

On GitHub: **Actions** → **Daily Puzzle Generation** → **Run workflow** → set `date_override` to a date at least 2 days in the future (e.g. `2026-03-14`) → **Run workflow**

Use a future date so it doesn't conflict with today's already-published puzzles.

- [ ] **Step 3: Watch the run**

In GitHub Actions, open the run. You should see:
- 20 parallel `Generate (domain)` jobs start simultaneously
- Each job takes 3-10 min depending on cache warmth
- After all matrix jobs complete, the `Verify coverage` job runs
- `check-today.js` should output no missing lines and exit 0

- [ ] **Step 4: Verify in Supabase**

Run locally:
```bash
cd pipeline && node check-today.js 2026-03-14
```

Expected: `done (date: 2026-03-14)` with exit code 0 and no missing lines.

---

### Task 6: Bulk generate the next 30 days

- [ ] **Step 1: Trigger the bulk workflow**

On GitHub: **Actions** → **Bulk Puzzle Generation** → **Run workflow**

Inputs:
- `start_date`: tomorrow's date (e.g. `2026-03-13`) — skip today since it's already done
- `num_days`: `30`

- [ ] **Step 2: Monitor progress**

The bulk run will take ~40-50 min. You can watch the single job's log output — it prints a banner for each date as it starts.

- [ ] **Step 3: Verify full coverage locally**

```bash
cd pipeline
for i in $(seq 0 29); do
  DATE=$(date -v+${i}d +%Y-%m-%d 2>/dev/null || date -d "+$i days" +%Y-%m-%d)
  node check-today.js "$DATE"
done
```

Expected: all 30 dates print `done` with no missing lines.

---

## Notes for the implementer

**macOS vs Linux date syntax:** The bulk workflow shell script uses Linux `date -d` syntax (GNU date). GitHub Actions runners are Ubuntu. Your local Mac uses BSD `date -v`. If testing the date loop locally on Mac, use `date -v+1d +%Y-%m-%d` instead of `date -d '+1 day' +%Y-%m-%d`.

**Cache behaviour:** The entity cache is per-domain (e.g. `history.json`, `movies.json`). Within a single bulk run, the first date fetches from Wikidata and writes the cache; all subsequent dates read from it. The `actions/cache` step persists the entire `pipeline/.entity-cache/` directory between workflow runs, so the daily cron also benefits from a warm cache all week. Note: `actions/cache@v4` saves the cache automatically at the end of the job — there is no explicit upload step needed.

**Re-running failed jobs:** Both workflows are idempotent. Already-published puzzles are detected by `isAlreadyPublished()` in `run-domain.ts` and skipped. It's safe to re-trigger either workflow for any date.

**`mb_*` domains note:** `mb_rock`, `mb_hiphop`, and `mb_country` are active music domains. `mb_pop` and `mb_rnb` are deactivated — do not add them to the domain lists.
