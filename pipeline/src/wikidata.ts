import { Entity } from './graphBuilder'

const WIKIDATA_ENDPOINT = 'https://query.wikidata.org/sparql'

export type WikidataDomain =
  | 'movies' | 'sport' | 'music' | 'science' | 'history'
  | 'videogames' | 'art' | 'literature' | 'geography' | 'royals'
  | 'tennis' | 'soccer' | 'tv' | 'philosophy' | 'military'
  | 'mythology' | 'space' | 'food'

export type CategoryDomain = WikidataDomain | 'mb_rock' | 'mb_hiphop' | 'mb_pop' | 'mb_rnb' | 'mb_country' | 'mb_electronic' | 'comicvine'

// Sport uses multiple focused queries to avoid Wikidata timeouts
const SPORT_SUBQUERIES = [
  // Athlete → team
  (limit: number) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P641 []; wdt:P54 ?b.
  ?b wdt:P31 wd:Q476028.
  ?a wikibase:sitelinks ?links. FILTER(?links > 20)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`,
  // Coach → team
  (limit: number) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q31729; wdt:P6087 ?b.
  ?b wdt:P31 wd:Q476028.
  ?a wikibase:sitelinks ?links. FILTER(?links > 15)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`,
  // Sports team → location (no transitive traversal)
  (limit: number) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q476028; wdt:P131 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 15)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`,
]
// NOTE: "team → sport" subquery removed — sport-category nodes (Chess, Volleyball) make
// poor start/end points and produce trivially-obvious connections ("both are competitive sports")

// Movies uses multiple focused queries merged together instead of one large join
const MOVIES_SUBQUERIES = [
  // Film → director
  (limit: number) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?type { wd:Q11424 wd:Q506240 }
  ?a wdt:P31 ?type; wdt:P57 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 30)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`,
  // Film → cast member
  (limit: number) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?type { wd:Q11424 wd:Q506240 }
  ?a wdt:P31 ?type; wdt:P161 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 30)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`,
  // Film → production company
  (limit: number) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?type { wd:Q11424 wd:Q506240 }
  ?a wdt:P31 ?type; wdt:P272 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 30)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`,
]

// Music subqueries — split by entity type so we can tag them correctly
const MUSIC_SUBQUERIES = [
  // Artist → record label
  (limit: number) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q639669; wdt:P264 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 30)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`,
  // Artist → influenced by (both must have sitelinks > 50 to stay fast)
  (limit: number) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q639669; wdt:P737 ?b.
  ?b wdt:P31 wd:Q5; wdt:P106 wd:Q639669.
  ?a wikibase:sitelinks ?links. FILTER(?links > 50)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 50)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`,
  // Song → performer
  (limit: number) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?songType { wd:Q7366 wd:Q134556 wd:Q208569 }
  ?a wdt:P31 ?songType; wdt:P175 ?b.
  ?b wdt:P31 wd:Q5.
  ?a wikibase:sitelinks ?links. FILTER(?links > 15)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`,
]
const MUSIC_TYPES: [string, string][] = [
  ['person', 'label'],   // artist → record label
  ['person', 'person'],  // artist → influenced by (artist)
  ['song', 'person'],    // song → performer
]

// Video games: game → publisher, game → developer, game → series
const VIDEOGAMES_SUBQUERIES = [
  (limit: number) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q7889; wdt:P123 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 10)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`,
  (limit: number) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q7889; wdt:P178 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 10)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`,
  (limit: number) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q7889; wdt:P179 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 10)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`,
]
const VIDEOGAMES_TYPES: [string, string][] = [
  ['game', 'company'],  // game → publisher
  ['game', 'company'],  // game → developer
  ['game', 'series'],   // game → series
]

