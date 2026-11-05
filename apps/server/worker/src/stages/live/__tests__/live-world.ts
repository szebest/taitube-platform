import {
  InMemoryLiveGateway,
  InMemoryRepositories,
  InMemoryStorageClient,
} from '@vp/adapters/in-memory';
import { inProcessAppConfig } from '@vp/env-schema';
import { liveOutbox } from '@vp/job-contracts';
import { createLogger } from '@vp/logger';
import { expectOk } from '@vp/testing/result';

export const STREAM_ID = '00000000-0000-7000-8000-00000000f101';
export const VIDEO_ID = '00000000-0000-7000-8000-00000000f201';
export const STREAM_KEY = 'key-1';
export const BUCKET = 'public';
export const OWNER_ID = '00000000-0000-7000-8000-000000000101';

export const LIVE = inProcessAppConfig().live;

/** A channel whose stream is live on `STREAM_KEY`, over the in-memory doubles a live stage takes. */
export async function liveWorld() {
  const repositories = new InMemoryRepositories();
  const storage = new InMemoryStorageClient();
  const gateway = new InMemoryLiveGateway();

  expectOk(await repositories.users.upsert({ id: OWNER_ID, email: 'owner@video-pipeline.local' }));
  const channel = expectOk(
    await repositories.channels.create({ userId: OWNER_ID, handle: 'owner', displayName: 'Owner' })
  );
  expectOk(
    await repositories.liveStreams.ensureIdle(channel.id, {
      id: STREAM_ID,
      streamKey: STREAM_KEY,
      overlayToken: 'overlay-1',
      controlToken: 'control-1',
    })
  );
  expectOk(await repositories.liveStreams.update(STREAM_ID, { archiveVisibility: 'unlisted' }));
  const stream = expectOk(
    await repositories.liveStreams.goLive({
      streamId: STREAM_ID,
      video: {
        id: VIDEO_ID,
        ownerId: OWNER_ID,
        visibility: 'public',
        sourceKey: `live/${STREAM_ID}/`,
      },
      startedAt: new Date('2026-03-01T12:00:00.000Z'),
      outbox: [liveOutbox({ liveStreamId: STREAM_ID, videoId: VIDEO_ID })],
    })
  );
  if (stream === null) throw new Error('the stream did not go live');

  return {
    repositories,
    storage,
    gateway,
    stream,
    logger: createLogger({ format: 'json', service: 'live-spec', level: 'silent' }),
  };
}
