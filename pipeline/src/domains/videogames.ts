import { sq, TaggedSubquery } from '../wikidataHelpers'

// Video games: game → series, game → developer, game → publisher
export const VIDEOGAMES_SUBQUERIES: TaggedSubquery[] = [
  // Game → series (easy: e.g. Halo, Mario, Zelda)
  sq('easy', ['game', 'series'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q7889; wdt:P179 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 10)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'part of series'),
  // Series → developer (easy: Mario→Nintendo, Halo→Bungie — well-known franchise-to-company links)
  sq('easy', ['series', 'company'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q7058673; wdt:P178|wdt:P123 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 5)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'developed by'),
  // Character → game (easy: Mario→Super Mario Bros, Lara Croft→Tomb Raider)
  sq('easy', ['person', 'game'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q15773347; wdt:P8345 ?b.
  ?b wdt:P31 wd:Q7889.
  ?a wikibase:sitelinks ?links. FILTER(?links > 5)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'appears in'),
  // Game → developer (medium)
  sq('medium', ['game', 'company'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q7889; wdt:P178 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 10)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'developed by'),
  // Game → publisher (hard: often different from developer — require publisher to be well-known)
  sq('hard', ['game', 'company'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q7889; wdt:P123 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 10)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 20)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'published by'),
  // Developer → publisher (hard: studio relationships — e.g. Bioware→EA, Rare→Microsoft)
  // Require both sides to be reasonably well-known (sitelinks > 10)
  sq('hard', ['company', 'company'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q210167; wdt:P749|wdt:P127 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 10)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 20)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'owned by'),
  // Game → game engine (hard: Unreal/Unity/id Tech/Source bridges games across studios)
  sq('hard', ['game', 'engine'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q7889; wdt:P408 ?b.
  ?b wdt:P31 wd:Q107642.
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 20)
  ?a wikibase:sitelinks ?links. FILTER(?links > 10)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'runs on'),
  // Game → featured character (P674, fictional characters only)
  sq('easy', ['game', 'person'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q7889; wdt:P674 ?b.
  ?b wdt:P31 wd:Q15773347.
  ?a wikibase:sitelinks ?links. FILTER(?links > 15)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 10)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'features character'),
  // Game → narrative setting (P840)
  sq('easy', ['game', 'location'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q7889; wdt:P840 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 15)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 15)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'set in'),
  // Game → composer (P86)
  sq('hard', ['game', 'person'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q7889; wdt:P86 ?b.
  ?b wdt:P31 wd:Q5.
  ?a wikibase:sitelinks ?links. FILTER(?links > 15)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 5)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'music composed by'),
  // Game → director (P57)
  sq('medium', ['game', 'person'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q7889; wdt:P57 ?b.
  ?b wdt:P31 wd:Q5.
  ?a wikibase:sitelinks ?links. FILTER(?links > 15)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 5)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'directed by'),
  // Game → genre (P136) — e.g. Halo→first-person shooter, Civilization→turn-based strategy
  // Bridges games that share a genre — "both are RPGs" connection
  sq('easy', ['game', 'genre'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q7889; wdt:P136 ?b.
  ?b wdt:P31 wd:Q659563.
  ?a wikibase:sitelinks ?links. FILTER(?links > 20)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 20)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'belongs to genre'),
  // Game → platform (P400) — iconic consoles only (N64, SNES, PS1/2/3, Xbox, Game Boy, Atari 2600, Sega Genesis)
  // "Both were N64 games" is a satisfying surprise connection
  sq('medium', ['game', 'platform'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  VALUES ?b { wd:Q184640 wd:Q183259 wd:Q172742 wd:Q10676 wd:Q10680 wd:Q10683 wd:Q132020 wd:Q48263 wd:Q186437 wd:Q206261 wd:Q269614 wd:Q8093 wd:Q15474 wd:Q10695 wd:Q11232 wd:Q10998 }
  ?a wdt:P31 wd:Q7889; wdt:P400 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 25)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 80)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'available on'),
  // Game → voice actor (P725) — real actors who voiced characters, bridges games via celebrity
  // e.g. GTA V → Samuel L. Jackson (via San Andreas), Last of Us → Troy Baker
  sq('hard', ['game', 'person'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q7889; wdt:P725 ?b.
  ?b wdt:P31 wd:Q5.
  ?a wikibase:sitelinks ?links. FILTER(?links > 20)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 30)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'voice acted by'),
]
