import { fitEmbedSize } from '../embed-size';

describe('@vp/domain-rules: fitEmbedSize', () => {
  it.each([
    { scenario: 'no limits', limits: {}, expected: { width: 640, height: 360 } },
    {
      scenario: 'a wider ceiling',
      limits: { maxwidth: 1920 },
      expected: { width: 640, height: 360 },
    },
    {
      scenario: 'a narrower ceiling',
      limits: { maxwidth: 320 },
      expected: { width: 320, height: 180 },
    },
    {
      scenario: 'a short ceiling',
      limits: { maxheight: 90 },
      expected: { width: 160, height: 90 },
    },
    {
      scenario: 'both, the height binding',
      limits: { maxwidth: 600, maxheight: 200 },
      expected: { width: 355, height: 200 },
    },
    {
      scenario: 'both, the width binding',
      limits: { maxwidth: 300, maxheight: 900 },
      expected: { width: 300, height: 169 },
    },
    {
      scenario: 'a one pixel ceiling',
      limits: { maxwidth: 1, maxheight: 1 },
      expected: { width: 1, height: 1 },
    },
  ])('fits $scenario', ({ limits, expected }) => {
    const size = fitEmbedSize(limits);

    expect(size).toEqual(expected);
    expect(size.width).toBeLessThanOrEqual(limits.maxwidth ?? Number.POSITIVE_INFINITY);
    expect(size.height).toBeLessThanOrEqual(limits.maxheight ?? Number.POSITIVE_INFINITY);
  });
});
