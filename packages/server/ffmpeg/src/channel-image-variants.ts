import { assertNever } from '@kit/result';
import {
  AVATAR_SIZES,
  BANNER_ASPECTS,
  BANNER_TARGETS,
  BANNER_WIDTHS,
  type BannerCrops,
  type ChannelImageKind,
  type CropRect,
  POST_IMAGE_WIDTHS,
} from '@vp/domain';

export type ChannelImageCrops =
  | { readonly kind: 'avatar'; readonly crop: CropRect }
  | { readonly kind: 'banner'; readonly crops: BannerCrops }
  | { readonly kind: 'post-image'; readonly crop: CropRect };

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
  'post-image': '1280',
};

export function defaultChannelImageVariant(kind: ChannelImageKind): string {
  return DEFAULT_VARIANT[kind];
}

/**
 * Four squares of an avatar's one crop; a banner's three targets, each at two widths with an even
 * height; a post image at two widths keeping the shape of its crop.
 */
export function planChannelImageVariants(crops: ChannelImageCrops): ChannelImageVariant[] {
  switch (crops.kind) {
    case 'avatar':
      return AVATAR_SIZES.map((size) => ({
        name: String(size),
        crop: crops.crop,
        width: size,
        height: size,
      }));
    case 'banner':
      return BANNER_TARGETS.flatMap((target) =>
        BANNER_WIDTHS.map((width) => ({
          name: `${target}-${width}`,
          crop: crops.crops[target],
          width,
          height: evenHeight(width, BANNER_ASPECTS[target]),
        }))
      );
    case 'post-image':
      return POST_IMAGE_WIDTHS.map((width) => ({
        name: String(width),
        crop: crops.crop,
        width,
        height: evenHeight(width, crops.crop.width / crops.crop.height),
      }));
    default:
      return assertNever(crops, 'ImageCrops.kind');
  }
}

function evenHeight(width: number, aspect: number): number {
  return Math.round(width / aspect / 2) * 2;
}
