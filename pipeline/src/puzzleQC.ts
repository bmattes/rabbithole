/**
 * Puzzle QC Agent
 *
 * For each published puzzle, asks an LLM to evaluate whether every hop in the
 * optimal path is knowable by a reasonably well-informed player. Puzzles that
 * fail QC are unpublished and logged.
 *
 * Usage:
 *   npx ts-node src/puzzleQC.ts [--date YYYY-MM-DD] [--dry-run]
 */

import * as dotenv from 'dotenv'
dotenv.config()

import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)
const openai = new OpenAI()

const DRY_RUN = process.argv.includes('--dry-run')
const dateArg = process.argv.find(a => a.match(/^\d{4}-\d{2}-\d{2}$/))

interface QCResult {
  pass: boolean
  score: number        // 1-10
  issues: string[]
  verdict: string
}

// Three-tier personas per domain: easy=casual fan, medium=enthusiast, hard=expert.
// Easy puzzles are reviewed by a casual player — catches things that are trivially obvious.
// Hard puzzles are reviewed by an expert — catches things that are too obscure even for superfans.
type PersonaTier = { easy: string; medium: string; hard: string }

const REVIEWER_PERSONAS: Record<string, PersonaTier> = {
  movies: {
    easy:   'You are a casual moviegoer who watches the big blockbusters and popular films but has no deep industry knowledge.',
    medium: 'You are a film enthusiast who follows directors, award seasons, and has seen a wide range of films beyond the mainstream.',
    hard:   'You are a serious cinephile and film historian who knows obscure studios, production companies, and deep filmography details.',
  },
  videogames: {
    easy:   'You are a casual gamer who plays popular mainstream games but knows little about game history or the industry.',
    medium: 'You are a gaming enthusiast who follows the industry, knows major developers, and has played games across many genres and eras.',
    hard:   'You are a lifelong video game historian with encyclopedic knowledge of developers, publishers, series, and gaming history since the 1970s.',
  },
  mb_hiphop: {
    easy:   'You are a casual hip-hop listener who knows the biggest artists and hits from the mainstream charts.',
    medium: 'You are a hip-hop fan who digs into albums, knows labels, and follows the culture beyond just the radio hits.',
    hard:   'You are a hip-hop historian who knows every crew, collab, beef, and underground movement from the Bronx to Compton across every era.',
  },
  mb_rock: {
    easy:   'You are a casual rock fan who knows the biggest bands and classic hits but not deep lineup details.',
    medium: 'You are a rock music fan who follows band histories, knows major record labels, and digs into albums.',
    hard:   'You are a rock music obsessive who has memorised every band lineup change, side project, and obscure label from the 1950s to today.',
  },
  mb_pop: {
    easy:   'You are a mainstream pop listener who knows the current charts and the biggest pop stars.',
    medium: 'You are a pop music enthusiast who follows labels, collaborations, and pop history across decades.',
    hard:   'You are a pop music archivist who knows deep-cut collaborations, label imprints, and the full discography of every major pop act.',
  },
  mb_rnb: {
    easy:   'You are a casual R&B listener who knows the biggest names and hits from radio.',
    medium: 'You are an R&B fan who knows the history from Motown through neo-soul and follows artists deeply.',
    hard:   'You are an R&B and soul music scholar who knows every session musician, influence chain, and label from the 1950s to today.',
  },
  mb_country: {
    easy:   'You are a casual country music listener who knows the mainstream acts and biggest hits.',
    medium: 'You are a country music fan who knows bluegrass, classic country, and the Nashville scene.',
    hard:   'You are a country music historian who knows every session player, side project, and outlaw country connection.',
  },
  history: {
    easy:   'You are an average person with a high school level of world history knowledge.',
    medium: 'You are a history enthusiast who reads widely about political history, world leaders, and major events.',
    hard:   'You are a history professor with deep specialist knowledge of political parties, offices, and obscure historical figures.',
  },
  science: {
    easy:   'You are a curious layperson who knows famous scientists and major scientific discoveries from school.',
    medium: 'You are a science enthusiast who follows Nobel prizes, major institutions, and research fields.',
    hard:   'You are a research scientist who knows the detailed career histories and institutional affiliations of scientists across all fields.',
  },
  literature: {
    easy:   'You are a general reader who knows the most famous novels and their authors from school and popular culture.',
    medium: 'You are a literature enthusiast who reads widely and knows literary movements, major authors, and notable works.',
    hard:   'You are a literature professor who knows obscure authors, minor movements, and the full canon of world literature.',
  },
  philosophy: {
    easy:   'You are an interested layperson who knows the most famous philosophers and broad schools of thought.',
    medium: 'You are a philosophy enthusiast who has studied the major thinkers and understands schools of thought in some depth.',
    hard:   'You are a philosophy professor who knows obscure thinkers, minor schools, and the detailed intellectual genealogy of ideas.',
  },
  art: {
    easy:   'You are a casual museum-goer who knows the most famous paintings, artists, and art movements.',
    medium: 'You are an art enthusiast who follows art history and knows painters across many movements and periods.',
    hard:   'You are an art historian who knows obscure painters, minor movements, and detailed institutional histories.',
  },
  mythology: {
    easy:   'You are a general reader who knows the major Greek, Norse, and Egyptian gods from popular culture.',
    medium: 'You are a mythology enthusiast who has studied multiple pantheons and knows the major figures and their stories.',
    hard:   'You are a mythology scholar with deep knowledge of minor deities, regional variants, and cross-cultural connections.',
  },
  soccer: {
    easy:   'You are a casual football fan who watches the big games and knows the star players from major clubs.',
    medium: 'You are a football enthusiast who follows multiple leagues, knows transfer histories, and tracks club careers.',
    hard:   'You are a football statistician who knows every player transfer, loan spell, and career detail across world football.',
  },
  sport: {
    easy:   'You are a casual sports fan who watches major events and knows the biggest stars.',
    medium: 'You are a sports enthusiast who follows multiple sports and knows career histories in some depth.',
    hard:   'You are a sports historian with expert knowledge of career transfers, club histories, and obscure career details.',
  },
  basketball: {
    easy:   'You are a casual basketball fan who knows the biggest NBA stars and most famous teams.',
    medium: 'You are a basketball enthusiast who follows the NBA closely, knows team rosters, and tracks player movements.',
    hard:   'You are a basketball obsessive who knows every NBA trade, draft pick, G-League player, and historical roster detail.',
  },
  americanfootball: {
    easy:   'You are a casual NFL fan who watches the Super Bowl and knows the biggest stars and teams.',
    medium: 'You are an NFL enthusiast who follows rosters, trades, and the league history in some depth.',
    hard:   'You are an American football expert who knows every roster move, college career, and obscure team history.',
  },
  tennis: {
    easy:   'You are a casual tennis fan who knows the Grand Slams and the biggest stars of the current era.',
    medium: 'You are a tennis enthusiast who follows the full tour and knows player nationalities and career histories.',
    hard:   'You are a tennis historian who knows every player\'s full career, Davis Cup team, and the complete tour history.',
  },
  geography: {
    easy:   'You are an average person with a solid general knowledge of world geography — capitals, continents, major countries.',
    medium: 'You are a geography enthusiast who knows world geography in detail including smaller nations and political borders.',
    hard:   'You are a geography expert who knows obscure territories, historical borders, and detailed regional geography.',
  },
  royals: {
    easy:   'You are a casual observer who knows the most famous monarchs and royal families from popular culture and news.',
    medium: 'You are a royal history enthusiast who knows dynasties, successions, and the histories of major monarchies.',
    hard:   'You are a royal genealogy expert who knows obscure monarchs, minor dynasties, and detailed succession histories.',
  },
  military: {
    easy:   'You are an average person with general knowledge of major wars and the most famous military figures.',
    medium: 'You are a military history enthusiast who knows commanders, conflicts, and military campaigns in some depth.',
    hard:   'You are a military historian with expert knowledge of obscure commanders, minor conflicts, and detailed campaign histories.',
  },
  space: {
    easy:   'You are a casual space fan who knows the Apollo missions, the biggest astronauts, and the major space agencies.',
    medium: 'You are a space enthusiast who follows NASA, ESA, and other agencies and knows astronaut careers in some depth.',
    hard:   'You are a space historian who knows every mission, every astronaut\'s career, and the full history of all space programs.',
  },
  food: {
    easy:   'You are a curious eater who knows the most famous dishes and their obvious countries of origin.',
    medium: 'You are a food enthusiast who knows world cuisines, regional dishes, and food categories in some depth.',
    hard:   'You are a food anthropologist who knows obscure regional dishes, their exact origins, and culinary history in detail.',
  },
  comics: {
    easy:   'You are a casual comics reader who knows the most famous Marvel and DC characters from movies and TV.',
    medium: 'You are a comics fan who reads regularly and knows teams, publishers, and key creators.',
    hard:   'You are a comics collector who knows every obscure character, creator credit, and publishing imprint in detail.',
  },
  tv: {
    easy:   'You are a casual TV viewer who watches popular shows and knows the biggest stars.',
    medium: 'You are a TV enthusiast who follows many shows, knows showrunners and recurring cast members.',
    hard:   'You are a TV superfan who knows every guest appearance, creator credit, and network detail across thousands of shows.',
  },
}

