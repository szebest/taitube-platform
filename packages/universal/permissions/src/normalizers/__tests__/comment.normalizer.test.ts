import { describe, expect, it } from 'vitest';
import { normalizeCommentResource } from '../comment.normalizer';

describe('normalizers/comment: normalizeCommentResource', () => {
  it('returns undefined when no input and no videoOwnerId', () => {
    expect(normalizeCommentResource(undefined)).toBeUndefined();
    expect(normalizeCommentResource(null)).toBeUndefined();
  });

  it('normalizes authorId from userId and maps videoOwnerId', () => {
    const res = normalizeCommentResource({ id: 'cm1', userId: 'author-1' }, 'video-owner-1');
    expect(res).toEqual({
      id: 'cm1',
      userId: 'author-1',
      authorId: 'author-1',
      videoOwnerId: 'video-owner-1',
    });
  });

  it('allows videoOwnerId passed as second arg to override or supplement', () => {
    const res = normalizeCommentResource(undefined, 'video-owner-2');
    expect(res).toEqual({
      videoOwnerId: 'video-owner-2',
    });
  });
});
