import * as path from 'node:path';
import {
  audioEncodeArgs,
  hlsOutputArgs,
  resolveThreads,
  type TranscodeArgsOptions,
  videoEncodeArgs,
} from './transcode-args';

const QUIET = ['-hide_banner', '-nostdin', '-loglevel', 'error', '-progress', 'pipe:1'];

export interface ChunkArgsOptions
  extends Pick<
    TranscodeArgsOptions,
    'sourcePath' | 'rendition' | 'fps' | 'gopSeconds' | 'threads' | 'attempt' | 'preset'
  > {
  outputPath: string;
  startSeconds: number;
  durationSeconds: number;
}

export function buildChunkArgs(options: ChunkArgsOptions): string[] {
  const threads = resolveThreads(options);
  const args = [
    ...QUIET,
    '-ss',
    String(options.startSeconds),
    '-t',
    String(options.durationSeconds),
    '-i',
    options.sourcePath,
    '-map',
    '0:v:0',
    '-an',
    ...videoEncodeArgs(options),
    '-f',
    'mp4',
  ];
  if (threads > 0) args.push('-threads', String(threads));
  args.push(options.outputPath);
  return args;
}

export interface ConcatArgsOptions
  extends Pick<TranscodeArgsOptions, 'rendition' | 'hlsSegmentSeconds' | 'threads' | 'attempt'> {
  listPath: string;
  audioSourcePath: string;
  outputDir: string;
}

export function buildConcatArgs(options: ConcatArgsOptions): string[] {
  const threads = resolveThreads(options);
  const args = [
    ...QUIET,
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    options.listPath,
    '-i',
    options.audioSourcePath,
    '-map',
    '0:v:0',
    '-map',
    '1:a:0?',
    '-c:v',
    'copy',
    ...audioEncodeArgs(options.rendition),
    '-shortest',
    ...hlsOutputArgs(options.outputDir, options.hlsSegmentSeconds),
  ];
  if (threads > 0) args.push('-threads', String(threads));
  args.push(path.join(options.outputDir, 'index.m3u8'));
  return args;
}
