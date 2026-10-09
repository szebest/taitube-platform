import type { ServerResponse } from 'node:http';
import { PassThrough } from 'node:stream';
import { videoChannel } from '@vp/events';
import { SseConnection } from '../sse-connection';

const VIDEO_ID = '018f0000-0000-7000-8000-000000000010';
const TIMERS = { heartbeatMs: 15_000, idleTimeoutMs: 30 * 60 * 1000 };

function connect(stream: PassThrough, idleTimeoutMs = TIMERS.idleTimeoutMs): SseConnection {
  return new SseConnection({
    ...TIMERS,
    idleTimeoutMs,
    channel: videoChannel(VIDEO_ID),
    rawResponse: stream as unknown as ServerResponse,
  });
}

function progress(id: number, rendition: string, percent: number, overall: number) {
  return { id, event: 'progress' as const, data: { rendition, percent, overall } };
}

describe('apps/api/services: SseConnection', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('holds live events until the snapshot is sent, then drops the ones the snapshot covers', () => {
    const snapshotEventId = 7;
    const writtenFrames: string[] = [];
    const stream = new PassThrough();
    stream.on('data', (chunk) => writtenFrames.push(chunk.toString()));
    const connection = connect(stream);

    connection.onLiveEvent(progress(snapshotEventId, '720p', 10, 5));
    connection.onLiveEvent(progress(snapshotEventId + 1, '720p', 20, 10));

    expect(writtenFrames.length).toBe(0);

    connection.sendSnapshot(
      {
        videoId: VIDEO_ID,
        status: 'PROCESSING',
        progress: { overall: 5, byRendition: { '720p': 10 } },
      },
      snapshotEventId
    );
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
    const connection = connect(new PassThrough(), 50);
    connection.on('close', () => {
      closed = true;
    });

    vi.advanceTimersByTime(50);

    expect(closed).toBe(true);
  });

  it('coalesces progress to the latest per rendition under backpressure and never drops status', () => {
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
});
