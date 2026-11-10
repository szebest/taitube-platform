import { AVATAR_SIZES, BANNER_TARGETS, BANNER_WIDTHS } from '@vp/domain';
import {
  type ChannelImageCrops,
  defaultChannelImageVariant,
  planChannelImageVariants,
} from '../channel-image-variants';

const CROP = { x: 10, y: 20, width: 400, height: 400 };
const BANNER = {
  desktop: { x: 0, y: 0, width: 1200, height: 200 },
  mobile: { x: 5, y: 6, width: 900, height: 300 },
  tv: { x: 7, y: 8, width: 1600, height: 900 },
};
const AVATAR_CROPS: ChannelImageCrops = { kind: 'avatar', crop: CROP };
const BANNER_CROPS: ChannelImageCrops = { kind: 'banner', crops: BANNER };

describe('@vp/ffmpeg: channel image variants', () => {
  it.each(AVATAR_SIZES)('cuts the avatar crop to a %i px square', (size) => {
    expect(planChannelImageVariants(AVATAR_CROPS)).toContainEqual({
      name: String(size),
      crop: CROP,
      width: size,
      height: size,
    });
  });

  it.each([
    { target: 'desktop', width: 1280, height: 214 },
    { target: 'desktop', width: 2560, height: 426 },
    { target: 'mobile', width: 1280, height: 426 },
    { target: 'mobile', width: 2560, height: 854 },
    { target: 'tv', width: 1280, height: 720 },
    { target: 'tv', width: 2560, height: 1440 },
  ] as const)('cuts the $target banner crop to $width x $height', ({ target, width, height }) => {
    expect(planChannelImageVariants(BANNER_CROPS)).toContainEqual({
      name: `${target}-${width}`,
      crop: BANNER[target],
      width,
      height,
    });
  });

  it.each([
    { crops: AVATAR_CROPS, count: AVATAR_SIZES.length },
    { crops: BANNER_CROPS, count: BANNER_TARGETS.length * BANNER_WIDTHS.length },
  ])('plans $count variants for a $crops.kind with unique names', ({ crops, count }) => {
    const names = planChannelImageVariants(crops).map((variant) => variant.name);
    expect(new Set(names).size).toBe(count);
  });

  it.each([
    { crops: AVATAR_CROPS, variant: '128' },
    { crops: BANNER_CROPS, variant: 'desktop-1280' },
  ])('names $variant the default of a $crops.kind', ({ crops, variant }) => {
    expect(defaultChannelImageVariant(crops.kind)).toBe(variant);
    expect(planChannelImageVariants(crops).map((planned) => planned.name)).toContain(variant);
  });
});
