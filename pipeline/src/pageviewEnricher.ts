import { Entity } from './graphBuilder'

// Wikipedia Pageviews API — CC0, no auth required
// Returns average monthly views over the past 3 months for an article title
const PAGEVIEWS_BASE = 'https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/all-agents'

// Wikidata entity → Wikipedia article title via sitelinks API
const WIKIDATA_LABELS_BASE = 'https://www.wikidata.org/w/api.php'

const BATCH_SIZE = 50
const BATCH_DELAY_MS = 500

async function fetchWikipediaTitles(wikidataIds: string[]): Promise<Map<string, string>> {
  // Wikidata API: get enwiki sitelink for each QID in one request (up to 50 IDs)
  const params = new URLSearchParams({
    action: 'wbgetentities',
    ids: wikidataIds.join('|'),
    props: 'sitelinks',
    sitefilter: 'enwiki',
    format: 'json',
    formatversion: '2',
  })
  const url = `${WIKIDATA_LABELS_BASE}?${params}`
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'RabbitHoleGame/1.0 (puzzle-generator; contact@rabbithole.game)' }
    })
    if (!res.ok) return new Map()
    const data = await res.json() as {
      entities: Record<string, { sitelinks?: { enwiki?: { title: string } } }>
    }
    const map = new Map<string, string>()
    for (const [id, entity] of Object.entries(data.entities)) {
      const title = entity.sitelinks?.enwiki?.title
      if (title) map.set(id, title)
    }
    return map
  } catch {
    return new Map()
  }
}

async function fetchPageviewsForTitle(title: string): Promise<number | undefined> {
  // Get monthly pageviews for the last 3 full months, return average
  const now = new Date()
  const end = new Date(now.getFullYear(), now.getMonth(), 1) // first of current month
  const start = new Date(end.getFullYear(), end.getMonth() - 3, 1) // 3 months back

  const fmt = (d: Date) =>
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}01`

  const encodedTitle = encodeURIComponent(title.replace(/ /g, '_'))
  const url = `${PAGEVIEWS_BASE}/${encodedTitle}/monthly/${fmt(start)}/${fmt(end)}`

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'RabbitHoleGame/1.0 (puzzle-generator; contact@rabbithole.game)' }
    })
    if (!res.ok) return undefined
    const data = await res.json() as { items: Array<{ views: number }> }
    if (!data.items?.length) return undefined
    const total = data.items.reduce((sum, item) => sum + item.views, 0)
    return Math.round(total / data.items.length)
  } catch {
    return undefined
  }
}

export async function enrichWithPageviews(entities: Entity[]): Promise<void> {
  console.log(`  Enriching ${entities.length} entities with Wikipedia pageviews...`)

  // Only enrich entities that have Wikidata QIDs (Q-prefixed IDs)
  const wikidataEntities = entities.filter(e => /^Q\d+$/.test(e.id))
  const total = wikidataEntities.length
  let enriched = 0

  for (let i = 0; i < wikidataEntities.length; i += BATCH_SIZE) {
    const batch = wikidataEntities.slice(i, i + BATCH_SIZE)
    const ids = batch.map(e => e.id)

    // Step 1: get Wikipedia article titles for this batch
    const titleMap = await fetchWikipediaTitles(ids)

    // Step 2: fetch pageviews for each title (parallel within batch)
    await Promise.all(
      batch.map(async (entity) => {
        const title = titleMap.get(entity.id)
        if (!title) return
        const views = await fetchPageviewsForTitle(title)
        if (views !== undefined) {
          entity.pageviews = views
          enriched++
        }
      })
    )

    const pct = Math.round(((i + batch.length) / total) * 100)
    process.stdout.write(`\r  Pageview enrichment: ${pct}% (${enriched} enriched)`)

    if (i + BATCH_SIZE < wikidataEntities.length) {
      await new Promise(r => setTimeout(r, BATCH_DELAY_MS))
    }
  }

  console.log(`\n  Pageview enrichment complete: ${enriched}/${total} entities enriched`)
}
