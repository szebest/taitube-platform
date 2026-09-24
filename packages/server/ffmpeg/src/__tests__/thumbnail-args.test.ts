import { buildPosterArgs, buildSpriteArgs } from '../thumbnail-args';
import { SPRITE } from './encoder-settings';

describe('@vp/ffmpeg: thumbnail arguments (SDD §8.3)', () => {
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
});
