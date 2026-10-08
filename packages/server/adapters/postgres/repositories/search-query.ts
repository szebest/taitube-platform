import { SEARCH_TEXT_CONFIG } from '@vp/db';
import {
  SEARCH_RANKING,
  type SearchMode,
  type SearchPosition,
  type SearchResultKind,
  type SearchSort,
  searchKeyBound,
} from '@vp/domain';
import { type SQL, type SQLWrapper, or, sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { keysetBefore } from '../scopes/index';
import { constant } from './sql-constant';

/** `websearch_to_tsquery` parses the text, quotes, `or` and `-` included; nothing here does. */
function tsqueryOf(text: string): SQL {
  return sql`websearch_to_tsquery(${SEARCH_TEXT_CONFIG}::regconfig, ${text})`;
}

const { A, B, C, D } = SEARCH_RANKING.weights;

/** `ts_rank_cd` reads its weights lowest first: D, C, B, A. */
const RANK_WEIGHTS = sql.raw(`'{${D},${C},${B},${A}}'::float4[]`);

export function instantOf(instant: number): SQL {
  return sql`${new Date(instant).toISOString()}::timestamptz`;
}

export interface TextMatch {
  where: SQL;
  score: SQL;
}

/**
 * Lexical: the row's vector against the parsed query, scored by `ts_rank_cd`. Fuzzy: trigram word
 * similarity against the short fields, where `<%` lets the GIN trigram index find the candidates.
 */
export function textMatch(
  mode: SearchMode,
  text: string,
  vector: SQL,
  fields: readonly SQLWrapper[]
): TextMatch {
  switch (mode) {
    case 'lexical': {
      const tsquery = tsqueryOf(text);
      return {
        where: sql`${vector} @@ ${tsquery}`,
        score: sql`ts_rank_cd(${RANK_WEIGHTS}, ${vector}, ${tsquery})`,
      };
    }
    case 'fuzzy': {
      const threshold = constant(SEARCH_RANKING.fuzzyThreshold);
      const similar = fields.map(
        (field) => sql`(${text} <% ${field} and word_similarity(${text}, ${field}) >= ${threshold})`
      );
      const scores = fields.map((field) => sql`word_similarity(${text}, ${field})`);
      return {
        where: or(...similar) ?? sql`false`,
        score: sql`greatest(${sql.join(scores, sql`, `)})`,
      };
    }
  }
}

export function epochOf(column: SQLWrapper): SQL {
  return sql`extract(epoch from ${column})::double precision`;
}

export interface SortKeys {
  relevance: SQL;
  date: SQL;
  views: SQL;
}

export function sortKey(sort: SearchSort, keys: SortKeys): SQL<number> {
  return sql<number>`(${keys[sort]})::double precision`.mapWith(Number);
}

export function afterCursor(
  kind: SearchResultKind,
  key: SQL,
  id: AnyPgColumn,
  cursor: SearchPosition | null
): SQL | undefined {
  if (!cursor) return undefined;
  const bound = sql`${cursor.key}::double precision`;
  switch (searchKeyBound(kind, cursor)) {
    case 'below':
      return sql`${key} < ${bound}`;
    case 'at-or-below':
      return sql`${key} <= ${bound}`;
    case 'keyset':
      return keysetBefore(key, id, { sort: bound, tie: cursor.id });
  }
}
