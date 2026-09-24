import { ErrorCodes, TransientError } from '@vp/errors';
import type { LadderEntry } from '@vp/job-contracts';
import { buildTranscodeArgs, classifyFfmpegError, computeFfmpegThreads } from '../index';
import { ENCODER } from './encoder-settings';

describe('Ticket 14: FFmpeg thread back-off, VFR arguments and ENOSPC', () => {
  const defaultRendition: LadderEntry = {
    name: '1080p',
    width: 1920,
    height: 1080,
    videoKbps: 5000,
    maxrateKbps: 5350,
    bufsizeKbps: 7500,
    audioKbps: 128,
    profile: 'high',
    level: '4.1',
  };

  describe('AC 3: Thread back-off calculation (SDD §9.6 rule 6)', () => {
    it('computes threads per attempt correctly: attempt 1 = FFMPEG_THREADS, attempt 2 = FFMPEG_THREADS - 1, attempt >= FFMPEG_THREADS = 1', () => {
      // With baseThreads = 2
      expect(computeFfmpegThreads(2, 1)).toBe(2);
      expect(computeFfmpegThreads(2, 2)).toBe(1);
      expect(computeFfmpegThreads(2, 3)).toBe(1);

      // With baseThreads = 4
      expect(computeFfmpegThreads(4, 1)).toBe(4);
      expect(computeFfmpegThreads(4, 2)).toBe(3);
      expect(computeFfmpegThreads(4, 3)).toBe(2);
      expect(computeFfmpegThreads(4, 4)).toBe(1);
      expect(computeFfmpegThreads(4, 5)).toBe(1);
    });

    it.each([
      { attempt: 1, expected: '4' },
      { attempt: 2, expected: '3' },
      { attempt: 4, expected: '1' },
    ])('passes $expected threads to ffmpeg on attempt $attempt', ({ attempt, expected }) => {
      const args = buildTranscodeArgs({
        ...ENCODER,
        sourcePath: 'dummy.mp4',
        outputDir: 'out',
        rendition: defaultRendition,
        fps: 24,
        threads: 4,
        preset: 'veryfast',
        attempt,
      });

      expect(args[args.indexOf('-threads') + 1]).toBe(expected);
    });

    it('enforces -fps_mode cfr in buildTranscodeArgs for VFR handling', () => {
      const args = buildTranscodeArgs({
        ...ENCODER,
        sourcePath: 'dummy.mp4',
        outputDir: 'out',
        rendition: defaultRendition,
        fps: 24,
        threads: 2,
        preset: 'veryfast',
      });
      const fpsModeIdx = args.indexOf('-fps_mode');
      expect(fpsModeIdx).toBeGreaterThanOrEqual(0);
      expect(args[fpsModeIdx + 1]).toBe('cfr');
    });
  });

  describe('AC 6: ENOSPC error classification', () => {
    it('classifies "No space left on device" as TransientError with hint DISK_FULL', () => {
      const err = classifyFfmpegError(
        1,
        null,
        'av_interleaved_write_frame(): No space left on device\nError writing trailer: No space left on device'
      );
      expect(err).toBeInstanceOf(TransientError);
      expect((err as TransientError).code).toBe(ErrorCodes.DISK_FULL);
      expect((err as TransientError).details?.['hint']).toBe('DISK_FULL');
    });

    it('classifies enospc in stderr as TransientError with hint DISK_FULL', () => {
      const err = classifyFfmpegError(1, null, 'Error: ENOSPC: cannot write segment to disk');
      expect(err).toBeInstanceOf(TransientError);
      expect((err as TransientError).code).toBe(ErrorCodes.DISK_FULL);
      expect((err as TransientError).details?.['hint']).toBe('DISK_FULL');
    });
  });
});
