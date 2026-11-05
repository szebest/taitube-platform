import type { GoLiveInput, LiveStreamRepositoryPort } from '@vp/core/repositories';
import { liveOutbox } from '@vp/job-contracts';
import { expectOk } from '@vp/testing/result';
import { OWNER_ID, seedOwners } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const STREAM_ID = '00000000-0000-7000-8000-00000000f101';
const NEXT_ID = '00000000-0000-7000-8000-00000000f102';
const VIDEO_ID = '00000000-0000-7000-8000-00000000f201';
const STARTED = new Date('2026-03-01T12:00:00.000Z');
const ENDED = new Date('2026-03-01T13:00:00.000Z');

const SEED = {
  id: STREAM_ID,
  streamKey: 'key-1',
  overlayToken: 'overlay-1',
  controlToken: 'control-1',
};

function goLive(): GoLiveInput {
  return {
    streamId: STREAM_ID,
    video: {
      id: VIDEO_ID,
      ownerId: OWNER_ID,
      title: 'Speedrun',
      visibility: 'public',
      sourceKey: `live/${STREAM_ID}/`,
    },
    startedAt: STARTED,
    outbox: [liveOutbox({ liveStreamId: STREAM_ID, videoId: VIDEO_ID })],
  };
}

export function describeLiveStreamRepositoryContract(makeSubject: MakeRepositoriesSubject): void {
  describe('LiveStreamRepository contract', () => {
    let subject: RepositoriesSubject;
    let streams: LiveStreamRepositoryPort;
    let channelId: string;

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(async () => {
      await subject.reset();
      await seedOwners(subject.repositories);
      const channel = expectOk(
        await subject.repositories.channels.create({
          userId: OWNER_ID,
          handle: 'owner',
          displayName: 'The Owner',
        })
      );
      channelId = channel.id;
      streams = subject.repositories.liveStreams;
    });

    it('mints one idle stream per channel and hands the same one back after', async () => {
      const first = expectOk(await streams.ensureIdle(channelId, SEED));
      const again = expectOk(await streams.ensureIdle(channelId, { ...SEED, id: NEXT_ID }));

      expect(first).toMatchObject({ id: STREAM_ID, status: 'IDLE', streamKey: 'key-1' });
      expect(again.id).toBe(STREAM_ID);
      expect(expectOk(await streams.findByKey('key-1'))?.id).toBe(STREAM_ID);
      expect(expectOk(await streams.findOpenByChannel(channelId))?.id).toBe(STREAM_ID);
    });

    it('goes live once, with its video, the video event and the packager job', async () => {
      expectOk(await streams.ensureIdle(channelId, SEED));

      const live = expectOk(await streams.goLive(goLive()));
      const twice = expectOk(await streams.goLive(goLive()));

      expect(live).toMatchObject({ status: 'LIVE', videoId: VIDEO_ID, startedAt: STARTED });
      expect(twice).toBeNull();
      expect(expectOk(await subject.repositories.videos.findById(VIDEO_ID))?.status).toBe('LIVE');
      expect(
        expectOk(await subject.repositories.events.findByVideoId(VIDEO_ID)).map((e) => e.type)
      ).toContain('video.live');
      expect(expectOk(await streams.findByVideoId(VIDEO_ID))?.id).toBe(STREAM_ID);
    });

    it('ends a broadcast and hands its key and tokens to the next idle stream', async () => {
      expectOk(await streams.ensureIdle(channelId, SEED));
      expectOk(
        await streams.update(STREAM_ID, { title: 'Speedrun', archiveVisibility: 'private' })
      );
      expectOk(await streams.goLive(goLive()));

      const ended = expectOk(
        await streams.end({ streamId: STREAM_ID, endedAt: ENDED, nextId: NEXT_ID })
      );
      const next = expectOk(await streams.findByKey('key-1'));

      expect(ended).toMatchObject({ status: 'ENDED', endedAt: ENDED, streamKey: null });
      expect(next).toMatchObject({
        id: NEXT_ID,
        status: 'IDLE',
        title: 'Speedrun',
        archiveVisibility: 'private',
        overlayToken: 'overlay-1',
        controlToken: 'control-1',
        videoId: null,
      });
    });

    it('answers a second end with the ended stream, minting nothing more', async () => {
      expectOk(await streams.ensureIdle(channelId, SEED));
      expectOk(await streams.goLive(goLive()));
      expectOk(await streams.end({ streamId: STREAM_ID, endedAt: ENDED, nextId: NEXT_ID }));

      const again = expectOk(
        await streams.end({
          streamId: STREAM_ID,
          endedAt: ENDED,
          nextId: '00000000-0000-7000-8000-00000000f103',
        })
      );

      expect(again?.status).toBe('ENDED');
      expect(expectOk(await streams.findOpenByChannel(channelId))?.id).toBe(NEXT_ID);
    });

    it('marks a live stream stopping once, and the next idle stream starts clear', async () => {
      expectOk(await streams.ensureIdle(channelId, SEED));
      expectOk(await streams.goLive(goLive()));

      const stopping = expectOk(await streams.requestStop(STREAM_ID, STARTED));
      const again = expectOk(await streams.requestStop(STREAM_ID, ENDED));
      expectOk(await streams.end({ streamId: STREAM_ID, endedAt: ENDED, nextId: NEXT_ID }));

      expect(stopping).toMatchObject({ status: 'LIVE', stopRequestedAt: STARTED });
      expect(again?.stopRequestedAt).toEqual(STARTED);
      expect(expectOk(await streams.findById(NEXT_ID))?.stopRequestedAt).toBeNull();
      expect(expectOk(await streams.requestStop(NEXT_ID, ENDED))).toBeNull();
    });

    it('carries an edit made while live onto its video, keeping the title an empty one would clear', async () => {
      expectOk(await streams.ensureIdle(channelId, SEED));
      expectOk(await streams.goLive(goLive()));
      const version = expectOk(await subject.repositories.videos.findById(VIDEO_ID))?.version ?? 0;

      expectOk(
        await streams.update(STREAM_ID, { title: '', description: 'Any%', visibility: 'private' })
      );

      expect(expectOk(await subject.repositories.videos.findById(VIDEO_ID))).toMatchObject({
        title: 'Speedrun',
        description: 'Any%',
        visibility: 'private',
        version: version + 1,
      });
    });

    it('refuses to end a stream that never went live', async () => {
      expectOk(await streams.ensureIdle(channelId, SEED));

      expect(
        expectOk(await streams.end({ streamId: STREAM_ID, endedAt: ENDED, nextId: NEXT_ID }))
      ).toBeNull();
    });

    it.each([
      { name: 'an unknown id', read: (s: LiveStreamRepositoryPort) => s.findById(NEXT_ID) },
      { name: 'an unknown key', read: (s: LiveStreamRepositoryPort) => s.findByKey('nope') },
      {
        name: 'an update of nothing',
        read: (s: LiveStreamRepositoryPort) => s.update(NEXT_ID, { title: 'x' }),
      },
    ])('answers $name with null', async ({ read }) => {
      expect(expectOk(await read(streams))).toBeNull();
    });
  });
}
