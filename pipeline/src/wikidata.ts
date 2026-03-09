import { Entity } from './graphBuilder'

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
  // Artist → record label (medium)
  sq('medium', ['person', 'label'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q639669; wdt:P264 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 30)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'signed to'),
  // Artist → influenced by (hard: subjective/obscure)
  sq('hard', ['person', 'person'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q639669; wdt:P737 ?b.
  ?b wdt:P31 wd:Q5; wdt:P106 wd:Q639669.
  ?a wikibase:sitelinks ?links. FILTER(?links > 50)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 50)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'influenced by'),
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
  // Game → publisher (hard: often different from developer)
  sq('hard', ['game', 'company'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q7889; wdt:P123 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 10)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'published by'),
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
]

// Royals: monarch → country (via P27 citizenship), monarch → noble house (P53)
const ROYALS_SUBQUERIES: TaggedSubquery[] = [
  // Monarch → country (easy: well-known kings/queens)
  sq('easy', ['person', 'country'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P27 ?b.
  ?b wdt:P31 wd:Q6256.
  ?a wdt:P106 wd:Q116.
  ?a wikibase:sitelinks ?links. FILTER(?links > 20)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'monarch of'),
  // Monarch → noble house/dynasty (medium: requires dynasty knowledge)
  sq('medium', ['person', 'dynasty'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P53 ?b.
  ?a wdt:P106 wd:Q116.
  ?a wikibase:sitelinks ?links. FILTER(?links > 20)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'member of dynasty'),
]

// Tennis: player → country, player → team/federation
const TENNIS_SUBQUERIES: TaggedSubquery[] = [
  // Player → country (easy: nationality is widely known)
  sq('easy', ['person', 'country'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q10833314; wdt:P27 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 15)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'represents'),
  // Player → team/federation (medium: requires tour knowledge)
  sq('medium', ['person', 'team'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q10833314; wdt:P54 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 15)
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
]

// TV: show → cast, show → creator
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
]

// Philosophy: philosopher → notable work (easy), philosopher → influenced by (hard)
const PHILOSOPHY_SUBQUERIES: TaggedSubquery[] = [
  // Philosopher → notable work (easy: Plato→Republic, Kant→Critique of Pure Reason)
  sq('easy', ['person', 'work'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q4964182; wdt:P800 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 10)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'authored'),
  // Philosopher → nationality (easy: Aristotle→Greece, Kant→Germany — bridges famous figures via country)
  sq('easy', ['person', 'country'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q4964182; wdt:P27 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 15)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'from'),
  // Philosopher → philosophical school/movement (medium: Stoicism, Empiricism, Existentialism)
  sq('medium', ['person', 'movement'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q4964182; wdt:P737|wdt:P135 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 10)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'school of thought'),
  // Philosopher → influenced by (hard: requires deeper philosophical knowledge)
  sq('hard', ['person', 'person'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q4964182; wdt:P737 ?b.
  ?b wdt:P31 wd:Q5; wdt:P106 wd:Q4964182.
  ?a wikibase:sitelinks ?links. FILTER(?links > 20)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'influenced by'),
]

// Military: commander → country, commander → conflict
const MILITARY_SUBQUERIES: TaggedSubquery[] = [
  // Commander → country (easy: nationality is well-known)
  sq('easy', ['person', 'country'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q189290; wdt:P27 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 30)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'served'),
  // Commander → conflict/war (medium: requires history knowledge)
  sq('medium', ['person', 'conflict'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?b { wd:Q362 wd:Q361 wd:Q6583 wd:Q8676 wd:Q8740 wd:Q154697 wd:Q179637 wd:Q188055 wd:Q180684 wd:Q11514 wd:Q37643 wd:Q8680 wd:Q8673 }
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q189290; wdt:P607 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 15)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'fought in'),
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
]

// Food: dish → country of origin, dish → food category
// Q746549=dish, Q2095372=food, Q1278475=product, Q756=apple (too broad) — use multiple types
const FOOD_SUBQUERIES: TaggedSubquery[] = [
  // Dish → country of origin (easy: cuisine nationality is well-known)
  // Broaden dish type to include Q2095372 (food) and drop mandatory P31=country filter
  sq('easy', ['dish', 'country'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?foodType { wd:Q746549 wd:Q2095372 wd:Q189796 }
  ?a wdt:P31 ?foodType; wdt:P495 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 5)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'originates from'),
  // Dish → food category (easy too: gives cross-country connections via shared categories)
  sq('easy', ['dish', 'category'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?foodType { wd:Q746549 wd:Q2095372 wd:Q189796 }
  ?a wdt:P31 ?foodType; wdt:P279 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 5)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'type of'),
  // Dish → food category (medium: pasta, soup, etc. requires classification knowledge)
  sq('medium', ['dish', 'category'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?foodType { wd:Q746549 wd:Q2095372 wd:Q189796 }
  ?a wdt:P31 ?foodType; wdt:P279 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 8)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'type of'),
]

// Comics: character → publisher, character → team, character → creator
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
      entityMap.set(bId, { id: bId, label: bLabel, relatedIds: [aId], entityType: bType })
    } else {
      const b = entityMap.get(bId)!
      if (!b.relatedIds.includes(aId)) b.relatedIds.push(aId)
      if (bType && !b.entityType) b.entityType = bType
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
): Promise<Entity[]> {
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
    for (const { bindings, tsq } of results) {
      bindingsToEntityMap(bindings, entityMap, tsq.types[0], tsq.types[1])
    }
    return Array.from(entityMap.values())
  }

  const query = DOMAIN_QUERIES[domain](limit)
  const bindings = await runSparqlQuery(query)
  const [aType, bType] = SINGLE_QUERY_TYPES[domain] ?? [undefined, undefined]
  return Array.from(bindingsToEntityMap(bindings, undefined, aType, bType).values())
}

export async function fetchMovieEntities(limit = 200): Promise<Entity[]> {
  return fetchEntities('movies', limit)
}

