import type { ServerResponse } from 'node:http';
import { PassThrough } from 'node:stream';
import { cacheUnavailable } from '@vp/errors';
import { videoChannel } from '@vp/events';
import { err, ok, type Result } from '@vp/result';
import {
  SseConnection,
  type SseConnectionOptions,
  type SseFrame,
  type SseLogRead,
  type SseResync,
} from '../sse-connection';

const VIDEO_ID = '018f0000-0000-7000-8000-000000000010';
const TIMERS = {
  heartbeatMs: 15_000,
  idleTimeoutMs: 30 * 60 * 1000,
  maxPendingFrames: 2,
  rememberedIds: 8,
};

function connect(
  stream: PassThrough,
  overrides: Partial<SseConnectionOptions> = {}
): SseConnection {
  return new SseConnection({
    ...TIMERS,
    channel: videoChannel(VIDEO_ID),
    rawResponse: stream as unknown as ServerResponse,
    ...overrides,
  });
}

const status = (id: number): SseFrame => ({ id, event: 'status', data: { status: 'READY' } });

function logReader(read: (afterId: number) => Result<SseLogRead, unknown>) {
  const reads: Promise<Result<SseLogRead, unknown>>[] = [];
  const readFrom: number[] = [];
  const resync: SseResync = (afterId) => {
    const pending = Promise.resolve(read(afterId));
    readFrom.push(afterId);
    reads.push(pending);
    return pending;
  };
  const everyRead = async () => {
    for (let index = 0; index < reads.length; index += 1) await reads[index];
  };
  return { resync, everyRead, readFrom };
}

function logOf(frames: SseFrame[]) {
  return (afterId: number) => {
    const after = frames.filter((frame) => (frame.id ?? 0) > afterId);
    return ok({ frames: after, lastId: after.at(-1)?.id ?? afterId });
  };
}

function written(stream: PassThrough): () => number[] {
  const ids: number[] = [];
  stream.on('data', (chunk) => {
    const id = /^id: (\d+)/.exec(chunk.toString())?.[1];
    if (id) ids.push(Number(id));
  });
  return () => ids;
}

function progress(id: number, rendition: string, percent: number, overall: number): SseFrame {
  return { id, event: 'progress', data: { rendition, percent, overall }, coalesceKey: rendition };
}

