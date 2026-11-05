import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { LIVE_READER_USER } from '@vp/domain-rules';
import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { LiveIngestService } from '../live-ingest-service';

const OWNER_ID = '00000000-0000-7000-8000-00000000c001';
const STREAM_ID = '00000000-0000-7000-8000-00000000f101';
const SECRET = 'hook-secret';
const NOW = Date.parse('2026-03-01T12:00:00.000Z');

const publish = (path = 'live/key-1') => ({
  presentedSecret: SECRET,
  call: { action: 'publish', path, user: '', password: '' },
});

describe('apps/server/api/services: LiveIngestService', () => {
  let repositories: InMemoryRepositories;
  let service: LiveIngestService;

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    const channel = expectOk(
      await repositories.channels.create({
        userId: OWNER_ID,
        handle: 'owner',
        displayName: 'Owner',
      })
    );
    expectOk(
      await repositories.liveStreams.ensureIdle(channel.id, {
        id: STREAM_ID,
        streamKey: 'key-1',
        overlayToken: 'o',
        controlToken: 'c',
      })
    );
    service = new LiveIngestService({
      liveStreams: repositories.liveStreams,
      channels: repositories.channels,
      hookSecret: SECRET,
      now: () => NOW,
    });
  });

  const outboxKinds = async () =>
    expectOk(await repositories.outbox.claimBatch(10)).map((row) => row.kind);

  it('takes an idle stream live with its video, the packager job and the subscribers notice', async () => {
    expectOk(await service.authorize(publish()));

    const stream = expectOk(await repositories.liveStreams.findById(STREAM_ID));
    const video = stream?.videoId
      ? expectOk(await repositories.videos.findById(stream.videoId))
      : null;
    expect(stream).toMatchObject({ status: 'LIVE', startedAt: new Date(NOW) });
    expect(video).toMatchObject({
      status: 'LIVE',
      ownerId: OWNER_ID,
      title: 'Owner',
      masterPlaylistKey: `live/${STREAM_ID}/master.m3u8`,
    });
    expect(await outboxKinds()).toEqual(expect.arrayContaining(['live', 'notification']));
  });

  it('notifies nobody of a broadcast that is not public', async () => {
    expectOk(await repositories.liveStreams.update(STREAM_ID, { visibility: 'unlisted' }));

    expectOk(await service.authorize(publish()));

    expect(await outboxKinds()).not.toContain('notification');
  });

  it('admits a publisher reconnecting to a live stream without a second video', async () => {
    expectOk(await service.authorize(publish()));
    const first = expectOk(await repositories.liveStreams.findById(STREAM_ID))?.videoId;

    expectOk(await service.authorize(publish()));

    expect(expectOk(await repositories.liveStreams.findById(STREAM_ID))?.videoId).toBe(first);
  });

  it('admits the live worker reading with the secret', async () => {
    expectOk(
      await service.authorize({
        presentedSecret: SECRET,
        call: { action: 'read', path: 'live/key-1', user: LIVE_READER_USER, password: SECRET },
      })
    );
  });

  it.each([
    { scenario: 'an unknown key', input: publish('live/nope') },
    { scenario: 'a path outside live/', input: publish('other/key-1') },
    { scenario: 'a wrong hook secret', input: { ...publish(), presentedSecret: 'nope' } },
  ])('refuses $scenario and leaves the stream idle', async ({ input }) => {
    expect(expectErr(await service.authorize(input)).code).toBe(ErrorCodes.LIVE_INGEST_REFUSED);
    expect(expectOk(await repositories.liveStreams.findById(STREAM_ID))?.status).toBe('IDLE');
  });
});
