import { Entity } from './graphBuilder'

const WIKIDATA_ENDPOINT = 'https://query.wikidata.org/sparql'

export type CategoryDomain = 'movies' | 'sport' | 'music' | 'science' | 'history'

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

// Each domain query returns pairs of (primary entity, related entity)
const DOMAIN_QUERIES: Record<CategoryDomain, (limit: number) => string> = {
  // placeholder — uses subqueries instead
  movies: (_limit) => '',
  sport: (_limit) => '',
  music: (_limit) => '',

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
const SINGLE_QUERY_TYPES: Partial<Record<CategoryDomain, [string, string]>> = {
  science: ['person', 'other'],  // scientist → institution/field
  history: ['person', 'other'],  // politician → party/position
}

export async function fetchEntities(domain: CategoryDomain, limit = 300): Promise<Entity[]> {
  const subqueries =
    domain === 'movies' ? MOVIES_SUBQUERIES :
    domain === 'sport'  ? SPORT_SUBQUERIES  :
    domain === 'music'  ? MUSIC_SUBQUERIES  : null
  const typeHints =
    domain === 'movies' ? MOVIES_TYPES :
    domain === 'sport'  ? SPORT_TYPES  :
    domain === 'music'  ? MUSIC_TYPES  : null

  if (subqueries && typeHints) {
    const perQuery = Math.ceil(limit / subqueries.length)
    const entityMap = new Map<string, Entity>()
    for (let i = 0; i < subqueries.length; i++) {
      console.log(`  [${domain}] fetching subquery ${i + 1}/${subqueries.length} (limit ${perQuery})...`)
      const bindings = await runSparqlQuery(subqueries[i](perQuery))
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