// Art: painter → movement, painter → institution, artwork → painter
const ART_SUBQUERIES = [
  (limit: number) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q1028181; wdt:P135 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 5)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`,
  (limit: number) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q1028181; wdt:P108 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 5)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`,
  (limit: number) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q3305213; wdt:P170 ?b.
  ?b wdt:P31 wd:Q5.
  ?a wikibase:sitelinks ?links. FILTER(?links > 10)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`,
]
const ART_TYPES: [string, string][] = [
  ['person', 'movement'],  // painter → art movement
  ['person', 'other'],     // painter → institution
  ['artwork', 'person'],   // artwork → painter
]

// Literature: author → movement/genre, novel → author
const LITERATURE_SUBQUERIES = [
  (limit: number) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q36180; wdt:P135|wdt:P101 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 10)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`,
  (limit: number) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?bookType { wd:Q7725634 wd:Q8261 wd:Q1667921 }
  ?a wdt:P31 ?bookType; wdt:P50 ?b.
  ?b wdt:P31 wd:Q5.
  ?a wikibase:sitelinks ?links. FILTER(?links > 15)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`,
]
const LITERATURE_TYPES: [string, string][] = [
  ['person', 'other'],   // author → literary movement/genre
  ['book', 'person'],    // novel → author
]

// Geography: country → continent, capital city → country (capitals only to avoid timeout)
const GEOGRAPHY_SUBQUERIES = [
  (limit: number) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q6256; wdt:P30 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 20)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`,
  (limit: number) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?b wdt:P31 wd:Q6256; wdt:P36 ?a.
  ?a wikibase:sitelinks ?links. FILTER(?links > 30)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`,
]
const GEOGRAPHY_TYPES: [string, string][] = [
  ['country', 'continent'],  // country → continent
  ['city', 'country'],       // capital city → country
]

// Royals: monarch → country (via P27 citizenship), monarch → noble house (P53)
const ROYALS_SUBQUERIES = [
  (limit: number) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P27 ?b.
  ?b wdt:P31 wd:Q6256.
  ?a wdt:P106 wd:Q116.
  ?a wikibase:sitelinks ?links. FILTER(?links > 20)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`,
  (limit: number) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P53 ?b.
  ?a wdt:P106 wd:Q116.
  ?a wikibase:sitelinks ?links. FILTER(?links > 20)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`,
]
const ROYALS_TYPES: [string, string][] = [
  ['person', 'country'],  // monarch → country
  ['person', 'dynasty'],  // monarch → noble house
]

// Tennis: player → country, player → tournament wins (via award)
const TENNIS_SUBQUERIES = [
  (limit: number) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q10833314; wdt:P27 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 15)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`,
  (limit: number) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q10833314; wdt:P54 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 15)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`,
]
const TENNIS_TYPES: [string, string][] = [
  ['person', 'country'],  // player → country
  ['person', 'team'],     // player → team/federation
]

// Soccer: footballer → club (high sitelinks to stay fast), club → league
const SOCCER_SUBQUERIES = [
  (limit: number) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q937857; wdt:P54 ?b.
  ?b wdt:P31 wd:Q476028.
  ?a wikibase:sitelinks ?links. FILTER(?links > 50)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`,
  (limit: number) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q476028; wdt:P641 wd:Q2736; wdt:P118 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 30)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`,
]
const SOCCER_TYPES: [string, string][] = [
  ['person', 'team'],   // footballer → club
  ['team', 'league'],   // club → league
]

// TV: show → creator, show → network, show → cast
const TV_SUBQUERIES = [
  (limit: number) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5398426; wdt:P57|wdt:P162 ?b.
  ?b wdt:P31 wd:Q5.
  ?a wikibase:sitelinks ?links. FILTER(?links > 15)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`,
  (limit: number) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5398426; wdt:P161 ?b.
  ?b wdt:P31 wd:Q5.
  ?a wikibase:sitelinks ?links. FILTER(?links > 15)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`,
]
const TV_TYPES: [string, string][] = [
  ['show', 'person'],   // show → creator/director
  ['show', 'person'],   // show → cast member
]

// Philosophy: philosopher → school of thought, philosopher → influenced by
const PHILOSOPHY_SUBQUERIES = [
  (limit: number) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q4964182; wdt:P101 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 10)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`,
  (limit: number) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q4964182; wdt:P737 ?b.
  ?b wdt:P31 wd:Q5; wdt:P106 wd:Q4964182.
  ?a wikibase:sitelinks ?links. FILTER(?links > 20)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`,
]
const PHILOSOPHY_TYPES: [string, string][] = [
  ['person', 'other'],   // philosopher → field/school
  ['person', 'person'],  // philosopher → influenced by
]

// Military: commander → conflict, commander → country
const MILITARY_SUBQUERIES = [
  (limit: number) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q189290; wdt:P607 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 15)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`,
  (limit: number) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q189290; wdt:P27 ?b.
  ?b wdt:P31 wd:Q6256.
  ?a wikibase:sitelinks ?links. FILTER(?links > 15)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`,
]
const MILITARY_TYPES: [string, string][] = [
  ['person', 'conflict'],  // commander → conflict/war
  ['person', 'country'],   // commander → country
]

// Mythology: deity → pantheon/group, deity → influenced (parent myth system)
const MYTHOLOGY_SUBQUERIES = [
  // Deity/figure → group they belong to (Twelve Olympians, Aesir, etc.)
  (limit: number) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?type { wd:Q22989102 wd:Q4271324 wd:Q178885 wd:Q12195757 }
  ?a wdt:P31 ?type; wdt:P361 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 10)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`,
  // Deity → mythology system (Greek mythology, Norse mythology, etc.)
  (limit: number) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?type { wd:Q22989102 wd:Q4271324 wd:Q178885 wd:Q12195757 wd:Q4936492 }
  ?a wdt:P31 ?type; wdt:P1080 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 5)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`,
]
const MYTHOLOGY_TYPES: [string, string][] = [
  ['deity', 'group'],    // deity → pantheon group
  ['deity', 'other'],    // deity → divine domain/attribute
]

// Space: astronaut → country, astronaut → space program
const SPACE_SUBQUERIES = [
  (limit: number) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q11631; wdt:P27 ?b.
  ?b wdt:P31 wd:Q6256.
  ?a wikibase:sitelinks ?links. FILTER(?links > 10)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`,
  // Astronaut → space agency they flew with
  (limit: number) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q11631; wdt:P108 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 10)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`,
]
const SPACE_TYPES: [string, string][] = [
  ['person', 'country'],   // astronaut → country
  ['person', 'other'],     // astronaut → space agency
]

// Food: dish → country of origin, dish → food category
const FOOD_SUBQUERIES = [
  (limit: number) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q746549; wdt:P495 ?b.
  ?b wdt:P31 wd:Q6256.
  ?a wikibase:sitelinks ?links. FILTER(?links > 10)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`,
  (limit: number) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q746549; wdt:P279 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 10)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`,
]
const FOOD_TYPES: [string, string][] = [
  ['dish', 'country'],    // dish → country of origin
  ['dish', 'category'],   // dish → food category (pasta, soup, etc.)
]

// Each domain query returns pairs of (primary entity, related entity)
const DOMAIN_QUERIES: Record<WikidataDomain, (limit: number) => string> = {
  // placeholder — uses subqueries instead
  movies: (_limit) => '',
  sport: (_limit) => '',
  music: (_limit) => '',
  videogames: (_limit) => '',
  art: (_limit) => '',
  literature: (_limit) => '',
  geography: (_limit) => '',
  royals: (_limit) => '',
  tennis: (_limit) => '',
  soccer: (_limit) => '',
  tv: (_limit) => '',
  philosophy: (_limit) => '',
  military: (_limit) => '',
  mythology: (_limit) => '',
  space: (_limit) => '',
  food: (_limit) => '',

  // employer (P108) and field of work (P101) — "Scientist → Institution/Field → Scientist"
  // ?a is always a person, ?b is institution or field (both fine as bridges, only person as anchor)
  science: (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q901.
  ?a wdt:P108|wdt:P101 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 25)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`,

  // political party (P102) and position held (P39) — "Politician → Party/Role → Politician"
  history: (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q82955.
  ?a wdt:P102|wdt:P39 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 30)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`,
}

function extractId(uri: string): string {
  return uri.split('/').pop()!
}

async function runSparqlQuery(query: string): Promise<Array<Record<string, { value: string }>>> {
  const url = `${WIKIDATA_ENDPOINT}?query=${encodeURIComponent(query)}&format=json`
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= 3; attempt++) {
    if (attempt > 1) {
      const delay = attempt * 15000
      console.log(`  Retry ${attempt}/3 after ${delay / 1000}s...`)
      await new Promise(r => setTimeout(r, delay))
    }
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 55000)
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'RabbitHoleGame/1.0 (puzzle-generator; contact@rabbithole.game)',
          'Accept': 'application/sparql-results+json',
        }
      })
      clearTimeout(timeout)
      if (!response.ok) {
        lastError = new Error(`Wikidata query failed: ${response.status} ${response.statusText}`)
        continue
      }
      const data = await response.json() as {
        results: { bindings: Array<Record<string, { value: string }>> }
      }
      return data.results.bindings
    } catch (err: any) {
      clearTimeout(timeout)
      lastError = err?.name === 'AbortError'
        ? new Error(`Wikidata query timed out (attempt ${attempt})`)
        : err
    }
  }
  throw lastError ?? new Error('Wikidata fetch failed')
}

function bindingsToEntityMap(
  bindings: Array<Record<string, { value: string }>>,
  existing?: Map<string, Entity>,
  aType?: string,
  bType?: string,
): Map<string, Entity> {
  const entityMap = existing ?? new Map<string, Entity>()
  for (const binding of bindings) {
    const aId = extractId(binding.a.value)
    const aLabel = binding.aLabel?.value ?? aId
    const bId = extractId(binding.b.value)
    const bLabel = binding.bLabel?.value ?? bId
    const sitelinks = binding.links ? parseInt(binding.links.value) : undefined
    if (aLabel.startsWith('Q') && /^Q\d+$/.test(aLabel)) continue
    if (bLabel.startsWith('Q') && /^Q\d+$/.test(bLabel)) continue
    if (!entityMap.has(aId)) {
      entityMap.set(aId, { id: aId, label: aLabel, relatedIds: [], sitelinks, entityType: aType })
    } else {
      const e = entityMap.get(aId)!
      if (sitelinks !== undefined && (!e.sitelinks || sitelinks > e.sitelinks)) e.sitelinks = sitelinks
      if (aType && !e.entityType) e.entityType = aType
    }
    entityMap.get(aId)!.relatedIds.push(bId)
    if (!entityMap.has(bId)) {
      entityMap.set(bId, { id: bId, label: bLabel, relatedIds: [aId], entityType: bType })
    } else {
      const b = entityMap.get(bId)!
      if (!b.relatedIds.includes(aId)) b.relatedIds.push(aId)
      if (bType && !b.entityType) b.entityType = bType
    }
  }
  return entityMap
}

// Type hints: [aType, bType] per subquery, in same order as subquery arrays
const MOVIES_TYPES: [string, string][] = [
  ['film', 'person'],   // film → director
  ['film', 'person'],   // film → cast
  ['film', 'company'],  // film → studio
]
const SPORT_TYPES: [string, string][] = [
  ['person', 'team'],   // athlete → team
  ['person', 'team'],   // coach → team
  ['team', 'city'],     // team → city
]
// For single-query domains, type hint applied to all rows
const SINGLE_QUERY_TYPES: Partial<Record<WikidataDomain, [string, string]>> = {
  science: ['person', 'other'],  // scientist → institution/field
  history: ['person', 'other'],  // politician → party/position
}

export async function fetchEntities(domain: WikidataDomain, limit = 300): Promise<Entity[]> {
  const subqueries =
    domain === 'movies'     ? MOVIES_SUBQUERIES     :
    domain === 'sport'      ? SPORT_SUBQUERIES      :
    domain === 'music'      ? MUSIC_SUBQUERIES      :
    domain === 'videogames' ? VIDEOGAMES_SUBQUERIES :
    domain === 'art'        ? ART_SUBQUERIES        :
    domain === 'literature' ? LITERATURE_SUBQUERIES :
    domain === 'geography'  ? GEOGRAPHY_SUBQUERIES  :
    domain === 'royals'     ? ROYALS_SUBQUERIES     :
    domain === 'tennis'     ? TENNIS_SUBQUERIES     :
    domain === 'soccer'     ? SOCCER_SUBQUERIES     :
    domain === 'tv'         ? TV_SUBQUERIES         :
    domain === 'philosophy' ? PHILOSOPHY_SUBQUERIES :
    domain === 'military'   ? MILITARY_SUBQUERIES   :
    domain === 'mythology'  ? MYTHOLOGY_SUBQUERIES  :
    domain === 'space'      ? SPACE_SUBQUERIES      :
    domain === 'food'       ? FOOD_SUBQUERIES       : null
  const typeHints =
    domain === 'movies'     ? MOVIES_TYPES     :
    domain === 'sport'      ? SPORT_TYPES      :
    domain === 'music'      ? MUSIC_TYPES      :
    domain === 'videogames' ? VIDEOGAMES_TYPES :
    domain === 'art'        ? ART_TYPES        :
    domain === 'literature' ? LITERATURE_TYPES :
    domain === 'geography'  ? GEOGRAPHY_TYPES  :
    domain === 'royals'     ? ROYALS_TYPES     :
    domain === 'tennis'     ? TENNIS_TYPES     :
    domain === 'soccer'     ? SOCCER_TYPES     :
    domain === 'tv'         ? TV_TYPES         :
    domain === 'philosophy' ? PHILOSOPHY_TYPES :
    domain === 'military'   ? MILITARY_TYPES   :
    domain === 'mythology'  ? MYTHOLOGY_TYPES  :
    domain === 'space'      ? SPACE_TYPES      :
    domain === 'food'       ? FOOD_TYPES       : null

  if (subqueries && typeHints) {
    const perQuery = Math.ceil(limit / subqueries.length)
    console.log(`  [${domain}] fetching ${subqueries.length} subqueries in parallel (limit ${perQuery} each)...`)
    const results = await Promise.all(
      subqueries.map((q, i) => runSparqlQuery(q(perQuery)).then(bindings => ({ bindings, i })))
    )
    const entityMap = new Map<string, Entity>()
    for (const { bindings, i } of results) {
      bindingsToEntityMap(bindings, entityMap, typeHints[i][0], typeHints[i][1])
    }
    return Array.from(entityMap.values())
  }

  const query = DOMAIN_QUERIES[domain](limit)
  const bindings = await runSparqlQuery(query)
  const [aType, bType] = SINGLE_QUERY_TYPES[domain] ?? [undefined, undefined]
  return Array.from(bindingsToEntityMap(bindings, undefined, aType, bType).values())
}

export async function fetchMovieEntities(limit = 200): Promise<Entity[]> {
  return fetchEntities('movies', limit)
}

