import { sq, TaggedSubquery } from '../wikidataHelpers'

// History: politician → party (easy), politician → position held (medium)
export const HISTORY_SUBQUERIES: TaggedSubquery[] = [
  // Politician → political party (easy: parties are widely recognisable bridge nodes)
  sq('easy', ['person', 'other'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q82955; wdt:P102 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 30)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'member of'),
  // Politician → politician: mentor/student, influenced-by (easy: direct person links)
  sq('easy', ['person', 'person'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q82955.
  { ?a wdt:P1066 ?b. } UNION { ?a wdt:P737 ?b. } UNION { ?a wdt:P3373 ?b. }
  ?b wdt:P31 wd:Q5; wdt:P106 wd:Q82955.
  ?a wikibase:sitelinks ?links. FILTER(?links > 20)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'connected to'),
  // Politician → position held (medium: offices like President, Prime Minister)
  sq('medium', ['person', 'office'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q82955; wdt:P39 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 30)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'held office'),
  // Historical figure → conflict/war they participated in (hard: requires detailed history knowledge)
  sq('hard', ['person', 'conflict'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P607 ?b.
  ?b wdt:P31 wd:Q198.
  ?a wikibase:sitelinks ?links. FILTER(?links > 20)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'fought in'),
  // Politician → ideological movement (hard: requires knowing what they stood for)
  sq('hard', ['person', 'movement'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q82955; wdt:P1142 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 20)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'aligned with'),
  // Historical figure → educated at (medium: Oxford, Cambridge, Harvard, Sorbonne — recognisable elite institutions)
  sq('medium', ['person', 'other'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q5; wdt:P69 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 35)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 50)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'educated at'),
  // Historical figure → award received (medium: Nobel Peace Prize, Presidential Medal of Freedom — cross-era recognition)
  sq('medium', ['person', 'other'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?b { wd:Q35637 wd:Q131226 wd:Q7191 wd:Q170483 wd:Q131539 wd:Q2747062 wd:Q131604 }
  ?a wdt:P31 wd:Q5; wdt:P166 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 30)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'received award'),
  // Historical figure → alma mater (hard: Oxford/Cambridge/Harvard connections across eras)
  sq('hard', ['person', 'other'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q5; wdt:P69 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 35)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 40)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'educated at'),
  // Historical figure → award (hard: Nobel Peace Prize, Presidential Medal of Freedom — cross-era recognition)
  sq('hard', ['person', 'other'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  VALUES ?b { wd:Q35637 wd:Q131226 wd:Q7191 wd:Q170483 wd:Q131539 wd:Q2747062 wd:Q131604 }
  ?a wdt:P31 wd:Q5; wdt:P166 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 30)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'received award'),
]