describe('apps/server/api/services: SseConnection', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('holds live events until the opening is sent, then drops the ones it covers', () => {
    const snapshotEventId = 7;
    const writtenFrames: string[] = [];
    const stream = new PassThrough();
    stream.on('data', (chunk) => writtenFrames.push(chunk.toString()));
    const connection = connect(stream);

    connection.onLiveEvent(progress(snapshotEventId, '720p', 10, 5));
    connection.onLiveEvent(progress(snapshotEventId + 1, '720p', 20, 10));

    expect(writtenFrames.length).toBe(0);

    connection.sendOpening({
      id: snapshotEventId,
      event: 'snapshot',
      data: { videoId: VIDEO_ID, status: 'PROCESSING', progress: { overall: 5, byRendition: {} } },
    });
    connection.markLive(snapshotEventId);

    expect(writtenFrames[0]).toContain('event: snapshot');
    expect(writtenFrames[0]).toContain(`id: ${snapshotEventId}`);
    expect(writtenFrames.length).toBe(2);
    expect(writtenFrames[1]).toContain(`id: ${snapshotEventId + 1}`);
    expect(writtenFrames[1]).toContain('"percent":20');

    connection.close();
  });

  it('closes an idle stream after the configured timeout', () => {
    vi.useFakeTimers();
    let closed = false;
    const connection = connect(new PassThrough(), { idleTimeoutMs: 50 });
    connection.on('close', () => {
      closed = true;
    });

    vi.advanceTimersByTime(50);

    expect(closed).toBe(true);
  });

  it('coalesces lossy frames to the latest per key under backpressure and never drops the rest', () => {
    const writtenFrames: string[] = [];
    let canWrite = true;
    const stream = new PassThrough();
    stream.write = (chunk: string) => {
      writtenFrames.push(chunk.toString());
      return canWrite;
    };
    const connection = connect(stream);
    connection.markLive(0);

    connection.onLiveEvent(progress(1, '720p', 10, 5));
    expect(writtenFrames.length).toBe(1);

    canWrite = false;
    connection.onLiveEvent(progress(2, '720p', 20, 10));
    connection.onLiveEvent(progress(3, '720p', 30, 15));
    connection.onLiveEvent(progress(4, '720p', 40, 20));
    connection.onLiveEvent(progress(5, '1080p', 15, 25));
    connection.onLiveEvent({
      id: 6,
      event: 'status',
      data: { status: 'READY', playbackUrl: 'http://cdn/master.m3u8' },
    });

    expect(writtenFrames.length).toBe(2);

    canWrite = true;
    stream.emit('drain');

    const postDrainText = writtenFrames.slice(2).join('');
    expect(postDrainText).toContain('"rendition":"720p","percent":40');
    expect(postDrainText).not.toContain('"rendition":"720p","percent":30');
    expect(postDrainText).toContain('"rendition":"1080p","percent":15');
    expect(postDrainText).toContain('event: status\ndata: {"status":"READY"');

    connection.close();
  });

  it('closes a stream whose backlog passes the cap, so its client reconnects and replays', () => {
    const stream = new PassThrough();
    stream.write = () => false;
    const connection = connect(stream);
    let closed = false;
    connection.on('close', () => {
      closed = true;
    });
    connection.markLive(0);

    for (const id of [1, 2, 3]) connection.onLiveEvent(status(id));
    expect(closed).toBe(false);

    connection.onLiveEvent(status(4));
    expect(closed).toBe(true);
  });

  it('reads the log on a numbered live frame, so ids pub/sub delivers out of order arrive in order', async () => {
    const log = [status(5), status(6)];
    const stream = new PassThrough();
    const ids = written(stream);
    const reader = logReader(logOf(log));
    const connection = connect(stream, { resync: reader.resync });
    connection.markLive(4);

    connection.onLiveEvent(status(6));
    connection.onLiveEvent(status(5));
    await reader.everyRead();

    expect(ids()).toEqual([5, 6]);
    connection.close();
  });

  it('closes a stream whose log cannot be read, so its client reconnects and replays', async () => {
    const reader = logReader(() => err(cacheUnavailable('read')));
    const connection = connect(new PassThrough(), { resync: reader.resync });
    let closed = false;
    connection.on('close', () => {
      closed = true;
    });
    connection.markLive(0);

    connection.onLiveEvent(status(1));
    await reader.everyRead();

    expect(closed).toBe(true);
  });

  it('writes a late lower id on a stream with no log to read, and drops one already written', () => {
    const stream = new PassThrough();
    const ids = written(stream);
    const connection = connect(stream);
    connection.markLive(0);

    for (const id of [6, 5, 6]) connection.onLiveEvent(status(id));

    expect(ids()).toEqual([6, 5]);
    connection.close();
  });

  it('reads on from the last row of a read, though no frame came of it', async () => {
    const reader = logReader((afterId) => ok({ frames: [], lastId: afterId + 3 }));
    const connection = connect(new PassThrough(), { resync: reader.resync });
    connection.markLive(4);

    connection.onLiveEvent(status(7));
    await reader.everyRead();
    connection.onLiveEvent(status(8));
    await reader.everyRead();

    expect(reader.readFrom).toEqual([4, 7]);
    connection.close();
  });

  it('stops reading the log once the backlog cap has closed it', async () => {
    const stream = new PassThrough();
    stream.write = () => false;
    const reader = logReader(logOf([1, 2, 3, 4, 5].map(status)));
    const connection = connect(stream, { resync: reader.resync });
    connection.markLive(0);

    connection.onLiveEvent(status(1));
    connection.onLiveEvent(status(2));
    await reader.everyRead();

    expect(reader.readFrom).toEqual([0]);
  });
});
