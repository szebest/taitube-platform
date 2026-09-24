import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { ErrorCodes, TransientError } from '@vp/errors';
import type { LadderEntry } from '@vp/job-contracts';
import {
  buildTranscodeArgs,
  classifyFfmpegError,
  computeFfmpegThreads,
  runFfmpegTranscode,
} from '../index';
import { ENCODER } from './encoder-settings';

describe('Ticket 14: FFmpeg keyframe alignment and thread back-off', () => {
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

  const renditions: LadderEntry[] = [
    defaultRendition,
    {
      name: '720p',
      width: 1280,
      height: 720,
      videoKbps: 2800,
      maxrateKbps: 2996,
      bufsizeKbps: 4200,
      audioKbps: 128,
      profile: 'high',
      level: '3.1',
    },
    {
      name: '480p',
      width: 854,
      height: 480,
      videoKbps: 1400,
      maxrateKbps: 1498,
      bufsizeKbps: 2100,
      audioKbps: 96,
      profile: 'main',
      level: '3.1',
    },
  ];

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

  describe('AC 4: Keyframe timestamps of segment N across 1080p/720p/480p', () => {
    function getKeyframeTimestamp(segPath: string): number {
      const stdout = execFileSync(
        'ffprobe',
        [
          '-v',
          'error',
          '-select_streams',
          'v',
          '-show_entries',
          'frame=pts_time,key_frame',
          '-show_frames',
          '-read_intervals',
          '%+#1',
          '-of',
          'json',
          segPath,
        ],
        { encoding: 'utf-8' }
      );
      const parsed = JSON.parse(stdout);
      expect(parsed.frames[0].key_frame).toBe(1);
      return Number(parsed.frames[0].pts_time);
    }

    /** Segment keyframes of one rendition, encoded into a directory removed afterwards. */
    async function keyframes(
      sourcePath: string,
      rendition: (typeof renditions)[number],
      segmentSeconds: number
    ) {
      const outDir = fs.mkdtempSync(path.join(os.tmpdir(), `test-align-${rendition.name}-`));
      try {
        await runFfmpegTranscode({
          ...ENCODER,
          gopSeconds: Math.min(ENCODER.gopSeconds, segmentSeconds),
          hlsSegmentSeconds: segmentSeconds,
          sourcePath,
          outputDir: outDir,
          rendition,
          fps: 24,
          durationMs: 15000,
          threads: 0,
          preset: 'ultrafast',
        });
        return fs
          .readdirSync(outDir)
          .filter((f) => f.endsWith('.ts'))
          .sort()
          .map((f) => getKeyframeTimestamp(path.join(outDir, f)));
      } finally {
        fs.rmSync(outDir, { recursive: true, force: true });
      }
    }

    it.each([
      ['vfr.mp4', ENCODER.hlsSegmentSeconds],
      ['s2.mp4', 0.5],
    ])(
      'puts every segment keyframe of %s at the same time (within 1 frame) in each rendition, %s s segments',
      async (fixture, segmentSeconds) => {
        const sourcePath = path.resolve(__dirname, '../../../../../tests/fixtures', fixture);
        if (!fs.existsSync(sourcePath)) return;

        const [t1080 = [], t720 = [], t480 = []] = await Promise.all(
          renditions.map((rendition) => keyframes(sourcePath, rendition, segmentSeconds))
        );

        expect(t1080.length).toBeGreaterThanOrEqual(3);
        expect([t720.length, t480.length]).toEqual([t1080.length, t1080.length]);
        t1080.forEach((t, i) => {
          expect(Math.abs(t - (t720[i] ?? Number.NaN))).toBeLessThan(0.05);
          expect(Math.abs(t - (t480[i] ?? Number.NaN))).toBeLessThan(0.05);
        });
      },
      60000
    );
  });
});
