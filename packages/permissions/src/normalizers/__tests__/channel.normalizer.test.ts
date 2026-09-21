import { describe, expect, it } from 'vitest';
import { normalizeChannelResource } from '../channel.normalizer';

describe('normalizers/channel: normalizeChannelResource', () => {
  it('returns undefined for undefined or null input', () => {
    expect(normalizeChannelResource(undefined)).toBeUndefined();
    expect(normalizeChannelResource(null)).toBeUndefined();
  });

  it('falls back ownerId from userId', () => {
    const res = normalizeChannelResource({ id: 'c1', userId: 'user-1' });
    expect(res).toEqual({
      id: 'c1',
      userId: 'user-1',
      ownerId: 'user-1',
    });
  });

  it('preserves existing ownerId', () => {
    const res = normalizeChannelResource({ id: 'c2', ownerId: 'owner-1' });
    expect(res).toEqual({
      id: 'c2',
      ownerId: 'owner-1',
    });
  });
});
