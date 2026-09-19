import { describe, expect, it } from 'vitest';
import { normalizeVideoResource } from '../video.normalizer';

describe('normalizers/video: normalizeVideoResource', () => {
  it('returns undefined for undefined or null input', () => {
    expect(normalizeVideoResource(undefined)).toBeUndefined();
    expect(normalizeVideoResource(null)).toBeUndefined();
  });

  it('falls back ownerId from userId and defaults visibility to public', () => {
    const res = normalizeVideoResource({ id: 'v1', userId: 'user-1' });
    expect(res).toEqual({
      id: 'v1',
      userId: 'user-1',
      ownerId: 'user-1',
      visibility: 'public',
    });
  });

  it('preserves existing ownerId and visibility', () => {
    const res = normalizeVideoResource({
      id: 'v2',
      ownerId: 'owner-1',
      visibility: 'private',
    });
    expect(res).toEqual({
      id: 'v2',
      ownerId: 'owner-1',
      visibility: 'private',
    });
  });
});
