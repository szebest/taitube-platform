import { describe, expect, it } from 'vitest';
import { normalizeUploadResource } from '../upload.normalizer';

describe('normalizers/upload: normalizeUploadResource', () => {
  it('returns undefined when neither upload nor video provided', () => {
    expect(normalizeUploadResource(undefined, undefined)).toBeUndefined();
    expect(normalizeUploadResource(null, null)).toBeUndefined();
  });

  it('resolves ownerId from upload ownerId or userId', () => {
    expect(normalizeUploadResource({ id: 'u1', userId: 'user-1' })).toEqual({
      id: 'u1',
      userId: 'user-1',
      ownerId: 'user-1',
    });

    expect(normalizeUploadResource({ id: 'u2', ownerId: 'owner-2' })).toEqual({
      id: 'u2',
      ownerId: 'owner-2',
    });
  });

  it('resolves ownerId from fallback video object', () => {
    expect(normalizeUploadResource(null, { id: 'v1', userId: 'user-2' })).toEqual({
      ownerId: 'user-2',
    });

    expect(normalizeUploadResource({ id: 'u3' }, { id: 'v2', ownerId: 'owner-3' })).toEqual({
      id: 'u3',
      ownerId: 'owner-3',
    });
  });
});
