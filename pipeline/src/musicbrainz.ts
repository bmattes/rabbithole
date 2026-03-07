import { Entity } from './graphBuilder'

// MusicBrainz API — CC0, no auth required, 1 req/sec rate limit
const MB_BASE = 'https://musicbrainz.org/ws/2'
const MB_HEADERS = {
  'User-Agent': 'RabbitHoleGame/1.0 (puzzle-generator; contact@rabbithole.game)',
  'Accept': 'application/json',
}

// Genre tags to query per domain
export type MusicBrainzDomain = 'mb_rock' | 'mb_hiphop' | 'mb_pop' | 'mb_rnb' | 'mb_country' | 'mb_electronic'

const DOMAIN_TAGS: Record<MusicBrainzDomain, string[]> = {
  mb_rock:       ['rock', 'classic rock', 'alternative rock', 'indie rock', 'hard rock', 'punk'],
  mb_hiphop:     ['hip-hop', 'hip hop', 'rap', 'trap', 'drill', 'gangsta rap'],
  mb_pop:        ['pop', 'dance-pop', 'electropop', 'synth-pop', 'teen pop'],
  mb_rnb:        ['r&b', 'soul', 'rhythm and blues', 'neo soul', 'motown'],
  mb_country:    ['country', 'country pop', 'bluegrass', 'americana', 'outlaw country'],
  mb_electronic: ['electronic', 'edm', 'house', 'techno', 'trance', 'drum and bass'],
}

const DELAY_MS = 1100 // MusicBrainz: 1 req/sec without auth

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

async function mbFetch<T>(path: string, params: Record<string, string> = {}): Promise<T | null> {
  const url = new URL(`${MB_BASE}/${path}`)
  url.searchParams.set('fmt', 'json')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url.toString(), { headers: MB_HEADERS })
      if (res.status === 503) {
        await sleep(attempt * 2000)
        continue
      }
      if (!res.ok) return null
      return await res.json() as T
    } catch {
      if (attempt < 3) await sleep(attempt * 1000)
    }
  }
  return null
}

interface MBArtist {
  id: string
  name: string
  type?: string
  score?: number
  tags?: Array<{ name: string; count: number }>
  relations?: Array<{
    type: string
    artist?: { id: string; name: string }
    label?: { id: string; name: string }
  }>
}

async function fetchTopArtistsForTag(tag: string, limit: number): Promise<MBArtist[]> {
  // Use lucene search to find highly-tagged artists
  const data = await mbFetch<{ artists: MBArtist[]; count: number }>('artist', {
    query: `tag:${JSON.stringify(tag)} AND (type:person OR type:group)`,
    limit: String(Math.min(limit, 100)),
  })
  return data?.artists ?? []
}

async function fetchArtistRelations(artistId: string): Promise<MBArtist | null> {
  await sleep(DELAY_MS)
  return mbFetch<MBArtist>(`artist/${artistId}`, { inc: 'artist-rels label-rels' })
}

export async function fetchMusicBrainzEntities(
  domain: MusicBrainzDomain,
  limit = 500,
): Promise<Entity[]> {
  const tags = DOMAIN_TAGS[domain]
  const perTag = Math.ceil(limit / tags.length)

  // Step 1: collect top artists across all tags for this domain
  const artistMap = new Map<string, MBArtist>()
  for (const tag of tags) {
    console.log(`  [${domain}] fetching artists for tag "${tag}"...`)
    const artists = await fetchTopArtistsForTag(tag, perTag)
    for (const a of artists) {
      if (!artistMap.has(a.id)) artistMap.set(a.id, a)
    }
    await sleep(DELAY_MS)
  }

  console.log(`  [${domain}] fetched ${artistMap.size} unique artists, now fetching relations...`)

  // Step 2: for each artist, fetch label + band relations
  const entityMap = new Map<string, Entity>()

  // Add all artists as entities first
  for (const [id, artist] of artistMap) {
    entityMap.set(id, {
      id,
      label: artist.name,
      relatedIds: [],
      entityType: artist.type === 'Group' ? 'band' : 'person',
    })
  }

  // Fetch relations in batches — 1 req/sec
  let processed = 0
  for (const [artistId] of artistMap) {
    const full = await fetchArtistRelations(artistId)
    if (!full?.relations) continue

    const entity = entityMap.get(artistId)!

    for (const rel of full.relations) {
      // Band membership: artist ↔ band
      if (rel.type === 'member of band' && rel.artist) {
        const bandId = rel.artist.id
        const bandName = rel.artist.name
        if (!entityMap.has(bandId)) {
          entityMap.set(bandId, { id: bandId, label: bandName, relatedIds: [], entityType: 'band' })
        }
        if (!entity.relatedIds.includes(bandId)) entity.relatedIds.push(bandId)
        const band = entityMap.get(bandId)!
        if (!band.relatedIds.includes(artistId)) band.relatedIds.push(artistId)
      }

      // Record label: artist ↔ label
      if (rel.type === 'recording contract' && rel.label) {
        const labelId = `mb_label_${rel.label.id}`
        const labelName = rel.label.name
        if (!entityMap.has(labelId)) {
          entityMap.set(labelId, { id: labelId, label: labelName, relatedIds: [], entityType: 'label' })
        }
        if (!entity.relatedIds.includes(labelId)) entity.relatedIds.push(labelId)
        const labelEntity = entityMap.get(labelId)!
        if (!labelEntity.relatedIds.includes(artistId)) labelEntity.relatedIds.push(artistId)
      }

      // Collaboration: artist ↔ artist (influenced by, supporting musician, etc.)
      if (['supporting musician', 'instrumental supporting musician', 'involved with'].includes(rel.type) && rel.artist) {
        const otherId = rel.artist.id
        const otherName = rel.artist.name
        if (!entityMap.has(otherId)) {
          entityMap.set(otherId, { id: otherId, label: otherName, relatedIds: [], entityType: 'person' })
        }
        if (!entity.relatedIds.includes(otherId)) entity.relatedIds.push(otherId)
        const other = entityMap.get(otherId)!
        if (!other.relatedIds.includes(artistId)) other.relatedIds.push(artistId)
      }
    }

    processed++
    if (processed % 10 === 0) {
      process.stdout.write(`\r  [${domain}] relations: ${processed}/${artistMap.size}`)
    }
  }

  console.log(`\n  [${domain}] built graph: ${entityMap.size} entities`)

  // Drop entities with no connections (orphans from relation fetches)
  return Array.from(entityMap.values()).filter(e => e.relatedIds.length > 0)
}
