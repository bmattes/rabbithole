import { Entity } from './graphBuilder'
export { SubqueryDifficulty, TaggedSubquery } from './wikidataHelpers'

export interface FetchResult {
  entities: Entity[]
  edgeLabels: Record<string, string>  // key: "idA|idB", value: label string
}

const WIKIDATA_ENDPOINT = 'https://query.wikidata.org/sparql'

export type WikidataDomain =
  | 'movies' | 'sport' | 'music' | 'science' | 'history'
  | 'videogames' | 'art' | 'literature' | 'geography' | 'royals'
  | 'tennis' | 'soccer' | 'tv' | 'philosophy' | 'military'
  | 'mythology' | 'space' | 'food' | 'comics'
  | 'basketball' | 'americanfootball'
  | 'rock' | 'hiphop' | 'pop' | 'rnb' | 'country'

// mb_* are kept as CategoryDomain aliases that map to the Wikidata rock/hiphop/etc domains
export type CategoryDomain = WikidataDomain | 'mb_rock' | 'mb_hiphop' | 'mb_pop' | 'mb_rnb' | 'mb_country'

// Maps legacy mb_* domain names (stored in Supabase) to the new Wikidata domain names
export const MB_TO_WIKIDATA: Record<string, WikidataDomain> = {
  mb_rock:    'rock',
  mb_hiphop:  'hiphop',
  mb_pop:     'pop',
  mb_rnb:     'rnb',
  mb_country: 'country',
}

import { SubqueryDifficulty, TaggedSubquery } from './wikidataHelpers'
import { SPORT_SUBQUERIES } from './domains/sport'
import { MOVIES_SUBQUERIES } from './domains/movies'
import { MUSIC_SUBQUERIES } from './domains/music'
import { ROCK_SUBQUERIES } from './domains/rock'
import { HIPHOP_SUBQUERIES } from './domains/hiphop'
import { POP_SUBQUERIES } from './domains/pop'
import { RNB_SUBQUERIES } from './domains/rnb'
import { COUNTRY_SUBQUERIES } from './domains/country'
import { VIDEOGAMES_SUBQUERIES } from './domains/videogames'
import { ART_SUBQUERIES } from './domains/art'
import { LITERATURE_SUBQUERIES } from './domains/literature'
import { GEOGRAPHY_SUBQUERIES } from './domains/geography'
import { ROYALS_SUBQUERIES } from './domains/royals'
import { TENNIS_SUBQUERIES } from './domains/tennis'
import { SOCCER_SUBQUERIES } from './domains/soccer'
import { TV_SUBQUERIES } from './domains/tv'
import { PHILOSOPHY_SUBQUERIES } from './domains/philosophy'
import { MILITARY_SUBQUERIES } from './domains/military'
import { MYTHOLOGY_SUBQUERIES } from './domains/mythology'
import { SPACE_SUBQUERIES } from './domains/space'
import { FOOD_SUBQUERIES } from './domains/food'
import { COMICS_SUBQUERIES } from './domains/comics'
import { BASKETBALL_SUBQUERIES } from './domains/basketball'
import { AMERICANFOOTBALL_SUBQUERIES } from './domains/americanfootball'
import { HISTORY_SUBQUERIES } from './domains/history'
import { SCIENCE_SUBQUERIES } from './domains/science'

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
    const bSitelinks = binding.blinks ? parseInt(binding.blinks.value) : undefined
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
      entityMap.set(bId, { id: bId, label: bLabel, relatedIds: [aId], sitelinks: bSitelinks, entityType: bType })
    } else {
      const b = entityMap.get(bId)!
      if (!b.relatedIds.includes(aId)) b.relatedIds.push(aId)
      if (bType && !b.entityType) b.entityType = bType
      if (bSitelinks !== undefined && (!b.sitelinks || bSitelinks > b.sitelinks)) b.sitelinks = bSitelinks
    }
  }
  return entityMap
}

const SINGLE_QUERY_TYPES: Partial<Record<WikidataDomain, [string, string]>> = {}

const DIFFICULTY_ORDER: SubqueryDifficulty[] = ['easy', 'medium', 'hard']

