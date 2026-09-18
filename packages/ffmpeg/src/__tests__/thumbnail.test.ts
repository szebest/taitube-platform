import { execSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { PermanentError } from '@vp/errors';
import { describe, expect, it } from 'vitest';
import {
  buildPosterArgs,
  buildSpriteArgs,
  formatVttTimestamp,
  generateSpriteVtt,
  parseSpriteVtt,
  runFfmpegThumbnail,
} from '../index';

describe('FFmpeg Thumbnails & WebVTT (Ticket 13, SDD §8.3)', () => {
  it('builds poster arguments with 10% seek offset and 1280x720 letterboxing', () => {
    const args = buildPosterArgs({
      sourcePath: '/path/to/source.mp4',
      outputPath: '/path/to/poster.jpg',
      durationMs: 60000,
    });

    expect(args).toContain('-ss');
    const ssIndex = args.indexOf('-ss');
    expect(args[ssIndex + 1]).toBe('6.000'); // 10% of 60s = 6.000s
    expect(args).toContain('-frames:v');
    expect(args).toContain(
      'thumbnail,scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2'
    );
    expect(args).toContain('-q:v');
    expect(args).toContain('3');
    expect(args[args.length - 1]).toBe('/path/to/poster.jpg');
  });

  it('builds poster arguments with 0.000 fallback when duration is unknown', () => {
    const args = buildPosterArgs({
      sourcePath: '/path/to/source.mp4',
      outputPath: '/path/to/poster.jpg',
    });
    const ssIndex = args.indexOf('-ss');
    expect(args[ssIndex + 1]).toBe('0.000');
  });

  it('builds sprite arguments computing correct tile grid for s60 and m10', () => {
    // s60: 60s, 5s interval -> 12 frames, 10 cols -> 2 rows (tile=10x2)
    const args60 = buildSpriteArgs({
      sourcePath: '/path/to/source.mp4',
      outputPath: '/path/to/sprite.jpg',
      durationMs: 60000,
      intervalSec: 5,
    });
    expect(args60).toContain(
      'fps=1/5,scale=160:90:force_original_aspect_ratio=decrease,pad=160:90:(ow-iw)/2:(oh-ih)/2,tile=10x2'
    );

    // m10: 600s, 5s interval -> 120 frames, 10 cols -> 12 rows (tile=10x12)
    const args600 = buildSpriteArgs({
      sourcePath: '/path/to/source.mp4',
      outputPath: '/path/to/sprite.jpg',
      durationMs: 600000,
      intervalSec: 5,
    });
    expect(args600).toContain(
      'fps=1/5,scale=160:90:force_original_aspect_ratio=decrease,pad=160:90:(ow-iw)/2:(oh-ih)/2,tile=10x12'
    );
  });

  it('formatVttTimestamp formats milliseconds to HH:MM:SS.mmm', () => {
    expect(formatVttTimestamp(0)).toBe('00:00:00.000');
    expect(formatVttTimestamp(5000)).toBe('00:00:05.000');
    expect(formatVttTimestamp(65432)).toBe('00:01:05.432');
    expect(formatVttTimestamp(3661005)).toBe('01:01:01.005');
  });

  it('AC 1: generates and validates VTT for s60 (12 cues of 5s) and m10 (120 cues)', () => {
    // s60
    const vtt60 = generateSpriteVtt({ durationMs: 60000, intervalSec: 5 });
    const cues60 = parseSpriteVtt(vtt60);

    expect(cues60).toHaveLength(12);
    expect(cues60[0]).toEqual({
      cueIndex: 0,
      startTime: '00:00:00.000',
      endTime: '00:00:05.000',
      startMs: 0,
      endMs: 5000,
      spriteFilename: 'sprite.jpg',
      x: 0,
      y: 0,
      width: 160,
      height: 90,
    });
    // Cue 9: col 9, row 0
    expect(cues60[9]?.x).toBe(1440);
    expect(cues60[9]?.y).toBe(0);
    // Cue 10: col 0, row 1
    expect(cues60[10]?.x).toBe(0);
    expect(cues60[10]?.y).toBe(90);
    // Cue 11: col 1, row 1 (last cue)
    expect(cues60[11]?.x).toBe(160);
    expect(cues60[11]?.y).toBe(90);
    expect(cues60[11]?.startTime).toBe('00:00:55.000');
    expect(cues60[11]?.endTime).toBe('00:01:00.000');

    // m10 (600,000 ms)
    const vtt600 = generateSpriteVtt({ durationMs: 600000, intervalSec: 5 });
    const cues600 = parseSpriteVtt(vtt600);

    expect(cues600).toHaveLength(120);
    expect(cues600[0]?.startTime).toBe('00:00:00.000');
    expect(cues600[119]?.startTime).toBe('00:09:55.000');
    expect(cues600[119]?.endTime).toBe('00:10:00.000');
    expect(cues600[119]?.x).toBe(1440);
    expect(cues600[119]?.y).toBe(990); // row 11 * 90 = 990
  });

  it('parseSpriteVtt rejects malformed WebVTT inputs', () => {
    expect(() => parseSpriteVtt('INVALID_HEADER\n00:00:00.000 --> 00:00:05.000')).toThrow(
      /header does not start with WEBWTT/
    );
    expect(() =>
      parseSpriteVtt('WEBVTT\n\n00:00:05.000 --> 00:00:01.000\nsprite.jpg#xywh=0,0,160,90')
    ).toThrow(/Invalid cue timing/);
    expect(() =>
      parseSpriteVtt('WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nsprite.jpg#no-coords')
    ).toThrow(/Invalid WebVTT cue payload/);
  });

  it('AC 1 & SDD §8.3: runs real FFmpeg on s60.mp4 and validates outputs', async () => {
    const fixturePath = path.resolve(__dirname, '../../../../tests/fixtures/s60.mp4');
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vp-thumb-test-'));

    try {
      const result = await runFfmpegThumbnail({
        sourcePath: fixturePath,
        outputDir: tmpDir,
        durationMs: 60000,
        intervalSec: 5,
      });

      expect(result.frameCount).toBe(12);
      expect(result.rows).toBe(2);
      expect(result.columns).toBe(10);

      // Verify files exist
      const posterStat = await fs.stat(result.posterPath);
      expect(posterStat.size).toBeGreaterThan(0);

      const spriteStat = await fs.stat(result.spritePath);
      expect(spriteStat.size).toBeGreaterThan(0);

      const vttContent = await fs.readFile(result.vttPath, 'utf-8');
      const parsedCues = parseSpriteVtt(vttContent);
      expect(parsedCues).toHaveLength(12);

      // Verify dimensions using ffprobe
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
  }, 30000);

  it('forceFailure option throws PermanentError with code FFMPEG_FAILED', async () => {
    await expect(
      runFfmpegThumbnail({
        sourcePath: 'dummy.mp4',
        outputDir: '/tmp',
        durationMs: 60000,
        forceFailure: true,
      })
    ).rejects.toThrow(PermanentError);
  });
});
