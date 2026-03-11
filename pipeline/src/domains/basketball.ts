import { sq, TaggedSubquery } from '../wikidataHelpers'

// Basketball: NBA players → teams, teams → NBA league
// Q5372 = basketball (sport), Q155223 = NBA, Q623109 = sports league
export const BASKETBALL_SUBQUERIES: TaggedSubquery[] = [
  // Basketball player → team via sport property (easy: top players, famous franchises)
  // Using P641=basketball sport rather than occupation QID which returns 0 results
  sq('easy', ['person', 'team'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P641 wd:Q5372; wdt:P54 ?b.
  ?b wdt:P641 wd:Q5372.
  ?a wikibase:sitelinks ?links. FILTER(?links > 20)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'played for'),
  // NBA player → team (medium: NBA-specific, requires league knowledge)
  sq('medium', ['person', 'team'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P641 wd:Q5372; wdt:P54 ?b.
  ?b wdt:P118 wd:Q155223.
  ?a wikibase:sitelinks ?links. FILTER(?links > 15)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'played for'),
  // NBA team → NBA league (hard: conference/division knowledge)
  sq('hard', ['team', 'league'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  { ?a wdt:P31 wd:Q13393265. } UNION { ?a wdt:P118 wd:Q155223; wdt:P641 wd:Q5372. }
  ?a wdt:P118 ?b. ?b wdt:P31 wd:Q623109.
  ?a wikibase:sitelinks ?links. FILTER(?links > 5)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'plays in'),
  // Player → alma mater (hard: college basketball — Duke, Kentucky, UNC — well-known pipeline schools)
  sq('hard', ['person', 'other'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q5; wdt:P641 wd:Q5372; wdt:P69 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 20)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 30)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'played college ball at'),
  // Player → award (hard: MVP, All-Star, Rookie of the Year — prestigious recognitions)
  sq('hard', ['person', 'other'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  VALUES ?b { wd:Q843303 wd:Q766290 wd:Q913851 wd:Q2469962 wd:Q2470027 wd:Q1361501 wd:Q2470036 }
  ?a wdt:P31 wd:Q5; wdt:P641 wd:Q5372; wdt:P166 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 20)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'received award'),
  // Player → college (easy: Duke, Kentucky, UCLA, UNC — basketball fans know college connections well)
  sq('easy', ['person', 'other'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q3665646; wdt:P69 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 15)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 30)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'played college ball at'),
  // Player → award received (medium: NBA MVP, Finals MVP, Rookie of the Year, All-Star)
  sq('medium', ['person', 'other'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?b { wd:Q219730 wd:Q1411146 wd:Q853153 wd:Q1454433 wd:Q2622472 wd:Q1300642 wd:Q219888 }
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q3665646; wdt:P166 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 15)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'awarded'),
  // Player → place of birth (medium: birthplace cities — Akron, Brooklyn, Chicago, Philadelphia)
  sq('medium', ['person', 'other'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q3665646; wdt:P19 ?b.
  ?b wdt:P31 wd:Q515.
  ?a wikibase:sitelinks ?links. FILTER(?links > 15)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 25)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'born in'),
]
