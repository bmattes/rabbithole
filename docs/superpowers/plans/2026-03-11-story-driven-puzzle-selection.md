# Story-Driven Puzzle Selection Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two-call QC+narrative sequence with a single LLM call that selects the best story from up to 5 candidate paths and writes the narrative for the winner.

**Architecture:** `composePuzzleForDifficulty` already collects up to 5 candidates ranked by math-based `scorePathQuality`. A new `evaluateAndSelectPuzzle` function in `puzzleQC.ts` receives all candidates, evaluates validity AND story quality in one GPT-4o call, picks the winner, and returns the narrative. `run-domain.ts` collects all candidates before calling the LLM, then uses the selection result — eliminating the separate `generateNarrative` call.

**Tech Stack:** TypeScript, OpenAI GPT-4o, existing pipeline infrastructure

---

## Files

- **Modify:** `pipeline/src/puzzleQC.ts` — add `evaluateAndSelectPuzzle()`, keep `evaluatePuzzle()` unchanged
- **Modify:** `pipeline/src/scripts/run-domain.ts` — collect candidates, call `evaluateAndSelectPuzzle`, store narrative in draft
- **Modify:** `pipeline/src/puzzleComposer.ts` — expose `collectCandidates()` helper or adjust `composePuzzleForDifficulty` return type
- **No change:** `narrativeGenerator.ts`, DB schema, mobile app, `puzzleComposer.ts` core logic

---

## Chunk 1: Add `evaluateAndSelectPuzzle` to puzzleQC.ts

### Task 1: Define the new function signature and types

**Files:**
- Modify: `pipeline/src/puzzleQC.ts`

- [ ] **Step 1: Read current exports from puzzleQC.ts**

  Check the existing `QCResult` interface and `evaluatePuzzle` signature — confirm nothing will conflict.

- [ ] **Step 2: Add `PuzzleCandidate` and `SelectionResult` types**

  Add after the existing `QCResult` interface:

  ```typescript
  export interface PuzzleCandidate {
    pathLabels: string[]   // human-readable labels in order
    index: number          // original index in the candidates array
  }

  export interface SelectionResult {
    winnerIndex: number              // index into the candidates array
    narrative: string                // narrative for the winner
    storyScores: number[]            // story quality score 1-10 per candidate
    qcResult: QCResult               // validity QC for the winner
  }
  ```

- [ ] **Step 3: Commit types**

  ```bash
  git add pipeline/src/puzzleQC.ts
  git commit -m "feat(pipeline): add PuzzleCandidate and SelectionResult types to puzzleQC"
  ```

---

### Task 2: Implement `evaluateAndSelectPuzzle`

**Files:**
- Modify: `pipeline/src/puzzleQC.ts`

- [ ] **Step 1: Add the function after `evaluatePuzzle`**

  ```typescript
  export async function evaluateAndSelectPuzzle(
    candidates: PuzzleCandidate[],
    domain: string,
    difficulty: string,
    connectionType: string,
  ): Promise<SelectionResult | null> {
    if (candidates.length === 0) return null

    const personaTier = REVIEWER_PERSONAS[domain]
    const defaultPersonas: PersonaTier = {
      easy:   'You are a curious layperson with broad general knowledge.',
      medium: 'You are a well-read enthusiast with solid knowledge across many topics.',
      hard:   'You are a specialist with deep expert knowledge.',
    }
    const persona = (personaTier ?? defaultPersonas)[difficulty as keyof PersonaTier] ?? defaultPersonas.medium

    const difficultyExpectation = {
      easy:   'EASY puzzle — solvable by a casual fan, but not trivially obvious.',
      medium: 'MEDIUM puzzle — requires real knowledge, not just pop culture familiarity.',
      hard:   'HARD puzzle — genuinely challenges enthusiasts. Flag hops that are too easy for hard difficulty.',
    }[difficulty] ?? ''

    const domainNotes: Record<string, string> = {
      videogames: 'Real-world locations are VALID when games are set there. Game genres and platforms are VALID.',
      movies: 'Real-world locations are VALID as filming locations or settings. Film genres and awards are VALID.',
      tv: 'TV networks, genres, and fictional characters are all VALID bridge nodes.',
      geography: 'Films are VALID bridges when filmed in one of the cities.',
      soccer: 'Countries (birthplace) and playing positions are VALID.',
      basketball: 'Universities and basketball awards are VALID.',
      americanfootball: 'Playing positions and coaches are VALID.',
      literature: 'Literary genres and universities are VALID.',
      art: 'Countries (birthplace) and art schools are VALID alongside movements.',
      comics: 'Artistic and literary movements are VALID.',
      music: 'Musical genres are VALID.',
      science: 'Universities, awards, and intellectual influences are VALID.',
      history: 'Universities and prestigious awards are VALID.',
      philosophy: 'Universities and academic institutions are VALID.',
      military: 'Military academies are VALID.',
      royals: 'Schools, universities, and countries of birth are VALID.',
      space: 'Space missions, spacecraft, launch vehicles, and space agencies are all VALID.',
      food: 'Famous chefs who created dishes are VALID.',
      mb_rock: 'Record labels and songs are VALID at easy/medium. At hard, musical influences are the expected type — artist→major label is too_easy for hard.',
      mb_hiphop: 'Record labels and songs are VALID. Related genre artists with hip-hop connections are VALID.',
      mb_country: 'Record labels and songs are VALID. Bluegrass and Americana artists are VALID.',
    }
    const domainNote = domainNotes[domain] ?? ''

    const candidateList = candidates
      .map((c, i) => `Candidate ${i + 1}: ${c.pathLabels.join(' → ')}`)
      .join('\n')

    const prompt = `${persona}

