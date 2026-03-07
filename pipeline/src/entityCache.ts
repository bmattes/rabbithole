import * as fs from 'fs'
import * as path from 'path'
import { Entity } from './graphBuilder'
import { fetchEntities, CategoryDomain, WikidataDomain } from './wikidata'
import { fetchMusicBrainzEntities, MusicBrainzDomain } from './musicbrainz'
import { enrichWithPageviews } from './pageviewEnricher'

const CACHE_DIR = path.join(__dirname, '../../.entity-cache')
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

interface CacheEntry {
  fetchedAt: number
  domain: CategoryDomain
  entities: Entity[]
}

function cachePath(domain: CategoryDomain): string {
  return path.join(CACHE_DIR, `${domain}.json`)
}

function readCache(domain: CategoryDomain): CacheEntry | null {
  const file = cachePath(domain)
  if (!fs.existsSync(file)) return null
  try {
    const entry = JSON.parse(fs.readFileSync(file, 'utf8')) as CacheEntry
    if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) return null
    return entry
  } catch {
    return null
  }
}

function writeCache(domain: CategoryDomain, entities: Entity[]): void {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true })
  const entry: CacheEntry = { fetchedAt: Date.now(), domain, entities }
  fs.writeFileSync(cachePath(domain), JSON.stringify(entry))
}

export async function fetchEntitiesCached(
  domain: CategoryDomain,
  limit = 1500,
  { forceRefresh = false } = {}
): Promise<Entity[]> {
  if (!forceRefresh) {
    const cached = readCache(domain)
    if (cached) {
      const ageHours = Math.round((Date.now() - cached.fetchedAt) / 3600000)
      console.log(`  [${domain}] using cached entities (${cached.entities.length} entities, ${ageHours}h old)`)
      return cached.entities
    }
  }

  const isMusicBrainz = (domain as string).startsWith('mb_')
  const entities = isMusicBrainz
    ? await fetchMusicBrainzEntities(domain as MusicBrainzDomain, limit)
    : await fetchEntities(domain as WikidataDomain, limit)

  if (!isMusicBrainz) {
    // MusicBrainz entities have non-Wikidata IDs — pageview enrichment only applies to Wikidata QIDs
    await enrichWithPageviews(entities)
  }

  writeCache(domain, entities)
  return entities
}
