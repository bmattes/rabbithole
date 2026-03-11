import { sq, TaggedSubquery } from '../wikidataHelpers'

// Science: scientist → employer/institution (easy), scientist → field of work (medium)
export const SCIENCE_SUBQUERIES: TaggedSubquery[] = [
  // Scientist → employer/institution (easy: universities and labs are well-known)
  sq('easy', ['person', 'other'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q901; wdt:P108 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 25)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'worked at'),
  // Scientist → field of work (medium: requires domain knowledge)
  sq('medium', ['person', 'field'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q901; wdt:P101 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 25)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'worked in'),
  // Scientist → alma mater (hard: educational institution connection)
  sq('hard', ['person', 'other'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q901; wdt:P69 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 25)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 30)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'educated at'),
  // Scientist → influenced by (hard: intellectual lineage — both must be well-known scientists)
  sq('hard', ['person', 'person'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q901; wdt:P737 ?b.
  ?b wdt:P31 wd:Q5.
  ?a wikibase:sitelinks ?links. FILTER(?links > 30)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 30)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'influenced by'),
  // Scientist → award (hard: Nobel Prize, Fields Medal — prestigious recognition)
  sq('hard', ['person', 'other'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  VALUES ?b { wd:Q7191 wd:Q38104 wd:Q25363 wd:Q44585 wd:Q11631 wd:Q35637 wd:Q131539 wd:Q28008836 wd:Q35637 wd:Q781026 }
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q901; wdt:P166 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 20)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'received award'),
  // Scientist → award received, prominent awards (easy: Nobel Prize is universally known — bridges scientists across fields)
  sq('easy', ['person', 'other'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?b { wd:Q7191 wd:Q38104 wd:Q25363 wd:Q44585 wd:Q11631 wd:Q35637 wd:Q44585 }
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q901; wdt:P166 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 25)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'received award'),
  // Scientist → educated at (easy: MIT, Cambridge, Harvard, ETH Zurich — recognisable to casual players)
  sq('easy', ['person', 'other'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q901; wdt:P69 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 25)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 50)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'studied at'),
  // Scientist → influenced by (medium: intellectual lineage — Darwin influenced by Malthus, Feynman influenced by Dirac)
  sq('medium', ['person', 'person'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q901; wdt:P737 ?b.
  ?b wdt:P31 wd:Q5.
  ?a wikibase:sitelinks ?links. FILTER(?links > 25)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 25)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'influenced by'),
]
