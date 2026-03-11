/**
 * wikidataHelpers.ts
 *
 * Shared types and helpers used by both wikidata.ts and the per-domain
 * subquery files in src/domains/.
 */

export type SubqueryDifficulty = 'easy' | 'medium' | 'hard'

export interface TaggedSubquery {
  difficulty: SubqueryDifficulty
  query: (limit: number) => string
  types: [string, string]
  edgeLabel?: string
}

export function sq(
  difficulty: SubqueryDifficulty,
  types: [string, string],
  query: (limit: number) => string,
  edgeLabel?: string,
): TaggedSubquery {
  return { difficulty, types, query, edgeLabel }
}
