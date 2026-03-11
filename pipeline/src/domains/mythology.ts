import { sq, TaggedSubquery } from '../wikidataHelpers'

// Mythology: deities, heroes, creatures, artifacts — multiple relation types for rich graph
// Types: Q22989102=mythological figure, Q4271324=mythological character, Q178885=deity,
//        Q12195757=legendary creature, Q4936492=heroic figure
export const MYTHOLOGY_SUBQUERIES: TaggedSubquery[] = [
  // Figure → mythology system (easy: Greek/Norse/Egyptian widely known)
  sq('easy', ['deity', 'other'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?type { wd:Q22989102 wd:Q4271324 wd:Q178885 wd:Q12195757 wd:Q4936492 }
  ?a wdt:P31 ?type; wdt:P1080 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 3)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'from mythology'),
  // Figure → parent/child/consort (easy: Zeus/Athena, Odin/Thor, Hera/Zeus — widely known family links)
  sq('easy', ['deity', 'deity'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?type { wd:Q22989102 wd:Q4271324 wd:Q178885 wd:Q12195757 wd:Q4936492 }
  ?a wdt:P31 ?type.
  { ?a wdt:P22 ?b. } UNION { ?a wdt:P25 ?b. } UNION { ?a wdt:P26 ?b. }
  ?b wdt:P31 ?type.
  ?a wikibase:sitelinks ?links. FILTER(?links > 3)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'family of'),
  // Figure → pantheon/group (easy: Twelve Olympians, Aesir, Vanir — bridges across family clusters)
  sq('easy', ['deity', 'group'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  VALUES ?type { wd:Q22989102 wd:Q4271324 wd:Q178885 wd:Q12195757 wd:Q4936492 }
  ?a wdt:P31 ?type; wdt:P361 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 3)
  ?b wikibase:sitelinks ?blinks.
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'member of'),
  // Figure → associated fictional location (easy: Olympus, Underworld, Valhalla — bridges cross-family)
  sq('easy', ['deity', 'location'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  VALUES ?type { wd:Q22989102 wd:Q4271324 wd:Q178885 wd:Q12195757 wd:Q4936492 }
  ?a wdt:P31 ?type; wdt:P276 ?b.
  ?b wdt:P31 wd:Q271669.
  ?a wikibase:sitelinks ?links. FILTER(?links > 5)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 5)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'associated with'),
  // Figure → pantheon/group (medium: Twelve Olympians, Aesir, Vanir, etc.)
  // Also include mythology system at medium — without it the medium graph is too sparse
  // (groups have only 7-14 members, not enough to form 4-hop paths)
  sq('medium', ['deity', 'other'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?type { wd:Q22989102 wd:Q4271324 wd:Q178885 wd:Q12195757 wd:Q4936492 }
  ?a wdt:P31 ?type; wdt:P1080 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 3)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'from mythology'),
  sq('medium', ['deity', 'group'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?type { wd:Q22989102 wd:Q4271324 wd:Q178885 wd:Q12195757 wd:Q4936492 }
  ?a wdt:P31 ?type; wdt:P361 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 5)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'member of'),
  // Figure → parent (hard: dense family trees require detailed knowledge)
  sq('hard', ['deity', 'deity'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?type { wd:Q22989102 wd:Q4271324 wd:Q178885 wd:Q12195757 wd:Q4936492 }
  ?a wdt:P31 ?type.
  { ?a wdt:P22 ?b. } UNION { ?a wdt:P25 ?b. }
  ?b wdt:P31 ?type.
  ?a wikibase:sitelinks ?links. FILTER(?links > 3)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'parent of'),
  // Figure → consort/spouse (hard)
  sq('hard', ['deity', 'deity'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?type { wd:Q22989102 wd:Q4271324 wd:Q178885 wd:Q12195757 wd:Q4936492 }
  ?a wdt:P31 ?type; wdt:P26 ?b.
  ?b wdt:P31 ?type.
  ?a wikibase:sitelinks ?links. FILTER(?links > 3)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'consort of'),
]
