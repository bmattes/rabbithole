import { Entity } from './graphBuilder'

const WIKIDATA_ENDPOINT = 'https://query.wikidata.org/sparql'

const MOVIES_QUERY = (limit: number) => `
SELECT ?film ?filmLabel ?related ?relatedLabel WHERE {
  ?film wdt:P31 wd:Q11424.
  ?film wdt:P57|wdt:P161 ?related.
  ?film wikibase:sitelinks ?links.
  FILTER(?links > 500)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
ORDER BY DESC(?links)
LIMIT ${limit}
`

function extractId(uri: string): string {
  return uri.split('/').pop()!
}

export async function fetchMovieEntities(limit = 200): Promise<Entity[]> {
  const url = `${WIKIDATA_ENDPOINT}?query=${encodeURIComponent(MOVIES_QUERY(limit))}&format=json`
  const response = await fetch(url, {
    headers: { 'User-Agent': 'RabbitHoleGame/1.0 (puzzle-generator)' }
  })
  const data = await response.json() as {
    results: { bindings: Array<Record<string, { value: string }>> }
  }

  const entityMap = new Map<string, Entity>()

  for (const binding of data.results.bindings) {
    const filmId = extractId(binding.film.value)
    const filmLabel = binding.filmLabel.value
    const relatedId = extractId(binding.related.value)

    if (!entityMap.has(filmId)) {
      entityMap.set(filmId, { id: filmId, label: filmLabel, relatedIds: [] })
    }
    entityMap.get(filmId)!.relatedIds.push(relatedId)

    if (!entityMap.has(relatedId)) {
      entityMap.set(relatedId, {
        id: relatedId,
        label: binding.relatedLabel?.value ?? relatedId,
        relatedIds: [filmId],
      })
    } else {
      const related = entityMap.get(relatedId)!
      if (!related.relatedIds.includes(filmId)) {
        related.relatedIds.push(filmId)
      }
    }
  }

  return Array.from(entityMap.values())
}