async function evaluatePuzzle(
  categoryName: string,
  difficulty: string,
  path: string[],
  connectionType: string,
  domain: string,
): Promise<QCResult> {
  const pathStr = path.join(' → ')
  const personaTier = REVIEWER_PERSONAS[domain]
  const defaultPersonas: PersonaTier = {
    easy:   'You are a curious layperson with broad general knowledge.',
    medium: 'You are a well-read enthusiast with solid knowledge across many topics.',
    hard:   'You are a specialist with deep expert knowledge.',
  }
  const persona = (personaTier ?? defaultPersonas)[difficulty as keyof PersonaTier] ?? defaultPersonas.medium

  // Easy puzzles must not be trivially obvious; hard puzzles must actually be hard.
  const difficultyExpectation = {
    easy:   'This is an EASY puzzle — it should be solvable by a casual fan, but must NOT be so obvious that it feels trivial or boring. Flag hops that are so obvious they offer no challenge.',
    medium: 'This is a MEDIUM puzzle — it should require some real knowledge, not just pop culture familiarity, but not be deeply specialist.',
    hard:   'This is a HARD puzzle — it should genuinely challenge even enthusiasts. Flag hops that are too easy for this difficulty level, as well as hops that are too obscure to be knowable.',
  }[difficulty] ?? ''

  const prompt = `${persona}

You are reviewing a puzzle for RabbitHole, a daily trivia game where players hop through connected concepts. ${difficultyExpectation}

Category: "${categoryName}" | Difficulty: ${difficulty} | Connections are via: ${connectionType}

Puzzle path to evaluate:
${pathStr}

FIRST — check that every node in the path actually belongs in the "${categoryName}" category. A node that is clearly from a different domain (e.g. a geography place in a TV puzzle, a sports team in a music puzzle) is an immediate disqualifier regardless of its connections.

For each hop (A → B), ask:
1. Does each node BELONG in the "${categoryName}" category? Or is it clearly from a different domain entirely?
2. Is the connection KNOWABLE to someone at this experience level? Would they recognise that A and B are connected via ${connectionType}?
3. Is the connection appropriately CHALLENGING for ${difficulty} difficulty? Or is it trivially obvious / impossibly obscure?
4. Is the intermediate node SPECIFIC? Or so generic/abstract it could connect to almost anything?
5. Are any node labels AMBIGUOUS? (e.g. a real name instead of a stage name, or could refer to multiple things)

Rate each hop 1-10 for knowability at this difficulty level. Flag issues:
- "wrong_domain" if a node clearly does not belong in the ${categoryName} category (e.g. a place name in a TV puzzle) — this should score 1 and fail the puzzle
- "obscure" if the connection is not well-known enough for this audience
- "too_easy" if the connection is so obvious it offers no challenge for this difficulty
- "ambiguous" if a label could refer to multiple things or uses an unfamiliar name form
- "abstract" if a node is an abstract concept/category rather than a real specific entity
- "duplicate_label" if two nodes have the same or very similar names

Respond with JSON only:
{
  "hops": [
    { "from": "A", "to": "B", "knowability": 8, "issue": null },
    { "from": "B", "to": "C", "knowability": 3, "issue": "obscure" }
  ],
  "overall_score": 7,
  "pass": true,
  "verdict": "one sentence summary"
}

Pass if overall_score >= 7 AND no hop scores below 4. Also fail if this is a hard puzzle and overall_score >= 9 (too easy for hard difficulty).`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.choices[0]?.message?.content ?? ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error(`No JSON in response: ${text}`)

  const parsed = JSON.parse(jsonMatch[0])
  const issues: string[] = parsed.hops
    .filter((h: any) => h.issue)
    .map((h: any) => `${h.from} → ${h.to}: ${h.issue} (${h.knowability}/10)`)

  const score = parsed.overall_score
  const minHopScore = Math.min(...parsed.hops.map((h: any) => h.knowability ?? 10))
  const hasWrongDomain = parsed.hops.some((h: any) => h.issue === 'wrong_domain')
  const pass = !hasWrongDomain && score >= 7 && minHopScore >= 4 && !(difficulty === 'hard' && score >= 9)

  return {
    pass,
    score,
    issues,
    verdict: parsed.verdict,
  }
}

