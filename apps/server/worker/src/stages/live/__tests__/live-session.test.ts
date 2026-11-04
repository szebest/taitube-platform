import { InMemoryStorageClient } from '@vp/adapters/in-memory';
import { inProcessAppConfig } from '@vp/env-schema';
import type { Fmp4Fragment } from '@vp/ffmpeg';
import { expectOk } from '@vp/testing/result';
import { type LiveArchive, LiveSession, loadLiveArchive } from '../live-session';
import { LiveUploader } from '../live-uploader';

const STREAM_ID = 'stream-1';
const BUCKET = 'public';
const { packaging } = inProcessAppConfig().live;

const init: Fmp4Fragment = { type: 'init', bytes: Uint8Array.of(1) };
const part = (n: number): Fmp4Fragment => ({ type: 'media', bytes: Uint8Array.of(n) });

function setup(archive: LiveArchive = { epochs: 0, segments: [] }) {
  const storage = new InMemoryStorageClient();
  const session = new LiveSession(STREAM_ID, packaging, new LiveUploader(storage, BUCKET), archive);
  const text = async (key: string) =>
    expectOk(await storage.getObject(BUCKET, `live/${STREAM_ID}/${key}`)).toString();
  return { storage, session, text };
}

function feed(session: LiveSession, parts: number): void {
  session.accept(init);
  for (let n = 0; n < parts; n += 1) session.accept(part(n));
}

describe('worker/live: LiveSession', () => {
  it('cuts four parts to a segment and lists the parts of the one being written', async () => {
    const { session, text } = setup();
    feed(session, 9);
    expectOk(await session.finish());

    const playlist = await text('index.m3u8');
    expect(playlist).toContain('#EXT-X-MEDIA-SEQUENCE:0');
    expect(playlist).toContain('#EXT-X-MAP:URI="0/init.mp4"');
    expect(playlist).toContain('#EXTINF:2.000,\n0/1.m4s');
    expect(playlist).toContain('#EXT-X-PART:DURATION=0.500,URI="0/2.0.m4s",INDEPENDENT=YES');
  });

  it('writes each segment whole, as the concatenation of its parts', async () => {
    const { storage, session } = setup();
    feed(session, 4);
    expectOk(await session.finish());

    const segment = expectOk(await storage.getObject(BUCKET, `live/${STREAM_ID}/0/0.m4s`));
    expect([...segment]).toEqual([0, 1, 2, 3]);
  });

  it('closes a short last segment on finish, and keeps the archive open until it is finalized', async () => {
    const { session, text } = setup();
    feed(session, 5);

    const archive = expectOk(await session.finish());

    expect(archive.segments.map((s) => [s.sequence, s.durationMs])).toEqual([
      [0, 2000],
      [1, 500],
    ]);
    expect(await text('archive.m3u8')).not.toContain('#EXT-X-ENDLIST');
  });

  it('carries a restarted broadcast on in a new epoch, after a discontinuity', async () => {
    const first = setup();
    feed(first.session, 8);
    const archive = expectOk(await first.session.finish());

    const { session, text } = setup(archive);
    feed(session, 4);
    const resumed = expectOk(await session.finish());

    expect(resumed.epochs).toBe(2);
    expect(resumed.segments.at(-1)).toMatchObject({
      sequence: 2,
      discontinuity: 1,
      mapUri: '1/init.mp4',
      uri: '1/2.m4s',
    });
    expect(await text('index.m3u8')).toContain('#EXT-X-DISCONTINUITY\n#EXT-X-MAP:URI="1/init.mp4"');
  });

  it('reads back the archive a run left behind, and an empty one before the first run', async () => {
    const { storage, session } = setup();
    feed(session, 4);
    const written = expectOk(await session.finish());

    const loaded = expectOk(await loadLiveArchive(storage, BUCKET, STREAM_ID));
    const empty = expectOk(await loadLiveArchive(storage, BUCKET, 'other'));

    expect(loaded.epochs).toBe(1);
    expect(loaded.segments.map((s) => s.uri)).toEqual(written.segments.map((s) => s.uri));
    expect(empty).toEqual({ epochs: 0, segments: [] });
  });
});
