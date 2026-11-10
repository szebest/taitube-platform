import {
  AVATAR_SIZES,
  BANNER_ASPECTS,
  BANNER_TARGETS,
  BANNER_WIDTHS,
  type BannerCrops,
  type ChannelImageKind,
  type CropRect,
} from '@vp/domain';

export type ChannelImageCrops =
  | { readonly kind: 'avatar'; readonly crop: CropRect }
  | { readonly kind: 'banner'; readonly crops: BannerCrops };

/** One file the job writes: the rectangle it cuts from the source and the size it scales that to. */
export interface ChannelImageVariant {
  name: string;
  crop: CropRect;
  width: number;
  height: number;
}

const DEFAULT_VARIANT: Readonly<Record<ChannelImageKind, string>> = {
  avatar: '128',
  banner: 'desktop-1280',
};

export function defaultChannelImageVariant(kind: ChannelImageKind): string {
  return DEFAULT_VARIANT[kind];
}

/** Four squares of an avatar's one crop; a banner's three targets, each at two widths with an even height. */
export function planChannelImageVariants(crops: ChannelImageCrops): ChannelImageVariant[] {
  if (crops.kind === 'avatar') {
    return AVATAR_SIZES.map((size) => ({
      name: String(size),
      crop: crops.crop,
      width: size,
      height: size,
    }));
  }
  return BANNER_TARGETS.flatMap((target) =>
    BANNER_WIDTHS.map((width) => ({
      name: `${target}-${width}`,
      crop: crops.crops[target],
      width,
      height: Math.round(width / BANNER_ASPECTS[target] / 2) * 2,
    }))
  );
}
