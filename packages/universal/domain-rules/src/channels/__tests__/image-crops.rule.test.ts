import type { ImageCrops } from '@vp/domain';
import { expectErr, expectOk } from '@vp/testing/result';
import { decideImageCrops } from '../image-crops.rule';

const IMAGE = { width: 2560, height: 1440 };
const banner: ImageCrops = {
  kind: 'banner',
  crops: {
    desktop: { x: 0, y: 100, width: 2400, height: 400 },
    mobile: { x: 0, y: 0, width: 1500, height: 500 },
    tv: { x: 0, y: 0, width: 2560, height: 1440 },
  },
};

describe('@vp/domain-rules: decideImageCrops', () => {
  it('accepts a banner with a crop of each target shape', () => {
    expect(expectOk(decideImageCrops(banner, IMAGE))).toEqual(banner);
  });

  it('accepts a square avatar crop', () => {
    const avatar: ImageCrops = { kind: 'avatar', crop: { x: 10, y: 10, width: 400, height: 400 } };

    expect(expectOk(decideImageCrops(avatar, IMAGE))).toEqual(avatar);
  });

  it.each(['desktop', 'mobile', 'tv'] as const)(
    'names the %s crop when it is the wrong shape',
    (target) => {
      const crops = {
        ...banner,
        crops: { ...banner.crops, [target]: { x: 0, y: 0, width: 900, height: 900 } },
      };

      expect(expectErr(decideImageCrops(crops, IMAGE))).toMatchObject({
        code: 'VALIDATION_FAILED',
        field: `crops.${target}`,
      });
    }
  );

  it('refuses a non-square avatar crop', () => {
    const avatar: ImageCrops = { kind: 'avatar', crop: { x: 0, y: 0, width: 400, height: 300 } };

    expect(expectErr(decideImageCrops(avatar, IMAGE))).toMatchObject({ field: 'crop' });
  });

  it.each([
    {
      kind: 'avatar',
      image: { width: 199, height: 199 },
      crop: { x: 0, y: 0, width: 100, height: 100 },
    },
    { kind: 'banner', image: { width: 1000, height: 560 }, crop: null },
  ] as const)(
    'refuses a $kind image below the minimum before looking at the crops',
    ({ kind, image, crop }) => {
      const crops: ImageCrops = kind === 'avatar' && crop ? { kind, crop } : banner;

      expect(expectErr(decideImageCrops(crops, image)).code).toBe('IMAGE_TOO_SMALL');
    }
  );
});
