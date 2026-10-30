import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { type FfmpegProcessLimits, runFfmpeg } from './run-ffmpeg';
import { type SpriteLayout, calculateSpriteGrid, generateSpriteVtt } from './sprite-sheet';
import { buildPosterArgs, buildSpriteArgs } from './thumbnail-args';

export interface RunThumbnailOptions {
  ffmpegPath: string;
  sourcePath: string;
  outputDir: string;
  durationMs: number;
  layout: SpriteLayout;
  timeoutMs: number;
  limits: FfmpegProcessLimits;
}

export interface ThumbnailExecutionResult {
  outputDir: string;
  posterPath: string;
  spritePath: string;
  vttPath: string;
  frameCount: number;
  rows: number;
  columns: number;
}

export async function runFfmpegThumbnail(
  options: RunThumbnailOptions
): Promise<ThumbnailExecutionResult> {
  const { ffmpegPath, sourcePath, outputDir, durationMs, layout, timeoutMs, limits } = options;

  const posterPath = path.join(outputDir, 'poster.jpg');
  const spritePath = path.join(outputDir, 'sprite.jpg');
  const vttPath = path.join(outputDir, 'sprite.vtt');

  const { frameCount, rows } = calculateSpriteGrid(durationMs, layout);

  const vttContent = generateSpriteVtt({ durationMs, layout });
  await fs.writeFile(vttPath, vttContent, 'utf-8');

  const posterArgs = buildPosterArgs({ sourcePath, outputPath: posterPath, durationMs });
  const spriteArgs = buildSpriteArgs({
    sourcePath,
    outputPath: spritePath,
    durationMs,
    layout,
  });

  await Promise.all([
    runFfmpeg({ ffmpegPath, stage: 'thumbnail', args: posterArgs, timeoutMs, limits }),
    runFfmpeg({ ffmpegPath, stage: 'thumbnail', args: spriteArgs, timeoutMs, limits }),
  ]);

  return {
    outputDir,
    posterPath,
    spritePath,
    vttPath,
    frameCount,
    rows,
    columns: layout.columns,
  };
}
