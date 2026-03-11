import { sq, TaggedSubquery } from '../wikidataHelpers'

// Comics: character → publisher, character → team, character → creator, creator → creator
// Q173496=Marvel Comics, Q2924461=DC Comics, Q1500953=Dark Horse, Q2303691=Image
export const COMICS_SUBQUERIES: TaggedSubquery[] = [
  // Comic character → publisher (easy: Marvel/DC widely known)
  sq('easy', ['character', 'publisher'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?b { wd:Q173496 wd:Q2924461 wd:Q1500953 wd:Q2303691 wd:Q835239 wd:Q617033 }
  ?a wdt:P31 wd:Q1114461; wdt:P123 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 5)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'published by'),
  // Comic character → team (easy: Avengers/X-Men/Justice League widely known)
  sq('easy', ['character', 'team'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q1114461; wdt:P463 ?b.
  ?b wdt:P31 wd:Q14514600.
  ?a wikibase:sitelinks ?links. FILTER(?links > 5)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'member of'),
  // Comic character → team affiliation (medium: requires team knowledge)
  sq('medium', ['character', 'team'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q1114461; wdt:P463 ?b.
  ?b wdt:P31 wd:Q14514600.
  ?a wikibase:sitelinks ?links. FILTER(?links > 5)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'member of'),
  // Comic character → creator (hard: writer/artist knowledge is niche)
  sq('hard', ['character', 'person'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q1114461; wdt:P170 ?b.
  ?b wdt:P31 wd:Q5.
  ?a wikibase:sitelinks ?links. FILTER(?links > 8)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'created by'),
  // Creator → publisher (hard: connects comic writers/artists via shared publisher)
  // Bridges Bob Kane→DC Comics→Neal Adams without requiring character intermediates
  sq('hard', ['person', 'publisher'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?b { wd:Q173496 wd:Q2924461 wd:Q1500953 wd:Q2303691 wd:Q835239 wd:Q617033 }
  ?a wdt:P31 wd:Q5; wdt:P108|wdt:P170 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 5)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'worked at'),
  // Creator → influenced by (hard: Jack Kirby→Will Eisner, Alan Moore→Steve Ditko)
  sq('hard', ['person', 'person'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q5; wdt:P737 ?b.
  ?b wdt:P31 wd:Q5.
  { ?a wdt:P108 wd:Q173496. } UNION { ?a wdt:P108 wd:Q2924461. } UNION { ?a wdt:P170 wd:Q1114461. }
  ?a wikibase:sitelinks ?links. FILTER(?links > 10)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 10)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'influenced by'),
  // Creator → movement (hard: new wave comics, golden age, silver age)
  sq('hard', ['person', 'movement'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q5; wdt:P135 ?b.
  { ?a wdt:P108 wd:Q173496. } UNION { ?a wdt:P108 wd:Q2924461. } UNION { ?a wdt:P170 wd:Q1114461. }
  ?a wikibase:sitelinks ?links. FILTER(?links > 5)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 5)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'part of movement'),
  // Comics creator → influenced by (easy: creative lineage — Jack Kirby influenced by Alex Raymond, Neal Adams influenced by Gil Kane — fans know this)
  sq('easy', ['person', 'person'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q5; wdt:P737 ?b.
  ?b wdt:P31 wd:Q5.
  ?a wikibase:sitelinks ?links. FILTER(?links > 15)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 15)
  { ?a wdt:P106 wd:Q1734662. } UNION { ?a wdt:P106 wd:Q715301. } UNION { ?a wdt:P106 wd:Q266569. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'influenced by'),
  // Comics creator → award received (medium: Eisner Award, Harvey Award, Hugo Award — comics industry awards)
  sq('medium', ['person', 'other'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?b { wd:Q1047285 wd:Q1291735 wd:Q44585 wd:Q185715 wd:Q1377075 }
  ?a wdt:P31 wd:Q5; wdt:P166 ?b.
  { ?a wdt:P106 wd:Q1734662. } UNION { ?a wdt:P106 wd:Q715301. } UNION { ?a wdt:P106 wd:Q266569. }
  ?a wikibase:sitelinks ?links. FILTER(?links > 10)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'received award'),
  // Comics creator → movement/style (medium: Silver Age, Golden Age, underground comix — connects creators across publishers)
  sq('medium', ['person', 'other'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q5; wdt:P135 ?b.
  { ?a wdt:P106 wd:Q1734662. } UNION { ?a wdt:P106 wd:Q715301. } UNION { ?a wdt:P106 wd:Q266569. }
  ?a wikibase:sitelinks ?links. FILTER(?links > 10)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 10)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'part of movement'),
]
