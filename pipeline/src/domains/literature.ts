import { sq, TaggedSubquery } from '../wikidataHelpers'

// Literature: author → movement/genre, novel → author
export const LITERATURE_SUBQUERIES: TaggedSubquery[] = [
  // Novel → author (easy: direct, famous works)
  sq('easy', ['book', 'person'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?bookType { wd:Q7725634 wd:Q8261 wd:Q1667921 }
  ?a wdt:P31 ?bookType; wdt:P50 ?b.
  ?b wdt:P31 wd:Q5.
  ?a wikibase:sitelinks ?links. FILTER(?links > 15)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'written by'),
  // Author → literary movement (easy: well-known movements bridge authors, enabling longer paths)
  sq('easy', ['person', 'movement'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q36180; wdt:P135 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 20)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'part of movement'),
  // Author → literary movement/genre (medium: P135|P101, broader)
  sq('medium', ['person', 'field'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q36180; wdt:P135|wdt:P101 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 10)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'part of movement'),
  // Author → influenced by (hard: intellectual lineage between writers)
  sq('hard', ['person', 'person'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q36180; wdt:P737 ?b.
  ?b wdt:P31 wd:Q5.
  ?a wikibase:sitelinks ?links. FILTER(?links > 20)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 20)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'influenced by'),
  // Author → alma mater (hard: shared educational institution)
  sq('hard', ['person', 'other'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q36180; wdt:P69 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 20)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 30)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'educated at'),
  // Book → genre (hard: genre classification for books — literary fiction, sci-fi, mystery)
  sq('hard', ['book', 'genre'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  VALUES ?bookType { wd:Q7725634 wd:Q8261 wd:Q1667921 }
  ?a wdt:P31 ?bookType; wdt:P136 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 15)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 20)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'belongs to genre'),
  // Author → country of citizenship (easy: nationality connects authors — British, French, American, Russian writers)
  sq('easy', ['person', 'other'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q36180; wdt:P27 ?b.
  ?b wdt:P31 wd:Q6256.
  ?a wikibase:sitelinks ?links. FILTER(?links > 20)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 50)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'from'),
  // Author → award received (medium: Nobel Prize in Literature, Booker Prize, Pulitzer — recognisable by casual readers)
  sq('medium', ['person', 'other'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?b { wd:Q37922 wd:Q160082 wd:Q44585 wd:Q166552 wd:Q35637 wd:Q131539 wd:Q179131 }
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q36180; wdt:P166 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 15)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'received award'),
  // Author → place of birth (medium: birthplace cities/countries connect authors across eras — Paris, London, New York, St Petersburg)
  sq('medium', ['person', 'other'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q36180; wdt:P19 ?b.
  ?b wdt:P31 wd:Q515.
  ?a wikibase:sitelinks ?links. FILTER(?links > 20)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 30)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'born in'),
]
