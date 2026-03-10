import * as fs from 'fs'
import * as path from 'path'
import { Entity } from './graphBuilder'
import { fetchEntities, FetchResult, CategoryDomain, WikidataDomain, SubqueryDifficulty, MB_TO_WIKIDATA } from './wikidata'
import { enrichWithPageviews } from './pageviewEnricher'

const CACHE_DIR = path.join(__dirname, '../../.entity-cache')
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

interface CacheEntry {
  fetchedAt: number
  domain: CategoryDomain
  entities: Entity[]
  edgeLabels: Record<string, string>
}

function cachePath(domain: CategoryDomain, difficulty?: SubqueryDifficulty): string {
  const key = difficulty ? `${domain}-${difficulty}` : domain
  return path.join(CACHE_DIR, `${key}.json`)
}

function readCache(domain: CategoryDomain, difficulty?: SubqueryDifficulty): CacheEntry | null {
  const file = cachePath(domain, difficulty)
  if (!fs.existsSync(file)) return null
  try {
    const entry = JSON.parse(fs.readFileSync(file, 'utf8')) as CacheEntry
    if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) return null
    return entry
  } catch {
    return null
  }
}

function writeCache(domain: CategoryDomain, entities: Entity[], edgeLabels: Record<string, string>, difficulty?: SubqueryDifficulty): void {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true })
  const entry: CacheEntry = { fetchedAt: Date.now(), domain, entities, edgeLabels }
  fs.writeFileSync(cachePath(domain, difficulty), JSON.stringify(entry))
}

export async function fetchEntitiesCached(
  domain: CategoryDomain,
  limit = 1500,
  { forceRefresh = false, maxDifficulty }: { forceRefresh?: boolean; maxDifficulty?: SubqueryDifficulty } = {}
): Promise<FetchResult> {
  // mb_* domains now route through Wikidata using genre-filtered subqueries
  const wikidataDomain: WikidataDomain = MB_TO_WIKIDATA[domain as string] ?? (domain as WikidataDomain)

  if (!forceRefresh) {
    const cached = readCache(domain, maxDifficulty)
    if (cached) {
      const ageHours = Math.round((Date.now() - cached.fetchedAt) / 3600000)
      console.log(`  [${domain}${maxDifficulty ? `/${maxDifficulty}` : ''}] using cached entities (${cached.entities.length} entities, ${ageHours}h old)`)
      return { entities: cached.entities, edgeLabels: cached.edgeLabels ?? {} }
    }
  }

  const result: FetchResult = await fetchEntities(wikidataDomain, limit, maxDifficulty)
  await enrichWithPageviews(result.entities)

  writeCache(domain, result.entities, result.edgeLabels, maxDifficulty)
  return result
}
