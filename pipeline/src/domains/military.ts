import { sq, TaggedSubquery } from '../wikidataHelpers'

// Military: commander → country, commander → conflict
export const MILITARY_SUBQUERIES: TaggedSubquery[] = [
  // Commander → major conflict (easy: WWII, WWI, Korean War — widely known)
  // P607=conflict; hand-picked famous wars. P106=military officer/personnel only — exclude civilians
  sq('easy', ['person', 'conflict'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?b { wd:Q362 wd:Q361 wd:Q11514 wd:Q8676 wd:Q8740 wd:Q179637 }
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q189290; wdt:P607 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 15)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'fought in'),
  // Commander → conflict/war (medium: requires history knowledge)
  sq('medium', ['person', 'conflict'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?b { wd:Q362 wd:Q361 wd:Q6583 wd:Q8676 wd:Q8740 wd:Q154697 wd:Q179637 wd:Q188055 wd:Q180684 wd:Q11514 wd:Q37643 wd:Q8680 wd:Q8673 }
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q189290; wdt:P607 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 10)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'fought in'),
  // Commander → military award (hard: Medal of Honor, Victoria Cross, Iron Cross — niche knowledge)
  // P166=award; Q21669 = Medal of Honor, Q1267319 = Victoria Cross, Q152037 = Iron Cross, etc.
  sq('hard', ['person', 'other'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?b { wd:Q21669 wd:Q1267319 wd:Q152037 wd:Q150787 wd:Q193373 wd:Q185715 wd:Q744030 wd:Q193714 }
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q189290; wdt:P166 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 5)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'awarded'),
  // Commander → alma mater (hard: West Point, Sandhurst, St-Cyr — military academy connections)
  sq('hard', ['person', 'other'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q189290; wdt:P69 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 10)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 20)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'educated at'),
]
