import { fetchMovieEntities } from '../wikidata'

global.fetch = jest.fn().mockResolvedValue({
  json: () => Promise.resolve({
    results: {
      bindings: [
        {
          film: { value: 'http://www.wikidata.org/entity/Q47703' },
          filmLabel: { value: 'The Godfather' },
          related: { value: 'http://www.wikidata.org/entity/Q128518' },
          relatedLabel: { value: 'Francis Ford Coppola' },
        }
      ]
    }
  })
}) as jest.Mock

describe('fetchMovieEntities', () => {
  it('returns entities with labels and related IDs', async () => {
    const entities = await fetchMovieEntities(10)
    expect(entities.length).toBeGreaterThan(0)
    expect(entities[0]).toHaveProperty('label')
    expect(entities[0]).toHaveProperty('relatedIds')
  })
})