const SUBQUERY_MAP: Partial<Record<WikidataDomain, TaggedSubquery[]>> = {
  movies:           MOVIES_SUBQUERIES,
  sport:            SPORT_SUBQUERIES,
  music:            MUSIC_SUBQUERIES,
  videogames:       VIDEOGAMES_SUBQUERIES,
  art:              ART_SUBQUERIES,
  literature:       LITERATURE_SUBQUERIES,
  geography:        GEOGRAPHY_SUBQUERIES,
  royals:           ROYALS_SUBQUERIES,
  tennis:           TENNIS_SUBQUERIES,
  soccer:           SOCCER_SUBQUERIES,
  tv:               TV_SUBQUERIES,
  philosophy:       PHILOSOPHY_SUBQUERIES,
  military:         MILITARY_SUBQUERIES,
  mythology:        MYTHOLOGY_SUBQUERIES,
  space:            SPACE_SUBQUERIES,
  food:             FOOD_SUBQUERIES,
  comics:           COMICS_SUBQUERIES,
  basketball:       BASKETBALL_SUBQUERIES,
  americanfootball: AMERICANFOOTBALL_SUBQUERIES,
  history:          HISTORY_SUBQUERIES,
  science:          SCIENCE_SUBQUERIES,
  rock:             ROCK_SUBQUERIES,
  hiphop:           HIPHOP_SUBQUERIES,
  pop:              POP_SUBQUERIES,
  rnb:              RNB_SUBQUERIES,
  country:          COUNTRY_SUBQUERIES,
}

// All domains now use subquery maps; DOMAIN_QUERIES is kept as a stub for compatibility
const DOMAIN_QUERIES: Record<WikidataDomain, (limit: number) => string> = {
  movies: (_limit) => '', sport: (_limit) => '', music: (_limit) => '',
  videogames: (_limit) => '', art: (_limit) => '', literature: (_limit) => '',
  geography: (_limit) => '', royals: (_limit) => '', tennis: (_limit) => '',
  soccer: (_limit) => '', tv: (_limit) => '', philosophy: (_limit) => '',
  military: (_limit) => '', mythology: (_limit) => '', space: (_limit) => '',
  food: (_limit) => '', comics: (_limit) => '', basketball: (_limit) => '',
  americanfootball: (_limit) => '', science: (_limit) => '', history: (_limit) => '',
  rock: (_limit) => '', hiphop: (_limit) => '', pop: (_limit) => '',
  rnb: (_limit) => '', country: (_limit) => '',
}

export async function fetchEntities(
  domain: WikidataDomain,
  limit = 300,
  maxDifficulty: SubqueryDifficulty = 'hard',
): Promise<FetchResult> {
  const allSubqueries = SUBQUERY_MAP[domain]

  if (allSubqueries) {
    const maxIdx = DIFFICULTY_ORDER.indexOf(maxDifficulty)
    const subqueries = allSubqueries.filter(sq => DIFFICULTY_ORDER.indexOf(sq.difficulty) <= maxIdx)
    const perQuery = Math.ceil(limit / subqueries.length)
    console.log(`  [${domain}/${maxDifficulty}] fetching ${subqueries.length} subqueries in parallel (limit ${perQuery} each)...`)
    const results = await Promise.all(
      subqueries.map(tsq => runSparqlQuery(tsq.query(perQuery)).then(bindings => ({ bindings, tsq })))
    )
    const entityMap = new Map<string, Entity>()
    const edgeLabels: Record<string, string> = {}
    for (const { bindings, tsq } of results) {
      bindingsToEntityMap(bindings, entityMap, tsq.types[0], tsq.types[1])
      if (tsq.edgeLabel) {
        for (const binding of bindings) {
          const aId = extractId(binding.a.value)
          const bId = extractId(binding.b.value)
          edgeLabels[`${aId}|${bId}`] = tsq.edgeLabel
          edgeLabels[`${bId}|${aId}`] = tsq.edgeLabel
        }
      }
    }
    return { entities: Array.from(entityMap.values()), edgeLabels }
  }

  const query = DOMAIN_QUERIES[domain](limit)
  const bindings = await runSparqlQuery(query)
  const [aType, bType] = SINGLE_QUERY_TYPES[domain] ?? [undefined, undefined]
  return { entities: Array.from(bindingsToEntityMap(bindings, undefined, aType, bType).values()), edgeLabels: {} }
}

export async function fetchMovieEntities(limit = 200): Promise<FetchResult> {
  return fetchEntities('movies', limit)
}
