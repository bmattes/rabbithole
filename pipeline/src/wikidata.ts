import { Entity } from './graphBuilder'

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

export type CategoryDomain = WikidataDomain | 'mb_rock' | 'mb_hiphop' | 'mb_pop' | 'mb_rnb' | 'mb_country'

// Sport uses multiple focused queries to avoid Wikidata timeouts
const SPORT_SUBQUERIES: TaggedSubquery[] = [
  // Athlete → team (easy)
  sq('easy', ['person', 'team'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P641 []; wdt:P54 ?b.
  ?b wdt:P31 wd:Q476028.
  ?a wikibase:sitelinks ?links. FILTER(?links > 20)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'played for'),
  // Sports team → location (medium)
  sq('medium', ['team', 'city'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q476028; wdt:P131 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 15)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'based in'),
  // Coach → team (hard: less well-known)
  sq('hard', ['person', 'team'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q31729; wdt:P6087 ?b.
  ?b wdt:P31 wd:Q476028.
  ?a wikibase:sitelinks ?links. FILTER(?links > 15)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'coached'),
]
// NOTE: "team → sport" subquery removed — sport-category nodes (Chess, Volleyball) make
// poor start/end points and produce trivially-obvious connections ("both are competitive sports")

export type SubqueryDifficulty = 'easy' | 'medium' | 'hard'
export interface TaggedSubquery {
  difficulty: SubqueryDifficulty
  query: (limit: number) => string
  types: [string, string]
  edgeLabel?: string
}

function sq(difficulty: SubqueryDifficulty, types: [string, string], query: (limit: number) => string, edgeLabel?: string): TaggedSubquery {
  return { difficulty, types, query, edgeLabel }
}

// Movies uses multiple focused queries merged together instead of one large join
const MOVIES_SUBQUERIES: TaggedSubquery[] = [
  // Film → cast member (easy: obvious, star-driven)
  sq('easy', ['film', 'person'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?type { wd:Q11424 wd:Q506240 }
  ?a wdt:P31 ?type; wdt:P161 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 30)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'cast member of'),
  // Film → director (medium: one step removed from cast)
  sq('medium', ['film', 'person'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?type { wd:Q11424 wd:Q506240 }
  ?a wdt:P31 ?type; wdt:P57 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 30)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'directed by'),
  // Film → production company (hard: obscure studio links like MGM/Hobbit)
  sq('hard', ['film', 'company'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?type { wd:Q11424 wd:Q506240 }
  ?a wdt:P31 ?type; wdt:P272 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 30)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'produced by'),
  // Film → genre (medium: connects films across eras via shared genre — "both are westerns")
  sq('medium', ['film', 'genre'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  VALUES ?type { wd:Q11424 wd:Q506240 }
  ?a wdt:P31 ?type; wdt:P136 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 30)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 20)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'belongs to genre'),
  // Film → narrative setting (hard: connects films set in same real-world location)
  sq('hard', ['film', 'location'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  VALUES ?type { wd:Q11424 wd:Q506240 }
  ?a wdt:P31 ?type; wdt:P840 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 30)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 30)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'set in'),
  // Film → award (hard: Oscars, Palme d'Or — connects prestige films)
  sq('hard', ['film', 'other'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  VALUES ?type { wd:Q11424 wd:Q506240 }
  VALUES ?b { wd:Q19020 wd:Q41417 wd:Q38400 wd:Q185498 wd:Q102427 wd:Q10856358 wd:Q104183 wd:Q2388766 }
  ?a wdt:P31 ?type; wdt:P166 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 30)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'won award'),
]

