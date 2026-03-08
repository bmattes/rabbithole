/**
 * Probe 100 candidate categories against Wikidata.
 * Scores each by: entity count, average sitelinks, and "high fame" count (>80 sitelinks).
 * High fame count is the best proxy for puzzle quality — players need to recognise entities.
 *
 * Usage: npx ts-node src/scripts/probe-categories.ts
 */

import * as fs from 'fs'
import * as path from 'path'

const WIKIDATA_ENDPOINT = 'https://query.wikidata.org/sparql'

interface ProbeResult {
  id: string
  label: string
  entityCount: number
  avgSitelinks: number
  highFameCount: number  // entities with >80 sitelinks — best puzzle quality signal
  score: number          // entityCount × avgSitelinks / 1000
  status: 'ok' | 'thin' | 'error' | 'timeout'
}

interface Candidate {
  id: string
  label: string
  query: string
}

// Each query must SELECT ?item (MAX(?l) AS ?links) GROUP BY ?item
// so the prober can count entities and compute sitelink stats.
const CANDIDATES: Candidate[] = [
  // ── Film & TV ─────────────────────────────────────────────────────────────
  {
    id: 'movies',
    label: 'Movies',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q11424; wdt:P57 []; wikibase:sitelinks ?l. FILTER(?l>30)
    } GROUP BY ?item`,
  },
  {
    id: 'tv_shows',
    label: 'TV Shows',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q5398426; wdt:P161 []; wikibase:sitelinks ?l. FILTER(?l>30)
    } GROUP BY ?item`,
  },
  {
    id: 'animated_films',
    label: 'Animated Films',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q202866; wdt:P272 []; wikibase:sitelinks ?l. FILTER(?l>30)
    } GROUP BY ?item`,
  },
  {
    id: 'directors',
    label: 'Film Directors',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q5; wdt:P106 wd:Q2526255; wikibase:sitelinks ?l. FILTER(?l>30)
    } GROUP BY ?item`,
  },
  {
    id: 'actors',
    label: 'Actors',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q5; wdt:P106 wd:Q33999; wikibase:sitelinks ?l. FILTER(?l>40)
    } GROUP BY ?item`,
  },
  {
    id: 'marvel_dc',
    label: 'Marvel / DC Comics Films',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      { ?item wdt:P31 wd:Q11424; wdt:P272 wd:Q622930 }
      UNION
      { ?item wdt:P31 wd:Q11424; wdt:P272 wd:Q1408183 }
      ?item wikibase:sitelinks ?l. FILTER(?l>25)
    } GROUP BY ?item`,
  },
  {
    id: 'oscar_winners',
    label: 'Oscar-Winning Films',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q11424; wdt:P166 ?award. ?award wdt:P279* wd:Q19020.
      ?item wikibase:sitelinks ?l. FILTER(?l>30)
    } GROUP BY ?item`,
  },
  {
    id: 'video_games',
    label: 'Video Games',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q7889; wdt:P123 []; wikibase:sitelinks ?l. FILTER(?l>30)
    } GROUP BY ?item`,
  },
  {
    id: 'anime',
    label: 'Anime & Manga',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q1107; wikibase:sitelinks ?l. FILTER(?l>30)
    } GROUP BY ?item`,
  },

  // ── Music ─────────────────────────────────────────────────────────────────
  {
    id: 'music',
    label: 'Music (all artists)',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q5; wdt:P106 wd:Q639669; wdt:P264 []; wikibase:sitelinks ?l. FILTER(?l>30)
    } GROUP BY ?item`,
  },
  {
    id: 'rock_music',
    label: 'Rock Music',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q5; wdt:P106 wd:Q639669; wdt:P136 wd:Q11399; wikibase:sitelinks ?l. FILTER(?l>30)
    } GROUP BY ?item`,
  },
  {
    id: 'hip_hop',
    label: 'Hip-Hop',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q5; wdt:P106 wd:Q639669; wdt:P136 wd:Q11401; wikibase:sitelinks ?l. FILTER(?l>25)
    } GROUP BY ?item`,
  },
  {
    id: 'pop_music',
    label: 'Pop Music',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q5; wdt:P106 wd:Q639669; wdt:P136 wd:Q37073; wikibase:sitelinks ?l. FILTER(?l>30)
    } GROUP BY ?item`,
  },
  {
    id: 'classical_music',
    label: 'Classical Music',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q5; wdt:P106 wd:Q36834; wikibase:sitelinks ?l. FILTER(?l>40)
    } GROUP BY ?item`,
  },
  {
    id: 'jazz',
    label: 'Jazz',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q5; wdt:P106 wd:Q639669; wdt:P136 wd:Q8341; wikibase:sitelinks ?l. FILTER(?l>25)
    } GROUP BY ?item`,
  },
  {
    id: 'rnb_soul',
    label: 'R&B / Soul',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q5; wdt:P106 wd:Q639669; wdt:P136 wd:Q850412; wikibase:sitelinks ?l. FILTER(?l>25)
    } GROUP BY ?item`,
  },
  {
    id: 'country_music',
    label: 'Country Music',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q5; wdt:P106 wd:Q639669; wdt:P136 wd:Q83440; wikibase:sitelinks ?l. FILTER(?l>25)
    } GROUP BY ?item`,
  },
  {
    id: 'electronic_music',
    label: 'Electronic / Dance Music',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q5; wdt:P106 wd:Q639669; wdt:P136 wd:Q9778; wikibase:sitelinks ?l. FILTER(?l>25)
    } GROUP BY ?item`,
  },
  {
    id: 'bands',
    label: 'Music Bands',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q215380; wdt:P264 []; wikibase:sitelinks ?l. FILTER(?l>30)
    } GROUP BY ?item`,
  },

  // ── Sport ─────────────────────────────────────────────────────────────────
  {
    id: 'football_soccer',
    label: 'Football / Soccer',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q5; wdt:P641 wd:Q2736; wdt:P54 []; wikibase:sitelinks ?l. FILTER(?l>30)
    } GROUP BY ?item`,
  },
  {
    id: 'premier_league',
    label: 'Premier League',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q5; wdt:P54 ?team. ?team wdt:P118 wd:Q9448.
      ?item wikibase:sitelinks ?l. FILTER(?l>20)
    } GROUP BY ?item`,
  },
  {
    id: 'la_liga',
    label: 'La Liga',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q5; wdt:P54 ?team. ?team wdt:P118 wd:Q324867.
      ?item wikibase:sitelinks ?l. FILTER(?l>20)
    } GROUP BY ?item`,
  },
  {
    id: 'bundesliga',
    label: 'Bundesliga',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q5; wdt:P54 ?team. ?team wdt:P118 wd:Q82595.
      ?item wikibase:sitelinks ?l. FILTER(?l>20)
    } GROUP BY ?item`,
  },
  {
    id: 'nba',
    label: 'NBA Basketball',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q5; wdt:P641 wd:Q5372; wdt:P54 ?team. ?team wdt:P118 wd:Q155223.
      ?item wikibase:sitelinks ?l. FILTER(?l>20)
    } GROUP BY ?item`,
  },
  {
    id: 'nfl',
    label: 'NFL American Football',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q5; wdt:P106 wd:Q19204627; wikibase:sitelinks ?l. FILTER(?l>30)
    } GROUP BY ?item`,
  },
  {
    id: 'mlb',
    label: 'MLB Baseball',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q5; wdt:P106 wd:Q10871364; wikibase:sitelinks ?l. FILTER(?l>30)
    } GROUP BY ?item`,
  },
  {
    id: 'nhl',
    label: 'NHL Ice Hockey',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q5; wdt:P106 wd:Q11774891; wikibase:sitelinks ?l. FILTER(?l>25)
    } GROUP BY ?item`,
  },
  {
    id: 'formula1',
    label: 'Formula 1',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q5; wdt:P641 wd:Q1968; wikibase:sitelinks ?l. FILTER(?l>25)
    } GROUP BY ?item`,
  },
  {
    id: 'tennis',
    label: 'Tennis',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q5; wdt:P641 wd:Q847; wikibase:sitelinks ?l. FILTER(?l>30)
    } GROUP BY ?item`,
  },
  {
    id: 'golf',
    label: 'Golf',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q5; wdt:P641 wd:Q5377; wikibase:sitelinks ?l. FILTER(?l>25)
    } GROUP BY ?item`,
  },
  {
    id: 'boxing',
    label: 'Boxing',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q5; wdt:P641 wd:Q32112; wikibase:sitelinks ?l. FILTER(?l>25)
    } GROUP BY ?item`,
  },
  {
    id: 'cricket',
    label: 'Cricket',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q5; wdt:P106 wd:Q12299841; wikibase:sitelinks ?l. FILTER(?l>25)
    } GROUP BY ?item`,
  },
  {
    id: 'rugby',
    label: 'Rugby',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q5; wdt:P106 wd:Q13141064; wikibase:sitelinks ?l. FILTER(?l>20)
    } GROUP BY ?item`,
  },
  {
    id: 'cycling',
    label: 'Cycling',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q5; wdt:P106 wd:Q2309784; wikibase:sitelinks ?l. FILTER(?l>25)
    } GROUP BY ?item`,
  },
  {
    id: 'athletics',
    label: 'Athletics / Track & Field',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q5; wdt:P641 wd:Q542; wikibase:sitelinks ?l. FILTER(?l>25)
    } GROUP BY ?item`,
  },
  {
    id: 'mma',
    label: 'MMA / UFC',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q5; wdt:P641 wd:Q81103; wikibase:sitelinks ?l. FILTER(?l>20)
    } GROUP BY ?item`,
  },
  {
    id: 'swimming',
    label: 'Swimming',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q5; wdt:P641 wd:Q31920; wikibase:sitelinks ?l. FILTER(?l>20)
    } GROUP BY ?item`,
  },

  // ── History & Politics ────────────────────────────────────────────────────
  {
    id: 'world_history',
    label: 'World History (politicians)',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q5; wdt:P106 wd:Q82955; wdt:P102 []; wikibase:sitelinks ?l. FILTER(?l>30)
    } GROUP BY ?item`,
  },
  {
    id: 'us_politics',
    label: 'US Presidents & Politics',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q5; wdt:P27 wd:Q30; wdt:P106 wd:Q82955; wikibase:sitelinks ?l. FILTER(?l>40)
    } GROUP BY ?item`,
  },
  {
    id: 'ancient_history',
    label: 'Ancient History',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q5; wdt:P570 ?died. FILTER(YEAR(?died) < 500)
      ?item wikibase:sitelinks ?l. FILTER(?l>50)
    } GROUP BY ?item`,
  },
  {
    id: 'ww2',
    label: 'World War II figures',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q5; wdt:P570 ?d. FILTER(YEAR(?d) > 1890 && YEAR(?d) < 1970)
      ?item wdt:P106 wd:Q82955; wikibase:sitelinks ?l. FILTER(?l>50)
    } GROUP BY ?item`,
  },
  {
    id: 'philosophers',
    label: 'Philosophy',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q5; wdt:P106 wd:Q4964182; wikibase:sitelinks ?l. FILTER(?l>40)
    } GROUP BY ?item`,
  },
  {
    id: 'explorers',
    label: 'Explorers & Adventurers',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q5; wdt:P106 wd:Q11513337; wikibase:sitelinks ?l. FILTER(?l>30)
    } GROUP BY ?item`,
  },
  {
    id: 'empires',
    label: 'Empires & Kingdoms',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q48349; wikibase:sitelinks ?l. FILTER(?l>40)
    } GROUP BY ?item`,
  },
  {
    id: 'revolutions',
    label: 'Revolutions & Independence',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q10931; wikibase:sitelinks ?l. FILTER(?l>30)
    } GROUP BY ?item`,
  },

  // ── Science & Tech ────────────────────────────────────────────────────────
  {
    id: 'science',
    label: 'Science (all)',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q5; wdt:P106 wd:Q901; wdt:P108 []; wikibase:sitelinks ?l. FILTER(?l>25)
    } GROUP BY ?item`,
  },
  {
    id: 'physics',
    label: 'Physics',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q5; wdt:P101 wd:Q413; wikibase:sitelinks ?l. FILTER(?l>30)
    } GROUP BY ?item`,
  },
  {
    id: 'space',
    label: 'Space & Astronomy',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      { ?item wdt:P31 wd:Q5; wdt:P106 wd:Q11631 }
      UNION { ?item wdt:P31 wd:Q634 }
      ?item wikibase:sitelinks ?l. FILTER(?l>30)
    } GROUP BY ?item`,
  },
  {
    id: 'nobel',
    label: 'Nobel Prize Winners',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q5; wdt:P166 ?award. ?award wdt:P279* wd:Q35637.
      ?item wikibase:sitelinks ?l. FILTER(?l>30)
    } GROUP BY ?item`,
  },
  {
    id: 'mathematics',
    label: 'Mathematics',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q5; wdt:P101 wd:Q395; wikibase:sitelinks ?l. FILTER(?l>30)
    } GROUP BY ?item`,
  },
  {
    id: 'inventors',
    label: 'Inventors & Innovators',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q5; wdt:P106 wd:Q205375; wikibase:sitelinks ?l. FILTER(?l>30)
    } GROUP BY ?item`,
  },
  {
    id: 'tech_companies',
    label: 'Tech Companies',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q4830453; wdt:P452 wd:Q11661; wikibase:sitelinks ?l. FILTER(?l>40)
    } GROUP BY ?item`,
  },
  {
    id: 'medicine',
    label: 'Medicine & Health',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q5; wdt:P106 wd:Q39631; wikibase:sitelinks ?l. FILTER(?l>30)
    } GROUP BY ?item`,
  },
  {
    id: 'biology',
    label: 'Biology & Nature',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q5; wdt:P101 wd:Q420; wikibase:sitelinks ?l. FILTER(?l>25)
    } GROUP BY ?item`,
  },
  {
    id: 'chemistry',
    label: 'Chemistry',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q5; wdt:P101 wd:Q2329; wikibase:sitelinks ?l. FILTER(?l>25)
    } GROUP BY ?item`,
  },
  {
    id: 'elements',
    label: 'Chemical Elements',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q11344; wikibase:sitelinks ?l. FILTER(?l>30)
    } GROUP BY ?item`,
  },

  // ── Geography ─────────────────────────────────────────────────────────────
  {
    id: 'countries',
    label: 'Countries & Nations',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q6256; wikibase:sitelinks ?l. FILTER(?l>50)
    } GROUP BY ?item`,
  },
  {
    id: 'cities',
    label: 'World Cities',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q515; wikibase:sitelinks ?l. FILTER(?l>50)
    } GROUP BY ?item`,
  },
  {
    id: 'us_geography',
    label: 'US States & Cities',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      { ?item wdt:P31 wd:Q35657 }
      UNION { ?item wdt:P31 wd:Q515; wdt:P17 wd:Q30 }
      ?item wikibase:sitelinks ?l. FILTER(?l>30)
    } GROUP BY ?item`,
  },
  {
    id: 'mountains',
    label: 'Mountains & Volcanoes',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      { ?item wdt:P31 wd:Q8502 } UNION { ?item wdt:P31 wd:Q8072 }
      ?item wikibase:sitelinks ?l. FILTER(?l>25)
    } GROUP BY ?item`,
  },
  {
    id: 'rivers_lakes',
    label: 'Rivers & Lakes',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      { ?item wdt:P31 wd:Q4022 } UNION { ?item wdt:P31 wd:Q23397 }
      ?item wikibase:sitelinks ?l. FILTER(?l>30)
    } GROUP BY ?item`,
  },
  {
    id: 'landmarks',
    label: 'World Landmarks',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q570116; wikibase:sitelinks ?l. FILTER(?l>30)
    } GROUP BY ?item`,
  },
  {
    id: 'space_objects',
    label: 'Planets, Moons & Space',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      { ?item wdt:P31 wd:Q634 } UNION { ?item wdt:P31 wd:Q2537 } UNION { ?item wdt:P31 wd:Q523 }
      ?item wikibase:sitelinks ?l. FILTER(?l>20)
    } GROUP BY ?item`,
  },

  // ── Arts & Culture ────────────────────────────────────────────────────────
  {
    id: 'literature',
    label: 'Literature & Authors',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q5; wdt:P106 wd:Q36180; wikibase:sitelinks ?l. FILTER(?l>40)
    } GROUP BY ?item`,
  },
  {
    id: 'novels',
    label: 'Famous Novels',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q7725634; wdt:P50 []; wikibase:sitelinks ?l. FILTER(?l>30)
    } GROUP BY ?item`,
  },
  {
    id: 'visual_art',
    label: 'Visual Art & Painters',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q5; wdt:P106 wd:Q1028181; wikibase:sitelinks ?l. FILTER(?l>40)
    } GROUP BY ?item`,
  },
  {
    id: 'architecture',
    label: 'Architecture & Architects',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q5; wdt:P106 wd:Q42973; wikibase:sitelinks ?l. FILTER(?l>35)
    } GROUP BY ?item`,
  },
  {
    id: 'mythology',
    label: 'Mythology & Legends',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q4271324; wikibase:sitelinks ?l. FILTER(?l>30)
    } GROUP BY ?item`,
  },
  {
    id: 'musicals',
    label: 'Musicals',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q2743; wikibase:sitelinks ?l. FILTER(?l>25)
    } GROUP BY ?item`,
  },
  {
    id: 'theatre',
    label: 'Theatre & Playwrights',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q5; wdt:P106 wd:Q214917; wikibase:sitelinks ?l. FILTER(?l>30)
    } GROUP BY ?item`,
  },
  {
    id: 'comedy',
    label: 'Stand-up Comedy',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q5; wdt:P106 wd:Q245068; wikibase:sitelinks ?l. FILTER(?l>30)
    } GROUP BY ?item`,
  },
  {
    id: 'fashion',
    label: 'Fashion & Designers',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q5; wdt:P106 wd:Q3501317; wikibase:sitelinks ?l. FILTER(?l>30)
    } GROUP BY ?item`,
  },
  {
    id: 'photography',
    label: 'Photography',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q5; wdt:P106 wd:Q33231; wikibase:sitelinks ?l. FILTER(?l>30)
    } GROUP BY ?item`,
  },

  // ── Nature & Animals ──────────────────────────────────────────────────────
  {
    id: 'animals',
    label: 'Animals & Wildlife',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q16521; wdt:P171 []; wikibase:sitelinks ?l. FILTER(?l>40)
    } GROUP BY ?item`,
  },
  {
    id: 'dinosaurs',
    label: 'Dinosaurs & Prehistoric',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P171* wd:Q430; wikibase:sitelinks ?l. FILTER(?l>20)
    } GROUP BY ?item`,
  },
  {
    id: 'plants',
    label: 'Plants & Botany',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q16521; wdt:P171* wd:Q756; wikibase:sitelinks ?l. FILTER(?l>30)
    } GROUP BY ?item`,
  },

  // ── Food & Lifestyle ──────────────────────────────────────────────────────
  {
    id: 'food',
    label: 'Food & Cuisine',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q2095; wikibase:sitelinks ?l. FILTER(?l>30)
    } GROUP BY ?item`,
  },
  {
    id: 'chefs',
    label: 'Chefs & Restaurants',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q5; wdt:P106 wd:Q3499072; wikibase:sitelinks ?l. FILTER(?l>25)
    } GROUP BY ?item`,
  },
  {
    id: 'drinks',
    label: 'Drinks & Beverages',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q40050; wikibase:sitelinks ?l. FILTER(?l>25)
    } GROUP BY ?item`,
  },

  // ── Business ──────────────────────────────────────────────────────────────
  {
    id: 'companies',
    label: 'Global Companies',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q4830453; wikibase:sitelinks ?l. FILTER(?l>50)
    } GROUP BY ?item`,
  },
  {
    id: 'ceos',
    label: 'Business Leaders / CEOs',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q5; wdt:P106 wd:Q484876; wikibase:sitelinks ?l. FILTER(?l>35)
    } GROUP BY ?item`,
  },
  {
    id: 'airlines',
    label: 'Airlines & Aviation',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q46970; wikibase:sitelinks ?l. FILTER(?l>25)
    } GROUP BY ?item`,
  },
  {
    id: 'cars',
    label: 'Cars & Auto Brands',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q3947; wdt:P176 []; wikibase:sitelinks ?l. FILTER(?l>30)
    } GROUP BY ?item`,
  },

  // ── Society & Culture ─────────────────────────────────────────────────────
  {
    id: 'religion',
    label: 'World Religions',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q9174; wikibase:sitelinks ?l. FILTER(?l>30)
    } GROUP BY ?item`,
  },
  {
    id: 'languages',
    label: 'Languages',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q34770; wikibase:sitelinks ?l. FILTER(?l>40)
    } GROUP BY ?item`,
  },
  {
    id: 'military',
    label: 'Military Leaders',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q5; wdt:P106 wd:Q47064; wikibase:sitelinks ?l. FILTER(?l>35)
    } GROUP BY ?item`,
  },
  {
    id: 'royals',
    label: 'Royals & Monarchs (global)',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q5; wdt:P39 ?pos. ?pos wdt:P279* wd:Q116.
      ?item wikibase:sitelinks ?l. FILTER(?l>40)
    } GROUP BY ?item`,
  },
  {
    id: 'universities',
    label: 'Universities & Colleges',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q3918; wikibase:sitelinks ?l. FILTER(?l>40)
    } GROUP BY ?item`,
  },
  {
    id: 'museums',
    label: 'Museums & Galleries',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q33506; wikibase:sitelinks ?l. FILTER(?l>30)
    } GROUP BY ?item`,
  },
  {
    id: 'newspapers',
    label: 'Newspapers & Media',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q11032; wikibase:sitelinks ?l. FILTER(?l>30)
    } GROUP BY ?item`,
  },
  {
    id: 'space_missions',
    label: 'Space Missions',
    query: `SELECT DISTINCT ?item (MAX(?l) AS ?links) WHERE {
      ?item wdt:P31 wd:Q2133344; wikibase:sitelinks ?l. FILTER(?l>20)
    } GROUP BY ?item`,
  },
]

