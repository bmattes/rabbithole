import { sq, TaggedSubquery } from '../wikidataHelpers'

// Philosophy: philosopher → notable work, philosopher → school, philosopher → influenced by
// Removed philosopher→country (P27 nationality) subquery — countries are wrong_domain bridges
export const PHILOSOPHY_SUBQUERIES: TaggedSubquery[] = [
  // Philosopher → notable work (easy: Plato→Republic, Kant→Critique of Pure Reason)
  sq('easy', ['person', 'work'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q4964182; wdt:P800 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 10)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'authored'),
  // Philosopher → philosophical school/movement (easy: bridges philosophers via well-known schools)
  sq('easy', ['person', 'movement'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q4964182; wdt:P135 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 15)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'part of movement'),
  // Philosopher → philosophical school/movement (medium: P737=influenced by + P135=movement)
  sq('medium', ['person', 'movement'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q4964182; wdt:P737|wdt:P135 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 10)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'school of thought'),
  // Philosopher → influenced by (hard: requires deeper philosophical knowledge, philosopher-to-philosopher only)
  sq('hard', ['person', 'person'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q4964182; wdt:P737 ?b.
  ?b wdt:P31 wd:Q5; wdt:P106 wd:Q4964182.
  ?a wikibase:sitelinks ?links. FILTER(?links > 20)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'influenced by'),
  // Philosopher → alma mater (hard: Oxford, Cambridge, Berlin — institutional connections)
  sq('hard', ['person', 'other'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q4964182; wdt:P69 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 15)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 30)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'educated at'),
]
