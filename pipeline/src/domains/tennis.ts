import { sq, TaggedSubquery } from '../wikidataHelpers'

// Tennis: player → national cup team (Davis/BJK), player → coach
// These are the two reliably populated relationship types in Wikidata for tennis players
export const TENNIS_SUBQUERIES: TaggedSubquery[] = [
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
