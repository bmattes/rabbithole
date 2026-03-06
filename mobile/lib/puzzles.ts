import { Dimensions } from 'react-native'

const { width: SW } = Dimensions.get('window')

export interface PuzzleData {
  id: string
  category_id: string
  date: string
  start_concept: string
  end_concept: string
  narrative: null
  bubbles: Array<{ id: string; label: string; position: { x: number; y: number } }>
  connections: Record<string, string[]>
  optimal_path: string[]
}

export const MOCK_PUZZLES: Record<string, PuzzleData> = {
  movies: {
    id: 'mock-movies',
    category_id: 'movies',
    date: '',
    start_concept: 'The Godfather',
    end_concept: 'Apocalypse Now',
    narrative: null,
    bubbles: [
      { id: 'start', label: 'The Godfather',     position: { x: SW/2,    y: 80  } },
      { id: 'b1',    label: 'Marlon Brando',      position: { x: SW*0.20, y: 190 } },
      { id: 'b2',    label: 'Francis Coppola',    position: { x: SW*0.50, y: 195 } },
      { id: 'b3',    label: 'Al Pacino',          position: { x: SW*0.80, y: 190 } },
      { id: 'b4',    label: 'The Conversation',   position: { x: SW*0.15, y: 310 } },
      { id: 'b5',    label: 'Godfather II',        position: { x: SW*0.42, y: 305 } },
      { id: 'b6',    label: 'Scarface',            position: { x: SW*0.75, y: 310 } },
      { id: 'b7',    label: 'Vietnam War',         position: { x: SW*0.50, y: 390 } },
      { id: 'b8',    label: 'Robert Duvall',       position: { x: SW*0.18, y: 450 } },
      { id: 'b9',    label: 'George Lucas',        position: { x: SW*0.50, y: 470 } },
      { id: 'b10',   label: 'Brian De Palma',      position: { x: SW*0.82, y: 450 } },
      { id: 'b11',   label: 'Martin Sheen',        position: { x: SW*0.30, y: 545 } },
      { id: 'b12',   label: 'Dennis Hopper',       position: { x: SW*0.70, y: 545 } },
      { id: 'o1',    label: 'Citizen Kane',        position: { x: SW*0.15, y: 570 } },
      { id: 'o2',    label: 'Lawrence of Arabia',  position: { x: SW*0.85, y: 240 } },
      { id: 'end',   label: 'Apocalypse Now',      position: { x: SW/2,    y: 640 } },
    ],
    connections: {
      start: ['b1', 'b2', 'b3'],
      b1:    ['start', 'b4', 'b5'],
      b2:    ['start', 'b5', 'b7'],
      b3:    ['start', 'b6'],
      b4:    ['b1', 'b8'],
      b5:    ['b1', 'b2', 'b9'],
      b6:    ['b3', 'b10'],
      b7:    ['b2', 'b9', 'b11', 'end'],
      b8:    ['b4', 'b11'],
      b9:    ['b5', 'b7'],
      b10:   ['b6', 'b12'],
      b11:   ['b7', 'b8', 'end'],
      b12:   ['b10', 'end'],
      o1:    [],
      o2:    [],
      end:   ['b7', 'b11', 'b12'],
    },
    optimal_path: ['start', 'b2', 'b7', 'end'],
  },

  sport: {
    id: 'mock-sport',
    category_id: 'sport',
    date: '',
    start_concept: 'Michael Jordan',
    end_concept: 'Space Jam',
    narrative: null,
    bubbles: [
      { id: 'start', label: 'Michael Jordan',     position: { x: SW/2,    y: 80  } },
      { id: 'b1',    label: 'Chicago Bulls',       position: { x: SW*0.20, y: 190 } },
      { id: 'b2',    label: 'Scottie Pippen',      position: { x: SW*0.50, y: 195 } },
      { id: 'b3',    label: 'Nike / Air Jordan',   position: { x: SW*0.80, y: 190 } },
      { id: 'b4',    label: '6 NBA Titles',        position: { x: SW*0.15, y: 310 } },
      { id: 'b5',    label: 'Phil Jackson',        position: { x: SW*0.42, y: 305 } },
      { id: 'b6',    label: 'Hollywood',           position: { x: SW*0.75, y: 310 } },
      { id: 'b7',    label: 'Bugs Bunny',          position: { x: SW*0.50, y: 390 } },
      { id: 'b8',    label: 'Dennis Rodman',       position: { x: SW*0.18, y: 450 } },
      { id: 'b9',    label: 'Tune Squad',          position: { x: SW*0.50, y: 470 } },
      { id: 'b10',   label: 'Bill Murray',         position: { x: SW*0.82, y: 450 } },
      { id: 'b11',   label: 'Looney Tunes',        position: { x: SW*0.30, y: 545 } },
      { id: 'b12',   label: 'Warner Bros',         position: { x: SW*0.70, y: 545 } },
      { id: 'o1',    label: 'LeBron James',        position: { x: SW*0.15, y: 570 } },
      { id: 'o2',    label: 'Kobe Bryant',         position: { x: SW*0.85, y: 240 } },
      { id: 'end',   label: 'Space Jam',           position: { x: SW/2,    y: 640 } },
    ],
    connections: {
      start: ['b1', 'b2', 'b3'],
      b1:    ['start', 'b4', 'b5'],
      b2:    ['start', 'b5', 'b7'],  // Pippen → Bugs Bunny (both in Space Jam lore)
      b3:    ['start', 'b6'],        // Nike → Hollywood
      b4:    ['b1', 'b8'],
      b5:    ['b1', 'b2', 'b9'],     // Phil Jackson → Tune Squad
      b6:    ['b3', 'b10', 'b12'],   // Hollywood → Bill Murray, Warner Bros
      b7:    ['b2', 'b9', 'b11', 'end'], // Bugs → Space Jam ✓
      b8:    ['b4', 'b1'],
      b9:    ['b5', 'b7', 'end'],    // Tune Squad → Space Jam ✓
      b10:   ['b6', 'end'],          // Bill Murray → Space Jam ✓
      b11:   ['b7', 'end'],          // Looney Tunes → Space Jam ✓
      b12:   ['b6', 'end'],          // Warner Bros → Space Jam ✓
      o1:    [],
      o2:    [],
      end:   ['b7', 'b9', 'b10', 'b11', 'b12'],
    },
    // Optimal: Jordan → Pippen → Bugs Bunny → Space Jam (3 hops)
    optimal_path: ['start', 'b2', 'b7', 'end'],
  },
}
