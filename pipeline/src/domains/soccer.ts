import { sq, TaggedSubquery } from '../wikidataHelpers'

// Soccer: footballer → club (high sitelinks to stay fast), club → league
export const SOCCER_SUBQUERIES: TaggedSubquery[] = [
  // Footballer → club (easy: top players, famous clubs)
  sq('easy', ['person', 'team'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q937857; wdt:P54 ?b.
  ?b wdt:P31 wd:Q476028.
  ?a wikibase:sitelinks ?links. FILTER(?links > 50)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'played for'),
  // Club → league (medium: requires league knowledge)
  sq('medium', ['team', 'league'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q476028; wdt:P641 wd:Q2736; wdt:P118 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 30)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'plays in'),
  // Player → place of birth (hard: geographic birthplace connection)
  sq('hard', ['person', 'country'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q937857; wdt:P19 ?b.
  ?b wdt:P31 wd:Q6256.
  ?a wikibase:sitelinks ?links. FILTER(?links > 40)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 30)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'born in'),
  // Player → position played (hard: striker/goalkeeper/midfielder — requires tactical knowledge)
  sq('hard', ['person', 'other'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q937857; wdt:P413 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 40)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 5)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'plays as'),
  // Club → head coach/manager (hard: manager knowledge is for dedicated fans)
  sq('hard', ['team', 'person'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q476028; wdt:P641 wd:Q2736; wdt:P286 ?b.
  ?b wdt:P31 wd:Q5.
  ?a wikibase:sitelinks ?links. FILTER(?links > 30)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 20)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'managed by'),
  // Player → award received (easy: Ballon d'Or, FIFA Best, Golden Boot — every casual soccer fan knows these)
  sq('easy', ['person', 'other'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?b { wd:Q170022 wd:Q1356490 wd:Q1369908 wd:Q876371 wd:Q1221592 wd:Q1365160 }
  ?a wdt:P31 wd:Q5; wdt:P166 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 20)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'awarded'),
  // Player → place of birth (medium: birthplace cities connect players — São Paulo, Buenos Aires, Lagos, Madrid)
  sq('medium', ['person', 'other'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q937857; wdt:P19 ?b.
  ?b wdt:P31 wd:Q515.
  ?a wikibase:sitelinks ?links. FILTER(?links > 20)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 30)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'born in'),
  // Team → manager / head coach (medium: Guardiola, Mourinho, Klopp managed multiple clubs — bridges teams)
  sq('medium', ['team', 'person'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q476028; wdt:P286 ?b.
  ?b wdt:P31 wd:Q5.
  ?a wikibase:sitelinks ?links. FILTER(?links > 20)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 25)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'managed by'),
]
