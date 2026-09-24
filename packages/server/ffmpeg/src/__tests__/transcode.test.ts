import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { CANONICAL_LADDER, type LadderEntry } from '@vp/job-contracts';
import { runFfmpegTranscode } from '../transcode';
import { ENCODER } from './encoder-settings';

describe('@vp/ffmpeg: runFfmpegTranscode', () => {
  const renditions: readonly LadderEntry[] = CANONICAL_LADDER;

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
