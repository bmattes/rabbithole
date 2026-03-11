import { sq, TaggedSubquery } from '../wikidataHelpers'

// ---- Genre-specific music subqueries ----
// Each genre uses P136 (genre) to filter artists/songs to the relevant genre cluster.
// Wikidata genre QIDs:
//   Rock:    Q11399   Hip-hop: Q11401   Pop: Q37073
//   R&B:     Q131272  Soul:    Q213714  Country: Q83440
//
// Pattern: same structure as MUSIC_SUBQUERIES but with a genre filter on ?a or ?b.
// Rock music (Q11399): artist→label, artist→influences, song→performer, genre bridges
export const ROCK_SUBQUERIES: TaggedSubquery[] = [
  // Rock artist → record label (easy)
  sq('easy', ['person', 'label'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?genre { wd:Q11399 wd:Q5647 wd:Q38848 wd:Q484641 wd:Q45981 }
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q639669; wdt:P264 ?b; wdt:P136 ?genre.
  ?a wikibase:sitelinks ?links. FILTER(?links > 20)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'signed to'),
  // Rock song → performer (easy: iconic rock songs → band/artist)
  sq('easy', ['song', 'person'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?genre { wd:Q11399 wd:Q5647 wd:Q38848 wd:Q484641 wd:Q45981 }
  VALUES ?songType { wd:Q7366 wd:Q134556 wd:Q208569 }
  ?a wdt:P31 ?songType; wdt:P175 ?b; wdt:P136 ?genre.
  ?a wikibase:sitelinks ?links. FILTER(?links > 15)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'performed by'),
  // Rock artist → record label (medium)
  sq('medium', ['person', 'label'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  VALUES ?genre { wd:Q11399 wd:Q5647 wd:Q38848 wd:Q484641 wd:Q45981 }
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q639669; wdt:P264 ?b; wdt:P136 ?genre.
  ?a wikibase:sitelinks ?links. FILTER(?links > 30)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 25)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'signed to'),
  // Rock artist → influenced by (hard: both artist and influence must be rock/adjacent genre)
  sq('hard', ['person', 'person'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?genre { wd:Q11399 wd:Q5647 wd:Q38848 wd:Q484641 wd:Q45981 }
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q639669; wdt:P737 ?b; wdt:P136 ?genre.
  ?b wdt:P31 wd:Q5; wdt:P106 wd:Q639669; wdt:P136 ?genre.
  ?a wikibase:sitelinks ?links. FILTER(?links > 40)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 30)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'influenced by'),
]
