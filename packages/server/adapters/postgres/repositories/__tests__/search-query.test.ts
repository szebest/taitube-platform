import { videos } from '@vp/db';
import { SEARCH_RANKING, type SearchSort } from '@vp/domain';
import { sql } from 'drizzle-orm';
import { sqlParams, sqlText } from '../../scopes/__tests__/sql-text';
import { afterCursor, epochOf, instantOf, sortKey, textMatch } from '../search-query';

const VECTOR = sql`"videos"."search_vector"`;
const CURSOR = { key: 1.5, kind: 'video', id: 'v-9' } as const;

describe('adapters/postgres: search SQL', () => {
  it('hands the text to websearch_to_tsquery under the configuration the vectors use', () => {
    const { where } = textMatch('lexical', 'learn "react hooks" -class', VECTOR, [videos.title]);

    expect(sqlParams(where)).toEqual(['simple', 'learn "react hooks" -class']);
  });

  it('pins the walk to the instant it carries', () => {
    expect(sqlParams(instantOf(0))).toEqual(['1970-01-01T00:00:00.000Z']);
  });

  it('matches lexically on the vector and scores with ts_rank_cd', () => {
    const match = textMatch('lexical', 'react', VECTOR, [videos.title]);

    expect(sqlText(match.where)).toBe(
      '"videos"."search_vector" @@ websearch_to_tsquery($1::regconfig, $2)'
    );
    expect(sqlText(match.score)).toBe(
      'ts_rank_cd("videos"."search_vector", websearch_to_tsquery($1::regconfig, $2))'
    );
  });

  it('falls back to trigram word similarity over the short fields, index operator first', () => {
    const match = textMatch('fuzzy', 'reac', VECTOR, [videos.title, videos.description]);
    const threshold = SEARCH_RANKING.fuzzyThreshold;

    expect(sqlText(match.where)).toBe(
      `(($1 <% "videos"."title" and word_similarity($2, "videos"."title") >= ${threshold}) or ($3 <% "videos"."description" and word_similarity($4, "videos"."description") >= ${threshold}))`
    );
    expect(sqlText(match.score)).toBe(
      'greatest(word_similarity($1, "videos"."title"), word_similarity($2, "videos"."description"))'
    );
  });

  it.each<[SearchSort, string]>([
    ['relevance', '(r)::double precision'],
    ['date', '(extract(epoch from "videos"."created_at")::double precision)::double precision'],
    ['views', '(v)::double precision'],
  ])('keys a %s sort on %s', (sort, expected) => {
    const keys = { relevance: sql`r`, date: epochOf(videos.createdAt), views: sql`v` };

    expect(sqlText(sortKey(sort, keys))).toBe(expected);
  });

  it('starts at the top without a cursor', () => {
    expect(afterCursor('video', sql`k`, videos.id, null)).toBeUndefined();
  });

  it.each([
    ['channel', 'k < $1::double precision'],
    ['playlist', 'k <= $1::double precision'],
    ['video', '(k < $1::double precision or (k = $2::double precision and "videos"."id" < $3))'],
  ] as const)('resumes a %s table after a video cursor with %s', (kind, expected) => {
    const bound = afterCursor(kind, sql`k`, videos.id, CURSOR);

    expect(sqlText(bound)).toBe(expected);
    expect(sqlParams(bound)).toContain(CURSOR.key);
  });
});
