import { sq, TaggedSubquery } from '../wikidataHelpers'

// Sport uses multiple focused queries to avoid Wikidata timeouts
export const SPORT_SUBQUERIES: TaggedSubquery[] = [
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
