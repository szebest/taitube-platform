import { isErr, isOk } from '@kit/result';
import { ErrorCodes } from '@vp/errors';
import { AUTHOR, OWNER, STRANGER, aThread, aVideo } from '../../__tests__/entities';
import { decideThreadRead } from '../read-thread.rule';

describe('@vp/domain-rules: decideThreadRead', () => {
  it.each([
    { name: 'a published thread to anyone', thread: aThread(), viewer: null },
    {
      name: 'a held thread to its author',
      thread: aThread({ moderationState: 'held' }),
      viewer: AUTHOR,
    },
    {
      name: 'a hidden thread to the owner',
      thread: aThread({ moderationState: 'hidden' }),
      viewer: OWNER,
    },
  ])('reads $name', ({ thread, viewer }) => {
    expect(isOk(decideThreadRead({ viewer, thread, threadId: thread.id, video: aVideo() }))).toBe(
      true
    );
  });

  it.each([
    { name: 'no thread', thread: null, video: aVideo(), code: ErrorCodes.THREAD_NOT_FOUND },
    {
      name: 'a held thread to a stranger',
      thread: aThread({ moderationState: 'held' }),
      video: aVideo(),
      code: ErrorCodes.THREAD_NOT_FOUND,
    },
    {
      name: 'a thread of a private video',
      thread: aThread(),
      video: aVideo({ visibility: 'private' }),
      code: ErrorCodes.FORBIDDEN,
    },
  ])('refuses $name', ({ thread, video, code }) => {
    const result = decideThreadRead({ viewer: STRANGER, thread, threadId: 'thread-1', video });

    expect(isErr(result) && result.error.code).toBe(code);
  });
});
