import { Entity } from './graphBuilder'

// Comic Vine API — free for commercial use with attribution
// https://comicvine.gamespot.com/api/
const CV_BASE = 'https://comicvine.gamespot.com/api'
const API_KEY = process.env.COMICVINE_API_KEY!

const CV_HEADERS = {
  'User-Agent': 'RabbitHoleGame/1.0 (puzzle-generator; contact@rabbithole.game)',
  'Accept': 'application/json',
}

// Curated seed teams — famous enough that all their members are recognizable
// Fetching by team is far more efficient than scanning 167k characters
const SEED_TEAM_IDS = [
  31815, // Justice League of America (DC, 487 members)
  6992,  // Green Lantern Corps (DC, 452 members)
  3806,  // Avengers (Marvel, 254 members)
  3173,  // X-Men (Marvel, 300 members)
  3804,  // Fantastic Four (Marvel, 52 members)
  3775,  // S.H.I.E.L.D. (Marvel, 421 members)
  3480,  // HYDRA (Marvel, 205 members)
  9591,  // League of Assassins (DC, 94 members)
  26208, // Justice League International (DC, 105 members)
  15595, // X-Force (Marvel, 63 members)
  14616, // Alpha Flight (Marvel, 72 members)
  5704,  // Outsiders (DC, 66 members)
  13344, // Eternals (Marvel, 78 members)
  13357, // Hellfire Club (Marvel, 106 members)
]

const DELAY_MS = 1000 // Comic Vine recommends ~1 req/sec

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

async function cvFetch<T>(path: string, params: Record<string, string> = {}): Promise<T | null> {
  const url = new URL(`${CV_BASE}/${path}/`)
  url.searchParams.set('api_key', API_KEY)
  url.searchParams.set('format', 'json')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url.toString(), { headers: CV_HEADERS })
      if (res.status === 420 || res.status === 429) {
        await sleep(attempt * 5000)
        continue
      }
      if (!res.ok) return null
      const data = await res.json() as { status_code: number; results: T }
      if (data.status_code !== 1) return null
      return data.results
    } catch {
      if (attempt < 3) await sleep(attempt * 1000)
    }
  }
  return null
}

interface CVCharacter {
  id: number
  name: string
  count_of_issue_appearances: number
  publisher?: { id: number; name: string } | null
  teams?: Array<{ id: number; name: string }>
  creators?: Array<{ id: number; name: string }>
}

interface CVTeam {
  id: number
  name: string
  count_of_team_members: number
  publisher?: { id: number; name: string } | null
  characters?: Array<{ id: number; name: string }>
}

