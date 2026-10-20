import { checkContrast, contrastRatio } from '../contrast';

const pair = (
  overrides: Partial<{ label: string; foreground: string; background: string; floor: number }>
) => ({
  label: 'fg on bg',
  foreground: '#000000',
  background: '#FFFFFF',
  floor: 4.5,
  ...overrides,
});

describe('contrast', () => {
  it.each([
    { label: 'black on white', foreground: '#000000', background: '#FFFFFF', ratio: 21 },
    { label: 'white on black', foreground: '#FFFFFF', background: '#000000', ratio: 21 },
    { label: 'a colour on itself', foreground: '#C9A66B', background: '#C9A66B', ratio: 1 },
    {
      label: 'the lightest grey passing AA on white',
      foreground: '#767676',
      background: '#FFFFFF',
      ratio: 4.54,
    },
    {
      label: 'the darkest grey failing AA on white',
      foreground: '#777777',
      background: '#FFFFFF',
      ratio: 4.48,
    },
    {
      label: 'a translucent black composited over white',
      foreground: '#00000080',
      background: '#FFFFFF',
      ratio: 4,
    },
    {
      label: 'a lowercase eight digit opaque colour',
      foreground: '#000000ff',
      background: '#ffffff',
      ratio: 21,
    },
  ])('measures $label', ({ foreground, background, ratio }) => {
    expect(contrastRatio(foreground, background)).toBeCloseTo(ratio, 2);
  });

  it.each([
    { label: 'a translucent background', foreground: '#000000', background: '#FFFFFF80' },
    { label: 'a malformed foreground', foreground: '#000', background: '#FFFFFF' },
    { label: 'a malformed background', foreground: '#000000', background: 'white' },
  ])('cannot measure $label', ({ foreground, background }) => {
    expect(contrastRatio(foreground, background)).toBeNaN();
  });

  it('returns only the pairs under their floor, keeping every field the caller passed and adding the ratio', () => {
    const failures = checkContrast([
      pair({ label: 'text', foreground: '#767676' }),
      pair({ label: 'muted text', foreground: '#777777' }),
      pair({ label: 'outline', foreground: '#949494', floor: 3 }),
      pair({ label: 'icon', foreground: '#959595', floor: 3 }),
    ]);

    expect(failures).toEqual([
      { ...pair({ label: 'muted text', foreground: '#777777' }), ratio: expect.closeTo(4.48, 2) },
      {
        ...pair({ label: 'icon', foreground: '#959595', floor: 3 }),
        ratio: expect.closeTo(2.995, 3),
      },
    ]);
  });

  it.each([
    { label: 'a translucent background', overrides: { background: '#FFFFFF80' } },
    { label: 'a malformed colour', overrides: { foreground: 'black' } },
  ])('fails a pair with $label rather than passing it', ({ overrides }) => {
    expect(checkContrast([pair(overrides)])).toEqual([expect.objectContaining({ ratio: NaN })]);
  });
});