// Music subqueries — split by entity type so we can tag them correctly
const MUSIC_SUBQUERIES: TaggedSubquery[] = [
  // Song → performer (easy: most direct connection)
  sq('easy', ['song', 'person'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?songType { wd:Q7366 wd:Q134556 wd:Q208569 }
  ?a wdt:P31 ?songType; wdt:P175 ?b.
  ?b wdt:P31 wd:Q5.
  ?a wikibase:sitelinks ?links. FILTER(?links > 15)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'performed by'),
  // Artist → record label (easy: cross-connects artists via shared labels for richer graph)
  sq('easy', ['person', 'label'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q639669; wdt:P264 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 20)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'signed to'),
  // Artist → record label (medium: require both artist and label to be well-known)
  sq('medium', ['person', 'label'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q639669; wdt:P264 ?b.
  ?b wdt:P31 wd:Q18011172.
  ?a wikibase:sitelinks ?links. FILTER(?links > 30)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 25)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'signed to'),
  // Artist → influenced by (hard: requires knowing musical influences — both must be well-known musicians)
  sq('hard', ['person', 'person'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q639669; wdt:P737 ?b.
  ?b wdt:P31 wd:Q5; wdt:P106 wd:Q639669.
  ?a wikibase:sitelinks ?links. FILTER(?links > 50)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 50)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'influenced by'),
  // Artist → historically significant label (hard: Motown, Sun Records, Atlantic, Stax — bridges artists via label era)
  // Both ?a and ?b are restricted: artist must be a musician (P106=Q639669), label from curated list
  sq('hard', ['person', 'label'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?b { wd:Q183387 wd:Q193059 wd:Q483677 wd:Q190778 wd:Q212699 wd:Q388401 wd:Q489507 wd:Q18345 wd:Q487517 wd:Q338357 wd:Q131436 wd:Q584601 wd:Q16831 wd:Q382674 wd:Q1196257 }
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q639669; wdt:P264 ?b.
  ?b wdt:P31 wd:Q18011172.
  ?a wikibase:sitelinks ?links. FILTER(?links > 30)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'signed to'),
  // Song/album → genre (hard: connects works across genres — jazz, soul, rock)
  sq('hard', ['song', 'genre'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  VALUES ?songType { wd:Q7366 wd:Q134556 wd:Q208569 }
  ?a wdt:P31 ?songType; wdt:P136 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 15)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 20)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'belongs to genre'),
]

// Video games: game → series, game → developer, game → publisher
const VIDEOGAMES_SUBQUERIES: TaggedSubquery[] = [
  // Game → series (easy: e.g. Halo, Mario, Zelda)
  sq('easy', ['game', 'series'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q7889; wdt:P179 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 10)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'part of series'),
  // Series → developer (easy: Mario→Nintendo, Halo→Bungie — well-known franchise-to-company links)
  sq('easy', ['series', 'company'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q7058673; wdt:P178|wdt:P123 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 5)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'developed by'),
  // Character → game (easy: Mario→Super Mario Bros, Lara Croft→Tomb Raider)
  sq('easy', ['person', 'game'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q15773347; wdt:P8345 ?b.
  ?b wdt:P31 wd:Q7889.
  ?a wikibase:sitelinks ?links. FILTER(?links > 5)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'appears in'),
  // Game → developer (medium)
  sq('medium', ['game', 'company'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q7889; wdt:P178 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 10)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'developed by'),
  // Game → publisher (hard: often different from developer — require publisher to be well-known)
  sq('hard', ['game', 'company'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q7889; wdt:P123 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 10)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 20)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'published by'),
  // Developer → publisher (hard: studio relationships — e.g. Bioware→EA, Rare→Microsoft)
  // Require both sides to be reasonably well-known (sitelinks > 10)
  sq('hard', ['company', 'company'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q210167; wdt:P749|wdt:P127 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 10)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 20)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'owned by'),
  // Game → game engine (hard: Unreal/Unity/id Tech/Source bridges games across studios)
  sq('hard', ['game', 'engine'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q7889; wdt:P408 ?b.
  ?b wdt:P31 wd:Q107642.
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 20)
  ?a wikibase:sitelinks ?links. FILTER(?links > 10)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'runs on'),
  // Game → featured character (P674, fictional characters only)
  sq('easy', ['game', 'person'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q7889; wdt:P674 ?b.
  ?b wdt:P31 wd:Q15773347.
  ?a wikibase:sitelinks ?links. FILTER(?links > 15)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 10)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'features character'),
  // Game → narrative setting (P840)
  sq('easy', ['game', 'location'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q7889; wdt:P840 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 15)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 15)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'set in'),
  // Game → composer (P86)
  sq('hard', ['game', 'person'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q7889; wdt:P86 ?b.
  ?b wdt:P31 wd:Q5.
  ?a wikibase:sitelinks ?links. FILTER(?links > 15)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 5)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'music composed by'),
  // Game → director (P57)
  sq('medium', ['game', 'person'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q7889; wdt:P57 ?b.
  ?b wdt:P31 wd:Q5.
  ?a wikibase:sitelinks ?links. FILTER(?links > 15)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 5)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'directed by'),
  // Game → genre (P136) — e.g. Halo→first-person shooter, Civilization→turn-based strategy
  // Bridges games that share a genre — "both are RPGs" connection
  sq('easy', ['game', 'genre'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q7889; wdt:P136 ?b.
  ?b wdt:P31 wd:Q659563.
  ?a wikibase:sitelinks ?links. FILTER(?links > 20)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 20)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'belongs to genre'),
  // Game → platform (P400) — iconic consoles only (N64, SNES, PS1/2/3, Xbox, Game Boy, Atari 2600, Sega Genesis)
  // "Both were N64 games" is a satisfying surprise connection
  sq('medium', ['game', 'platform'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  VALUES ?b { wd:Q184640 wd:Q183259 wd:Q172742 wd:Q10676 wd:Q10680 wd:Q10683 wd:Q132020 wd:Q48263 wd:Q186437 wd:Q206261 wd:Q269614 wd:Q8093 wd:Q15474 wd:Q10695 wd:Q11232 wd:Q10998 }
  ?a wdt:P31 wd:Q7889; wdt:P400 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 25)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 80)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'available on'),
  // Game → voice actor (P725) — real actors who voiced characters, bridges games via celebrity
  // e.g. GTA V → Samuel L. Jackson (via San Andreas), Last of Us → Troy Baker
  sq('hard', ['game', 'person'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q7889; wdt:P725 ?b.
  ?b wdt:P31 wd:Q5.
  ?a wikibase:sitelinks ?links. FILTER(?links > 20)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 30)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'voice acted by'),
]

// Art: artwork → painter, painter → movement, painter → institution
const ART_SUBQUERIES: TaggedSubquery[] = [
  // Artwork → painter (easy: direct and famous)
  sq('easy', ['artwork', 'person'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q3305213; wdt:P170 ?b.
  ?b wdt:P31 wd:Q5.
  ?a wikibase:sitelinks ?links. FILTER(?links > 10)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'created by'),
  // Painter → art movement (easy: Monet→Impressionism, Picasso→Cubism — bridges painters via movement)
  sq('easy', ['person', 'movement'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q1028181; wdt:P135 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 10)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'part of movement'),
  // Painter → art movement (medium)
  sq('medium', ['person', 'movement'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q1028181; wdt:P135 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 5)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'part of movement'),
  // Painter → institution (hard: obscure academic link)
  sq('hard', ['person', 'other'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q1028181; wdt:P108 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 5)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'studied at'),
  // Painter → influenced by (hard: Monet→Turner, Picasso→Cézanne)
  sq('hard', ['person', 'person'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q1028181; wdt:P737 ?b.
  ?b wdt:P31 wd:Q5.
  ?a wikibase:sitelinks ?links. FILTER(?links > 10)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 10)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'influenced by'),
  // Painter → birthplace country (hard: geographic origin — bridges across movements via nationality)
  sq('hard', ['person', 'country'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q1028181; wdt:P19 ?b.
  ?b wdt:P31 wd:Q6256.
  ?a wikibase:sitelinks ?links. FILTER(?links > 10)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 30)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'born in'),
  // Painter → alma mater (hard: Beaux-Arts, Royal Academy, Académie Gérôme)
  sq('hard', ['person', 'other'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q1028181; wdt:P69 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 10)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 20)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'trained at'),
]

