import { Container } from '@kit/composition';
import { expectOk } from '@kit/testing/result';
import { Adapters, registerAdapters } from '@vp/adapters/composition';
import { inProcessAppConfig } from '@vp/env-schema';
import { NO_VIDEO_ACCESS } from '../../services/video-access-gate';
import { registerServices, Services } from '../services.module';

const OWNER_ID = '00000000-0000-7000-8000-00000000f501';
const STREAM_ID = '00000000-0000-7000-8000-00000000f101';
const VIDEO_ID = '00000000-0000-7000-8000-00000000f201';

describe('apps/server/api/composition: sse module', () => {
  it('opens a broadcast with the viewers the tracker counts', async () => {
    const c = registerServices(await registerAdapters(new Container(), inProcessAppConfig()));
    const { channels, liveStreams } = c.get(Adapters.Repositories);
    const channel = expectOk(
      await channels.create({ userId: OWNER_ID, handle: 'owner', displayName: 'Owner' })
    );
    expectOk(
      await liveStreams.ensureIdle(channel.id, {
        id: STREAM_ID,
        streamKey: 'key',
        overlayToken: 'overlay',
        controlToken: 'control',
      })
    );
    expectOk(
      await liveStreams.goLive({
        streamId: STREAM_ID,
        video: {
          id: VIDEO_ID,
          ownerId: OWNER_ID,
          visibility: 'public',
          sourceKey: `live/${STREAM_ID}/`,
        },
        startedAt: new Date(),
        outbox: [],
      })
    );
    await c.get(Services.LiveViewerTracker).watch(STREAM_ID, VIDEO_ID);

    const sse = c.get(Services.SseService);
    const session = expectOk(await sse.openVideoStream(null, VIDEO_ID, NO_VIDEO_ACCESS));
    const [snapshot] = expectOk(await session.open(null)).frames;

    expect(snapshot?.data).toMatchObject({ live: { viewers: 1 } });
    expectOk(await c.dispose());
  });
});
