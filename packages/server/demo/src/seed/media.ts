import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { type Result, andThen, ok } from '@vp/result';
import type { SeedFailure } from './failure';
import type { SeedPorts } from './ports';
import type { UserSpec, VideoSpec } from './world-types';

export interface ClipSpec {
  source: VideoSpec['source'];
  width: number;
  height: number;
  seconds: number;
  hue: number;
  toneHz: number;
  seed: number;
}

export interface MediaFile {
  path: string;
  reused: boolean;
}

const FPS = 24;
const AVATAR = { width: 512, height: 512 } as const;
const BANNER = { width: 1536, height: 864 } as const;
const BITEXACT = ['-fflags', '+bitexact', '-flags:v', '+bitexact', '-flags:a', '+bitexact'];

export function clipSpecOf(video: VideoSpec): ClipSpec {
  const vertical = video.shape === 'short';
  return {
    source: video.source,
    width: vertical ? 360 : 640,
    height: vertical ? 640 : 360,
    seconds: video.seconds,
    hue: video.hue,
    toneHz: video.toneHz,
    seed: Number.parseInt(createHash('sha256').update(video.key).digest('hex').slice(0, 7), 16),
  };
}

function cacheKey(spec: unknown): string {
  return createHash('sha256').update(JSON.stringify(spec)).digest('hex').slice(0, 16);
}

export const clipCacheKey = (spec: ClipSpec): string => cacheKey(spec);

function lavfiSource({ source, width, height, hue, seed }: ClipSpec): string {
  const size = `size=${width}x${height}:rate=${FPS}`;
  const color = `0x${hueToHex(hue)}`;
  switch (source) {
    case 'gradients':
      return `gradients=${size}:speed=0.03:c0=${color}:c1=0x101820:nb_colors=2:seed=${seed}`;
    case 'life':
      return `life=${size}:ratio=0.18:life_color=${color}:death_color=0x111111:mold=12:random_seed=${seed}`;
    case 'cellauto':
      return `cellauto=${size}:rule=${[30, 90, 110, 150][seed % 4]}:scroll=1:full=1:random_seed=${seed}`;
    case 'mandelbrot':
      return `mandelbrot=${size}:maxiter=200`;
    case 'testsrc2':
    case 'smptebars':
    case 'rgbtestsrc':
      return `${source}=${size}`;
    default:
      return `testsrc2=${size}`;
  }
}

function hueToHex(hue: number): string {
  const channel = (offset: number) =>
    Math.round(160 + 90 * Math.sin((hue / 180) * Math.PI + offset))
      .toString(16)
      .padStart(2, '0');
  return `${channel(0)}${channel(2.1)}${channel(4.2)}`;
}

const flags = (text: string): string[] => text.split(' ');

/** Only lavfi sources and a sine tone, so the clip needs no font, no input file and no drawtext build. */
export function clipArgs(spec: ClipSpec, output: string): string[] {
  const tone = `sine=frequency=${spec.toneHz}:sample_rate=44100:duration=${spec.seconds}`;
  return [
    ...flags('-loglevel error -y -filter_threads 1'),
    ...flags('-f lavfi -i'),
    lavfiSource(spec),
    ...flags('-f lavfi -i'),
    tone,
    ...flags(`-t ${spec.seconds} -vf`),
    `hue=h=${spec.hue},format=yuv420p`,
    ...flags('-c:v libx264 -preset veryfast -crf 30 -maxrate 1200k -bufsize 2400k'),
    ...flags(`-g ${FPS * 2} -pix_fmt yuv420p -c:a aac -b:a 64k -ac 2 -threads 1`),
    ...BITEXACT,
    ...flags('-shortest -map_metadata -1 -movflags +faststart'),
    output,
  ];
}

function imageArgs(
  size: { width: number; height: number },
  hue: number,
  seed: number,
  output: string
): string[] {
  const gradient = `gradients=size=${size.width}x${size.height}:c0=0x${hueToHex(hue)}:c1=0x${hueToHex(hue + 140)}:nb_colors=2:seed=${seed}:speed=0`;
  return [
    ...flags('-loglevel error -y -f lavfi -i'),
    gradient,
    ...flags('-frames:v 1 -map_metadata -1'),
    output,
  ];
}

async function ensureFile(
  ports: SeedPorts,
  path: string,
  args: readonly string[]
): Promise<Result<MediaFile, SeedFailure>> {
  if (await ports.files.exists(path)) return ok({ path, reused: true });
  const rendered = await ports.runFfmpeg(args);
  return andThen(rendered, () => ok({ path, reused: false }));
}

export async function ensureClip(
  ports: SeedPorts,
  mediaDir: string,
  video: VideoSpec
): Promise<Result<MediaFile, SeedFailure>> {
  const spec = clipSpecOf(video);
  await ports.files.mkdir(mediaDir);
  const path = join(mediaDir, `${video.key}-${clipCacheKey(spec)}.mp4`);
  return ensureFile(ports, path, clipArgs(spec, path));
}

export const IMAGE_SIZES = { avatar: AVATAR, banner: BANNER } as const;

/** The crop the API asks for with each upload: the whole square, and a centred 6:1, 3:1 and 16:9 of the banner. */
export const IMAGE_CROPS = {
  avatar: { crop: { x: 0, y: 0, width: AVATAR.width, height: AVATAR.height } },
  banner: {
    crops: {
      desktop: { x: 0, y: 304, width: BANNER.width, height: 256 },
      mobile: { x: 0, y: 176, width: BANNER.width, height: 512 },
      tv: { x: 0, y: 0, width: BANNER.width, height: BANNER.height },
    },
  },
} as const;

export async function ensureImage(
  ports: SeedPorts,
  mediaDir: string,
  user: UserSpec,
  kind: keyof typeof IMAGE_SIZES
): Promise<Result<MediaFile, SeedFailure>> {
  await ports.files.mkdir(mediaDir);
  const size = IMAGE_SIZES[kind];
  const key = cacheKey({ kind, size, hue: user.hue, handle: user.handle });
  const path = join(mediaDir, `${user.handle}-${kind}-${key}.png`);
  const hash = Number.parseInt(key.slice(0, 7), 16);
  return ensureFile(ports, path, imageArgs(size, user.hue, hash, path));
}