// Literature: author → movement/genre, novel → author
const LITERATURE_SUBQUERIES: TaggedSubquery[] = [
  // Novel → author (easy: direct, famous works)
  sq('easy', ['book', 'person'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?bookType { wd:Q7725634 wd:Q8261 wd:Q1667921 }
  ?a wdt:P31 ?bookType; wdt:P50 ?b.
  ?b wdt:P31 wd:Q5.
  ?a wikibase:sitelinks ?links. FILTER(?links > 15)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'written by'),
  // Author → literary movement (easy: well-known movements bridge authors, enabling longer paths)
  sq('easy', ['person', 'movement'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q36180; wdt:P135 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 20)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'part of movement'),
  // Author → literary movement/genre (medium: P135|P101, broader)
  sq('medium', ['person', 'field'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q36180; wdt:P135|wdt:P101 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 10)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'part of movement'),
  // Author → influenced by (hard: intellectual lineage between writers)
  sq('hard', ['person', 'person'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q36180; wdt:P737 ?b.
  ?b wdt:P31 wd:Q5.
  ?a wikibase:sitelinks ?links. FILTER(?links > 20)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 20)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'influenced by'),
  // Author → alma mater (hard: shared educational institution)
  sq('hard', ['person', 'other'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q36180; wdt:P69 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 20)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 30)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'educated at'),
  // Book → genre (hard: genre classification for books — literary fiction, sci-fi, mystery)
  sq('hard', ['book', 'genre'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  VALUES ?bookType { wd:Q7725634 wd:Q8261 wd:Q1667921 }
  ?a wdt:P31 ?bookType; wdt:P136 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 15)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 20)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'belongs to genre'),
]

