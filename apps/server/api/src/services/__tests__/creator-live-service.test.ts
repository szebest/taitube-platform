import {
  InMemoryCacheClient,
  InMemoryLiveGateway,
  InMemoryRepositories,
} from '@vp/adapters/in-memory';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { expectErr, expectOk } from '@vp/testing/result';
import { CreatorLiveService } from '../creator-live-service';

const OWNER: UserContext = { id: '00000000-0000-7000-8000-00000000c001', role: 'USER' };
const STRANGER: UserContext = { id: '00000000-0000-7000-8000-00000000c002', role: 'USER' };
const STOPPED_AT = new Date('2026-11-05T10:00:00.000Z');
const INGEST = {
  rtmpPublicUrl: 'rtmp://localhost:1935/live',
  whipPublicUrl: 'http://localhost:8889/live',
};

describe('apps/server/api/services: CreatorLiveService', () => {
  let repositories: InMemoryRepositories;
  let gateway: InMemoryLiveGateway;
  let service: CreatorLiveService;

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    gateway = new InMemoryLiveGateway();
    const secrets = ['secret-1', 'secret-2', 'secret-3', 'secret-4', 'secret-5', 'secret-6'];
    service = new CreatorLiveService({
      liveStreams: repositories.liveStreams,
      channels: repositories.channels,
      gateway,
      ingest: INGEST,
      newSecret: () => secrets.shift() ?? 'spent',
      cache: new InMemoryCacheClient(),
      now: () => STOPPED_AT.getTime(),
    });
    expectOk(
      await repositories.channels.create({
        userId: OWNER.id,
        handle: 'owner',
        displayName: 'Owner',
      })
    );
  });

  const goLive = async (streamId: string) => {
    expectOk(
      await repositories.liveStreams.goLive({
        streamId,
        video: {
          id: '00000000-0000-7000-8000-00000000f201',
          ownerId: OWNER.id,
          sourceKey: 'live/',
        },
        startedAt: new Date(),
        outbox: [],
      })
    );
  };

  it('opens one stream with the credentials OBS takes, and hands the same one back', async () => {
    const opened = expectOk(await service.open(OWNER));
    const again = expectOk(await service.open(OWNER));

    expect(opened).toMatchObject({
      status: 'IDLE',
      ingest: {
        rtmpUrl: INGEST.rtmpPublicUrl,
        streamKey: 'secret-1',
        whipUrl: 'http://localhost:8889/live/secret-1/whip',
      },
    });
    expect(again.id).toBe(opened.id);
    expect(expectOk(await service.current(OWNER)).id).toBe(opened.id);
  });

  it('refuses to open a stream for a caller without a channel', async () => {
    expect(expectErr(await service.open(STRANGER)).code).toBe(ErrorCodes.CHANNEL_NOT_FOUND);
  });

  it('reports a stream never opened as absent', async () => {
    expect(expectErr(await service.current(OWNER)).code).toBe(ErrorCodes.LIVE_STREAM_NOT_FOUND);
  });

  it('keeps the settings it is given and leaves the rest alone', async () => {
    const { id } = expectOk(await service.open(OWNER));
    expectOk(await service.update(OWNER, id, { visibility: 'unlisted' }));

    const updated = expectOk(
      await service.update(OWNER, id, { title: '  Speedrun ', archiveVisibility: 'private' })
    );

    expect(updated).toMatchObject({
      title: 'Speedrun',
      visibility: 'unlisted',
      archiveVisibility: 'private',
    });
  });

  it("reads someone else's stream as absent", async () => {
    const { id } = expectOk(await service.open(OWNER));

    expect(expectErr(await service.update(STRANGER, id, { title: 'x' })).code).toBe(
      ErrorCodes.LIVE_STREAM_NOT_FOUND
    );
  });

  it('stops a live broadcast by marking it stopping and dropping its publisher', async () => {
    const { id } = expectOk(await service.open(OWNER));
    await goLive(id);
    gateway.publish('live/secret-1');

    expect(expectOk(await service.stop(OWNER, id)).status).toBe('LIVE');
    expect(gateway.kicked).toEqual(['live/secret-1']);
    expect(expectOk(await repositories.liveStreams.findById(id))?.stopRequestedAt).toEqual(
      STOPPED_AT
    );
  });

  it('carries a patch made while live onto the video, keeping its title when the patch empties it', async () => {
    const { id } = expectOk(await service.open(OWNER));
    await goLive(id);
    expectOk(await service.update(OWNER, id, { title: 'Speedrun', visibility: 'private' }));
    expectOk(await service.update(OWNER, id, { title: '', description: 'Any%' }));

    expect(
      expectOk(await repositories.videos.findById('00000000-0000-7000-8000-00000000f201'))
    ).toMatchObject({ title: 'Speedrun', description: 'Any%', visibility: 'private' });
  });

  it('refuses to stop a stream that is not live', async () => {
    const { id } = expectOk(await service.open(OWNER));

    expect(expectErr(await service.stop(OWNER, id)).code).toBe(ErrorCodes.LIVE_STREAM_NOT_LIVE);
  });
});
