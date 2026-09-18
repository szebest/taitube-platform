import { describe, expect, it } from 'vitest';
import { HttpCacheService } from '../http-cache-service';

describe('HttpCacheService', () => {
  const service = new HttpCacheService();

  describe('generateEtag', () => {
    it('generates weak ETag by default', () => {
      const etag = service.generateEtag({ id: '1', name: 'Music' });
      expect(etag).toMatch(/^W\/"[0-9a-f]{16}"$/);
    });

    it('generates strong ETag when weak = false', () => {
      const etag = service.generateEtag({ id: '1', name: 'Music' }, false);
      expect(etag).toMatch(/^"[0-9a-f]{16}"$/);
    });

    it('produces deterministic output for identical input', () => {
      const tag1 = service.generateEtag('hello world');
      const tag2 = service.generateEtag('hello world');
      expect(tag1).toBe(tag2);
    });
  });

  describe('isNotModified', () => {
    const etag = 'W/"abcd1234efgh5678"';

    it('returns false if If-None-Match or currentEtag is missing', () => {
      expect(service.isNotModified(undefined, etag)).toBe(false);
      expect(service.isNotModified(null, etag)).toBe(false);
      expect(service.isNotModified('abcd', undefined)).toBe(false);
      expect(service.isNotModified('abcd', null)).toBe(false);
    });

    it('matches exact weak etag', () => {
      expect(service.isNotModified('W/"abcd1234efgh5678"', etag)).toBe(true);
    });

    it('matches unquoted or strong format of the same etag', () => {
      expect(service.isNotModified('"abcd1234efgh5678"', etag)).toBe(true);
      expect(service.isNotModified('abcd1234efgh5678', etag)).toBe(true);
    });

    it('matches wildcard *', () => {
      expect(service.isNotModified('*', etag)).toBe(true);
    });

    it('matches within comma-separated list of etags', () => {
      expect(service.isNotModified('"foo", "bar", W/"abcd1234efgh5678"', etag)).toBe(true);
      expect(service.isNotModified('"foo", "bar"', etag)).toBe(false);
    });

    it('returns false on mismatch', () => {
      expect(service.isNotModified('"different-tag"', etag)).toBe(false);
    });
  });

  describe('buildCacheHeaders', () => {
    it('builds public max-age and etag headers', () => {
      const headers = service.buildCacheHeaders({
        etag: 'W/"123"',
        maxAgeSeconds: 300,
        staleWhileRevalidateSeconds: 60,
      });

      expect(headers).toEqual({
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
        ETag: 'W/"123"',
      });
    });

    it('respects private flag and mustRevalidate', () => {
      const headers = service.buildCacheHeaders({
        isPublic: false,
        maxAgeSeconds: 0,
        mustRevalidate: true,
      });

      expect(headers).toEqual({
        'Cache-Control': 'private, max-age=0, must-revalidate',
      });
    });
  });
});