export async function fetchComicVineEntities(limit = 500): Promise<Entity[]> {
  if (!API_KEY) throw new Error('COMICVINE_API_KEY not set in environment')

  const entityMap = new Map<string, Entity>()

  // Step 1: fetch each seed team + its members
  console.log(`  [comics] fetching ${SEED_TEAM_IDS.length} seed teams...`)
  const allCharacterIds = new Set<number>()

  for (const teamId of SEED_TEAM_IDS) {
    await sleep(DELAY_MS)
    const team = await cvFetch<CVTeam>(`team/4060-${teamId}`, {
      field_list: 'id,name,publisher,characters',
    })
    if (!team) continue

    const teamEntityId = `cv_team_${teamId}`
    const publisherName = team.publisher?.name ?? 'Unknown'
    const publisherEntityId = `cv_pub_${team.publisher?.id ?? 0}`

    // Add team entity
    if (!entityMap.has(teamEntityId)) {
      entityMap.set(teamEntityId, {
        id: teamEntityId,
        label: team.name,
        relatedIds: [],
        entityType: 'team',
      })
    }

    // Add publisher entity
    if (team.publisher && !entityMap.has(publisherEntityId)) {
      entityMap.set(publisherEntityId, {
        id: publisherEntityId,
        label: publisherName,
        relatedIds: [],
        entityType: 'publisher',
      })
    }

    // Link team → publisher
    if (team.publisher) {
      const teamEntity = entityMap.get(teamEntityId)!
      if (!teamEntity.relatedIds.includes(publisherEntityId)) teamEntity.relatedIds.push(publisherEntityId)
      const pubEntity = entityMap.get(publisherEntityId)!
      if (!pubEntity.relatedIds.includes(teamEntityId)) pubEntity.relatedIds.push(teamEntityId)
    }

    // Collect character IDs for detail fetch
    for (const char of team.characters ?? []) {
      allCharacterIds.add(char.id)
    }

    console.log(`  [comics] team "${team.name}" — ${team.characters?.length ?? 0} members`)
  }

  // Step 2: fetch individual character details (appearances, creator, publisher)
  // Cap at limit to avoid huge fetches
  const charIds = Array.from(allCharacterIds).slice(0, limit)
  console.log(`  [comics] fetching details for ${charIds.length} characters...`)

  let fetched = 0
  for (const charId of charIds) {
    await sleep(DELAY_MS)
    const char = await cvFetch<CVCharacter>(`character/4005-${charId}`, {
      field_list: 'id,name,count_of_issue_appearances,publisher,teams,creators',
    })
    if (!char || char.count_of_issue_appearances < 10) continue

    const charEntityId = `cv_char_${charId}`
    const appearances = char.count_of_issue_appearances

    // Add character entity (appearances as sitelinks proxy)
    entityMap.set(charEntityId, {
      id: charEntityId,
      label: char.name,
      relatedIds: [],
      sitelinks: Math.round(appearances / 10), // normalize: 1000 appearances ≈ 100 sitelinks
      entityType: 'character',
    })

    const charEntity = entityMap.get(charEntityId)!

    // Link character → teams
    for (const team of char.teams ?? []) {
      const teamEntityId = `cv_team_${team.id}`
      if (!entityMap.has(teamEntityId)) {
        entityMap.set(teamEntityId, { id: teamEntityId, label: team.name, relatedIds: [], entityType: 'team' })
      }
      if (!charEntity.relatedIds.includes(teamEntityId)) charEntity.relatedIds.push(teamEntityId)
      const teamEntity = entityMap.get(teamEntityId)!
      if (!teamEntity.relatedIds.includes(charEntityId)) teamEntity.relatedIds.push(charEntityId)
    }

    // Link character → publisher
    if (char.publisher) {
      const pubEntityId = `cv_pub_${char.publisher.id}`
      if (!entityMap.has(pubEntityId)) {
        entityMap.set(pubEntityId, { id: pubEntityId, label: char.publisher.name, relatedIds: [], entityType: 'publisher' })
      }
      if (!charEntity.relatedIds.includes(pubEntityId)) charEntity.relatedIds.push(pubEntityId)
      const pubEntity = entityMap.get(pubEntityId)!
      if (!pubEntity.relatedIds.includes(charEntityId)) pubEntity.relatedIds.push(charEntityId)
    }

    // Link character → creators
    for (const creator of char.creators ?? []) {
      const creatorEntityId = `cv_creator_${creator.id}`
      if (!entityMap.has(creatorEntityId)) {
        entityMap.set(creatorEntityId, { id: creatorEntityId, label: creator.name, relatedIds: [], entityType: 'person' })
      }
      if (!charEntity.relatedIds.includes(creatorEntityId)) charEntity.relatedIds.push(creatorEntityId)
      const creatorEntity = entityMap.get(creatorEntityId)!
      if (!creatorEntity.relatedIds.includes(charEntityId)) creatorEntity.relatedIds.push(charEntityId)
    }

    fetched++
    if (fetched % 20 === 0) {
      process.stdout.write(`\r  [comics] ${fetched}/${charIds.length} characters fetched`)
    }
  }

  console.log(`\n  [comics] built graph: ${entityMap.size} total entities`)
  return Array.from(entityMap.values()).filter(e => e.relatedIds.length > 0)
}
