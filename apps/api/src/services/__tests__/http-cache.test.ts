import {
  type CacheControlOptions,
  buildCacheHeaders,
  generateEtag,
  isNotModified,
} from '../http-cache';

describe('apps/api/services: http-cache', () => {
  describe('generateEtag', () => {
    it.each([
      { scenario: 'weak by default', weak: undefined, pattern: /^W\/"[0-9a-f]{16}"$/ },
      { scenario: 'strong when weak is false', weak: false, pattern: /^"[0-9a-f]{16}"$/ },
    ])('tags $scenario', ({ weak, pattern }) => {
      expect(generateEtag({ id: '1', name: 'Music' }, weak)).toMatch(pattern);
    });

    it('produces deterministic output for identical input', () => {
      expect(generateEtag('hello world')).toBe(generateEtag('hello world'));
    });
  });

  describe('isNotModified', () => {
    const etag = 'W/"abcd1234efgh5678"';

    it.each<{
      scenario: string;
      ifNoneMatch?: string | null;
      currentEtag?: string | null;
      expected: boolean;
    }>([
      { scenario: 'If-None-Match is absent', currentEtag: etag, expected: false },
      { scenario: 'If-None-Match is null', ifNoneMatch: null, currentEtag: etag, expected: false },
      { scenario: 'the resource has no etag', ifNoneMatch: 'abcd', expected: false },
      {
        scenario: 'the resource etag is null',
        ifNoneMatch: 'abcd',
        currentEtag: null,
        expected: false,
      },
      {
        scenario: 'the client sends the same weak etag',
        ifNoneMatch: 'W/"abcd1234efgh5678"',
        currentEtag: etag,
        expected: true,
      },
      {
        scenario: 'the client sends the same etag in strong form',
        ifNoneMatch: '"abcd1234efgh5678"',
        currentEtag: etag,
        expected: true,
      },
      {
        scenario: 'the client sends the same etag unquoted',
        ifNoneMatch: 'abcd1234efgh5678',
        currentEtag: etag,
        expected: true,
      },
      {
        scenario: 'the client sends a wildcard',
        ifNoneMatch: '*',
        currentEtag: etag,
        expected: true,
      },
      {
        scenario: 'the etag is one of a comma-separated list',
        ifNoneMatch: '"foo", "bar", W/"abcd1234efgh5678"',
        currentEtag: etag,
        expected: true,
      },
      {
        scenario: 'no entry of a comma-separated list matches',
        ifNoneMatch: '"foo", "bar"',
        currentEtag: etag,
        expected: false,
      },
      {
        scenario: 'the client sends a different etag',
        ifNoneMatch: '"different-tag"',
        currentEtag: etag,
        expected: false,
      },
    ])('$scenario: $expected', ({ ifNoneMatch, currentEtag, expected }) => {
      expect(isNotModified(ifNoneMatch, currentEtag)).toBe(expected);
    });
  });

  describe('buildCacheHeaders', () => {
    it.each<{ scenario: string; options: CacheControlOptions; expected: Record<string, string> }>([
      {
        scenario: 'a public response with an etag',
        options: { etag: 'W/"123"', maxAgeSeconds: 300, staleWhileRevalidateSeconds: 60 },
        expected: {
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
          ETag: 'W/"123"',
        },
      },
      {
        scenario: 'a private response that must revalidate',
        options: { isPublic: false, maxAgeSeconds: 0, mustRevalidate: true },
        expected: { 'Cache-Control': 'private, max-age=0, must-revalidate' },
      },
    ])('builds headers for $scenario', ({ options, expected }) => {
      expect(buildCacheHeaders(options)).toEqual(expected);
    });
  });
});
