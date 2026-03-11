import { sq, TaggedSubquery } from '../wikidataHelpers'

// Pop music (Q37073)
export const POP_SUBQUERIES: TaggedSubquery[] = [
  sq('easy', ['person', 'label'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?genre { wd:Q37073 wd:Q484641 wd:Q2964303 }
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q639669; wdt:P264 ?b; wdt:P136 ?genre.
  ?a wikibase:sitelinks ?links. FILTER(?links > 20)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'signed to'),
  sq('easy', ['song', 'person'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?genre { wd:Q37073 wd:Q484641 wd:Q2964303 }
  VALUES ?songType { wd:Q7366 wd:Q134556 wd:Q208569 }
  ?a wdt:P31 ?songType; wdt:P175 ?b; wdt:P136 ?genre.
  ?a wikibase:sitelinks ?links. FILTER(?links > 15)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'performed by'),
  sq('medium', ['person', 'label'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  VALUES ?genre { wd:Q37073 wd:Q484641 wd:Q2964303 }
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q639669; wdt:P264 ?b; wdt:P136 ?genre.
  ?a wikibase:sitelinks ?links. FILTER(?links > 30)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 25)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'signed to'),
  sq('hard', ['person', 'person'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?genre { wd:Q37073 wd:Q484641 }
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q639669; wdt:P737 ?b; wdt:P136 ?genre.
  ?b wdt:P31 wd:Q5; wdt:P106 wd:Q639669; wdt:P136 ?genre.
  ?a wikibase:sitelinks ?links. FILTER(?links > 40)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 30)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'influenced by'),
]
