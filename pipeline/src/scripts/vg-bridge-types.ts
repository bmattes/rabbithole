// Query all available bridge types for videogames with counts and examples
// So we can feed a complete picture to the persona agents

async function sparql(query: string): Promise<any[]> {
  const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}&format=json`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'RabbitHoleGame/1.0', 'Accept': 'application/sparql-results+json' }
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return (await res.json() as any).results.bindings
}

// Each entry: [name, property, extra filter, example query]
const bridgeTypes: [string, string, string][] = [
  ['series (P179)', 'P179', ''],
  ['developer (P178)', 'P178', '?b wdt:P31 wd:Q210167.'],
  ['publisher (P123)', 'P123', ''],
  ['character (P674)', 'P674', '?b wdt:P31 wd:Q15773347.'],
  ['setting/location (P840)', 'P840', ''],
  ['composer (P86)', 'P86', '?b wdt:P31 wd:Q5.'],
  ['director/designer (P57)', 'P57', '?b wdt:P31 wd:Q5.'],
  ['platform (P400)', 'P400', ''],
  ['genre (P136)', 'P136', ''],
  ['voice actor (P725)', 'P725', '?b wdt:P31 wd:Q5.'],
  ['award received (P166)', 'P166', ''],
  ['game engine (P408)', 'P408', ''],
]

async function run() {
  console.log('\n=== Available bridge types for videogames ===\n')
  for (const [name, prop, filter] of bridgeTypes) {
    const q = `
SELECT ?b ?bLabel (COUNT(DISTINCT ?a) AS ?gameCount) WHERE {
  ?a wdt:P31 wd:Q7889 ; wdt:${prop} ?b .
  ${filter}
  ?a wikibase:sitelinks ?gl . FILTER(?gl > 15)
  ?b wikibase:sitelinks ?bl . FILTER(?bl > 5)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
} GROUP BY ?b ?bLabel ORDER BY DESC(?gameCount) LIMIT 10`
    try {
      const rows = await sparql(q)
      const total = rows.reduce((s, r) => s + parseInt(r.gameCount?.value ?? '0'), 0)
      const examples = rows.slice(0, 5).map(r => {
        const l = r.bLabel?.value ?? ''
        const n = r.gameCount?.value ?? '0'
        return l.startsWith('Q') ? null : `${l}(${n})`
      }).filter(Boolean).join(', ')
      console.log(`${name}`)
      console.log(`  total game connections: ~${total}+  top: ${examples}`)
    } catch(e: any) {
      console.log(`${name}: ERROR ${e.message}`)
    }
    await new Promise(r => setTimeout(r, 1500))
  }
}
run().catch(console.error)
