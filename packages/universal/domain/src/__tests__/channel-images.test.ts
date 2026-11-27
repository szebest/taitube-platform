import { BANNER_ASPECTS, BANNER_TARGETS, IMAGE_UPLOAD_HAS_VARIANTS } from '../channel-images';

describe('@vp/domain: channel images', () => {
  it.each([
    ['desktop', 6],
    ['mobile', 3],
    ['tv', 16 / 9],
  ] as const)('crops the %s banner to %d:1', (target, aspect) => {
    expect(BANNER_ASPECTS[target]).toBeCloseTo(aspect);
  });

  it('has an aspect for every target', () => {
    expect(Object.keys(BANNER_ASPECTS)).toEqual([...BANNER_TARGETS]);
  });

  it('counts only a cut upload that is not purged yet as having variants', () => {
    const withVariants = Object.entries(IMAGE_UPLOAD_HAS_VARIANTS).filter(([, has]) => has);

    expect(withVariants.map(([status]) => status)).toEqual(['ready', 'superseded']);
  });
});