const CONNECTION_TYPES: Record<string, Record<string, string>> = {
  movies: {
    easy: 'shared cast members',
    medium: 'cast members and directors',
    hard: 'cast, directors, and production studios',
  },
  sport: {
    easy: 'teams they played for',
    medium: 'teams and cities',
    hard: 'teams, cities, and coaches',
  },
  history: {
    easy: 'political parties',
    medium: 'political parties and positions held',
    hard: 'political parties and positions held',
  },
  science: {
    easy: 'shared institutions/employers',
    medium: 'institutions and fields of work',
    hard: 'institutions and fields of work',
  },
  videogames: {
    easy: 'game series, characters, and settings',
    medium: 'game series, developers, and directors',
    hard: 'game series, developers, publishers, composers, and game engines',
  },
  mb_rock: { easy: 'band memberships and collaborations', medium: 'band memberships and collaborations', hard: 'band memberships and collaborations' },
  mb_hiphop: { easy: 'record labels and collaborations', medium: 'record labels and collaborations', hard: 'record labels and collaborations' },
  mb_pop: { easy: 'record labels and collaborations', medium: 'record labels and collaborations', hard: 'record labels and collaborations' },
  mb_rnb: { easy: 'record labels and influences', medium: 'record labels and influences', hard: 'record labels and influences' },
  mb_country: { easy: 'record labels and bands', medium: 'record labels and bands', hard: 'record labels and bands' },
  soccer: { easy: 'clubs', medium: 'clubs and leagues', hard: 'clubs and leagues' },
  tennis: { easy: 'nationality', medium: 'nationality and teams', hard: 'nationality and teams' },
  basketball: { easy: 'basketball teams', medium: 'NBA teams and leagues', hard: 'NBA teams, leagues, and divisions' },
  americanfootball: { easy: 'NFL teams', medium: 'NFL teams and leagues', hard: 'NFL teams, leagues, and divisions' },
  geography: { easy: 'capital cities, countries, and continents', medium: 'countries and continents', hard: 'countries and continents' },
  royals: { easy: 'countries and monarchs', medium: 'monarchs and dynasties', hard: 'monarchs and dynasties' },
  mythology: { easy: 'mythology systems', medium: 'mythology systems and pantheons', hard: 'pantheons, family, and legend' },
  philosophy: { easy: 'schools of thought', medium: 'schools of thought', hard: 'schools of thought and influences' },
  military: { easy: 'nationality and country', medium: 'nationality and conflicts', hard: 'nationality and conflicts' },
  space: { easy: 'space agencies', medium: 'space agencies and nationality', hard: 'space agencies and nationality' },
  literature: { easy: 'novels, authors, and literary movements', medium: 'authors and literary movements', hard: 'authors and literary movements' },
  art: { easy: 'artworks and painters', medium: 'painters and art movements', hard: 'painters, movements, and institutions' },
  food: { easy: 'country of origin', medium: 'origin and food categories', hard: 'origin and food categories' },
  comics: { easy: 'publisher', medium: 'publisher and teams', hard: 'publisher, teams, and creators' },
  tv: { easy: 'shared cast', medium: 'cast and creators', hard: 'cast and creators' },
}

