import { getTodaysPuzzle, submitRun } from '../api'

jest.mock('../supabase', () => ({
  supabase: {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: 'puzzle-1',
                  start_concept: 'The Godfather',
                  end_concept: 'Apocalypse Now',
                  bubbles: [],
                  connections: {},
                  optimal_path: [],
                },
                error: null,
              }),
            }),
          }),
        }),
      }),
      insert: jest.fn().mockResolvedValue({ data: null, error: null }),
    }),
  },
}))

describe('getTodaysPuzzle', () => {
  it('returns puzzle data for a category', async () => {
    const puzzle = await getTodaysPuzzle('movies-category-id')
    expect(puzzle).not.toBeNull()
    expect(puzzle?.start_concept).toBe('The Godfather')
  })
})
