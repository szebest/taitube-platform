import { InMemoryRepositories } from '@vp/adapters/in-memory';
import type { Channel, LiveStream, VideoVisibility } from '@vp/domain';
import type { UserContext } from '@vp/permissions';
import { expectOk } from '@vp/testing/result';

export const OWNER: UserContext = { id: '00000000-0000-7000-8000-0000000000c0', role: 'USER' };
export const VIEWER: UserContext = { id: '00000000-0000-7000-8000-0000000000d0', role: 'USER' };
export const MODERATOR: UserContext = {
  id: '00000000-0000-7000-8000-0000000000e0',
  role: 'MODERATOR',
};
export const STREAM_ID = '00000000-0000-7000-8000-00000000f101';
export const VIDEO_ID = '00000000-0000-7000-8000-00000000f201';
export const STARTED = new Date('2026-03-01T12:00:00.000Z');

export async function liveWorld(
  options: { live?: boolean; visibility?: VideoVisibility } = {}
): Promise<{ repositories: InMemoryRepositories; channelId: string }> {
  const { live = true, visibility = 'public' } = options;
  const repositories = new InMemoryRepositories();
  for (const user of [OWNER, VIEWER, MODERATOR]) {
    expectOk(await repositories.users.upsert({ id: user.id, email: `${user.id}@example.com` }));
  }
  const channel = expectOk(
    await repositories.channels.create({
      userId: OWNER.id,
      handle: 'night-kitchen',
      displayName: 'Night Kitchen',
    })
  );
  expectOk(
    await repositories.liveStreams.ensureIdle(channel.id, {
      id: STREAM_ID,
      streamKey: 'stream-key',
      overlayToken: 'overlay-token',
      controlToken: 'control-token',
    })
  );
  expectOk(await repositories.liveStreams.update(STREAM_ID, { visibility }));
  if (live) {
    expectOk(
      await repositories.liveStreams.goLive({
        streamId: STREAM_ID,
        video: { id: VIDEO_ID, ownerId: OWNER.id, visibility, sourceKey: `live/${STREAM_ID}/` },
        startedAt: STARTED,
        outbox: [],
      })
    );
  }
  return { repositories, channelId: channel.id };
}

export function aChannel(overrides: Partial<Channel> = {}): Channel {
  return {
    id: '00000000-0000-7000-8000-0000000000c1',
    userId: OWNER.id,
    handle: 'night-kitchen',
    displayName: 'Night Kitchen',
    avatarUrl: null,
    bannerUrl: null,
    brandColor: null,
    bio: null,
    links: [],
    avatarVersion: 0,
    bannerVersion: 0,
    bannerCrops: null,
    country: null,
    contactEmail: null,
    bannerLink: null,
    handleChangedAt: null,
    subscriberCount: 3,
    createdAt: STARTED,
    updatedAt: STARTED,
    ...overrides,
  };
}

export function aLiveStream(overrides: Partial<LiveStream> = {}): LiveStream {
  return {
    id: STREAM_ID,
    channelId: '00000000-0000-7000-8000-0000000000c1',
    title: '',
    description: '',
    streamKey: 'stream-key',
    status: 'LIVE',
    visibility: 'public',
    archiveVisibility: 'public',
    overlayToken: 'overlay-token',
    controlToken: 'control-token',
    currentViewers: 0,
    chatSlowModeSeconds: 0,
    chatSubscribersOnly: false,
    markers: [],
    startedAt: STARTED,
    endedAt: null,
    stopRequestedAt: null,
    videoId: VIDEO_ID,
    createdAt: STARTED,
    updatedAt: STARTED,
    ...overrides,
  };
}
