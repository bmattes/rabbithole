import { fetchEntitiesCached } from '../entityCache'

async function main() {
  const { entities } = await fetchEntitiesCached('videogames', 2000)

  const games = entities.filter((e: any) => e.entityType === 'game')
  const persons = entities.filter((e: any) => e.entityType === 'person')
  const series = entities.filter((e: any) => e.entityType === 'series')
  const companies = entities.filter((e: any) => e.entityType === 'company')
  const locations = entities.filter((e: any) => e.entityType === 'location')

  console.log('Total entities:', entities.length)
  console.log('Games:', games.length)
  console.log('Persons (chars + composers + directors):', persons.length)
  console.log('Series:', series.length)
  console.log('Companies:', companies.length)
  console.log('Locations:', locations.length)

  console.log('\nTop 25 games (by sitelinks):')
  games.sort((a: any, b: any) => (b.sitelinks ?? 0) - (a.sitelinks ?? 0)).slice(0, 25).forEach((g: any) =>
    console.log(' ', g.label, '(' + (g.sitelinks ?? 0) + 'sl)')
  )

  console.log('\nTop 25 persons (by sitelinks):')
  persons.sort((a: any, b: any) => (b.sitelinks ?? 0) - (a.sitelinks ?? 0)).slice(0, 25).forEach((p: any) =>
    console.log(' ', p.label, '(' + (p.sitelinks ?? 0) + 'sl)')
  )
}

main().catch(console.error)
