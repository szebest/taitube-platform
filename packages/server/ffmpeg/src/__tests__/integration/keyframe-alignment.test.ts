import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { CANONICAL_LADDER, runFfmpegTranscode } from '../../index';
import { ENCODER } from '../encoder-settings';

/** Real encodes of three renditions per fixture: the `integration` job runs these, not `unit`. */
const renditions = CANONICAL_LADDER.filter((rung) => ['1080p', '720p', '480p'].includes(rung.name));

describe('Ticket 14 AC 4: keyframe timestamps of segment N across 1080p/720p/480p', () => {
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
      const sourcePath = path.resolve(__dirname, '../../../../../../tests/fixtures', fixture);
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
