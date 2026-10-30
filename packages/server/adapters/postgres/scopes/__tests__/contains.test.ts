import { videos } from '@vp/db';
import { containsScope } from '../contains';
import { sqlParams, sqlText } from './sql-text';

describe('adapters/postgres/scoping: contains scope', () => {
  it.each([
    { text: 'cats', pattern: '%cats%' },
    { text: '50%_off\\', pattern: '%50\\%\\_off\\\\%' },
  ])('matches "$text" case-insensitively as a literal substring', ({ text, pattern }) => {
    const scope = containsScope(videos.title, text);

    expect(sqlText(scope)).toBe('"videos"."title" ilike $1');
    expect(sqlParams(scope)).toEqual([pattern]);
  });

  it.each([{ text: undefined }, { text: '' }])('scopes nothing for $text', ({ text }) => {
    expect(containsScope(videos.title, text)).toBeUndefined();
  });
});