// Geography: country → continent, capital city → country (capitals only to avoid timeout)
const GEOGRAPHY_SUBQUERIES: TaggedSubquery[] = [
  // Capital city → country (easy: direct, well-known)
  sq('easy', ['city', 'country'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?b wdt:P31 wd:Q6256; wdt:P36 ?a.
  ?a wikibase:sitelinks ?links. FILTER(?links > 30)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'capital of'),
  // Country → continent (easy: also included at easy so capital→country→continent paths exist)
  sq('easy', ['country', 'continent'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q6256; wdt:P30 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 20)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'on continent'),
  // Country → continent (medium — same data, kept for medium graph completeness)
  sq('medium', ['country', 'continent'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q6256; wdt:P30 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 20)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'on continent'),
  // Country → bordering country (hard: requires map knowledge — VALUES-restricted to avoid timeout)
  sq('hard', ['country', 'country'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?a { wd:Q30 wd:Q142 wd:Q183 wd:Q145 wd:Q38 wd:Q159 wd:Q29 wd:Q668 wd:Q17 wd:Q148 wd:Q155 wd:Q414 wd:Q45 wd:Q20 wd:Q34 wd:Q33 wd:Q35 wd:Q55 wd:Q36 wd:Q40 wd:Q39 wd:Q211 wd:Q219 wd:Q224 wd:Q217 wd:Q218 wd:Q228 wd:Q232 wd:Q233 wd:Q252 }
  ?a wdt:P47 ?b.
  ?b wdt:P31 wd:Q6256.
  ?a wikibase:sitelinks ?links.
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'borders'),
  // Major city → country (hard: VALUES-listed major non-capital cities to avoid full-table-scan timeout)
  sq('hard', ['city', 'country'], (_limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?a { wd:Q60 wd:Q84 wd:Q90 wd:Q220 wd:Q1353 wd:Q956 wd:Q649 wd:Q1439 wd:Q38022 wd:Q1345
              wd:Q1055 wd:Q3821 wd:Q72 wd:Q2807 wd:Q16555 wd:Q2013 wd:Q3630 wd:Q35765 wd:Q3795
              wd:Q406 wd:Q4120 wd:Q2484 wd:Q79 wd:Q987 wd:Q3624 wd:Q1354 wd:Q106087 wd:Q4656
              wd:Q1492 wd:Q2844 wd:Q1519 wd:Q8678 wd:Q18426 wd:Q189395 wd:Q3874 wd:Q2256 }
  ?a wdt:P17 ?b. ?b wdt:P31 wd:Q6256.
  ?a wikibase:sitelinks ?links.
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT 60`, 'located in'),
  // Film → filming location (hard: connects cities via films shot there — Rome, NYC, Paris)
  // Links geography's city nodes to famous films, creating cross-domain cultural bridges
  sq('hard', ['city', 'other'], (_limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?a { wd:Q60 wd:Q84 wd:Q90 wd:Q220 wd:Q1353 wd:Q649 wd:Q38022 wd:Q1345
              wd:Q1055 wd:Q3821 wd:Q72 wd:Q2807 wd:Q16555 wd:Q2013 wd:Q3630 wd:Q35765
              wd:Q406 wd:Q4120 wd:Q2484 wd:Q79 wd:Q987 wd:Q1354 wd:Q106087 wd:Q4656
              wd:Q1492 wd:Q2844 wd:Q1519 wd:Q8678 wd:Q189395 }
  VALUES ?filmType { wd:Q11424 wd:Q506240 }
  ?b wdt:P31 ?filmType; wdt:P915 ?a.
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 30)
  ?a wikibase:sitelinks ?links.
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?blinks) LIMIT 100`, 'filming location of'),
]

// Royals: monarch → country (via P27 citizenship), monarch → noble house (P53)
const ROYALS_SUBQUERIES: TaggedSubquery[] = [
  // Monarch → dynasty (easy: Windsor/Habsburg/Bourbon — widely known royal houses)
  // P53=family/dynasty; lower sitelinks floor to get more entities into the graph
  sq('easy', ['person', 'dynasty'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q116; wdt:P53 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 5)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 5)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'member of house'),
  // Monarch → spouse (easy: Elizabeth→Philip, Victoria→Albert — famous royal marriages)
  sq('easy', ['person', 'person'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q116; wdt:P26 ?b.
  ?b wdt:P31 wd:Q5.
  ?a wikibase:sitelinks ?links. FILTER(?links > 5)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'married to'),
  // Monarch → parent/child (easy: monarchs are related in well-known ways — Henry VIII→Mary I)
  sq('easy', ['person', 'person'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q116.
  { ?a wdt:P22 ?b. } UNION { ?a wdt:P25 ?b. } UNION { ?a wdt:P40 ?b. }
  ?b wdt:P31 wd:Q5.
  ?a wikibase:sitelinks ?links. FILTER(?links > 5)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'related to'),
  // Monarch → noble house/dynasty (medium: requires dynasty knowledge)
  sq('medium', ['person', 'dynasty'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P53 ?b.
  ?a wdt:P106 wd:Q116.
  ?a wikibase:sitelinks ?links. FILTER(?links > 10)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 5)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'member of dynasty'),
  // Monarch → successor/predecessor (hard: requires detailed succession knowledge)
  sq('hard', ['person', 'person'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q116.
  { ?a wdt:P40 ?b. } UNION { ?a wdt:P22 ?b. } UNION { ?a wdt:P25 ?b. }
  ?b wdt:P31 wd:Q5; wdt:P106 wd:Q116.
  ?a wikibase:sitelinks ?links. FILTER(?links > 5)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'parent/child of'),
  // Monarch → alma mater (hard: educational institution — surprisingly many royals shared schools)
  sq('hard', ['person', 'other'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q116; wdt:P69 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 5)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 30)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'educated at'),
  // Monarch → birthplace country (hard: geographic origin)
  sq('hard', ['person', 'country'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q116; wdt:P19 ?b.
  ?b wdt:P31 wd:Q6256.
  ?a wikibase:sitelinks ?links. FILTER(?links > 5)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 30)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'born in'),
]

// Tennis: player → national cup team (Davis/BJK), player → coach
// These are the two reliably populated relationship types in Wikidata for tennis players
const TENNIS_SUBQUERIES: TaggedSubquery[] = [
  // Player → national cup team (easy: Davis Cup / BJK Cup teams are tennis-domain nodes)
  sq('easy', ['person', 'team'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q10833314; wdt:P54 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 10)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'represented'),
  // Player → coach (medium: coaches connect players across eras)
  sq('medium', ['person', 'person'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q10833314; wdt:P286 ?b.
  ?b wdt:P31 wd:Q5.
  ?a wikibase:sitelinks ?links. FILTER(?links > 5)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'coached by'),
  // Player → national cup team (hard: broader pool including less famous players)
  sq('hard', ['person', 'team'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q10833314; wdt:P54 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 5)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'played for'),
]

// Soccer: footballer → club (high sitelinks to stay fast), club → league
const SOCCER_SUBQUERIES: TaggedSubquery[] = [
  // Footballer → club (easy: top players, famous clubs)
  sq('easy', ['person', 'team'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q937857; wdt:P54 ?b.
  ?b wdt:P31 wd:Q476028.
  ?a wikibase:sitelinks ?links. FILTER(?links > 50)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'played for'),
  // Club → league (medium: requires league knowledge)
  sq('medium', ['team', 'league'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q476028; wdt:P641 wd:Q2736; wdt:P118 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 30)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'plays in'),
  // Player → place of birth (hard: geographic birthplace connection)
  sq('hard', ['person', 'country'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q937857; wdt:P19 ?b.
  ?b wdt:P31 wd:Q6256.
  ?a wikibase:sitelinks ?links. FILTER(?links > 40)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 30)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'born in'),
  // Player → position played (hard: striker/goalkeeper/midfielder — requires tactical knowledge)
  sq('hard', ['person', 'other'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q937857; wdt:P413 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 40)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 5)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'plays as'),
  // Club → head coach/manager (hard: manager knowledge is for dedicated fans)
  sq('hard', ['team', 'person'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q476028; wdt:P641 wd:Q2736; wdt:P286 ?b.
  ?b wdt:P31 wd:Q5.
  ?a wikibase:sitelinks ?links. FILTER(?links > 30)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 20)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'managed by'),
]

// TV: show → cast, show → creator, show → production network
const TV_SUBQUERIES: TaggedSubquery[] = [
  // Show → cast member (easy: actors are widely known)
  sq('easy', ['show', 'person'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5398426; wdt:P161 ?b.
  ?b wdt:P31 wd:Q5.
  ?a wikibase:sitelinks ?links. FILTER(?links > 15)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'cast member of'),
  // Show → creator/director (medium: showrunners less famous)
  sq('medium', ['show', 'person'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5398426; wdt:P57|wdt:P162 ?b.
  ?b wdt:P31 wd:Q5.
  ?a wikibase:sitelinks ?links. FILTER(?links > 15)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'directed by'),
  // Show → TV network/streaming platform (hard: HBO/AMC/Netflix/FX — well-known even if directors aren't)
  // Q2001305=television network, Q15416=television channel, Q18127=broadcasting company
  sq('hard', ['show', 'network'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?networkType { wd:Q2001305 wd:Q15416 wd:Q18127 wd:Q18610010 }
  ?a wdt:P31 wd:Q5398426; wdt:P449 ?b.
  ?b wdt:P31 ?networkType.
  ?a wikibase:sitelinks ?links. FILTER(?links > 15)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'aired on'),
  // Show → screenwriter (hard: connects shows via shared writer — e.g. both written by Vince Gilligan)
  sq('hard', ['series', 'person'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q5398426; wdt:P58 ?b.
  ?b wdt:P31 wd:Q5.
  ?a wikibase:sitelinks ?links. FILTER(?links > 20)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 10)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'written by'),
  // Show → genre (medium: connects shows of same genre — crime drama, sitcom, sci-fi)
  sq('medium', ['series', 'genre'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q5398426; wdt:P136 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 20)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 20)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'belongs to genre'),
]

// Philosophy: philosopher → notable work, philosopher → school, philosopher → influenced by
// Removed philosopher→country (P27 nationality) subquery — countries are wrong_domain bridges
const PHILOSOPHY_SUBQUERIES: TaggedSubquery[] = [
  // Philosopher → notable work (easy: Plato→Republic, Kant→Critique of Pure Reason)
  sq('easy', ['person', 'work'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q4964182; wdt:P800 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 10)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'authored'),
  // Philosopher → philosophical school/movement (easy: bridges philosophers via well-known schools)
  sq('easy', ['person', 'movement'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q4964182; wdt:P135 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 15)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'part of movement'),
  // Philosopher → philosophical school/movement (medium: P737=influenced by + P135=movement)
  sq('medium', ['person', 'movement'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q4964182; wdt:P737|wdt:P135 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 10)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'school of thought'),
  // Philosopher → influenced by (hard: requires deeper philosophical knowledge, philosopher-to-philosopher only)
  sq('hard', ['person', 'person'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q4964182; wdt:P737 ?b.
  ?b wdt:P31 wd:Q5; wdt:P106 wd:Q4964182.
  ?a wikibase:sitelinks ?links. FILTER(?links > 20)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'influenced by'),
  // Philosopher → alma mater (hard: Oxford, Cambridge, Berlin — institutional connections)
  sq('hard', ['person', 'other'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q4964182; wdt:P69 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 15)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 30)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'educated at'),
]

// Military: commander → country, commander → conflict
const MILITARY_SUBQUERIES: TaggedSubquery[] = [
  // Commander → major conflict (easy: WWII, WWI, Korean War — widely known)
  // P607=conflict; hand-picked famous wars. P106=military officer/personnel only — exclude civilians
  sq('easy', ['person', 'conflict'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?b { wd:Q362 wd:Q361 wd:Q11514 wd:Q8676 wd:Q8740 wd:Q179637 }
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q189290; wdt:P607 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 15)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'fought in'),
  // Commander → conflict/war (medium: requires history knowledge)
  sq('medium', ['person', 'conflict'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?b { wd:Q362 wd:Q361 wd:Q6583 wd:Q8676 wd:Q8740 wd:Q154697 wd:Q179637 wd:Q188055 wd:Q180684 wd:Q11514 wd:Q37643 wd:Q8680 wd:Q8673 }
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q189290; wdt:P607 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 10)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'fought in'),
  // Commander → military award (hard: Medal of Honor, Victoria Cross, Iron Cross — niche knowledge)
  // P166=award; Q21669 = Medal of Honor, Q1267319 = Victoria Cross, Q152037 = Iron Cross, etc.
  sq('hard', ['person', 'other'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?b { wd:Q21669 wd:Q1267319 wd:Q152037 wd:Q150787 wd:Q193373 wd:Q185715 wd:Q744030 wd:Q193714 }
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q189290; wdt:P166 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 5)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'awarded'),
  // Commander → alma mater (hard: West Point, Sandhurst, St-Cyr — military academy connections)
  sq('hard', ['person', 'other'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q189290; wdt:P69 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 10)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 20)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'educated at'),
]

// Mythology: deities, heroes, creatures, artifacts — multiple relation types for rich graph
// Types: Q22989102=mythological figure, Q4271324=mythological character, Q178885=deity,
//        Q12195757=legendary creature, Q4936492=heroic figure
const MYTHOLOGY_SUBQUERIES: TaggedSubquery[] = [
  // Figure → mythology system (easy: Greek/Norse/Egyptian widely known)
  sq('easy', ['deity', 'other'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?type { wd:Q22989102 wd:Q4271324 wd:Q178885 wd:Q12195757 wd:Q4936492 }
  ?a wdt:P31 ?type; wdt:P1080 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 3)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'from mythology'),
  // Figure → parent/child (easy: Zeus/Athena, Odin/Thor — widely known family links)
  sq('easy', ['deity', 'deity'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?type { wd:Q22989102 wd:Q4271324 wd:Q178885 wd:Q12195757 wd:Q4936492 }
  ?a wdt:P31 ?type.
  { ?a wdt:P22 ?b. } UNION { ?a wdt:P25 ?b. } UNION { ?a wdt:P26 ?b. }
  ?b wdt:P31 ?type.
  ?a wikibase:sitelinks ?links. FILTER(?links > 3)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'family of'),
  // Figure → pantheon/group (medium: Twelve Olympians, Aesir, Vanir, etc.)
  // Also include mythology system at medium — without it the medium graph is too sparse
  // (groups have only 7-14 members, not enough to form 4-hop paths)
  sq('medium', ['deity', 'other'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?type { wd:Q22989102 wd:Q4271324 wd:Q178885 wd:Q12195757 wd:Q4936492 }
  ?a wdt:P31 ?type; wdt:P1080 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 3)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'from mythology'),
  sq('medium', ['deity', 'group'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?type { wd:Q22989102 wd:Q4271324 wd:Q178885 wd:Q12195757 wd:Q4936492 }
  ?a wdt:P31 ?type; wdt:P361 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 5)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'member of'),
  // Figure → parent (hard: dense family trees require detailed knowledge)
  sq('hard', ['deity', 'deity'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?type { wd:Q22989102 wd:Q4271324 wd:Q178885 wd:Q12195757 wd:Q4936492 }
  ?a wdt:P31 ?type.
  { ?a wdt:P22 ?b. } UNION { ?a wdt:P25 ?b. }
  ?b wdt:P31 ?type.
  ?a wikibase:sitelinks ?links. FILTER(?links > 3)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'parent of'),
  // Figure → consort/spouse (hard)
  sq('hard', ['deity', 'deity'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?type { wd:Q22989102 wd:Q4271324 wd:Q178885 wd:Q12195757 wd:Q4936492 }
  ?a wdt:P31 ?type; wdt:P26 ?b.
  ?b wdt:P31 ?type.
  ?a wikibase:sitelinks ?links. FILTER(?links > 3)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'consort of'),
]

// Space: astronaut → space agency, astronaut → country
// Hardcode major agencies to avoid full P106=Q11631 scan which times out
// Q23548=NASA, Q190903=ESA, Q14530=Roscosmos, Q789758=JAXA, Q15878=CSA,
// Q11237=ISRO, Q193569=CNSA
const SPACE_SUBQUERIES: TaggedSubquery[] = [
  // Astronaut → space agency (easy: NASA/ESA/Roscosmos widely known)
  sq('easy', ['person', 'other'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?b { wd:Q23548 wd:Q190903 wd:Q14530 wd:Q789758 wd:Q15878 wd:Q11237 wd:Q193569 }
  ?a wdt:P31 wd:Q5; wdt:P108 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 5)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'worked at'),
  // Astronaut → country (easy)
  sq('easy', ['person', 'country'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q11631; wdt:P27 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 5)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'represents'),
  // Any astronaut → space mission (medium: all astronauts, not just agency-filtered)
  sq('medium', ['person', 'other'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q11631; wdt:P450 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 3)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'flew on'),
  // Astronaut → country (medium)
  sq('medium', ['person', 'country'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q11631; wdt:P27 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 3)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'represents'),
  // Space program → participating country (medium: Apollo→US, ISS→Russia/US/Japan)
  sq('medium', ['other', 'country'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q24052309; wdt:P17 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 5)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'operated by'),
  // Astronaut → alma mater (hard)
  sq('hard', ['person', 'other'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q11631; wdt:P69 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 3)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'studied at'),
  // Astronaut → country (hard: broader pool)
  sq('hard', ['person', 'country'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q11631; wdt:P27 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 3)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'represents'),
  // Spacecraft → space agency (hard)
  sq('hard', ['other', 'other'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?missionType { wd:Q40218 wd:Q752783 wd:Q2472875 }
  ?a wdt:P31 ?missionType; wdt:P790 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 5)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'operated by'),
  // Astronaut → space mission (hard: bridges US and Soviet cosmonauts via ISS/Mir/Apollo-Soyuz)
  // This creates cross-component connections that otherwise don't exist in the graph
  sq('hard', ['person', 'other'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q11631; wdt:P450 ?b.
  ?b wdt:P31 wd:Q634; wdt:P17 ?country.
  ?a wikibase:sitelinks ?links. FILTER(?links > 5)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 10)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'flew on mission'),
]

// Food: dish → country of origin, dish → food category, dish → main ingredient
// Q746549=dish, Q2095372=food, Q1278475=product, Q756=apple (too broad) — use multiple types
const FOOD_SUBQUERIES: TaggedSubquery[] = [
  // Dish → country of origin (easy: cuisine nationality is well-known)
  // Broaden dish type to include Q2095372 (food) and drop mandatory P31=country filter
  sq('easy', ['dish', 'country'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?foodType { wd:Q746549 wd:Q189796 }
  ?a wdt:P31 ?foodType; wdt:P495 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 5)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'originates from'),
  // Dish → food type/superclass (easy: pizza is a type of flatbread, burger is a type of sandwich)
  // P279=subclass of; use VALUES to restrict ?b to known food supertypes for speed (avoids slow JOIN)
  sq('easy', ['dish', 'dish'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?foodType { wd:Q746549 wd:Q189796 }
  VALUES ?b { wd:Q18650 wd:Q190804 wd:Q161942 wd:Q3283 wd:Q7802 wd:Q3199697 wd:Q1549736 wd:Q57069 wd:Q5708808 wd:Q80313 wd:Q1480264 wd:Q11639 wd:Q131419 wd:Q3291 }
  ?a wdt:P31 ?foodType; wdt:P279 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 5)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'type of'),
  // Dish → food type/superclass (medium: pasta, soup, etc. requires classification knowledge)
  sq('medium', ['dish', 'dish'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?foodType { wd:Q746549 wd:Q189796 }
  VALUES ?b { wd:Q18650 wd:Q190804 wd:Q161942 wd:Q3283 wd:Q7802 wd:Q3199697 wd:Q1549736 wd:Q57069 wd:Q5708808 wd:Q80313 wd:Q1480264 wd:Q11639 wd:Q3291 wd:Q11812 wd:Q24354 wd:Q180173 wd:Q131419 wd:Q244291 wd:Q851850 }
  ?a wdt:P31 ?foodType; wdt:P279 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 8)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'type of'),
  // Dish → main ingredient via P186 (made from material) — more broadly used than P527 in Wikidata
  // Q25403900=ingredient, Q2095372=food product — connect dishes via shared key ingredients
  sq('hard', ['dish', 'ingredient'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?foodType { wd:Q746549 wd:Q189796 }
  VALUES ?ingredientType { wd:Q25403900 wd:Q2095372 wd:Q3314483 wd:Q10676833 wd:Q1466448 }
  ?a wdt:P31 ?foodType; wdt:P186|wdt:P527 ?b.
  ?b wdt:P31 ?ingredientType.
  ?a wikibase:sitelinks ?links. FILTER(?links > 10)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'made with'),
  // Dish → chef creator (hard: connects dishes via the famous chefs who created or popularized them)
  // Q3499072=chef, Q945799=restaurateur
  sq('hard', ['dish', 'person'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  VALUES ?foodType { wd:Q746549 wd:Q189796 }
  ?a wdt:P31 ?foodType; wdt:P170 ?b.
  ?b wdt:P31 wd:Q5.
  ?a wikibase:sitelinks ?links. FILTER(?links > 5)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 10)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'created by'),
]

// Comics: character → publisher, character → team, character → creator, creator → creator
// Q173496=Marvel Comics, Q2924461=DC Comics, Q1500953=Dark Horse, Q2303691=Image
const COMICS_SUBQUERIES: TaggedSubquery[] = [
  // Comic character → publisher (easy: Marvel/DC widely known)
  sq('easy', ['character', 'publisher'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?b { wd:Q173496 wd:Q2924461 wd:Q1500953 wd:Q2303691 wd:Q835239 wd:Q617033 }
  ?a wdt:P31 wd:Q1114461; wdt:P123 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 5)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'published by'),
  // Comic character → team (easy: Avengers/X-Men/Justice League widely known)
  sq('easy', ['character', 'team'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q1114461; wdt:P463 ?b.
  ?b wdt:P31 wd:Q14514600.
  ?a wikibase:sitelinks ?links. FILTER(?links > 5)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'member of'),
  // Comic character → team affiliation (medium: requires team knowledge)
  sq('medium', ['character', 'team'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q1114461; wdt:P463 ?b.
  ?b wdt:P31 wd:Q14514600.
  ?a wikibase:sitelinks ?links. FILTER(?links > 5)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'member of'),
  // Comic character → creator (hard: writer/artist knowledge is niche)
  sq('hard', ['character', 'person'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q1114461; wdt:P170 ?b.
  ?b wdt:P31 wd:Q5.
  ?a wikibase:sitelinks ?links. FILTER(?links > 8)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'created by'),
  // Creator → publisher (hard: connects comic writers/artists via shared publisher)
  // Bridges Bob Kane→DC Comics→Neal Adams without requiring character intermediates
  sq('hard', ['person', 'publisher'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?b { wd:Q173496 wd:Q2924461 wd:Q1500953 wd:Q2303691 wd:Q835239 wd:Q617033 }
  ?a wdt:P31 wd:Q5; wdt:P108|wdt:P170 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 5)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'worked at'),
  // Creator → influenced by (hard: Jack Kirby→Will Eisner, Alan Moore→Steve Ditko)
  sq('hard', ['person', 'person'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q5; wdt:P737 ?b.
  ?b wdt:P31 wd:Q5.
  { ?a wdt:P108 wd:Q173496. } UNION { ?a wdt:P108 wd:Q2924461. } UNION { ?a wdt:P170 wd:Q1114461. }
  ?a wikibase:sitelinks ?links. FILTER(?links > 10)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 10)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'influenced by'),
  // Creator → movement (hard: new wave comics, golden age, silver age)
  sq('hard', ['person', 'movement'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q5; wdt:P135 ?b.
  { ?a wdt:P108 wd:Q173496. } UNION { ?a wdt:P108 wd:Q2924461. } UNION { ?a wdt:P170 wd:Q1114461. }
  ?a wikibase:sitelinks ?links. FILTER(?links > 5)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 5)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'part of movement'),
]

// Basketball: NBA players → teams, teams → NBA league
// Q5372 = basketball (sport), Q155223 = NBA, Q623109 = sports league
const BASKETBALL_SUBQUERIES: TaggedSubquery[] = [
  // Basketball player → team via sport property (easy: top players, famous franchises)
  // Using P641=basketball sport rather than occupation QID which returns 0 results
  sq('easy', ['person', 'team'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P641 wd:Q5372; wdt:P54 ?b.
  ?b wdt:P641 wd:Q5372.
  ?a wikibase:sitelinks ?links. FILTER(?links > 20)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'played for'),
  // NBA player → team (medium: NBA-specific, requires league knowledge)
  sq('medium', ['person', 'team'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P641 wd:Q5372; wdt:P54 ?b.
  ?b wdt:P118 wd:Q155223.
  ?a wikibase:sitelinks ?links. FILTER(?links > 15)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'played for'),
  // NBA team → NBA league (hard: conference/division knowledge)
  sq('hard', ['team', 'league'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  { ?a wdt:P31 wd:Q13393265. } UNION { ?a wdt:P118 wd:Q155223; wdt:P641 wd:Q5372. }
  ?a wdt:P118 ?b. ?b wdt:P31 wd:Q623109.
  ?a wikibase:sitelinks ?links. FILTER(?links > 5)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'plays in'),
  // Player → alma mater (hard: college basketball — Duke, Kentucky, UNC — well-known pipeline schools)
  sq('hard', ['person', 'other'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q5; wdt:P641 wd:Q5372; wdt:P69 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 20)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 30)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'played college ball at'),
  // Player → award (hard: MVP, All-Star, Rookie of the Year — prestigious recognitions)
  sq('hard', ['person', 'other'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  VALUES ?b { wd:Q843303 wd:Q766290 wd:Q913851 wd:Q2469962 wd:Q2470027 wd:Q1361501 wd:Q2470036 }
  ?a wdt:P31 wd:Q5; wdt:P641 wd:Q5372; wdt:P166 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 20)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'received award'),
]

// American Football: player → team, team → league
const AMERICANFOOTBALL_SUBQUERIES: TaggedSubquery[] = [
  // NFL player → team (easy: famous players, well-known teams)
  sq('easy', ['person', 'team'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q19204627; wdt:P54 ?b.
  ?b wdt:P31 wd:Q17156793.
  ?a wikibase:sitelinks ?links. FILTER(?links > 20)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'played for'),
  // NFL team → league (medium: division/conference knowledge)
  sq('medium', ['team', 'league'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q17156793; wdt:P118 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 10)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'plays in'),
  // NFL team → head coach (hard: coaches bridge teams across eras)
  sq('hard', ['team', 'person'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q17156793; wdt:P286 ?b.
  ?b wdt:P31 wd:Q5.
  ?a wikibase:sitelinks ?links. FILTER(?links > 10)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 10)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'coached by'),
  // Player → position played (hard: quarterback, wide receiver — tactical knowledge)
  sq('hard', ['person', 'other'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q19204627; wdt:P413 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 15)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 5)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'plays as'),
]

// Each domain query returns pairs of (primary entity, related entity)
const DOMAIN_QUERIES: Record<WikidataDomain, (limit: number) => string> = {
  // placeholder — uses subqueries instead
  movies: (_limit) => '',
  sport: (_limit) => '',
  music: (_limit) => '',
  videogames: (_limit) => '',
  art: (_limit) => '',
  literature: (_limit) => '',
  geography: (_limit) => '',
  royals: (_limit) => '',
  tennis: (_limit) => '',
  soccer: (_limit) => '',
  tv: (_limit) => '',
  philosophy: (_limit) => '',
  military: (_limit) => '',
  mythology: (_limit) => '',
  space: (_limit) => '',
  food: (_limit) => '',
  comics: (_limit) => '',
  basketball: (_limit) => '',
  americanfootball: (_limit) => '',

  science: (_limit) => '',
  history: (_limit) => '',
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

// History: politician → party (easy), politician → position held (medium)
const HISTORY_SUBQUERIES: TaggedSubquery[] = [
  // Politician → political party (easy: parties are widely recognisable bridge nodes)
  sq('easy', ['person', 'other'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q82955; wdt:P102 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 30)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'member of'),
  // Politician → politician: mentor/student, influenced-by (easy: direct person links)
  sq('easy', ['person', 'person'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q82955.
  { ?a wdt:P1066 ?b. } UNION { ?a wdt:P737 ?b. } UNION { ?a wdt:P3373 ?b. }
  ?b wdt:P31 wd:Q5; wdt:P106 wd:Q82955.
  ?a wikibase:sitelinks ?links. FILTER(?links > 20)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'connected to'),
  // Politician → position held (medium: offices like President, Prime Minister)
  sq('medium', ['person', 'office'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q82955; wdt:P39 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 30)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'held office'),
  // Historical figure → conflict/war they participated in (hard: requires detailed history knowledge)
  sq('hard', ['person', 'conflict'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P607 ?b.
  ?b wdt:P31 wd:Q198.
  ?a wikibase:sitelinks ?links. FILTER(?links > 20)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'fought in'),
  // Politician → ideological movement (hard: requires knowing what they stood for)
  sq('hard', ['person', 'movement'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q82955; wdt:P1142 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 20)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'aligned with'),
  // Historical figure → alma mater (hard: Oxford/Cambridge/Harvard connections across eras)
  sq('hard', ['person', 'other'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q5; wdt:P69 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 35)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 40)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'educated at'),
  // Historical figure → award (hard: Nobel Peace Prize, Presidential Medal of Freedom — cross-era recognition)
  sq('hard', ['person', 'other'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  VALUES ?b { wd:Q35637 wd:Q131226 wd:Q7191 wd:Q170483 wd:Q131539 wd:Q2747062 wd:Q131604 }
  ?a wdt:P31 wd:Q5; wdt:P166 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 30)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'received award'),
]

// Science: scientist → employer/institution (easy), scientist → field of work (medium)
const SCIENCE_SUBQUERIES: TaggedSubquery[] = [
  // Scientist → employer/institution (easy: universities and labs are well-known)
  sq('easy', ['person', 'other'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q901; wdt:P108 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 25)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'worked at'),
  // Scientist → field of work (medium: requires domain knowledge)
  sq('medium', ['person', 'field'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q901; wdt:P101 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 25)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'worked in'),
  // Scientist → alma mater (hard: educational institution connection)
  sq('hard', ['person', 'other'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q901; wdt:P69 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 25)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 30)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'educated at'),
  // Scientist → influenced by (hard: intellectual lineage — both must be well-known scientists)
  sq('hard', ['person', 'person'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q901; wdt:P737 ?b.
  ?b wdt:P31 wd:Q5.
  ?a wikibase:sitelinks ?links. FILTER(?links > 30)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 30)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'influenced by'),
  // Scientist → award (hard: Nobel Prize, Fields Medal — prestigious recognition)
  sq('hard', ['person', 'other'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  VALUES ?b { wd:Q7191 wd:Q38104 wd:Q25363 wd:Q44585 wd:Q11631 wd:Q35637 wd:Q131539 wd:Q28008836 wd:Q35637 wd:Q781026 }
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q901; wdt:P166 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 20)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'received award'),
]

// For single-query domains, type hint applied to all rows (science/history now use subqueries)
const SINGLE_QUERY_TYPES: Partial<Record<WikidataDomain, [string, string]>> = {
}

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

