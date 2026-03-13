// For each bridge type, sample nodes at different sitelink thresholds
// and manually inspect whether they "feel" Easy/Medium/Hard

async function sparql(query: string): Promise<any[]> {
  const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}&format=json`
  const res = await fetch(url, { headers: { 'User-Agent': 'RabbitHoleGame/1.0', 'Accept': 'application/sparql-results+json' } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return (await res.json() as any).results.bindings
}

async function run() {
  // Sample real bridge nodes across sitelink ranges — gives us calibration data
  const q = `
SELECT DISTINCT ?type ?node ?nodeLabel ?links WHERE {
  {
    ?game wdt:P31 wd:Q7889 ; wdt:P674 ?node .
    ?node wdt:P31 wd:Q15773347 .
    BIND("character" AS ?type)
  } UNION {
    ?game wdt:P31 wd:Q7889 ; wdt:P179 ?node .
    BIND("series" AS ?type)
  } UNION {
    ?game wdt:P31 wd:Q7889 ; wdt:P178 ?node .
    ?node wdt:P31 wd:Q210167 .
    BIND("developer" AS ?type)
  } UNION {
    ?game wdt:P31 wd:Q7889 ; wdt:P86 ?node .
    ?node wdt:P31 wd:Q5 .
    BIND("composer" AS ?type)
  } UNION {
    ?game wdt:P31 wd:Q7889 ; wdt:P57 ?node .
    ?node wdt:P31 wd:Q5 .
    BIND("director" AS ?type)
  }
  ?game wikibase:sitelinks ?gl . FILTER(?gl > 20)
  ?node wikibase:sitelinks ?links . FILTER(?links > 3)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
} ORDER BY ?type DESC(?links)
LIMIT 400`

  const rows = await sparql(q)

  // Deduplicate by node id
  const seen = new Set<string>()
  const deduped = rows.filter(r => {
    const id = r.node?.value
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })

  // Group by type and sitelink range
  const byType: Record<string, {easy: string[], medium: string[], hard: string[]}> = {}
  for (const r of deduped) {
    const type = r.type?.value || 'unknown'
    const label = r.nodeLabel?.value || ''
    const links = parseInt(r.links?.value || '0')
    if (!byType[type]) byType[type] = { easy: [], medium: [], hard: [] }
    if (label.startsWith('Q')) continue // skip unlabelled
    if (links >= 80)       byType[type].easy.push(`${label}(${links})`)
    else if (links >= 20)  byType[type].medium.push(`${label}(${links})`)
    else                   byType[type].hard.push(`${label}(${links})`)
  }

  console.log('\n=== Bridge familiarity by type and sitelink threshold ===\n')
  console.log('Threshold: Easy ≥80 sitelinks | Medium 20-79 | Hard <20\n')
  for (const [type, buckets] of Object.entries(byType)) {
    console.log(`--- ${type.toUpperCase()} ---`)
    console.log(`  EASY   (${buckets.easy.length}): ${buckets.easy.slice(0,8).join(', ')}`)
    console.log(`  MEDIUM (${buckets.medium.length}): ${buckets.medium.slice(0,8).join(', ')}`)
    console.log(`  HARD   (${buckets.hard.length}): ${buckets.hard.slice(0,8).join(', ')}\n`)
  }

  console.log('\n=== Proposed bridge type → difficulty mapping ===')
  console.log(`
  Bridge Type   | Easy threshold | Medium threshold | Hard threshold | Notes
  --------------|----------------|------------------|----------------|------
  character     | links ≥ 80     | links 20-79      | links < 20     | Mickey Mouse=Easy, Sniper Wolf=Hard
  series        | links ≥ 60     | links 20-59      | links < 20     | GTA=Easy, Uncharted=Medium
  developer     | links ≥ 80     | links 20-79      | links < 20     | Nintendo=Easy, Retro Studios=Hard
  composer      | links ≥ 80     | links 20-79      | links < 20     | Koji Kondo=Medium, unknown=Hard
  director      | links ≥ 60     | links 20-59      | links < 20     | Miyamoto=Easy, Jaffe=Medium
  setting       | real-world+pop | fictional/region | obscure        | Greece=Easy, Shadow Moses=Hard
  platform      | any            | —                | —              | Always Easy (too obvious for Hard)
  publisher     | links ≥ 100    | links 40-99      | links < 40     | Sony=Easy, Devolver=Hard
  `)
}
run().catch(console.error)