You are selecting the best puzzle for RabbitHole, a daily trivia game where players hop through connected concepts.
Difficulty: ${difficulty} (${difficultyExpectation})
Category: ${domain} | Connections via: ${connectionType}
${domainNote ? `\n${domainNote}\n` : ''}
Here are the candidate puzzle paths:

${candidateList}

## Step 1: Validity check
For each candidate, evaluate whether every hop is valid and knowable at ${difficulty} difficulty.
Flag issues: wrong_domain, obscure, too_easy, abstract, ambiguous.
A candidate FAILS validity if: any hop is wrong_domain, any hop scores below 4, or overall score < 7.
(For hard: also fail if overall score >= 9 — too easy for hard.)

## Step 2: Story quality
For each candidate that PASSES validity, rate story quality 1-10:
- 9-10: Surprising and delightful — reveals something non-obvious, feels like a discovery
- 7-8: Interesting journey — connection makes sense once you see it, "aha" moment
- 5-6: Functional — valid but arbitrary, no memorable arc
- 1-4: Boring — obvious hubs, no narrative tension

The best story feels like a journey: starts familiar, travels through unexpected territory, arrives somewhere surprising.

## Step 3: Select winner and write narrative
Pick the candidate with the highest story score (among those passing validity).
Write a 2-3 sentence narrative for the winner in the style of RabbitHole: engaging, explains WHY each connection makes sense like a curious fact trail, enthusiastic but concise, flowing prose (no bullet points).

