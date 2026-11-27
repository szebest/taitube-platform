import { expectErr, expectOk } from '@kit/testing/result';
import type { ImageCrops } from '@vp/domain';
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

  it.each<ImageCrops>([
    { kind: 'avatar', crop: { x: 10, y: 10, width: 400, height: 400 } },
    { kind: 'playlist-cover', crop: { x: 0, y: 0, width: 1600, height: 900 } },
  ])('accepts a $kind crop of its shape', (crops) => {
    expect(expectOk(decideImageCrops(crops, IMAGE))).toEqual(crops);
  });

  it.each(['post-image', 'page-image'] as const)(
    'cuts a %s whole, whatever rectangle it came with',
    (kind) => {
      const given: ImageCrops = { kind, crop: { x: 5, y: 5, width: 10, height: 10 } };

      expect(expectOk(decideImageCrops(given, IMAGE))).toEqual({
        kind,
        crop: { x: 0, y: 0, ...IMAGE },
      });
    }
  );

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

  it.each<ImageCrops>([
    { kind: 'avatar', crop: { x: 0, y: 0, width: 400, height: 300 } },
    { kind: 'playlist-cover', crop: { x: 0, y: 0, width: 900, height: 900 } },
  ])('refuses a $kind crop of another shape', (crops) => {
    expect(expectErr(decideImageCrops(crops, IMAGE))).toMatchObject({ field: 'crop' });
  });

  it.each([
    {
      kind: 'avatar',
      image: { width: 199, height: 199 },
      crop: { x: 0, y: 0, width: 100, height: 100 },
    },
    { kind: 'banner', image: { width: 1000, height: 560 }, crop: null },
    {
      kind: 'playlist-cover',
      image: { width: 639, height: 360 },
      crop: { x: 0, y: 0, width: 320, height: 180 },
    },
    {
      kind: 'post-image',
      image: { width: 600, height: 600 },
      crop: { x: 0, y: 0, width: 600, height: 600 },
    },
  ] as const)(
    'refuses a $kind image below the minimum before looking at the crops',
    ({ kind, image, crop }) => {
      const crops: ImageCrops = kind === 'banner' || !crop ? banner : { kind, crop };

      expect(expectErr(decideImageCrops(crops, image)).code).toBe('IMAGE_TOO_SMALL');
    }
  );
});
