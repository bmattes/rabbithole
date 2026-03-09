import { fetchMovieEntities } from '../wikidata'

global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  status: 200,
  statusText: 'OK',
  json: () => Promise.resolve({
    results: {
      bindings: [
        {
          a: { value: 'http://www.wikidata.org/entity/Q47703' },
          aLabel: { value: 'The Godfather' },
          b: { value: 'http://www.wikidata.org/entity/Q128518' },
          bLabel: { value: 'Francis Ford Coppola' },
        }
      ]
    }
  })
}) as jest.Mock

describe('fetchMovieEntities', () => {
  it('returns entities with labels and related IDs', async () => {
    const { entities } = await fetchMovieEntities(10)
    expect(entities.length).toBeGreaterThan(0)
    expect(entities[0]).toHaveProperty('label')
    expect(entities[0]).toHaveProperty('relatedIds')
  })
})
