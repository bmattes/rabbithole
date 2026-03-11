import { sq, TaggedSubquery } from '../wikidataHelpers'

// TV: show → cast, show → creator, show → production network
export const TV_SUBQUERIES: TaggedSubquery[] = [
  // Show → cast member (easy: actors are widely known)
  sq('easy', ['series', 'person'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5398426; wdt:P161 ?b.
  ?b wdt:P31 wd:Q5.
  ?a wikibase:sitelinks ?links. FILTER(?links > 15)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'cast member of'),
  // Show → fictional character (easy: Walter White, Tony Soprano — characters are more recognisable than actors)
  // Q15773347=fictional human; Q1631275=fictional character (broader)
  sq('easy', ['series', 'character'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  VALUES ?charType { wd:Q15773347 wd:Q95074 }
  ?a wdt:P31 wd:Q5398426; wdt:P674 ?b.
  ?b wdt:P31 ?charType.
  ?a wikibase:sitelinks ?links. FILTER(?links > 20)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 10)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'features character'),
  // Show → genre (easy: sitcom/drama/thriller are well-known — enables series→genre→series paths)
  sq('easy', ['series', 'genre'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q5398426; wdt:P136 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 20)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 20)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'belongs to genre'),
  // Show → creator/director (medium: showrunners less famous)
  sq('medium', ['series', 'person'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q5398426; wdt:P57|wdt:P162 ?b.
  ?b wdt:P31 wd:Q5.
  ?a wikibase:sitelinks ?links. FILTER(?links > 15)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'directed by'),
  // Show → TV network/streaming platform (hard: HBO/AMC/Netflix/FX — well-known even if directors aren't)
  // Q2001305=television network, Q15416=television channel, Q18127=broadcasting company
  sq('hard', ['series', 'network'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?networkType { wd:Q2001305 wd:Q15416 wd:Q18127 wd:Q18610010 }
  ?a wdt:P31 wd:Q5398426; wdt:P449 ?b.
  ?b wdt:P31 ?networkType.
  ?a wikibase:sitelinks ?links. FILTER(?links > 15)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'aired on'),
  // Show → screenwriter (hard: connects shows via shared writer — e.g. both written by Vince Gilligan)
  sq('hard', ['series', 'person'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q5398426; wdt:P58 ?b.
  ?b wdt:P31 wd:Q5.
  ?a wikibase:sitelinks ?links. FILTER(?links > 20)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 10)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'written by'),
  // Show → genre (medium: connects shows of same genre — crime drama, sitcom, sci-fi)
  sq('medium', ['series', 'genre'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q5398426; wdt:P136 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 20)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 20)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'belongs to genre'),
]
