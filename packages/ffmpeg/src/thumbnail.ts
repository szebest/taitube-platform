import { spawn } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { ErrorCodes, PermanentError, TransientError } from '@vp/errors';
import { classifyFfmpegError } from './transcode.js';

export interface PosterOptions {
  sourcePath: string;
  outputPath: string;
  durationMs?: number;
}

export interface SpriteOptions {
  sourcePath: string;
  outputPath: string;
  durationMs: number;
  intervalSec?: number;
  columns?: number;
}

export interface GenerateSpriteVttOptions {
  durationMs: number;
  intervalSec?: number;
  columns?: number;
  tileWidth?: number;
  tileHeight?: number;
  spriteFilename?: string;
}

export interface SpriteVttCue {
  cueIndex: number;
  startTime: string;
  endTime: string;
  startMs: number;
  endMs: number;
  spriteFilename: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RunThumbnailOptions {
  sourcePath: string;
  outputDir: string;
  durationMs: number;
  intervalSec?: number;
  columns?: number;
  timeoutMs?: number;
  forceFailure?: boolean;
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

/**
 * Builds FFmpeg argument array for 1280x720 letterboxed poster image (SDD §8.3).
 */
export function buildPosterArgs(options: PosterOptions): string[] {
  const { sourcePath, outputPath, durationMs } = options;
  const t10 = durationMs && durationMs > 0 ? (durationMs * 0.1) / 1000 : 0;

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

export interface SpriteGrid {
  durationSec: number;
  frameCount: number;
  rows: number;
  columns: number;
}

/**
 * Computes frame count and grid dimensions for sprite sheet tiling.
 */
export function calculateSpriteGrid(durationMs: number, intervalSec = 5, columns = 10): SpriteGrid {
  const durationSec = durationMs / 1000;
  const frameCount = Math.max(1, Math.ceil(durationSec / intervalSec));
  const rows = Math.max(1, Math.ceil(frameCount / columns));
  return { durationSec, frameCount, rows, columns };
}

/**
 * Builds FFmpeg argument array for tiled thumbnail sprite sheet (SDD §8.3, PRD OQ-4).
 * 4K sources are scaled down before tiling to keep memory bounded.
 */
export function buildSpriteArgs(options: SpriteOptions): string[] {
  const { sourcePath, outputPath, durationMs, intervalSec = 5, columns = 10 } = options;
  const { rows } = calculateSpriteGrid(durationMs, intervalSec, columns);

  return [
    '-hide_banner',
    '-nostdin',
    '-loglevel',
    'error',
    '-i',
    sourcePath,
    '-vf',
    `fps=1/${intervalSec},scale=160:90:force_original_aspect_ratio=decrease,pad=160:90:(ow-iw)/2:(oh-ih)/2,tile=${columns}x${rows}`,
    '-frames:v',
    '1',
    '-q:v',
    '5',
    '-update',
    '1',
    outputPath,
  ];
}

/**
 * Formats milliseconds into WebVTT timestamp format: HH:MM:SS.mmm
 */
export function formatVttTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const milliseconds = Math.floor(ms % 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
}

/**
 * Generates WebVTT cues from duration and grid coordinates (SDD §8.3).
 */
export function generateSpriteVtt(options: GenerateSpriteVttOptions): string {
  const {
    durationMs,
    intervalSec = 5,
    columns = 10,
    tileWidth = 160,
    tileHeight = 90,
    spriteFilename = 'sprite.jpg',
  } = options;

  const { frameCount } = calculateSpriteGrid(durationMs, intervalSec, columns);
  const intervalMs = intervalSec * 1000;

  const lines: string[] = ['WEBVTT', ''];

  for (let i = 0; i < frameCount; i++) {
    const startMs = i * intervalMs;
    const endMs = Math.min(durationMs, (i + 1) * intervalMs);
    const col = i % columns;
    const row = Math.floor(i / columns);
    const x = col * tileWidth;
    const y = row * tileHeight;

    lines.push(
      `${formatVttTimestamp(startMs)} --> ${formatVttTimestamp(endMs)}`,
      `${spriteFilename}#xywh=${x},${y},${tileWidth},${tileHeight}`,
      ''
    );
  }

  return lines.join('\n');
}

/**
 * Strictly parses and validates WebVTT content for thumbnail sprite sheets.
 */
export function parseSpriteVtt(vttContent: string): SpriteVttCue[] {
  const normalized = vttContent.replace(/\r\n/g, '\n').trim();
  if (!normalized.startsWith('WEBVTT')) {
    throw new Error('Invalid WebVTT: header does not start with WEBWTT');
  }

  const lines = normalized.split('\n');
  const cues: SpriteVttCue[] = [];

  let idx = 0;
  while (idx < lines.length && lines[idx]?.trim() !== '') {
    idx++;
  }

  let cueIndex = 0;
  while (idx < lines.length) {
    const line = lines[idx]?.trim() || '';
    if (!line) {
      idx++;
      continue;
    }

    const timeMatch = line.match(/^(\d{2}:\d{2}:\d{2}\.\d{3})\s+-->\s+(\d{2}:\d{2}:\d{2}\.\d{3})/);
    if (!timeMatch) {
      idx++;
      continue;
    }

    const startTime = timeMatch[1];
    const endTime = timeMatch[2];
    if (!(startTime && endTime)) {
      throw new Error(`Invalid WebVTT cue time line at line ${idx + 1}: "${line}"`);
    }
    idx++;

    const payloadLine = lines[idx]?.trim() || '';
    const payloadMatch = payloadLine.match(/^(.*)#xywh=(\d+),(\d+),(\d+),(\d+)$/);
    if (!payloadMatch) {
      throw new Error(`Invalid WebVTT cue payload at line ${idx + 1}: "${payloadLine}"`);
    }

    const spriteFilename = payloadMatch[1] ?? '';
    const x = Number.parseInt(payloadMatch[2] ?? '0', 10);
    const y = Number.parseInt(payloadMatch[3] ?? '0', 10);
    const width = Number.parseInt(payloadMatch[4] ?? '0', 10);
    const height = Number.parseInt(payloadMatch[5] ?? '0', 10);

    const parseMs = (ts: string) => {
      const [hms = '', ms = '0'] = ts.split('.');
      const [h = 0, m = 0, s = 0] = hms.split(':').map(Number);
      return h * 3600000 + m * 60000 + s * 1000 + Number(ms);
    };

    const startMs = parseMs(startTime);
    const endMs = parseMs(endTime);

    if (startMs >= endMs) {
      throw new Error(`Invalid cue timing: start (${startTime}) >= end (${endTime})`);
    }

    cues.push({
      cueIndex: cueIndex++,
      startTime,
      endTime,
      startMs,
      endMs,
      spriteFilename,
      x,
      y,
      width,
      height,
    });

    idx++;
  }

  return cues;
}

function runSpawn(args: string[], timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, {
      stdio: ['ignore', 'ignore', 'pipe'],
    });

    const stderrLines: string[] = [];
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGTERM');
      setTimeout(() => {
        if (!proc.killed) proc.kill('SIGKILL');
      }, 3000);
    }, timeoutMs);

    proc.stderr.setEncoding('utf-8');
    proc.stderr.on('data', (chunk: string) => {
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.trim()) {
          stderrLines.push(line.trim());
          if (stderrLines.length > 50) {
            stderrLines.shift();
          }
        }
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    proc.on('close', (code, signal) => {
      clearTimeout(timer);
      if (timedOut) {
        return reject(
          new TransientError(
            ErrorCodes.FFMPEG_TIMEOUT,
            `FFmpeg thumbnail process timed out after ${timeoutMs}ms`
          )
        );
      }

      if (code !== 0) {
        const stderrStr = stderrLines.join('\n');
        return reject(classifyFfmpegError(code, signal, stderrStr));
      }

      resolve();
    });
  });
}

