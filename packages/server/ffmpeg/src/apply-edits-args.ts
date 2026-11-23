import * as path from 'node:path';
import { MS_PER_SECOND } from '@kit/primitives';
import type { BlurRegion, VideoEditList } from '@vp/domain';
import {
  audioEncodeArgs,
  hlsOutputArgs,
  resolveThreads,
  scaleFilter,
  type TranscodeArgsOptions,
  videoCodecArgs,
} from './transcode-args';

export interface ApplyEditsArgsOptions extends TranscodeArgsOptions {
  edits: VideoEditList;
  /** A source without an audio stream gets no audio chain and no audio output. */
  hasAudio: boolean;
}

const seconds = (ms: number) => String(ms / MS_PER_SECOND);

/** The alpha of an ellipse inscribed in the cropped region: opaque inside, transparent outside. */
const ELLIPSE_MASK =
  "format=yuva420p,geq=lum='p(X,Y)':cb='p(X,Y)':cr='p(X,Y)':a='if(lte(pow(2*X/W-1,2)+pow(2*Y/H-1,2),1),255,0)'";

function blurChain(blur: BlurRegion, index: number, input: string, output: string): string {
  const keep = `keep${index}`;
  const region = `region${index}`;
  const blurred = `blurred${index}`;
  const radius = (plane: 'w,h' | 'cw,ch') => `'min(${blur.strength},min(${plane})/2)'`;
  const crop = `crop=w=iw*${blur.w}:h=ih*${blur.h}:x=iw*${blur.x}:y=ih*${blur.y}`;
  const box = `boxblur=luma_radius=${radius('w,h')}:chroma_radius=${radius('cw,ch')}`;
  const mask = blur.shape === 'ellipse' ? `,${ELLIPSE_MASK}` : '';
  const enable = `enable='between(t,${seconds(blur.startMs)},${seconds(blur.endMs)})'`;
  return [
    `[${input}]split[${keep}][${region}]`,
    `[${region}]${crop},${box}${mask}[${blurred}]`,
    `[${keep}][${blurred}]overlay=x=main_w*${blur.x}:y=main_h*${blur.y}:${enable}[${output}]`,
  ].join(';');
}

/**
 * The filter graph of one rendition: each blur is a cropped, box-blurred copy of its region laid back
 * over the frame only between its times, then the trim, then the rendition's scale. Blurs come before
 * the trim, so their times are on the base generation's timeline like the trim's own.
 */
export function editFilterGraph(
  options: Pick<ApplyEditsArgsOptions, 'edits' | 'hasAudio' | 'rendition'>
): string {
  const { edits, hasAudio, rendition } = options;
  const chains: string[] = [];
  let current = '0:v';
  for (const [index, blur] of edits.blurs.entries()) {
    const next = `blur${index}`;
    chains.push(blurChain(blur, index, current, next));
    current = next;
  }
  const trim = edits.trim
    ? `trim=start=${seconds(edits.trim.startMs)}:end=${seconds(edits.trim.endMs)},setpts=PTS-STARTPTS,`
    : '';
  chains.push(`[${current}]${trim}${scaleFilter(rendition)}[v]`);
  if (hasAudio) {
    const audioTrim = edits.trim
      ? `atrim=start=${seconds(edits.trim.startMs)}:end=${seconds(edits.trim.endMs)},asetpts=PTS-STARTPTS`
      : 'anull';
    chains.push(`[0:a:0]${audioTrim}[a]`);
  }
  return chains.join(';');
}

/** One re-encode of the source into a rendition's HLS, through the edit list's filter graph. */
export function buildApplyEditsArgs(options: ApplyEditsArgsOptions): string[] {
  const { sourcePath, outputDir, rendition, hlsSegmentSeconds, hasAudio } = options;
  const threads = resolveThreads(options);
  return [
    '-hide_banner',
    '-nostdin',
    '-loglevel',
    'error',
    '-progress',
    'pipe:1',
    '-i',
    sourcePath,
    '-filter_complex',
    editFilterGraph(options),
    '-map',
    '[v]',
    ...(hasAudio ? ['-map', '[a]', ...audioEncodeArgs(rendition)] : []),
    ...videoCodecArgs(options),
    ...hlsOutputArgs(outputDir, hlsSegmentSeconds),
    ...(threads > 0 ? ['-threads', String(threads)] : []),
    path.join(outputDir, 'index.m3u8'),
  ];
}
