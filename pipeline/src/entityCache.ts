import * as fs from 'fs'
import * as path from 'path'
import { Entity } from './graphBuilder'
import { fetchEntities, CategoryDomain, WikidataDomain, SubqueryDifficulty } from './wikidata'
import { fetchMusicBrainzEntities, MusicBrainzDomain } from './musicbrainz'
import { enrichWithPageviews } from './pageviewEnricher'

const CACHE_DIR = path.join(__dirname, '../../.entity-cache')
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

interface CacheEntry {
  fetchedAt: number
  domain: CategoryDomain
  entities: Entity[]
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

function writeCache(domain: CategoryDomain, entities: Entity[], difficulty?: SubqueryDifficulty): void {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true })
  const entry: CacheEntry = { fetchedAt: Date.now(), domain, entities }
  fs.writeFileSync(cachePath(domain, difficulty), JSON.stringify(entry))
}

export async function fetchEntitiesCached(
  domain: CategoryDomain,
  limit = 1500,
  { forceRefresh = false, maxDifficulty }: { forceRefresh?: boolean; maxDifficulty?: SubqueryDifficulty } = {}
): Promise<Entity[]> {
  const isMusicBrainz = (domain as string).startsWith('mb_')
  // MusicBrainz domains don't use difficulty-based subqueries
  const diffKey = isMusicBrainz ? undefined : maxDifficulty

  if (!forceRefresh) {
    const cached = readCache(domain, diffKey)
    if (cached) {
      const ageHours = Math.round((Date.now() - cached.fetchedAt) / 3600000)
      console.log(`  [${domain}${diffKey ? `/${diffKey}` : ''}] using cached entities (${cached.entities.length} entities, ${ageHours}h old)`)
      return cached.entities
    }
  }

  const entities = isMusicBrainz
    ? await fetchMusicBrainzEntities(domain as MusicBrainzDomain, limit)
    : await fetchEntities(domain as WikidataDomain, limit, maxDifficulty)

  if (!isMusicBrainz) {
    await enrichWithPageviews(entities)
  }

  writeCache(domain, entities, diffKey)
  return entities
}
