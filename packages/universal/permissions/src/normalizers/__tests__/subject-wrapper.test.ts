import { describe, expect, it } from 'vitest';
import {
  createSubject,
  toChannelSubject,
  toCommentSubject,
  toUploadSubject,
  toVideoSubject,
} from '../subject-wrapper';
import { normalizeVideoResource } from '../video.normalizer';

describe('normalizers/subject-wrapper: CASL Subject Wrappers', () => {
  it('toVideoSubject wraps with CASL subject and Video tag', () => {
    const subj = toVideoSubject({ id: 'v1', userId: 'u1' });
    expect(subj).toBeDefined();
    expect((subj as unknown as Record<string, unknown>).ownerId).toBe('u1');
    expect((subj as unknown as Record<string, unknown>).visibility).toBe('public');
  });

  it('toChannelSubject wraps with CASL subject and Channel tag', () => {
    const subj = toChannelSubject({ id: 'c1', userId: 'u1' });
    expect(subj).toBeDefined();
    expect((subj as unknown as Record<string, unknown>).ownerId).toBe('u1');
  });

  it('toCommentSubject wraps with CASL subject and Comment tag', () => {
    const subj = toCommentSubject({ id: 'cm1' }, 'video-owner');
    expect(subj).toBeDefined();
    expect((subj as unknown as Record<string, unknown>).videoOwnerId).toBe('video-owner');
  });

  it('toUploadSubject wraps with CASL subject and Upload tag', () => {
    const subj = toUploadSubject(null, { ownerId: 'owner-1' });
    expect(subj).toBeDefined();
    expect((subj as unknown as Record<string, unknown>).ownerId).toBe('owner-1');
  });

  it('createSubject returns undefined if normalizer returns undefined', () => {
    const subj = createSubject('Video', null, normalizeVideoResource);
    expect(subj).toBeUndefined();
  });
});