// ---------------------------------------------------------------------------
// Probe runner
// ---------------------------------------------------------------------------
async function probe(candidate: Candidate): Promise<ProbeResult> {
  const url = `${WIKIDATA_ENDPOINT}?query=${encodeURIComponent(candidate.query)}&format=json`
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20000)
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'RabbitHoleGame/1.0 (category-probe)',
        Accept: 'application/sparql-results+json',
      },
    })
    clearTimeout(timeout)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json() as { results: { bindings: Array<Record<string, { value: string }>> } }
    const rows = data.results.bindings
    if (rows.length === 0) return { ...candidate, entityCount: 0, avgSitelinks: 0, highFameCount: 0, score: 0, status: 'thin' }
    const sitelinkValues = rows.map(r => parseInt(r.links?.value ?? '0')).filter(n => n > 0)
    const avg = sitelinkValues.length > 0 ? sitelinkValues.reduce((a, b) => a + b, 0) / sitelinkValues.length : 0
    const highFameCount = sitelinkValues.filter(s => s > 80).length
    const count = rows.length
    const score = Math.round(count * avg / 1000)
    return { ...candidate, entityCount: count, avgSitelinks: Math.round(avg), highFameCount, score, status: count >= 20 ? 'ok' : 'thin' }
  } catch (err: any) {
    const status = err?.name === 'AbortError' ? 'timeout' : 'error'
    return { ...candidate, entityCount: 0, avgSitelinks: 0, highFameCount: 0, score: 0, status }
  }
}

