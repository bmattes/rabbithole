// Test whether ?blinks is actually returned by the SPARQL for composer/director queries
import * as https from 'https'

const query = `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q7889; wdt:P86 ?b.
  ?b wdt:P31 wd:Q5.
  ?a wikibase:sitelinks ?links. FILTER(?links > 30)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 10)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?blinks) LIMIT 10
`

const url = 'https://query.wikidata.org/sparql?query=' + encodeURIComponent(query) + '&format=json'

https.get(url, { headers: { 'User-Agent': 'RabbitHole/1.0' } }, (res) => {
  let data = ''
  res.on('data', chunk => data += chunk)
  res.on('end', () => {
    const json = JSON.parse(data)
    const bindings = json.results.bindings
    console.log(`Got ${bindings.length} results`)
    bindings.forEach((b: any) => {
      console.log(`${b.aLabel?.value} → ${b.bLabel?.value} | links=${b.links?.value} blinks=${b.blinks?.value}`)
    })
  })
}).on('error', console.error)
