import { MICROSECONDS_PER_MS, MS_PER_SECOND } from '@vp/domain/time';
import type { LadderEntry } from '@vp/job-contracts';
import { audioEncodeArgs, videoEncodeArgs } from './transcode-args';

export interface LiveArgsOptions {
  inputUrl: string;
  rendition: LadderEntry;
  fps: number;
  segmentMs: number;
  partMs: number;
  /** How long a stalled ingest is waited for before ffmpeg gives up on it. */
  readTimeoutMs: number;
  preset: string;
  threads: number;
}

/**
 * Re-encodes the ingest to one constant-rate rung with a keyframe on every segment boundary, as a
 * fragmented MP4 on stdout cut every part: the shape the packager counts parts and segments on.
 */
export function buildLiveArgs(options: LiveArgsOptions): string[] {
  const { inputUrl, rendition, fps, segmentMs, partMs, readTimeoutMs, preset, threads } = options;

  return [
    '-hide_banner',
    '-nostdin',
    '-loglevel',
    'error',
    '-rtsp_transport',
    'tcp',
    '-timeout',
    String(readTimeoutMs * MICROSECONDS_PER_MS),
    '-i',
    inputUrl,
    '-map',
    '0:v:0',
    '-map',
    '0:a:0?',
    '-r',
    String(fps),
    ...videoEncodeArgs({ rendition, fps, preset, gopSeconds: segmentMs / MS_PER_SECOND }),
    '-tune',
    'zerolatency',
    ...audioEncodeArgs(rendition),
    '-threads',
    String(threads),
    '-f',
    'mp4',
    '-movflags',
    '+frag_keyframe+empty_moov+default_base_moof',
    '-frag_duration',
    String(partMs * MICROSECONDS_PER_MS),
    'pipe:1',
  ];
}