async function runQC(date: string) {
  console.log(`\n=== Puzzle QC — ${date}${DRY_RUN ? ' (DRY RUN)' : ''} ===\n`)

  const { data: puzzles, error } = await supabase
    .from('puzzles')
    .select('id, difficulty, optimal_path, bubbles, categories(name, wikidata_domain)')
    .eq('date', date)
    .eq('status', 'published')

  if (error || !puzzles?.length) {
    console.error('No puzzles found:', error?.message)
    return
  }

  console.log(`Found ${puzzles.length} puzzles to review\n`)

  const failed: string[] = []

  for (const puzzle of puzzles) {
    const cat = puzzle.categories as any
    const categoryName: string = cat?.name ?? 'Unknown'
    const domain: string = cat?.wikidata_domain ?? ''
    const difficulty: string = puzzle.difficulty ?? 'easy'

    const bubbleMap: Record<string, string> = {}
    for (const b of (puzzle.bubbles as any[]) ?? []) bubbleMap[b.id] = b.label
    const path = (puzzle.optimal_path as string[]).map(id => bubbleMap[id] ?? id)

    const connectionType = CONNECTION_TYPES[domain]?.[difficulty] ?? 'related concepts'

    process.stdout.write(`[${categoryName}/${difficulty}] ${path.join(' → ')}\n  Evaluating... `)

    try {
      const result = await evaluatePuzzle(categoryName, difficulty, path, connectionType, domain)

      if (result.pass) {
        console.log(`✓ PASS (${result.score}/10) — ${result.verdict}`)
      } else {
        console.log(`✗ FAIL (${result.score}/10) — ${result.verdict}`)
        for (const issue of result.issues) console.log(`    ⚠ ${issue}`)
        failed.push(puzzle.id)

        if (!DRY_RUN) {
          const { error: updateError } = await supabase
            .from('puzzles')
            .update({ status: 'qc_failed' })
            .eq('id', puzzle.id)
          if (updateError) console.error(`    DB update failed: ${updateError.message}`)
          else console.log(`    → Unpublished`)
        }
      }
    } catch (err: any) {
      console.log(`ERROR: ${err.message}`)
    }
  }

  console.log(`\n=== QC complete: ${puzzles.length - failed.length}/${puzzles.length} passed ===`)
  if (failed.length > 0) {
    console.log(`Failed: ${failed.length} puzzle(s) unpublished`)
    console.log('Re-run the pipeline to regenerate failed puzzles.')
  }
}

export { runQC, evaluatePuzzle, CONNECTION_TYPES, REVIEWER_PERSONAS }

// CLI entry point
if (require.main === module) {
  const date = dateArg ?? new Date().toISOString().split('T')[0]
  runQC(date)
}
