import { sq, TaggedSubquery } from '../wikidataHelpers'

// R&B / Soul (Q131272 R&B, Q213714 soul)
export const RNB_SUBQUERIES: TaggedSubquery[] = [
  sq('easy', ['person', 'label'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?genre { wd:Q131272 wd:Q213714 wd:Q206159 wd:Q484641 }
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q639669; wdt:P264 ?b; wdt:P136 ?genre.
  ?a wikibase:sitelinks ?links. FILTER(?links > 20)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'signed to'),
  sq('easy', ['song', 'person'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?genre { wd:Q131272 wd:Q213714 wd:Q206159 }
  VALUES ?songType { wd:Q7366 wd:Q134556 wd:Q208569 }
  ?a wdt:P31 ?songType; wdt:P175 ?b; wdt:P136 ?genre.
  ?a wikibase:sitelinks ?links. FILTER(?links > 15)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'performed by'),
  sq('medium', ['person', 'label'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  VALUES ?genre { wd:Q131272 wd:Q213714 wd:Q206159 wd:Q484641 }
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q639669; wdt:P264 ?b; wdt:P136 ?genre.
  ?a wikibase:sitelinks ?links. FILTER(?links > 30)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 20)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'signed to'),
  sq('hard', ['person', 'person'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?genre { wd:Q131272 wd:Q213714 wd:Q206159 }
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q639669; wdt:P737 ?b; wdt:P136 ?genre.
  ?b wdt:P31 wd:Q5; wdt:P106 wd:Q639669; wdt:P136 ?genre.
  ?a wikibase:sitelinks ?links. FILTER(?links > 60)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 30)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'influenced by'),
]
