import { err } from '@vp/result';
import { expectErr, expectOk } from '@vp/testing/result';
import { ensureClip, ensureImage, clipArgs, clipCacheKey, clipSpecOf } from '../media';
import type { UserSpec, VideoSpec } from '../world-types';
import { createFakePorts } from './fake-ports';

const VIDEO: VideoSpec = {
  key: 'v01',
  ownerId: 'owner',
  title: 'A title',
  description: 'A description',
  categorySlug: 'music',
  tags: ['demo'],
  visibility: 'public',
  shape: 'standard',
  seconds: 12,
  source: 'life',
  hue: 120,
  toneHz: 300,
};

const USER = { handle: 'demo-creator', hue: 40 } as UserSpec;

describe('seed/media: clipSpecOf', () => {
  it.each([
    { shape: 'standard', size: [640, 360] },
    { shape: 'short', size: [360, 640] },
  ] as const)('renders a $shape clip at $size', ({ shape, size }) => {
    const spec = clipSpecOf({ ...VIDEO, shape });

    expect([spec.width, spec.height]).toEqual(size);
    expect(spec.seed).toBe(clipSpecOf({ ...VIDEO, shape }).seed);
  });

  it('keys the cache by what changes the clip', () => {
    const base = clipSpecOf(VIDEO);

    expect(clipCacheKey(base)).toBe(clipCacheKey(clipSpecOf({ ...VIDEO })));
    expect(clipCacheKey(base)).not.toBe(clipCacheKey(clipSpecOf({ ...VIDEO, seconds: 13 })));
    expect(clipCacheKey(base)).not.toBe(clipCacheKey(clipSpecOf({ ...VIDEO, hue: 121 })));
  });
});

describe('seed/media: clipArgs', () => {
  it.each([
    'testsrc2',
    'gradients',
    'life',
    'mandelbrot',
    'cellauto',
    'smptebars',
    'rgbtestsrc',
  ] as const)('builds %s from lavfi alone, with no text overlay', (source) => {
    const args = clipArgs(clipSpecOf({ ...VIDEO, source }), 'out.mp4').join(' ');

    expect(args).toContain(`-i ${source}=`);
    expect(args).toContain('-i sine=frequency=300');
    expect(args).not.toContain('drawtext');
    expect(args.endsWith('out.mp4')).toBe(true);
  });

  it('pins the seed of the random sources so a re-render matches', () => {
    const args = clipArgs(clipSpecOf(VIDEO), 'out.mp4').join(' ');

    expect(args).toContain('random_seed=');
    expect(args).toContain('+bitexact');
  });
});

describe('seed/media: ensureClip', () => {
  it('renders a clip once and reuses the file on the next run', async () => {
    const ports = createFakePorts();

    const first = expectOk(await ensureClip(ports, '/work/media', VIDEO));
    const second = expectOk(await ensureClip(ports, '/work/media', VIDEO));

    expect(first).toEqual({ path: first.path, reused: false });
    expect(second).toEqual({ path: first.path, reused: true });
    expect(first.path).toMatch(/^\/work\/media\/v01-[0-9a-f]{16}\.mp4$/);
    expect(ports.ffmpegCalls).toHaveLength(1);
  });

  it('reports a failed render without writing a path', async () => {
    const ports = createFakePorts();
    ports.runFfmpeg = async () => err({ kind: 'process', message: 'ffmpeg exited 1' });

    expect(expectErr(await ensureClip(ports, '/work/media', VIDEO))).toEqual({
      kind: 'process',
      message: 'ffmpeg exited 1',
    });
  });
});

describe('seed/media: ensureImage', () => {
  it.each([
    { kind: 'avatar', size: '512x512' },
    { kind: 'banner', size: '1536x864' },
  ] as const)('renders one $kind frame at $size and reuses it', async ({ kind, size }) => {
    const ports = createFakePorts();

    const first = expectOk(await ensureImage(ports, '/work/media', USER, kind));
    const second = expectOk(await ensureImage(ports, '/work/media', USER, kind));

    expect(first.path).toMatch(new RegExp(`demo-creator-${kind}-[0-9a-f]{16}\\.png$`));
    expect(second.reused).toBe(true);
    expect(ports.ffmpegCalls[0]?.join(' ')).toContain(`size=${size}`);
    expect(ports.ffmpegCalls[0]).toContain('-frames:v');
  });
});
