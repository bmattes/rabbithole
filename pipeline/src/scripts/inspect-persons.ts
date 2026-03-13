import { fetchEntitiesCached } from '../entityCache'

async function main() {
  const { entities } = await fetchEntitiesCached('videogames', 2000)
  const persons = entities.filter((e: any) => e.entityType === 'person')

  // Split into those with sitelinks vs without
  const withSitelinks = persons.filter((e: any) => (e.sitelinks ?? 0) > 0)
  const withoutSitelinks = persons.filter((e: any) => (e.sitelinks ?? 0) === 0)

  console.log(`Total persons: ${persons.length}`)
  console.log(`With sitelinks: ${withSitelinks.length}`)
  console.log(`Without sitelinks (0sl): ${withoutSitelinks.length}`)

  console.log('\nPersons WITH sitelinks (real people — composers, directors):')
  withSitelinks
    .sort((a: any, b: any) => (b.sitelinks ?? 0) - (a.sitelinks ?? 0))
    .slice(0, 30)
    .forEach((p: any) => console.log(`  ${p.label} (${p.sitelinks}sl)`))

  console.log('\nSample persons WITHOUT sitelinks (fictional characters):')
  withoutSitelinks.slice(0, 20).forEach((p: any) => console.log(`  ${p.label}`))
}

main().catch(console.error)
