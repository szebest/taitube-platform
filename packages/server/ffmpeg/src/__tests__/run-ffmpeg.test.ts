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
        onStdoutLine: () => trapInstalled(),
      });
    });

    vi.advanceTimersByTime(1_000);
    vi.advanceTimersByTime(LIMITS.killGraceMs);

    await expect(running).rejects.toMatchObject({ code: ErrorCodes.FFMPEG_TIMEOUT });
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