Respond with JSON only:
{
  "candidates": [
    {
      "index": 0,
      "validity_pass": true,
      "overall_score": 8,
      "story_score": 7,
      "issues": ["Node → Node: too_easy (6/10)"]
    }
  ],
  "winner_index": 0,
  "narrative": "2-3 sentence narrative for the winner...",
  "verdict": "one sentence explaining why this path tells the best story"
}`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.choices[0]?.message?.content ?? ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error(`No JSON in evaluateAndSelectPuzzle response: ${text.slice(0, 200)}`)

    const parsed = JSON.parse(jsonMatch[0])

    // Find winner
    const winnerIdx: number = parsed.winner_index ?? 0
    const winnerData = parsed.candidates?.[winnerIdx]

    if (!winnerData) return null

    const issues: string[] = (winnerData.issues ?? [])
    const storyScores: number[] = (parsed.candidates ?? []).map((c: any) => c.story_score ?? 0)

    // Build QCResult for winner
    const hasWrongDomain = issues.some((i: string) => i.includes('wrong_domain'))
    const minHopScore = issues.length > 0
      ? Math.min(...issues.map((i: string) => {
          const m = i.match(/\((\d+)\/10\)/)
          return m ? parseInt(m[1]) : 10
        }))
      : 10
    const score = winnerData.overall_score ?? 7
    const pass = !hasWrongDomain && score >= 7 && minHopScore >= 4 && !(difficulty === 'hard' && score >= 9)

    return {
      winnerIndex: winnerIdx,
      narrative: parsed.narrative ?? '',
      storyScores,
      qcResult: {
        pass,
        score,
        issues,
        verdict: parsed.verdict ?? '',
      },
    }
  }
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  ```bash
  cd pipeline && npx tsc --noEmit
  ```
  Expected: no errors

- [ ] **Step 3: Commit**

  ```bash
  git add pipeline/src/puzzleQC.ts
  git commit -m "feat(pipeline): add evaluateAndSelectPuzzle — story-driven path selection with combined QC+narrative"
  ```

---

## Chunk 2: Wire into run-domain.ts

### Task 3: Collect candidates before LLM call

**Files:**
- Modify: `pipeline/src/scripts/run-domain.ts`

The current flow in `runDifficulty`:
1. Calls `composePuzzleForDifficulty` → gets one puzzle
2. Calls `evaluatePuzzle` → QC
3. If pass → `saveDraft`

New flow:
1. Call `composePuzzleForDifficulty` up to `MAX_LLM_CANDIDATES` times → collect passing-quality puzzles
2. Call `evaluateAndSelectPuzzle` → get winner + narrative
3. `saveDraft` with narrative already set

- [ ] **Step 1: Add import for `evaluateAndSelectPuzzle` and `PuzzleCandidate`**

  Replace the existing import line:
  ```typescript
  import { evaluatePuzzle, CONNECTION_TYPES } from '../puzzleQC'
  ```
  With:
  ```typescript
  import { evaluatePuzzle, evaluateAndSelectPuzzle, PuzzleCandidate, CONNECTION_TYPES } from '../puzzleQC'
  ```

- [ ] **Step 2: Add `MAX_LLM_CANDIDATES` constant near top of file**

  After the existing constants:
  ```typescript
  const MAX_LLM_CANDIDATES = 5  // collect up to this many paths before calling LLM
  ```

- [ ] **Step 3: Update `PuzzleDraft` to include narrative**

  ```typescript
  interface PuzzleDraft {
    puzzle: ComposedPuzzle
    pathLabels: string[]
    qcScore: number
    qualityScore: number
    narrative: string          // add this
    edgeLabels?: Record<string, string>
  }
  ```

- [ ] **Step 4: Replace the composition + QC block in `runDifficulty`**

  Find this section (after `const puzzle = composePuzzleForDifficulty(...)`):

  ```typescript
  const puzzle = composePuzzleForDifficulty({ ... })
  if (!puzzle) { ... return null }

  const entityMap = ...
  const pathLabels = puzzle.optimalPath.map(...)
  const qScore = scorePathQuality(...)
  console.log(...)

  // Cross-day deduplication check
  if (DRY_RUN) { ... }

  const connectionType = CONNECTION_TYPES[domain]?.[difficulty] ?? 'related concepts'
  const qcResult = await evaluatePuzzle(...)
  console.log(...)
  for (const issue of qcResult.issues) ...

  // Save passing puzzle as draft
  if (DRY_RUN && qcResult.pass) {
    ...
    saveDraft(difficulty, { puzzle, pathLabels, qcScore: qcResult.score, qualityScore: qScore.total, edgeLabels: filteredEdgeLabels })
  }

  return { domain, difficulty, score: qcResult.score, pass: qcResult.pass, ... }
  ```

  Replace with:

  ```typescript
  // Collect up to MAX_LLM_CANDIDATES candidates before calling LLM
  const candidates: Array<{ puzzle: ComposedPuzzle; pathLabels: string[]; qualityScore: number; edgeLabels: Record<string, string> }> = []
  const usedStartEnds = new Set<string>()

  for (let attempt = 0; attempt < MAX_LLM_CANDIDATES * 3 && candidates.length < MAX_LLM_CANDIDATES; attempt++) {
    const puzzle = composePuzzleForDifficulty({ entities: filtered, graph, entityIds, targetDifficulty: difficulty, domainOverrides, intermediateFilterConfig })
    if (!puzzle) continue

    // Avoid near-identical start/end pairs
    const pairKey = `${puzzle.startId}|${puzzle.endId}`
    if (usedStartEnds.has(pairKey)) continue
    usedStartEnds.add(pairKey)

    const entityMap = new Map(filtered.map((e: any) => [e.id, e]))
    const pathLabels = puzzle.optimalPath.map(id => entityMap.get(id)?.label ?? id)

    // Dedup check (only on DRY_RUN)
    if (DRY_RUN) {
      const categoryId = await getCategoryId(domain)
      if (categoryId) {
        const dedup = await checkDuplicate(supabase, categoryId, difficulty, date, puzzle.optimalPath)
        if (dedup.isDuplicate) {
          console.log(`[${domain}/${difficulty}] ✗ DEDUP rejected: ${dedup.reason}`)
          continue
        }
      }
    }

    const qScore = scorePathQuality(puzzle.optimalPath, entityMap as any, puzzle.connections as any, domainOverrides?.hubRelatedIdsThreshold)
    console.log(`[${domain}/${difficulty}] Candidate ${candidates.length + 1}: ${pathLabels.join(' → ')} (quality=${qScore.total.toFixed(1)})`)

    // Build filtered edge labels for this puzzle
    const bubbleSet = new Set(puzzle.bubbles.map((b: any) => b.id))
    const filteredEdgeLabels: Record<string, string> = {}
    for (const [key, label] of Object.entries(edgeLabels)) {
      const [a, b] = key.split('|')
      if (bubbleSet.has(a) && bubbleSet.has(b)) filteredEdgeLabels[key] = label
    }

    candidates.push({ puzzle, pathLabels, qualityScore: qScore.total, edgeLabels: filteredEdgeLabels })
  }

  if (candidates.length === 0) {
    console.log(`[${domain}/${difficulty}] No puzzle composed (limit=${entityLimit})`)
    return null
  }

  // LLM: evaluate all candidates for validity + story, pick winner, write narrative
  const connectionType = CONNECTION_TYPES[domain]?.[difficulty] ?? 'related concepts'
  const llmCandidates: PuzzleCandidate[] = candidates.map((c, i) => ({ pathLabels: c.pathLabels, index: i }))

  console.log(`[${domain}/${difficulty}] Evaluating ${candidates.length} candidate(s) for story quality...`)
  const selection = await evaluateAndSelectPuzzle(llmCandidates, domain, difficulty, connectionType)

  if (!selection || !selection.qcResult.pass) {
    const score = selection?.qcResult.score ?? 0
    const verdict = selection?.qcResult.verdict ?? 'no valid candidates'
    console.log(`[${domain}/${difficulty}] QC: ✗ FAIL (${score}/10) — ${verdict}`)
    for (const issue of selection?.qcResult.issues ?? []) console.log(`  ⚠ ${issue}`)
    return {
      domain, difficulty,
      score: score,
      pass: false,
      path: candidates[0]?.pathLabels ?? [],
      issues: selection?.qcResult.issues ?? [],
      qualityScore: candidates[0]?.qualityScore ?? 0,
    }
  }

  const winner = candidates[selection.winnerIndex]
  const storyScoresStr = selection.storyScores.map((s, i) => `${i + 1}:${s}`).join(' ')
  console.log(`[${domain}/${difficulty}] QC: ✓ PASS (${selection.qcResult.score}/10) — story scores: [${storyScoresStr}] — winner: ${selection.winnerIndex + 1}`)
  console.log(`[${domain}/${difficulty}] Path: ${winner.pathLabels.join(' → ')}`)
  for (const issue of selection.qcResult.issues) console.log(`  ⚠ ${issue}`)

  // Save winning puzzle as draft for the publish pass (includes narrative)
  if (DRY_RUN) {
    saveDraft(difficulty, {
      puzzle: winner.puzzle,
      pathLabels: winner.pathLabels,
      qcScore: selection.qcResult.score,
      qualityScore: winner.qualityScore,
      narrative: selection.narrative,
      edgeLabels: winner.edgeLabels,
    })
  }

  return {
    domain,
    difficulty,
    score: selection.qcResult.score,
    pass: true,
    path: winner.pathLabels,
    issues: selection.qcResult.issues,
    qualityScore: winner.qualityScore,
  }
  ```

- [ ] **Step 5: Update the publish pass to read narrative from draft**

  Find the publish pass section (the `if (!DRY_RUN)` block that calls `generateNarrative`):

  ```typescript
  const narrative = await generateNarrative({
    startLabel: capitalize(entityMap.get(puzzle.startId)?.label ?? puzzle.startId),
    endLabel: capitalize(entityMap.get(puzzle.endId)?.label ?? puzzle.endId),
    pathLabels: pathLabels.map(capitalize),
    category: domain,
  })
  ```

  Replace with:
  ```typescript
  // Narrative was generated during dry-run story selection — use it directly
  const narrative = draft.narrative ?? ''
  ```

  Also remove the entity re-fetch in the publish pass that was only needed for narrative generation. The publish pass now only needs `draft.puzzle` — no fresh entity fetch required:

  Replace this block:
  ```typescript
  // Re-fetch entities only for narrative generation (need labels)
  const maxDifficulty = DIFFICULTY_TO_MAX_SUBQUERY[difficulty]
  const { entities: rawEntities } = await fetchEntitiesCached(domain, entityLimit, { forceRefresh: false, maxDifficulty })
  const filtered = filterEntities(rawEntities, domain)
  const entityMap = new Map(filtered.map((e: any) => [e.id, e]))
  const pathLabels = draft.pathLabels
  ```

  With:
  ```typescript
  const pathLabels = draft.pathLabels
  ```

  And update the `upsert` call to use `draft.narrative` directly (no `entityMap` needed):
  ```typescript
  await supabase.from('puzzles').upsert({
    category_id: await getCategoryId(domain),
    date,
    start_concept: capitalize(draft.puzzle.bubbles.find((b: any) => b.id === draft.puzzle.startId)?.label ?? draft.puzzle.startId),
    end_concept: capitalize(draft.puzzle.bubbles.find((b: any) => b.id === draft.puzzle.endId)?.label ?? draft.puzzle.endId),
    bubbles: draft.puzzle.bubbles,
    connections: draft.puzzle.connections,
    optimal_path: draft.puzzle.optimalPath,
    difficulty: draft.puzzle.difficulty,
    narrative: draft.narrative,
    status: 'published',
    qc_score: draft.qcScore,
    edge_labels: draft.edgeLabels ?? null,
  }, { onConflict: 'category_id,date,difficulty' })
  ```

- [ ] **Step 6: Remove the now-unused `generateNarrative` import**

  Remove: `import { generateNarrative } from '../narrativeGenerator'`

- [ ] **Step 7: Verify TypeScript compiles**

  ```bash
  cd pipeline && npx tsc --noEmit
  ```
  Expected: no errors

- [ ] **Step 8: Commit**

  ```bash
  git add pipeline/src/scripts/run-domain.ts
  git commit -m "feat(pipeline): collect 5 candidates, use evaluateAndSelectPuzzle for story-driven selection"
  ```

---

## Chunk 3: Smoke test and validate

### Task 4: Run on one domain and inspect output

**Files:** none (validation only)

- [ ] **Step 1: Run a single domain dry-run**

  ```bash
  cd pipeline && npx ts-node src/scripts/run-domain.ts --domain movies --date 2026-03-12 --dry-run
  ```

  Expected console output:
  - `[movies/easy] Candidate 1: X → Y → Z (quality=...)`
  - `[movies/easy] Candidate 2: ...` (up to 5)
  - `[movies/easy] Evaluating N candidate(s) for story quality...`
  - `[movies/easy] QC: ✓ PASS (8/10) — story scores: [1:7 2:5 3:8] — winner: 3`
  - `[movies/easy] Path: The winner path labels`

- [ ] **Step 2: Inspect the saved draft**

  ```bash
  cat .entity-cache/puzzle-drafts/movies-2026-03-12-easy.json | node -e "
  const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'))
  console.log('Path:', d.pathLabels.join(' → '))
  console.log('Narrative:', d.narrative)
  console.log('QC score:', d.qcScore)
  "
  ```

  Expected: narrative field is populated, path makes sense

- [ ] **Step 3: Commit validation note to plan doc**

  If output looks good, mark this task complete and proceed.

---

### Task 5: Run full publish pass and verify narrative in DB

- [ ] **Step 1: Run publish pass for movies**

  ```bash
  cd pipeline && npx ts-node src/scripts/run-domain.ts --domain movies --date 2026-03-12
  ```

  Expected: publishes puzzle, narrative comes from draft (no separate generateNarrative call in logs)

- [ ] **Step 2: Verify narrative in DB**

  ```bash
  node -e "
  const { createClient } = require('@supabase/supabase-js')
  require('dotenv').config()
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
  sb.from('puzzles').select('difficulty, optimal_path, narrative, bubbles').eq('date','2026-03-12').then(({data}) => {
    for (const p of data||[]) {
      const labels = {}
      for (const b of p.bubbles||[]) labels[b.id]=b.label
      console.log(p.difficulty, ':', (p.optimal_path||[]).map(id=>labels[id]||id).join(' → '))
      console.log('  ', p.narrative?.slice(0,120))
    }
  })
  "
  ```

  Expected: narrative accurately describes the actual path (no hallucination of wrong node names)

- [ ] **Step 3: Final commit**

  ```bash
  git add -A
  git commit -m "feat(pipeline): story-driven puzzle selection — LLM picks best narrative arc from 5 candidates"
  ```
