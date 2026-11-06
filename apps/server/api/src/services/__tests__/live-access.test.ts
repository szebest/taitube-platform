import type { VideoVisibility } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { expectErr, expectOk } from '@vp/testing/result';
import { readLive } from '../live-access';
import { liveWorld, OWNER, STREAM_ID, VIEWER } from './live-harness';

async function read(
  viewer: UserContext | null,
  world: { live?: boolean; visibility?: VideoVisibility }
) {
  const { repositories } = await liveWorld(world);
  return readLive(repositories, viewer, STREAM_ID);
}

describe('apps/server/api/services: readLive', () => {
  it.each([
    { who: 'anyone', viewer: null, visibility: 'public' as const },
    { who: 'anyone with the link', viewer: null, visibility: 'unlisted' as const },
    { who: 'the owner', viewer: OWNER, visibility: 'private' as const },
  ])('lets $who watch a $visibility broadcast', async ({ viewer, visibility }) => {
    const { stream, channel } = expectOk(await read(viewer, { visibility }));

    expect([stream.id, channel.handle]).toEqual([STREAM_ID, 'night-kitchen']);
  });

  it.each([
    {
      scenario: 'an idle stream',
      viewer: VIEWER,
      world: { live: false },
      code: ErrorCodes.LIVE_STREAM_NOT_FOUND,
    },
    {
      scenario: "someone else's private broadcast",
      viewer: VIEWER,
      world: { visibility: 'private' as const },
      code: ErrorCodes.LIVE_STREAM_NOT_FOUND,
    },
    {
      scenario: 'a private broadcast, signed out',
      viewer: null,
      world: { visibility: 'private' as const },
      code: ErrorCodes.UNAUTHORIZED,
    },
  ])('answers $scenario with $code', async ({ viewer, world, code }) => {
    expect(expectErr(await read(viewer, world)).code).toBe(code);
  });
});
