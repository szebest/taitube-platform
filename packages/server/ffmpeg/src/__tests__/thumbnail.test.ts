import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { runFfmpegThumbnail } from '../thumbnail';
import { ENCODER, LIMITS, SPRITE } from './encoder-settings';

function dimensions(imagePath: string): string {
  return execFileSync(
    'ffprobe',
    [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=width,height',
      '-of',
      'csv=s=x:p=0',
      imagePath,
    ],
    { encoding: 'utf-8' }
  ).trim();
}

describe('@vp/ffmpeg: runFfmpegThumbnail', () => {
  it.each([
    { fixture: 's15.mp4', durationMs: 15_000, frameCount: 3 },
    { fixture: 's2.mp4', durationMs: 2_000, frameCount: 1 },
  ])(
    'runs real FFmpeg on $fixture and writes a poster, a sprite and $frameCount VTT cues',
    async ({ fixture, durationMs, frameCount }) => {
      const fixturePath = path.resolve(__dirname, '../../../../../tests/fixtures', fixture);
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vp-thumb-test-'));

      try {
        const result = await runFfmpegThumbnail({
          ffmpegPath: ENCODER.ffmpegPath,
          sourcePath: fixturePath,
          outputDir: tmpDir,
          durationMs,
          layout: SPRITE,
          timeoutMs: 60_000,
          limits: LIMITS,
        });

        expect(result).toMatchObject({ frameCount, rows: 1, columns: 10 });

        const vttContent = await fs.readFile(result.vttPath, 'utf-8');
        const timings = vttContent.split('\n').filter((line) => line.includes(' --> '));
        expect(timings).toHaveLength(frameCount);

        expect(dimensions(result.posterPath)).toBe('1280x720');
        expect(dimensions(result.spritePath)).toBe('1600x90');
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true });
      }
    }
  );
});
