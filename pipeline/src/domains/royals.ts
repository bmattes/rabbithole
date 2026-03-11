import { sq, TaggedSubquery } from '../wikidataHelpers'

// Royals: monarch → country (via P27 citizenship), monarch → noble house (P53)
export const ROYALS_SUBQUERIES: TaggedSubquery[] = [
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
