import type { BlurRegion } from '@vp/domain';
import type { LadderEntry } from '@vp/job-contracts';
import type { editFilterGraph } from '../apply-edits-args';
import { buildApplyEditsArgs } from '../apply-edits-args';
import { ENCODER } from './encoder-settings';

const RENDITION: LadderEntry = {
  name: '720p',
  width: 1280,
  height: 720,
  videoKbps: 2800,
  maxrateKbps: 2996,
  bufsizeKbps: 4200,
  audioKbps: 128,
  profile: 'high',
  level: '3.1',
};

const blur = (overrides: Partial<BlurRegion> = {}): BlurRegion => ({
  startMs: 1_500,
  endMs: 4_000,
  shape: 'rect',
  x: 0.25,
  y: 0.5,
  w: 0.1,
  h: 0.2,
  strength: 8,
  ...overrides,
});

const argsOf = (edits: Parameters<typeof editFilterGraph>[0]['edits'], hasAudio = true) =>
  buildApplyEditsArgs({
    ...ENCODER,
    sourcePath: '/tmp/base/index.m3u8',
    outputDir: '/tmp/out-720p',
    rendition: RENDITION,
    fps: 30,
    threads: 2,
    preset: 'veryfast',
    edits,
    hasAudio,
  });
const graphOf = (args: string[]) => args[args.indexOf('-filter_complex') + 1] ?? '';

describe('@vp/ffmpeg: apply-edits arguments', () => {
  it('trims video and audio to the same range and starts both at zero', () => {
    const graph = graphOf(argsOf({ trim: { startMs: 2_500, endMs: 10_000 }, blurs: [] }));

    expect(graph).toContain('[0:v]trim=start=2.5:end=10,setpts=PTS-STARTPTS,scale=w=1280:h=720');
    expect(graph).toContain('[0:a:0]atrim=start=2.5:end=10,asetpts=PTS-STARTPTS[a]');
  });

  it('blurs a cropped region of the frame only between its times, before the trim', () => {
    const graph = graphOf(argsOf({ trim: { startMs: 1_000, endMs: 9_000 }, blurs: [blur()] }));

    expect(graph).toContain('crop=w=iw*0.1:h=ih*0.2:x=iw*0.25:y=ih*0.5');
    expect(graph).toContain("boxblur=luma_radius='min(8,min(w,h)/2)'");
    expect(graph).toContain("overlay=x=main_w*0.25:y=main_h*0.5:enable='between(t,1.5,4)'");
    expect(graph.indexOf('overlay')).toBeLessThan(graph.indexOf('trim=start'));
  });

  it('masks an ellipse to the shape inscribed in its region, and leaves a rectangle unmasked', () => {
    const graph = graphOf(argsOf({ trim: null, blurs: [blur(), blur({ shape: 'ellipse' })] }));

    expect(graph.match(/geq=/g)).toHaveLength(1);
    expect(graph).toContain('[region1]crop');
    expect(graph).toContain('[blur1]scale=');
  });

  it('chains one blur into the next so every region lands on the same frames', () => {
    const graph = graphOf(argsOf({ trim: null, blurs: [blur(), blur({ x: 0.6 })] }));

    expect(graph).toContain('[0:v]split[keep0][region0]');
    expect(graph).toContain('[blur0]split[keep1][region1]');
  });

  it.each([
    { hasAudio: true, maps: ['[v]', '[a]'] },
    { hasAudio: false, maps: ['[v]'] },
  ])('maps the audio only when the source has some: $hasAudio', ({ hasAudio, maps }) => {
    const args = argsOf({ trim: null, blurs: [blur()] }, hasAudio);

    expect(args.filter((_, index) => args[index - 1] === '-map')).toEqual(maps);
    expect(graphOf(args).includes('[0:a:0]')).toBe(hasAudio);
  });

  it('writes the rendition as HLS with the ladder encoder settings and no second scale', () => {
    const args = argsOf({ trim: { startMs: 0, endMs: 5_000 }, blurs: [] });

    expect(args).not.toContain('-vf');
    expect(args[args.indexOf('-b:v') + 1]).toBe('2800k');
    expect(args.at(-1)).toBe('/tmp/out-720p/index.m3u8');
  });
});
