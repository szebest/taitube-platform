import { MS_PER_SECOND } from '@vp/domain/time';
import { type SpriteLayout, calculateSpriteGrid } from './sprite-sheet';

interface PosterOptions {
  sourcePath: string;
  outputPath: string;
  durationMs?: number;
}

interface SpriteOptions {
  sourcePath: string;
  outputPath: string;
  durationMs: number;
  layout: SpriteLayout;
}

export function buildPosterArgs(options: PosterOptions): string[] {
  const { sourcePath, outputPath, durationMs } = options;
  const t10 = durationMs && durationMs > 0 ? (durationMs * 0.1) / MS_PER_SECOND : 0;

  return [
    '-hide_banner',
    '-nostdin',
    '-loglevel',
    'error',
    '-ss',
    t10.toFixed(3),
    '-i',
    sourcePath,
    '-frames:v',
    '1',
    '-vf',
    'thumbnail,scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2',
    '-q:v',
    '3',
    '-update',
    '1',
    outputPath,
  ];
}

/**
 * Builds FFmpeg argument array for tiled thumbnail sprite sheet (SDD §8.3, PRD OQ-4).
 * 4K sources are scaled down before tiling to keep memory bounded.
 */
export function buildSpriteArgs(options: SpriteOptions): string[] {
  const { sourcePath, outputPath, durationMs, layout } = options;
  const { intervalSec, columns, tileWidth: w, tileHeight: h } = layout;
  const { rows } = calculateSpriteGrid(durationMs, layout);

  return [
    '-hide_banner',
    '-nostdin',
    '-loglevel',
    'error',
    '-i',
    sourcePath,
    '-vf',
    `fps=1/${intervalSec},scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,tile=${columns}x${rows}`,
    '-frames:v',
    '1',
    '-q:v',
    '5',
    '-update',
    '1',
    outputPath,
  ];
}
