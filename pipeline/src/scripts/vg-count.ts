async function sparql(query: string): Promise<any[]> {
  const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}&format=json`
  const res = await fetch(url, { headers: { 'User-Agent': 'RabbitHoleGame/1.0', 'Accept': 'application/sparql-results+json' } })
  if (!res.ok) { const t = await res.text(); throw new Error(`HTTP ${res.status}: ${t.slice(0,200)}`) }
  return (await res.json() as any).results.bindings
}

async function run() {
  // Simple count query first to validate connectivity
  const tests: [string, string][] = [
    ['composers per game count', `
SELECT ?composer ?composerLabel (COUNT(DISTINCT ?game) AS ?n) WHERE {
  ?game wdt:P31 wd:Q7889 ; wdt:P86 ?composer .
  ?game wikibase:sitelinks ?l . FILTER(?l > 15)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
} GROUP BY ?composer ?composerLabel
ORDER BY DESC(?n) LIMIT 200`],
    ['directors per game count', `
SELECT ?dir ?dirLabel (COUNT(DISTINCT ?game) AS ?n) WHERE {
  ?game wdt:P31 wd:Q7889 ; wdt:P57 ?dir .
  ?game wikibase:sitelinks ?l . FILTER(?l > 15)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
} GROUP BY ?dir ?dirLabel
ORDER BY DESC(?n) LIMIT 200`],
    ['series per game count', `
SELECT ?series ?seriesLabel (COUNT(DISTINCT ?game) AS ?n) WHERE {
  ?game wdt:P31 wd:Q7889 ; wdt:P179 ?series .
  ?game wikibase:sitelinks ?l . FILTER(?l > 15)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
} GROUP BY ?series ?seriesLabel
ORDER BY DESC(?n) LIMIT 200`],
    ['settings per game count', `
SELECT ?loc ?locLabel (COUNT(DISTINCT ?game) AS ?n) WHERE {
  ?game wdt:P31 wd:Q7889 ; wdt:P840 ?loc .
  ?game wikibase:sitelinks ?l . FILTER(?l > 15)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
} GROUP BY ?loc ?locLabel
ORDER BY DESC(?n) LIMIT 200`],
    ['developers per game count', `
SELECT ?dev ?devLabel (COUNT(DISTINCT ?game) AS ?n) WHERE {
  ?game wdt:P31 wd:Q7889 ; wdt:P178 ?dev .
  ?game wikibase:sitelinks ?l . FILTER(?l > 15)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
} GROUP BY ?dev ?devLabel
ORDER BY DESC(?n) LIMIT 200`],
    ['characters per game count', `
SELECT ?char ?charLabel (COUNT(DISTINCT ?game) AS ?n) WHERE {
  ?game wdt:P31 wd:Q7889 ; wdt:P674 ?char .
  ?char wdt:P31 wd:Q15773347 .
  ?game wikibase:sitelinks ?l . FILTER(?l > 15)
  ?char wikibase:sitelinks ?cl . FILTER(?cl > 5)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
} GROUP BY ?char ?charLabel
ORDER BY DESC(?n) LIMIT 200`],
  ]

  for (const [name, q] of tests) {
    try {
      const rows = await sparql(q)
      const ideal = rows.filter(r => { const n = parseInt(r.n?.value||'0'); return n >= 2 && n <= 6 })
      const hubs  = rows.filter(r => parseInt(r.n?.value||'0') > 6)
      console.log(`\n${name}:`)
      console.log(`  total=${rows.length}  ideal(2-6)=${ideal.length}  hubs(7+)=${hubs.length}`)
      console.log('  top ideal:', ideal.slice(0,6).map(r => `${r[Object.keys(r)[1]]?.value}(${r.n?.value})`).join(', '))
      console.log('  hubs to avoid:', hubs.slice(0,4).map(r => `${r[Object.keys(r)[1]]?.value}(${r.n?.value})`).join(', '))
    } catch(e: any) {
      console.log(`${name}: ERROR ${e.message}`)
    }
    await new Promise(r => setTimeout(r, 2000))
  }
}
run().catch(console.error)
