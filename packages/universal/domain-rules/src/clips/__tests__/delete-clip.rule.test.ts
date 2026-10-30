import type { Clip } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { ADMIN, OWNER, STRANGER } from '../../__tests__/entities';
import { decideClipDelete } from '../delete-clip.rule';

const CLIP: Clip = {
  id: 'clip-1',
  videoId: 'video-1',
  userId: STRANGER.id,
  startMs: 0,
  endMs: 20_000,
  title: 'Goal',
  createdAt: new Date('2026-01-02T00:00:00.000Z'),
};

describe('@vp/domain-rules: decideClipDelete', () => {
  it.each([
    { who: 'the creator', actor: STRANGER },
    { who: 'an admin', actor: ADMIN },
  ])('lets $who delete the clip', ({ actor }) => {
    expect(expectOk(decideClipDelete({ actor, clip: CLIP, clipId: 'clip-1' }))).toBe(CLIP);
  });

  it.each([
    { scenario: 'a missing clip', actor: STRANGER, clip: null, code: ErrorCodes.CLIP_NOT_FOUND },
    { scenario: 'an anonymous caller', actor: null, clip: CLIP, code: ErrorCodes.UNAUTHORIZED },
    { scenario: 'another viewer', actor: OWNER, clip: CLIP, code: ErrorCodes.FORBIDDEN },
  ])('refuses $scenario with $code', ({ actor, clip, code }) => {
    expect(expectErr(decideClipDelete({ actor, clip, clipId: 'clip-1' })).code).toBe(code);
  });
});
