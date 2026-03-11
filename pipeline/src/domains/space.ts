import { sq, TaggedSubquery } from '../wikidataHelpers'

// Space: astronaut → space agency, astronaut → country
// Hardcode major agencies to avoid full P106=Q11631 scan which times out
// Q23548=NASA, Q190903=ESA, Q14530=Roscosmos, Q789758=JAXA, Q15878=CSA,
// Q11237=ISRO, Q193569=CNSA
export const SPACE_SUBQUERIES: TaggedSubquery[] = [
  // Astronaut → space agency (easy: NASA/ESA/Roscosmos widely known)
  sq('easy', ['person', 'other'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?b { wd:Q23548 wd:Q190903 wd:Q14530 wd:Q789758 wd:Q15878 wd:Q11237 wd:Q193569 }
  ?a wdt:P31 wd:Q5; wdt:P108 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 5)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'worked at'),
  // Astronaut → country (easy)
  sq('easy', ['person', 'country'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q11631; wdt:P27 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 5)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'represents'),
  // Any astronaut → space mission (medium: all astronauts, not just agency-filtered)
  sq('medium', ['person', 'other'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q11631; wdt:P450 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 3)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'flew on'),
  // Astronaut → country (medium)
  sq('medium', ['person', 'country'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q11631; wdt:P27 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 3)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'represents'),
  // Spacecraft → crew (medium: broader vehicle types including orbiters and capsules)
  sq('medium', ['other', 'person'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  VALUES ?vehicleType { wd:Q40218 wd:Q752783 wd:Q3863 wd:Q12796 wd:Q2876821 }
  ?a wdt:P31 ?vehicleType; wdt:P1029 ?b.
  ?b wdt:P31 wd:Q5.
  ?a wikibase:sitelinks ?links. FILTER(?links > 5)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 3)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'crew of'),
  // Space program → participating country (medium: Apollo→US, ISS→Russia/US/Japan)
  sq('medium', ['other', 'country'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q24052309; wdt:P17 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 5)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'operated by'),
  // Astronaut → alma mater (hard)
  sq('hard', ['person', 'other'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q11631; wdt:P69 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 3)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'studied at'),
  // Astronaut → country (hard: broader pool)
  sq('hard', ['person', 'country'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q11631; wdt:P27 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 3)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'represents'),
  // Spacecraft → space agency (hard)
  sq('hard', ['other', 'other'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?missionType { wd:Q40218 wd:Q752783 wd:Q2472875 }
  ?a wdt:P31 ?missionType; wdt:P790 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 5)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'operated by'),
  // Spacecraft/vehicle → crew member (easy: Saturn V, Space Shuttle Discovery, Soyuz — iconic vessels)
  // P1029=crew member; Q40218=rocket, Q752783=spacecraft, Q3863=Space Shuttle
  sq('easy', ['other', 'person'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  VALUES ?vehicleType { wd:Q40218 wd:Q752783 wd:Q3863 wd:Q12796 }
  ?a wdt:P31 ?vehicleType; wdt:P1029 ?b.
  ?b wdt:P31 wd:Q5.
  ?a wikibase:sitelinks ?links. FILTER(?links > 10)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 5)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'crew of'),
  // Astronaut → space mission (easy: famous missions like Apollo 11, ISS, Mir — well-known to general players)
  // Also bridges US/Soviet components via shared missions (ISS, Apollo-Soyuz)
  sq('easy', ['person', 'other'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q5; wdt:P106 wd:Q11631; wdt:P450 ?b.
  ?b wdt:P31 wd:Q634; wdt:P17 ?country.
  ?a wikibase:sitelinks ?links. FILTER(?links > 5)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 10)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'flew on mission'),
]
