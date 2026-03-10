/**
 * prefetch-edge-labels.ts
 * Re-fetch entity caches for domains missing edge labels.
 * Run this before backfill-edge-labels.ts.
 */
import * as dotenv from 'dotenv'
dotenv.config()
import { fetchEntitiesCached } from '../entityCache'
import { CategoryDomain, SubqueryDifficulty } from '../wikidata'

const DOMAINS_TO_FETCH: Array<{ domain: CategoryDomain; diffs: SubqueryDifficulty[] }> = [
  { domain: 'history',          diffs: ['medium', 'hard'] },
  { domain: 'movies',           diffs: ['medium'] },
  { domain: 'geography',        diffs: ['easy', 'medium', 'hard'] },
  { domain: 'soccer',           diffs: ['easy', 'medium', 'hard'] },
  { domain: 'science',          diffs: ['easy', 'medium', 'hard'] },
  { domain: 'basketball',       diffs: ['easy', 'medium', 'hard'] },
  { domain: 'mythology',        diffs: ['easy', 'medium', 'hard'] },
  { domain: 'sport',            diffs: ['easy', 'medium', 'hard'] },
  { domain: 'space',            diffs: ['easy', 'medium', 'hard'] },
  { domain: 'art',              diffs: ['easy', 'medium', 'hard'] },
  { domain: 'tennis',           diffs: ['easy'] },
  { domain: 'americanfootball', diffs: ['easy', 'medium', 'hard'] },
]

async function main() {
  for (const { domain, diffs } of DOMAINS_TO_FETCH) {
    for (const diff of diffs) {
      console.log(`\nFetching ${domain}/${diff}...`)
      try {
        const { edgeLabels } = await fetchEntitiesCached(domain, 1500, { forceRefresh: true, maxDifficulty: diff })
        console.log(`  ✓ ${Object.keys(edgeLabels).length} edge labels`)
      } catch (e: any) {
        console.log(`  ✗ ${e.message}`)
      }
    }
  }
  console.log('\nDone prefetching.')
}

main().catch(err => { console.error(err); process.exit(1) })
