import { trace } from '@opentelemetry/api';
import { ErrorCodes } from '@vp/errors';
import { runFfmpeg } from '../run-ffmpeg';

const LIMITS = { killGraceMs: 200, stderrTailLines: 20 };

describe('@vp/ffmpeg: runFfmpeg', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('kills a process that ignores SIGTERM once the grace period is over', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    let running: Promise<void> = Promise.resolve();
    await new Promise<void>((trapInstalled) => {
      running = runFfmpeg({
        ffmpegPath: 'sh',
        stage: 'transcode',
        args: ['-c', "trap '' TERM; echo ready; while :; do :; done"],
        timeoutMs: 1_000,
        limits: LIMITS,
        stdout: { type: 'lines', onLine: () => trapInstalled() },
      });
    });

    vi.advanceTimersByTime(1_000);
    vi.advanceTimersByTime(LIMITS.killGraceMs);

    await expect(running).rejects.toMatchObject({ code: ErrorCodes.FFMPEG_TIMEOUT });
  });

  it('keeps the credentials of an input URL out of the span', async () => {
    const tracer = trace.getTracer('spec');
    const startSpan = vi.spyOn(tracer, 'startSpan');
    vi.spyOn(trace, 'getTracer').mockReturnValue(tracer);

    await runFfmpeg({
      ffmpegPath: 'sh',
      stage: 'live',
      args: ['-c', 'true', 'rtsp://vp-worker:hook-secret@mediamtx:8554/live/key'],
      timeoutMs: 5_000,
      limits: LIMITS,
    });

    expect(startSpan.mock.calls[0]?.[1]?.attributes?.['ffmpeg.command']).toBe(
      'ffmpeg -c true rtsp://mediamtx:8554/live/key'
    );
  });

  it('hands stdout over as bytes when asked for them', async () => {
    const chunks: Uint8Array[] = [];
    await runFfmpeg({
      ffmpegPath: 'sh',
      stage: 'live',
      args: ['-c', 'printf live'],
      timeoutMs: 5_000,
      limits: LIMITS,
      stdout: { type: 'bytes', onChunk: (chunk) => chunks.push(chunk) },
    });

    expect(Buffer.concat(chunks).toString()).toBe('live');
  });

  it('stops the process when its signal aborts, and rejects as aborted rather than timed out', async () => {
    const lease = new AbortController();
    const running = runFfmpeg({
      ffmpegPath: 'sleep',
      stage: 'transcode',
      args: ['5'],
      timeoutMs: 10_000,
      limits: LIMITS,
      signal: lease.signal,
    });

    lease.abort();

    await expect(running).rejects.toMatchObject({
      code: ErrorCodes.FFMPEG_FAILED,
      message: 'FFmpeg transcode was aborted',
    });
  });

  it('stops at once for a signal that is already aborted', async () => {
    await expect(
      runFfmpeg({
        ffmpegPath: 'sleep',
        stage: 'thumbnail',
        args: ['5'],
        timeoutMs: 10_000,
        limits: LIMITS,
        signal: AbortSignal.abort(),
      })
    ).rejects.toMatchObject({ message: 'FFmpeg thumbnail was aborted' });
  });
});
