import { sq, TaggedSubquery } from '../wikidataHelpers'

// Food: dish → country of origin, dish → food category, dish → main ingredient
// Q746549=dish, Q2095372=food, Q1278475=product, Q756=apple (too broad) — use multiple types
export const FOOD_SUBQUERIES: TaggedSubquery[] = [
  // Dish → country of origin (easy: cuisine nationality is well-known)
  // Broaden dish type to include Q2095372 (food) and drop mandatory P31=country filter
  sq('easy', ['dish', 'country'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?foodType { wd:Q746549 wd:Q189796 }
  ?a wdt:P31 ?foodType; wdt:P495 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 5)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'originates from'),
  // Dish → food type/superclass (easy: pizza is a type of flatbread, burger is a type of sandwich)
  // P279=subclass of; use VALUES to restrict ?b to known food supertypes for speed (avoids slow JOIN)
  sq('easy', ['dish', 'dish'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?foodType { wd:Q746549 wd:Q189796 }
  VALUES ?b { wd:Q18650 wd:Q190804 wd:Q161942 wd:Q3283 wd:Q7802 wd:Q3199697 wd:Q1549736 wd:Q57069 wd:Q5708808 wd:Q80313 wd:Q1480264 wd:Q11639 wd:Q131419 wd:Q3291 }
  ?a wdt:P31 ?foodType; wdt:P279 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 5)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'type of'),
  // Dish → food type/superclass (medium: pasta, soup, etc. requires classification knowledge)
  sq('medium', ['dish', 'dish'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?foodType { wd:Q746549 wd:Q189796 }
  VALUES ?b { wd:Q18650 wd:Q190804 wd:Q161942 wd:Q3283 wd:Q7802 wd:Q3199697 wd:Q1549736 wd:Q57069 wd:Q5708808 wd:Q80313 wd:Q1480264 wd:Q11639 wd:Q3291 wd:Q11812 wd:Q24354 wd:Q180173 wd:Q131419 wd:Q244291 wd:Q851850 }
  ?a wdt:P31 ?foodType; wdt:P279 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 8)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'type of'),
  // Dish → main ingredient via P186 (made from material) — more broadly used than P527 in Wikidata
  // Q25403900=ingredient, Q2095372=food product — connect dishes via shared key ingredients
  sq('hard', ['dish', 'ingredient'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  VALUES ?foodType { wd:Q746549 wd:Q189796 }
  VALUES ?ingredientType { wd:Q25403900 wd:Q2095372 wd:Q3314483 wd:Q10676833 wd:Q1466448 }
  ?a wdt:P31 ?foodType; wdt:P186|wdt:P527 ?b.
  ?b wdt:P31 ?ingredientType.
  ?a wikibase:sitelinks ?links. FILTER(?links > 10)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'made with'),
  // Dish → chef creator (hard: connects dishes via the famous chefs who created or popularized them)
  // Q3499072=chef, Q945799=restaurateur
  sq('hard', ['dish', 'person'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  VALUES ?foodType { wd:Q746549 wd:Q189796 }
  ?a wdt:P31 ?foodType; wdt:P170 ?b.
  ?b wdt:P31 wd:Q5.
  ?a wikibase:sitelinks ?links. FILTER(?links > 5)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 10)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'created by'),
  // Dish → country of origin (easy: Sushi→Japan, Pizza→Italy, Tacos→Mexico — very recognisable to casual players)
  sq('easy', ['dish', 'other'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q746549; wdt:P495 ?b.
  ?b wdt:P31 wd:Q6256.
  ?a wikibase:sitelinks ?links. FILTER(?links > 10)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 50)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'originates from'),
  // Ingredient → country of origin (easy: ingredients also have national origins — connects to same country hubs)
  sq('easy', ['ingredient', 'other'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  { ?a wdt:P31 wd:Q25403900. } UNION { ?a wdt:P31 wd:Q10675206. } UNION { ?a wdt:P31 wd:Q207123. }
  ?a wdt:P495 ?b.
  ?b wdt:P31 wd:Q6256.
  ?a wikibase:sitelinks ?links. FILTER(?links > 5)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 50)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'originates from'),
  // Dish → culinary tradition / cuisine (medium: Italian cuisine, French cuisine, Japanese cuisine — bridges dishes culturally)
  sq('medium', ['dish', 'other'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q746549; wdt:P2012 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 8)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 20)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'part of cuisine'),
  // Dish → key ingredient (easy: Pizza→tomato, Sushi→rice, Tacos→corn tortilla — ingredient as bridge between dishes)
  sq('easy', ['dish', 'ingredient'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  VALUES ?foodType { wd:Q746549 wd:Q189796 }
  ?a wdt:P31 ?foodType; wdt:P186|wdt:P527 ?b.
  VALUES ?ingredientType { wd:Q25403900 wd:Q2095372 wd:Q3314483 wd:Q10676833 wd:Q1466448 wd:Q207123 }
  ?b wdt:P31 ?ingredientType.
  ?a wikibase:sitelinks ?links. FILTER(?links > 8)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 10)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'made with'),
  // Dish → cuisine (easy: Sushi→Japanese cuisine, Pizza→Italian cuisine — cuisine as recognisable bridge)
  sq('easy', ['dish', 'other'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q746549; wdt:P2012 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 10)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 30)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'part of cuisine'),
]