async function main() {
  const results: ProbeResult[] = []
  const BATCH = 5
  const DELAY_MS = 2000

  console.log(`Probing ${CANDIDATES.length} candidates in batches of ${BATCH}...\n`)

  for (let i = 0; i < CANDIDATES.length; i += BATCH) {
    const batch = CANDIDATES.slice(i, i + BATCH)
    const batchResults = await Promise.all(batch.map(probe))
    results.push(...batchResults)
    for (const r of batchResults) {
      const icon = r.status === 'ok' ? '✓' : r.status === 'thin' ? '~' : '✗'
      console.log(`${icon} ${r.label.padEnd(35)} entities=${String(r.entityCount).padStart(5)}  avgLinks=${String(r.avgSitelinks).padStart(5)}  high80=${String(r.highFameCount).padStart(4)}  score=${String(r.score).padStart(6)}`)
    }
    if (i + BATCH < CANDIDATES.length) await new Promise(r => setTimeout(r, DELAY_MS))
  }

  // Sort by highFameCount descending — best puzzle quality signal
  const byHighFame = [...results].sort((a, b) => b.highFameCount - a.highFameCount)
  const byScore = [...results].sort((a, b) => b.score - a.score)

  console.log('\n\n════════════════════════════════════════════════════════════════')
  console.log('RANKED BY HIGH-FAME ENTITIES (>80 sitelinks) — best puzzle quality')
  console.log('════════════════════════════════════════════════════════════════\n')
  console.log('Rank  Category                           Entities  AvgLinks  High80    Score  Status')
  console.log('────  ─────────────────────────────────  ────────  ────────  ──────  ───────  ──────')
  byHighFame.forEach((r, i) => {
    const rank = String(i + 1).padStart(4)
    const label = r.label.padEnd(35)
    const count = String(r.entityCount).padStart(8)
    const avg = String(r.avgSitelinks).padStart(8)
    const high = String(r.highFameCount).padStart(6)
    const score = String(r.score).padStart(7)
    console.log(`${rank}  ${label}  ${count}  ${avg}  ${high}  ${score}  ${r.status}`)
  })

  console.log('\n\n════════════════════════════════════════════════════════════════')
  console.log('RANKED BY SCORE (entityCount × avgSitelinks) — breadth signal')
  console.log('════════════════════════════════════════════════════════════════\n')
  console.log('Rank  Category                           Entities  AvgLinks  High80    Score  Status')
  console.log('────  ─────────────────────────────────  ────────  ────────  ──────  ───────  ──────')
  byScore.forEach((r, i) => {
    const rank = String(i + 1).padStart(4)
    const label = r.label.padEnd(35)
    const count = String(r.entityCount).padStart(8)
    const avg = String(r.avgSitelinks).padStart(8)
    const high = String(r.highFameCount).padStart(6)
    const score = String(r.score).padStart(7)
    console.log(`${rank}  ${label}  ${count}  ${avg}  ${high}  ${score}  ${r.status}`)
  })

  const outPath = path.join(__dirname, '../../category-probe-results.json')
  fs.writeFileSync(outPath, JSON.stringify({ byHighFame, byScore }, null, 2))
  console.log(`\nFull results saved to: ${outPath}`)
  console.log(`Total candidates: ${CANDIDATES.length}`)
}

main().catch(console.error)
