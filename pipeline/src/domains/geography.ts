import { sq, TaggedSubquery } from '../wikidataHelpers'

// Geography: country → continent, capital city → country (capitals only to avoid timeout)
export const GEOGRAPHY_SUBQUERIES: TaggedSubquery[] = [
  // Capital city → country (easy: direct, well-known)
  sq('easy', ['city', 'country'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?b wdt:P31 wd:Q6256; wdt:P36 ?a.
  ?a wikibase:sitelinks ?links. FILTER(?links > 30)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'capital of'),
  // Country → continent (easy: also included at easy so capital→country→continent paths exist)
  sq('easy', ['country', 'continent'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q6256; wdt:P30 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 20)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'on continent'),
  // Country → continent (medium — same data, kept for medium graph completeness)
  sq('medium', ['country', 'continent'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q6256; wdt:P30 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 20)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'on continent'),
  // Country → bordering country (hard: requires map knowledge — VALUES-restricted to avoid timeout)
  sq('hard', ['country', 'country'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?a { wd:Q30 wd:Q142 wd:Q183 wd:Q145 wd:Q38 wd:Q159 wd:Q29 wd:Q668 wd:Q17 wd:Q148 wd:Q155 wd:Q414 wd:Q45 wd:Q20 wd:Q34 wd:Q33 wd:Q35 wd:Q55 wd:Q36 wd:Q40 wd:Q39 wd:Q211 wd:Q219 wd:Q224 wd:Q217 wd:Q218 wd:Q228 wd:Q232 wd:Q233 wd:Q252 }
  ?a wdt:P47 ?b.
  ?b wdt:P31 wd:Q6256.
  ?a wikibase:sitelinks ?links.
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'borders'),
  // Major city → country (hard: VALUES-listed major non-capital cities to avoid full-table-scan timeout)
  sq('hard', ['city', 'country'], (_limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?a { wd:Q60 wd:Q84 wd:Q90 wd:Q220 wd:Q1353 wd:Q956 wd:Q649 wd:Q1439 wd:Q38022 wd:Q1345
              wd:Q1055 wd:Q3821 wd:Q72 wd:Q2807 wd:Q16555 wd:Q2013 wd:Q3630 wd:Q35765 wd:Q3795
              wd:Q406 wd:Q4120 wd:Q2484 wd:Q79 wd:Q987 wd:Q3624 wd:Q1354 wd:Q106087 wd:Q4656
              wd:Q1492 wd:Q2844 wd:Q1519 wd:Q8678 wd:Q18426 wd:Q189395 wd:Q3874 wd:Q2256 }
  ?a wdt:P17 ?b. ?b wdt:P31 wd:Q6256.
  ?a wikibase:sitelinks ?links.
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT 60`, 'located in'),
  // Film → filming location (hard: connects cities via films shot there — Rome, NYC, Paris)
  // Links geography's city nodes to famous films, creating cross-domain cultural bridges
  sq('hard', ['city', 'other'], (_limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?a { wd:Q60 wd:Q84 wd:Q90 wd:Q220 wd:Q1353 wd:Q649 wd:Q38022 wd:Q1345
              wd:Q1055 wd:Q3821 wd:Q72 wd:Q2807 wd:Q16555 wd:Q2013 wd:Q3630 wd:Q35765
              wd:Q406 wd:Q4120 wd:Q2484 wd:Q79 wd:Q987 wd:Q1354 wd:Q106087 wd:Q4656
              wd:Q1492 wd:Q2844 wd:Q1519 wd:Q8678 wd:Q189395 }
  VALUES ?filmType { wd:Q11424 wd:Q506240 }
  ?b wdt:P31 ?filmType; wdt:P915 ?a.
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 30)
  ?a wikibase:sitelinks ?links.
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?blinks) LIMIT 100`, 'filming location of'),
  // City → narrative setting (medium: cities that appear as settings in famous films — Paris in Midnight in Paris, NYC in countless films)
  sq('medium', ['city', 'film'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?b wdt:P31 wd:Q11424; wdt:P840 ?a.
  ?a wdt:P31 wd:Q515.
  ?a wikibase:sitelinks ?links. FILTER(?links > 40)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 40)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?blinks) LIMIT ${limit}`, 'setting of'),
  // City → filming location (medium: cities used as filming locations for famous films)
  sq('medium', ['city', 'film'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?b wdt:P31 wd:Q11424; wdt:P915 ?a.
  ?a wdt:P31 wd:Q515.
  ?a wikibase:sitelinks ?links. FILTER(?links > 40)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 40)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?blinks) LIMIT ${limit}`, 'filming location for'),
  // City → notable person born there (hard: famous birthplaces — Einstein born in Ulm, Napoleon born in Ajaccio)
  sq('hard', ['city', 'person'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?b wdt:P31 wd:Q5; wdt:P19 ?a.
  ?a wdt:P31 wd:Q515.
  ?a wikibase:sitelinks ?links. FILTER(?links > 40)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 60)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?blinks) LIMIT ${limit}`, 'birthplace of'),
]
