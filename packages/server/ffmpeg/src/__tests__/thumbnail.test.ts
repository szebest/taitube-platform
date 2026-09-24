import { execSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { runFfmpegThumbnail } from '../thumbnail';
import { ENCODER, LIMITS, SPRITE } from './encoder-settings';

describe('@vp/ffmpeg: runFfmpegThumbnail', () => {
  it('runs real FFmpeg on s60.mp4 and validates the poster, sprite and VTT', async () => {
    const fixturePath = path.resolve(__dirname, '../../../../../tests/fixtures/s60.mp4');
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vp-thumb-test-'));

    try {
      const result = await runFfmpegThumbnail({
        ffmpegPath: ENCODER.ffmpegPath,
        sourcePath: fixturePath,
        outputDir: tmpDir,
        durationMs: 60000,
        layout: SPRITE,
        timeoutMs: 60_000,
        limits: LIMITS,
      });

      expect(result.frameCount).toBe(12);
      expect(result.rows).toBe(2);
      expect(result.columns).toBe(10);

      const posterStat = await fs.stat(result.posterPath);
      expect(posterStat.size).toBeGreaterThan(0);

      const spriteStat = await fs.stat(result.spritePath);
      expect(spriteStat.size).toBeGreaterThan(0);

      const vttContent = await fs.readFile(result.vttPath, 'utf-8');
      const timings = vttContent.split('\n').filter((line) => line.includes(' --> '));
      expect(timings).toHaveLength(12);

      const posterDims = execSync(
        `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "${result.posterPath}"`,
        { encoding: 'utf-8' }
      ).trim();
      expect(posterDims).toBe('1280x720');

      const spriteDims = execSync(
        `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "${result.spritePath}"`,
        { encoding: 'utf-8' }
      ).trim();
      expect(spriteDims).toBe('1600x180');
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  });
});
