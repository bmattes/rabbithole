// Get key properties for God of War (2018) and Assassin's Creed Odyssey
const query = `
SELECT DISTINCT ?prop ?propLabel ?val ?valLabel WHERE {
  VALUES ?game { wd:Q18345138 wd:Q54617566 wd:Q817369 }  # GoW 2018, AC Odyssey, original GoW
  VALUES ?prop { wdt:P840 wdt:P674 wdt:P178 wdt:P123 wdt:P57 wdt:P179 wdt:P136 wdt:P86 wdt:P400 }
  ?game ?prop ?val.
  ?propEntity wikibase:directClaim ?prop.
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} LIMIT 300
`
async function run() {
  const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}&format=json`
  const res = await fetch(url, { headers: { 'User-Agent': 'RabbitHoleGame/1.0', 'Accept': 'application/sparql-results+json' } })
  const data = await res.json() as any
  for (const r of data.results.bindings) {
    const val = r.valLabel?.value || ''
    const prop = r.propLabel?.value || r.prop?.value
    if (!val.startsWith('http') && !val.startsWith('Q')) console.log(`${prop} → ${val}`)
  }
}
run().catch(console.error)
