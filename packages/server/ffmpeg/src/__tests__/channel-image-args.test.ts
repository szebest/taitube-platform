import { buildChannelImageArgs } from '../channel-image-args';

const build = (
  variant = { crop: { x: 12, y: 34, width: 500, height: 250 }, width: 256, height: 128 }
) => buildChannelImageArgs({ sourcePath: '/in/src', outputPath: '/out/x.webp', variant });

const after = (args: string[], flag: string) => args[args.indexOf(flag) + 1];

describe('@vp/ffmpeg: channel image arguments', () => {
  it('crops then scales in one filter chain', () => {
    expect(after(build(), '-vf')).toBe('crop=500:250:12:34,scale=256:128:flags=lanczos');
  });

  it.each([
    { name: 'strips every metadata tag', flag: '-map_metadata', value: '-1' },
    { name: 'encodes WebP', flag: '-c:v', value: 'libwebp' },
    { name: 'writes a single frame', flag: '-frames:v', value: '1' },
    { name: 'reads the first video stream only', flag: '-map', value: '0:v:0' },
  ])('$name', ({ flag, value }) => {
    expect(after(build(), flag)).toBe(value);
  });

  it.each(['-an', '-sn', '-nostdin', '-y'])('passes %s', (flag) => {
    expect(build()).toContain(flag);
  });

  it('reads the source and ends on the output path', () => {
    const args = build();
    expect(after(args, '-i')).toBe('/in/src');
    expect(args.at(-1)).toBe('/out/x.webp');
  });
});
