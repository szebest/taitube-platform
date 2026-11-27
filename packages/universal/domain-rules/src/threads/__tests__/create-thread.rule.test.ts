import { isErr, isOk } from '@kit/result';
import { ErrorCodes } from '@vp/errors';
import { OWNER, STRANGER, aVideo } from '../../__tests__/entities';
import { decideThreadCreate } from '../create-thread.rule';

const input = (over: Partial<Parameters<typeof decideThreadCreate>[0]> = {}) => ({
  author: STRANGER,
  video: aVideo({ durationMs: 60_000 }),
  videoId: 'video-1',
  title: 'The cut',
  body: '',
  anchorMs: 1_000,
  openThreads: 0,
  ...over,
});

describe('@vp/domain-rules: decideThreadCreate', () => {
  it.each([
    { name: 'a thread at the start', over: { anchorMs: 0 } },
    { name: 'a thread at the very end', over: { anchorMs: 60_000 } },
    { name: 'the fifth thread', over: { openThreads: 4 } },
  ])('accepts $name', ({ over }) => {
    expect(isOk(decideThreadCreate(input(over)))).toBe(true);
  });

  it('keeps the trimmed text', () => {
    const result = decideThreadCreate(input({ title: ' The cut ', body: ' why ' }));

    expect(isOk(result) && result.value).toMatchObject({ title: 'The cut', body: 'why' });
  });

  it.each([
    { name: 'nobody signed in', over: { author: null }, code: ErrorCodes.UNAUTHORIZED },
    {
      name: 'a guest identity',
      over: { author: { id: 'g', role: 'GUEST' as const } },
      code: ErrorCodes.FORBIDDEN,
    },
    { name: 'no video', over: { video: null }, code: ErrorCodes.VIDEO_NOT_FOUND },
    {
      name: 'a private video of someone else',
      over: { video: aVideo({ visibility: 'private', ownerId: OWNER.id }) },
      code: ErrorCodes.FORBIDDEN,
    },
    { name: 'a blank title', over: { title: ' ' }, code: ErrorCodes.VALIDATION_FAILED },
    {
      name: 'an anchor past the end',
      over: { anchorMs: 60_001 },
      code: ErrorCodes.THREAD_ANCHOR_INVALID,
    },
    { name: 'a negative anchor', over: { anchorMs: -1 }, code: ErrorCodes.THREAD_ANCHOR_INVALID },
    {
      name: 'a video of unknown length',
      over: { video: aVideo({ durationMs: null }) },
      code: ErrorCodes.THREAD_ANCHOR_INVALID,
    },
    { name: 'five open threads', over: { openThreads: 5 }, code: ErrorCodes.THREAD_LIMIT },
  ])('refuses $name', ({ over, code }) => {
    const result = decideThreadCreate(input(over));

    expect(isErr(result) && result.error.code).toBe(code);
  });
});
