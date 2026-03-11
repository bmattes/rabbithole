import { sq, TaggedSubquery } from '../wikidataHelpers'

// Music subqueries — split by entity type so we can tag them correctly
export const MUSIC_SUBQUERIES: TaggedSubquery[] = [
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
