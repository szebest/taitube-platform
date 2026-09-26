import {
  SEARCH_RANKING,
  SEARCH_SUGGESTIONS,
  type SearchCursor,
  type SearchPosition,
  channelSearchScore,
  compareSearchPositions,
  isAfterSearchPosition,
  isExactChannelMatch,
  playlistSearchScore,
  searchKeyBound,
  searchKinds,
  searchSuggestionPrefixes,
  searchWalkInstant,
  videoSearchScore,
} from '../search';

const NOW = Date.parse('2026-09-01T00:00:00.000Z');
const DAY_MS = 86_400_000;

function at(key: number, kind: SearchPosition['kind'], id: string): SearchPosition {
  return { key, kind, id };
}

describe('packages/domain: search rules', () => {
  it.each([
    ['all', ['channel', 'video', 'playlist']],
    ['video', ['video']],
    ['channel', ['channel']],
    ['playlist', ['playlist']],
  ] as const)('searches %s as %j', (type, kinds) => {
    expect(searchKinds(type)).toEqual(kinds);
  });

  it.each([
    ['fireship', true],
    ['@fireship', true],
    ['fire ship', true],
    ['fire', false],
  ])('treats %j as an exact channel match: %s', (query, exact) => {
    expect(isExactChannelMatch({ handle: 'fireship', displayName: 'Fire Ship' }, query)).toBe(
      exact
    );
  });

  describe('scores', () => {
    it('lifts a popular video over an obscure one with the same match', () => {
      const created = new Date(NOW);

      expect(videoSearchScore(1, { viewsCount: 10_000, createdAt: created }, NOW)).toBeGreaterThan(
        videoSearchScore(1, { viewsCount: 0, createdAt: created }, NOW)
      );
    });

    it('halves a video a recency scale old against a new one', () => {
      const fresh = videoSearchScore(1, { viewsCount: 0, createdAt: new Date(NOW) }, NOW);
      const old = videoSearchScore(
        1,
        {
          viewsCount: 0,
          createdAt: new Date(NOW - SEARCH_RANKING.recencyScaleDays * DAY_MS),
        },
        NOW
      );

      expect(old).toBeCloseTo(fresh / 2);
    });

    it('boosts a channel and pins an exact one above any ordinary score', () => {
      expect(channelSearchScore(1, { subscriberCount: 0 }, false)).toBeCloseTo(
        SEARCH_RANKING.channelBoost
      );
      expect(channelSearchScore(0.1, { subscriberCount: 0 }, true)).toBeGreaterThan(
        channelSearchScore(1, { subscriberCount: 1_000_000_000 }, false)
      );
    });

    it('lifts a longer playlist over a shorter one with the same match', () => {
      expect(playlistSearchScore(1, 20)).toBeGreaterThan(playlistSearchScore(1, 1));
    });
  });

  describe('order', () => {
    it('sorts by key, then channels, videos, playlists, then id, all at once', () => {
      const shuffled = [
        at(1, 'playlist', 'b'),
        at(2, 'video', 'a'),
        at(1, 'channel', 'a'),
        at(1, 'video', 'a'),
        at(1, 'video', 'b'),
      ];

      expect(shuffled.sort(compareSearchPositions)).toEqual([
        at(2, 'video', 'a'),
        at(1, 'channel', 'a'),
        at(1, 'video', 'b'),
        at(1, 'video', 'a'),
        at(1, 'playlist', 'b'),
      ]);
    });

    it.each([
      { candidate: at(0.5, 'channel', 'z'), after: true },
      { candidate: at(1, 'playlist', 'z'), after: true },
      { candidate: at(1, 'video', 'a'), after: true },
      { candidate: at(1, 'video', 'm'), after: false },
      { candidate: at(1, 'channel', 'a'), after: false },
      { candidate: at(2, 'playlist', 'a'), after: false },
    ])('places $candidate after the cursor: $after', ({ candidate, after }) => {
      expect(isAfterSearchPosition(candidate, at(1, 'video', 'm'))).toBe(after);
    });

    it.each([
      ['channel', 'below'],
      ['video', 'keyset'],
      ['playlist', 'at-or-below'],
    ] as const)('bounds a %s table after a video cursor with %s', (kind, bound) => {
      expect(searchKeyBound(kind, at(1, 'video', 'm'))).toBe(bound);
    });
  });

  it('keeps the instant of the walk it resumes and samples the clock for a first page', () => {
    const cursor: SearchCursor = {
      ...at(1, 'video', 'm'),
      sort: 'relevance',
      mode: 'lexical',
      instant: 7,
    };

    expect(searchWalkInstant(cursor, NOW)).toBe(7);
    expect(searchWalkInstant(null, NOW)).toBe(NOW);
  });

  it('files a suggestion under every prefix, up to the cap', () => {
    expect(searchSuggestionPrefixes('react')).toEqual(['r', 're', 'rea', 'reac', 'react']);
    expect(searchSuggestionPrefixes('x'.repeat(40))).toHaveLength(
      SEARCH_SUGGESTIONS.prefixMaxLength
    );
  });
});
