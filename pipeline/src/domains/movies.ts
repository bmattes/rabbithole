import { sq, TaggedSubquery } from '../wikidataHelpers'

// Movies uses multiple focused queries merged together instead of one large join
export const MOVIES_SUBQUERIES: TaggedSubquery[] = [
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
  // Film → genre (easy: Action, Comedy, Drama, Horror, Sci-Fi — every casual viewer knows genres)
  sq('easy', ['film', 'other'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q11424; wdt:P136 ?b.
  ?b wdt:P31 wd:Q201658.
  ?a wikibase:sitelinks ?links. FILTER(?links > 30)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 50)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'genre'),
  // Film → award received (medium: Oscar, BAFTA, Cannes Palme d'Or — well-known film awards)
  sq('medium', ['film', 'other'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?b { wd:Q102427 wd:Q19020 wd:Q41417 wd:Q44584 wd:Q44585 wd:Q28943867 wd:Q106291 }
  ?a wdt:P31 wd:Q11424; wdt:P166 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 25)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'won award'),
  // Film → narrative setting / set in (medium: films set in Paris, New York, London, Tokyo — players recognise famous settings)
  sq('medium', ['film', 'other'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q11424; wdt:P840 ?b.
  ?b wdt:P31 wd:Q515.
  ?a wikibase:sitelinks ?links. FILTER(?links > 25)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 40)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'set in'),
  // Film → filming location (hard: actual shoot location differs from narrative setting — niche knowledge)
  sq('hard', ['film', 'other'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q11424; wdt:P915 ?b.
  ?b wdt:P31 wd:Q515.
  ?a wikibase:sitelinks ?links. FILTER(?links > 25)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 30)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'filmed in'),
]
