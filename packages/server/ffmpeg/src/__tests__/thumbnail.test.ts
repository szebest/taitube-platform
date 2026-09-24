import { execSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  buildPosterArgs,
  buildSpriteArgs,
  formatVttTimestamp,
  generateSpriteVtt,
  parseSpriteVtt,
  runFfmpegThumbnail,
} from '../index';
import { ENCODER, LIMITS, SPRITE } from './encoder-settings';

describe('FFmpeg thumbnails and WebVTT (SDD §8.3)', () => {
  it('builds poster arguments with 10% seek offset and 1280x720 letterboxing', () => {
    const args = buildPosterArgs({
      sourcePath: '/path/to/source.mp4',
      outputPath: '/path/to/poster.jpg',
      durationMs: 60000,
    });

    expect(args).toContain('-ss');
    const ssIndex = args.indexOf('-ss');
    expect(args[ssIndex + 1]).toBe('6.000');
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

  it.each([
    { durationMs: 60000, tile: '10x2' },
    { durationMs: 600000, tile: '10x12' },
  ])('builds a $tile sprite grid for a $durationMs ms source', ({ durationMs, tile }) => {
    const args = buildSpriteArgs({
      sourcePath: '/path/to/source.mp4',
      outputPath: '/path/to/sprite.jpg',
      durationMs,
      layout: SPRITE,
    });
    expect(args).toContain(
      `fps=1/5,scale=160:90:force_original_aspect_ratio=decrease,pad=160:90:(ow-iw)/2:(oh-ih)/2,tile=${tile}`
    );
  });

  it.each([
    [0, '00:00:00.000'],
    [5000, '00:00:05.000'],
    [65432, '00:01:05.432'],
    [3661005, '01:01:01.005'],
  ])('formatVttTimestamp formats %i ms as %s', (ms, expected) => {
    expect(formatVttTimestamp(ms)).toBe(expected);
  });

  it('generates VTT with 12 cues of 5s for a 60s source and 120 cues for a 10 min source', () => {
    const vtt60 = generateSpriteVtt({ durationMs: 60000, layout: SPRITE });
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
    expect(cues60[9]?.x).toBe(1440);
    expect(cues60[9]?.y).toBe(0);
    expect(cues60[10]?.x).toBe(0);
    expect(cues60[10]?.y).toBe(90);
    expect(cues60[11]?.x).toBe(160);
    expect(cues60[11]?.y).toBe(90);
    expect(cues60[11]?.startTime).toBe('00:00:55.000');
    expect(cues60[11]?.endTime).toBe('00:01:00.000');

    const vtt600 = generateSpriteVtt({ durationMs: 600000, layout: SPRITE });
    const cues600 = parseSpriteVtt(vtt600);

    expect(cues600).toHaveLength(120);
    expect(cues600[0]?.startTime).toBe('00:00:00.000');
    expect(cues600[119]?.startTime).toBe('00:09:55.000');
    expect(cues600[119]?.endTime).toBe('00:10:00.000');
    expect(cues600[119]?.x).toBe(1440);
    expect(cues600[119]?.y).toBe(990);
  });

  it.each([
    ['INVALID_HEADER\n00:00:00.000 --> 00:00:05.000', /header does not start with WEBWTT/],
    ['WEBVTT\n\n00:00:05.000 --> 00:00:01.000\nsprite.jpg#xywh=0,0,160,90', /Invalid cue timing/],
    ['WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nsprite.jpg#no-coords', /Invalid WebVTT cue payload/],
  ])('parseSpriteVtt rejects %j', (vtt, error) => {
    expect(() => parseSpriteVtt(vtt)).toThrow(error);
  });

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
      const parsedCues = parseSpriteVtt(vttContent);
      expect(parsedCues).toHaveLength(12);

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
