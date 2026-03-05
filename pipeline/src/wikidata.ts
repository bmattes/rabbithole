import { Entity } from './graphBuilder'

const WIKIDATA_ENDPOINT = 'https://query.wikidata.org/sparql'

export type CategoryDomain = 'movies' | 'basketball' | 'music' | 'science' | 'history'

// Each domain query returns pairs of (primary entity, related entity)
const DOMAIN_QUERIES: Record<CategoryDomain, (limit: number) => string> = {
  movies: (limit) => `
SELECT ?a ?aLabel ?b ?bLabel WHERE {
  ?a wdt:P31 wd:Q11424.
  ?a wdt:P57|wdt:P161|wdt:P58 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 300)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`,

  basketball: (limit) => `
SELECT ?a ?aLabel ?b ?bLabel WHERE {
  { ?a wdt:P31 wd:Q5; wdt:P641 wd:Q5372. }  # NBA players
  UNION
  { ?a wdt:P31 wd:Q847017; wdt:P641 wd:Q5372. }  # NBA teams
  ?a wdt:P54|wdt:P1344|wdt:P413|wdt:P18 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 100)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`,

  music: (limit) => `
SELECT ?a ?aLabel ?b ?bLabel WHERE {
  { ?a wdt:P31 wd:Q482994. }  # albums
  UNION
  { ?a wdt:P31 wd:Q5; wdt:P106 wd:Q639669. }  # musicians
  ?a wdt:P175|wdt:P86|wdt:P162|wdt:P136 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 200)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`,

  science: (limit) => `
SELECT ?a ?aLabel ?b ?bLabel WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q901.  # scientists
  ?a wdt:P108|wdt:P69|wdt:P101|wdt:P166 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 150)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`,

  history: (limit) => `
SELECT ?a ?aLabel ?b ?bLabel WHERE {
  ?a wdt:P31 wd:Q198.  # wars
  ?a wdt:P710|wdt:P1344|wdt:P276|wdt:P17 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 200)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`,
}

function extractId(uri: string): string {
  return uri.split('/').pop()!
}

export async function fetchEntities(domain: CategoryDomain, limit = 300): Promise<Entity[]> {
  const query = DOMAIN_QUERIES[domain](limit)
  const url = `${WIKIDATA_ENDPOINT}?query=${encodeURIComponent(query)}&format=json`

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'RabbitHoleGame/1.0 (puzzle-generator; contact@rabbithole.game)',
      'Accept': 'application/sparql-results+json',
    }
  })

  if (!response.ok) {
    throw new Error(`Wikidata query failed: ${response.status} ${response.statusText}`)
  }

  const data = await response.json() as {
    results: { bindings: Array<Record<string, { value: string }>> }
  }

  const entityMap = new Map<string, Entity>()

  for (const binding of data.results.bindings) {
    const aId = extractId(binding.a.value)
    const aLabel = binding.aLabel?.value ?? aId
    const bId = extractId(binding.b.value)
    const bLabel = binding.bLabel?.value ?? bId

    // Skip if labels look like Wikidata IDs (unfilled labels)
    if (aLabel.startsWith('Q') && /^Q\d+$/.test(aLabel)) continue
    if (bLabel.startsWith('Q') && /^Q\d+$/.test(bLabel)) continue

    if (!entityMap.has(aId)) {
      entityMap.set(aId, { id: aId, label: aLabel, relatedIds: [] })
    }
    entityMap.get(aId)!.relatedIds.push(bId)

    if (!entityMap.has(bId)) {
      entityMap.set(bId, { id: bId, label: bLabel, relatedIds: [aId] })
    } else {
      const b = entityMap.get(bId)!
      if (!b.relatedIds.includes(aId)) b.relatedIds.push(aId)
    }
  }

  return Array.from(entityMap.values())
}

// Keep backward compat
export async function fetchMovieEntities(limit = 200): Promise<Entity[]> {
  return fetchEntities('movies', limit)
}
