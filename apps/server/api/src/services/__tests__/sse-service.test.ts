import { InMemoryRepositories } from '@vp/adapters/in-memory';
import type { NewUserEventInput } from '@vp/core/repositories';
import type { RenditionStatus } from '@vp/domain';
import { asCdnBase } from '@vp/env-schema';
import { ErrorCodes } from '@vp/errors';
import { userChannel, videoChannel } from '@vp/events';
import { createLogger } from '@vp/logger';
import type { UserContext } from '@vp/permissions';
import { expectErr, expectOk } from '@vp/testing/result';
import type { SseFrame } from '../sse-connection';
import { SseService } from '../sse-service';

const VIDEO_ID = '00000000-0000-7000-8000-0000000000d1';
const OWNER: UserContext = { id: '00000000-0000-7000-8000-0000000000d2', role: 'USER' };
const STRANGER: UserContext = { id: '00000000-0000-7000-8000-0000000000d3', role: 'USER' };
const CDN = 'http://localhost:9000/public';
const REPLAY_LIMIT = 2;
const logger = createLogger({ format: 'json', service: 'sse-service-spec', level: 'silent' });

describe('apps/server/api/services: SseService', () => {
  let repositories: InMemoryRepositories;
  let service: SseService;

  async function seed(
    visibility: 'private' | 'public',
    status: 'PROCESSING' | 'READY' = 'PROCESSING'
  ): Promise<void> {
    await repositories.videos.create({
      id: VIDEO_ID,
      ownerId: OWNER.id,
      title: 'Stream fixture',
      visibility,
      status,
      sourceKey: 'raw/stream.mp4',
    });
  }

  function addRendition(name: string, status: RenditionStatus): Promise<unknown> {
    return repositories.renditions.create({
      videoId: VIDEO_ID,
      name,
      status,
      width: 1280,
      height: 720,
      videoBitrateKbps: 2500,
      audioBitrateKbps: 128,
    });
  }

  beforeEach(() => {
    repositories = new InMemoryRepositories();
    service = new SseService({
      videos: repositories.videos,
      renditions: repositories.renditions,
      events: repositories.events,
      userEvents: repositories.userEvents,
      cdn: asCdnBase(`${CDN}/`),
      replayLimit: REPLAY_LIMIT,
      logger,
    });
  });

  async function videoOpening(afterId: number | null = null) {
    const session = expectOk(await service.openVideoStream(OWNER, VIDEO_ID));
    return expectOk(await session.open(afterId));
  }

  async function snapshotOf() {
    const { frames, lastEventId } = await videoOpening();
    return { data: frames[0]?.data as Record<string, unknown>, lastEventId };
  }

  async function announce(count: number) {
    const appended = [];
    for (let i = 0; i < count; i += 1) {
      appended.push(
        expectOk(
          await repositories.userEvents.append({
            userId: OWNER.id,
            type: 'video.processing',
            payload: { videoId: VIDEO_ID, change: { kind: 'status', status: 'PROCESSING' } },
          })
        )
      );
    }
    return appended;
  }

  const hello = (resume: string): SseFrame => ({
    event: 'hello',
    data: { type: 'hello', payload: { resume } },
  });

  describe('openVideoStream', () => {
    it('names the channel the hub broadcasts on', async () => {
      await seed('public');

      const session = expectOk(await service.openVideoStream(OWNER, VIDEO_ID));

      expect(session.channel).toBe(videoChannel(VIDEO_ID));
      expect(session.userId).toBe(OWNER.id);
    });

    it('reports an unknown video as not found', async () => {
      expect(expectErr(await service.openVideoStream(OWNER, VIDEO_ID)).code).toBe(
        ErrorCodes.VIDEO_NOT_FOUND
      );
    });

    it('asks an anonymous caller to authenticate for a private video', async () => {
      await seed('private');

      expect(expectErr(await service.openVideoStream(null, VIDEO_ID)).code).toBe(
        ErrorCodes.UNAUTHORIZED
      );
    });

    it('hides a private video from a signed-in stranger behind a 404', async () => {
      await seed('private');

      expect(expectErr(await service.openVideoStream(STRANGER, VIDEO_ID)).code).toBe(
        ErrorCodes.VIDEO_NOT_FOUND
      );
    });

    it('averages rendition completion into overall progress', async () => {
      await seed('public');
      await addRendition('720p', 'DONE');
      await addRendition('480p', 'RUNNING');

      const { data } = await snapshotOf();

      expect(data['progress']).toEqual({ overall: 50, byRendition: { '720p': 100, '480p': 0 } });
    });

    it('omits a playback URL until the video is READY', async () => {
      await seed('public');

      const { data } = await snapshotOf();

      expect(data).not.toHaveProperty('playbackUrl');
    });

    it('serves the playback URL off the trimmed CDN base once READY', async () => {
      await seed('public', 'READY');

      const { data } = await snapshotOf();

      expect(data['playbackUrl']).toBe(`${CDN}/videos/${VIDEO_ID}/hls/master.m3u8`);
      expect(data['progress']).toEqual({ overall: 100, byRendition: {} });
    });

    it('carries the latest event id so a reconnect resumes from the snapshot', async () => {
      await seed('public');
      const event = expectOk(
        await repositories.events.create({ videoId: VIDEO_ID, type: 'probe.started' })
      );

      const { lastEventId } = await snapshotOf();

      expect(lastEventId).toBe(event.id);
    });

    it('replays only the events after the supplied id', async () => {
      await seed('public');
      const first = expectOk(
        await repositories.events.create({ videoId: VIDEO_ID, type: 'probe.started' })
      );
      await repositories.events.create({ videoId: VIDEO_ID, type: 'video.ready' });

      const { frames } = await videoOpening(first.id);

      expect(frames.slice(1)).toEqual([
        { id: expect.any(Number), event: 'status', data: { status: 'READY' } },
      ]);
    });
  });

  describe('openUserStream', () => {
    const userOpening = async (afterId: number | null) =>
      expectOk(await service.openUserStream(OWNER).open(afterId));

    it('opens on the user channel with hello, from the newest logged event', async () => {
      const [, newest] = await announce(2);

      expect(service.openUserStream(OWNER).channel).toBe(userChannel(OWNER.id));
      expect(await userOpening(null)).toEqual({
        frames: [hello('fresh')],
        lastEventId: newest?.id,
      });
    });

    it('reads every event logged after an id on a live cue, past one page', async () => {
      const [seen, ...after] = await announce(REPLAY_LIMIT + 3);
      const { frames, lastId } = expectOk(
        await service.openUserStream(OWNER).resync(seen?.id ?? 0)
      );

      expect(frames.map((frame) => frame.id)).toEqual(after.map((event) => event.id));
      expect(lastId).toBe(after.at(-1)?.id);
    });

    it('moves a live read past a row the contract does not know', async () => {
      const [seen] = await announce(1);
      const unknown = { userId: OWNER.id, type: 'video.deleted', payload: {} };
      const skipped = expectOk(
        await repositories.userEvents.append(unknown as unknown as NewUserEventInput)
      );

      expect(expectOk(await service.openUserStream(OWNER).resync(seen?.id ?? 0))).toEqual({
        frames: [],
        lastId: skipped.id,
      });
    });

    it('replays the events after Last-Event-ID', async () => {
      const [seen, second, third] = await announce(3);

      const { frames, lastEventId } = await userOpening(seen?.id ?? 0);

      expect(frames.map((frame) => frame.id)).toEqual([undefined, second?.id, third?.id]);
      expect(frames[0]).toEqual(hello('replayed'));
      expect(lastEventId).toBe(third?.id);
    });

    it.each([
      ['the last seen event left the log', 0, 'expired', () => repositories.userEvents.prune(-1)],
      ['as many events followed it as a replay carries', REPLAY_LIMIT, 'replayed', async () => 0],
      ['one more followed it than a replay carries', REPLAY_LIMIT + 1, 'expired', async () => 0],
    ])('resumes when %s as %s', async (_label, following, resume, after) => {
      const [seen] = await announce(following + 1);
      await after();

      expect((await userOpening(seen?.id ?? 0)).frames[0]).toEqual(hello(resume));
    });

    it('skips a logged event the contract does not know, and says so', async () => {
      const warn = vi.spyOn(logger, 'warn');
      const [seen] = await announce(1);
      const unknown = { userId: OWNER.id, type: 'video.deleted', payload: {} };
      await repositories.userEvents.append(unknown as unknown as NewUserEventInput);

      expect((await userOpening(seen?.id ?? 0)).frames).toEqual([hello('replayed')]);
      expect(warn).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'video.deleted' }),
        'dropped a user event the contract does not know'
      );
    });
  });

  describe('replayed events', () => {
    async function replayed(type: string, payload?: Record<string, unknown>) {
      await seed('public');
      await repositories.events.create({
        videoId: VIDEO_ID,
        type,
        ...(payload ? { payload } : {}),
      });
      return (await videoOpening(0)).frames[1];
    }

    it.each([
      ['progress', { percent: 40 }, 'progress', { percent: 40 }],
      ['video.ready', {}, 'status', { status: 'READY' }],
      ['probe.started', {}, 'status', { status: 'PROBING' }],
      ['video.processing', {}, 'status', { status: 'PROCESSING' }],
      ['probe.completed', {}, 'status', { status: 'PROCESSING' }],
      ['upload.initiated', { a: 1 }, 'status', { a: 1 }],
    ])('replays %s as the %s event', async (type, payload, event, data) => {
      expect(await replayed(type, payload)).toEqual({ id: expect.any(Number), event, data });
    });

    it('defaults a failure without codes to a bare FAILED status', async () => {
      expect(await replayed('video.failed')).toEqual({
        id: expect.any(Number),
        event: 'status',
        data: { status: 'FAILED', error: { code: 'FAILED', message: '' } },
      });
    });

    it('carries the failure code and message through', async () => {
      expect(
        await replayed('video.failed', {
          errorCode: 'PROBE_FAILED',
          errorMessage: 'no video stream',
        })
      ).toMatchObject({
        data: { error: { code: 'PROBE_FAILED', message: 'no video stream' } },
      });
    });
  });
});
