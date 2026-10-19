import { expectOk } from '@vp/testing/result';
import { fromOklch, toOklch } from '../oklch';
import { formatHex, parseHex } from '../rgb';

const measure = (hex: string) => toOklch(expectOk(parseHex(hex)));

const paint = (color: Parameters<typeof fromOklch>[0]) => formatHex(fromOklch(color));

describe('oklch', () => {
  it.each([
    { label: 'white', hex: '#FFFFFF', l: 1 },
    { label: 'black', hex: '#000000', l: 0 },
    { label: 'mid grey', hex: '#777777', l: 0.569262 },
  ])('measures $label as achromatic', ({ hex, l }) => {
    const color = measure(hex);

    expect(color.l).toBeCloseTo(l, 4);
    expect(color.c).toBeCloseTo(0, 4);
  });

  it.each([
    { label: 'red', hex: '#FF0000', l: 0.627955, c: 0.257683, h: 29.2339 },
    { label: 'green', hex: '#00FF00', l: 0.86644, c: 0.294827, h: 142.4953 },
    { label: 'blue', hex: '#0000FF', l: 0.452014, c: 0.313214, h: 264.052 },
    { label: 'yellow', hex: '#FFFF00', l: 0.967983, c: 0.211006, h: 109.7692 },
  ])('measures $label against the published OKLab reference', ({ hex, l, c, h }) => {
    const color = measure(hex);

    expect(color.l).toBeCloseTo(l, 4);
    expect(color.c).toBeCloseTo(c, 4);
    expect(color.h).toBeCloseTo(h, 2);
  });

  it.each(['#FFFFFF', '#000000', '#FF0000', '#00FF00', '#0000FF', '#C9A66B', '#14120F', '#767676'])(
    'round trips %s',
    (hex) => {
      expect(paint(measure(hex))).toBe(hex);
    }
  );

  it.each([
    { label: 'a vivid blue lightened past sRGB', color: { l: 0.9, c: 0.3, h: 264 } },
    { label: 'a vivid red darkened past sRGB', color: { l: 0.2, c: 0.4, h: 29 } },
    { label: 'chroma no display can show', color: { l: 0.6, c: 1, h: 145 } },
  ])('clips $label into gamut, keeping lightness and hue', ({ color }) => {
    const clipped = measure(paint(color));

    expect(clipped.l).toBeCloseTo(color.l, 2);
    expect(Math.abs(clipped.h - color.h)).toBeLessThan(1);
    expect(clipped.c).toBeLessThan(color.c);
  });

  it.each([
    { label: 'past white', color: { l: 1.2, c: 0, h: 0 }, hex: '#FFFFFF' },
    { label: 'below black', color: { l: -0.1, c: 0.1, h: 30 }, hex: '#000000' },
  ])('clamps lightness $label', ({ color, hex }) => {
    expect(paint(color)).toBe(hex);
  });
});
