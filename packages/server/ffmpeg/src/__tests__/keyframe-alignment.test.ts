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

describe('FFmpeg keyframe alignment and thread back-off', () => {
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

  describe('thread back-off (SDD §9.6 rule 6)', () => {
    it.each([
      { base: 2, attempt: 1, expected: 2 },
      { base: 2, attempt: 2, expected: 1 },
      { base: 2, attempt: 3, expected: 1 },
      { base: 4, attempt: 1, expected: 4 },
      { base: 4, attempt: 2, expected: 3 },
      { base: 4, attempt: 3, expected: 2 },
      { base: 4, attempt: 4, expected: 1 },
      { base: 4, attempt: 5, expected: 1 },
    ])('computes $expected threads from base $base on attempt $attempt', ({ base, attempt, expected }) => {
      expect(computeFfmpegThreads(base, attempt)).toBe(expected);
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

  describe('ENOSPC error classification', () => {
    it.each([
      'av_interleaved_write_frame(): No space left on device\nError writing trailer: No space left on device',
      'Error: ENOSPC: cannot write segment to disk',
    ])('classifies %j as TransientError with hint DISK_FULL', (stderr) => {
      const err = classifyFfmpegError(1, null, stderr);
      expect(err).toBeInstanceOf(TransientError);
      expect((err as TransientError).code).toBe(ErrorCodes.DISK_FULL);
      expect((err as TransientError).details?.['hint']).toBe('DISK_FULL');
    });
  });

  describe('keyframe timestamps of segment N across 1080p/720p/480p', () => {
    // One frame at 24 fps is ~0.042 s.
    const FRAME_TOLERANCE_S = 0.05;
    const fixturesDir = path.resolve(__dirname, '../../../../../tests/fixtures');

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

    async function segmentKeyframes(
      sourcePath: string,
      durationMs: number,
      keptSegments?: number
    ): Promise<Record<string, number[]>> {
      const timestampsByRendition: Record<string, number[]> = {};
      for (const rendition of renditions) {
        const outDir = fs.mkdtempSync(path.join(os.tmpdir(), `test-keyframes-${rendition.name}-`));
        try {
          await runFfmpegTranscode({
            ...ENCODER,
            sourcePath,
            outputDir: outDir,
            rendition,
            fps: 24,
            durationMs,
            threads: 0,
            preset: 'ultrafast',
          });
          const segFiles = fs
            .readdirSync(outDir)
            .filter((f) => f.endsWith('.ts'))
            .sort()
            .slice(0, keptSegments);
          timestampsByRendition[rendition.name] = segFiles.map((f) =>
            getKeyframeTimestamp(path.join(outDir, f))
          );
        } finally {
          fs.rmSync(outDir, { recursive: true, force: true });
        }
      }
      return timestampsByRendition;
    }

    function expectAligned(timestampsByRendition: Record<string, number[]>, segCount: number) {
      for (let i = 0; i < segCount; i++) {
        const t1080 = timestampsByRendition['1080p']?.[i] ?? 0;
        const t720 = timestampsByRendition['720p']?.[i] ?? 0;
        const t480 = timestampsByRendition['480p']?.[i] ?? 0;
        expect(Math.abs(t1080 - t720)).toBeLessThan(FRAME_TOLERANCE_S);
        expect(Math.abs(t1080 - t480)).toBeLessThan(FRAME_TOLERANCE_S);
      }
    }

    it('produces identical keyframe timestamps (within 1 frame) across 1080p/720p/480p for vfr.mp4', async () => {
      const vfrPath = path.join(fixturesDir, 'vfr.mp4');
      if (!fs.existsSync(vfrPath)) return;

      const timestamps = await segmentKeyframes(vfrPath, 15000);

      for (const rendition of renditions) {
        expect(timestamps[rendition.name]?.length ?? 0).toBeGreaterThanOrEqual(2);
      }
      expectAligned(timestamps, timestamps['1080p']?.length ?? 0);
    }, 60000);

    it('produces identical keyframe timestamps across 1080p/720p/480p for s60.mp4', async () => {
      const s60Path = path.join(fixturesDir, 's60.mp4');
      if (!fs.existsSync(s60Path)) return;

      const timestamps = await segmentKeyframes(s60Path, 18000, 3);

      for (const rendition of renditions) {
        expect(timestamps[rendition.name]).toHaveLength(3);
      }
      expectAligned(timestamps, 3);
    }, 60000);
  });
});