/**
 * Runs FFmpeg to produce poster.jpg, sprite.jpg, and generates sprite.vtt into outputDir.
 */
export async function runFfmpegThumbnail(
  options: RunThumbnailOptions
): Promise<ThumbnailExecutionResult> {
  if (options.forceFailure) {
    throw new PermanentError(ErrorCodes.FFMPEG_FAILED, 'Forced thumbnail failure for testing');
  }

  const {
    sourcePath,
    outputDir,
    durationMs,
    intervalSec = 5,
    columns = 10,
    timeoutMs = 60000,
  } = options;

  const posterPath = path.join(outputDir, 'poster.jpg');
  const spritePath = path.join(outputDir, 'sprite.jpg');
  const vttPath = path.join(outputDir, 'sprite.vtt');

  const { frameCount, rows } = calculateSpriteGrid(durationMs, intervalSec, columns);

  // 1. Generate WebVTT
  const vttContent = generateSpriteVtt({
    durationMs,
    intervalSec,
    columns,
  });
  await fs.writeFile(vttPath, vttContent, 'utf-8');

  // 2. Build args
  const posterArgs = buildPosterArgs({ sourcePath, outputPath: posterPath, durationMs });
  const spriteArgs = buildSpriteArgs({
    sourcePath,
    outputPath: spritePath,
    durationMs,
    intervalSec,
    columns,
  });

  // 3. Concurrently generate poster and sprite
  await Promise.all([runSpawn(posterArgs, timeoutMs), runSpawn(spriteArgs, timeoutMs)]);

  return {
    outputDir,
    posterPath,
    spritePath,
    vttPath,
    frameCount,
    rows,
    columns,
  };
}
