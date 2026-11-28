import { type Result, all, andThen, assertNever, map, ok } from '@kit/result';
import {
  BANNER_ASPECTS,
  BANNER_TARGETS,
  type BannerCrops,
  type ImageCrops,
  PLAYLIST_COVER_ASPECT,
} from '@vp/domain';
import {
  type ChannelImageKind,
  type ImageDimensions,
  type ImageTooSmall,
  type InvalidCropRect,
  validateChannelImageDimensions,
  validateCropRect,
} from '@vp/validation';

export type DecideImageCropsFailure = ImageTooSmall | InvalidCropRect;

type CropsOf<K extends ChannelImageKind> = Extract<ImageCrops, { kind: K }>;

/**
 * An avatar is cropped square, a banner once per target to that target's shape, a playlist cover
 * to a thumbnail's, a post image or a page image not at all: the crop is the whole image. Every crop lies inside
 * the image the worker will read, so the job never meets a rectangle it cannot cut.
 */
export function decideImageCrops(
  crops: ImageCrops,
  image: ImageDimensions
): Result<ImageCrops, DecideImageCropsFailure> {
  return andThen(validateChannelImageDimensions(crops.kind, image), () => {
    switch (crops.kind) {
      case 'avatar':
        return singleCrop(crops, image, 1);
      case 'banner':
        return bannerCrops(crops, image);
      case 'playlist-cover':
        return singleCrop(crops, image, PLAYLIST_COVER_ASPECT);
      case 'post-image':
      case 'page-image':
        return ok({ kind: crops.kind, crop: { x: 0, y: 0, ...image } });
      default:
        return assertNever(crops, 'ImageCrops');
    }
  });
}

function singleCrop(
  { kind, crop }: CropsOf<'avatar' | 'playlist-cover'>,
  image: ImageDimensions,
  aspect: number
): Result<ImageCrops, InvalidCropRect> {
  return map(validateCropRect('crop', crop, image, aspect), (checked) => ({ kind, crop: checked }));
}

function bannerCrops(
  { crops }: CropsOf<'banner'>,
  image: ImageDimensions
): Result<ImageCrops, InvalidCropRect> {
  const checked = all(
    BANNER_TARGETS.map((target) =>
      map(
        validateCropRect(`crops.${target}`, crops[target], image, BANNER_ASPECTS[target]),
        (rect) => [target, rect] as const
      )
    )
  );
  return map(checked, (entries) => ({
    kind: 'banner' as const,
    crops: Object.fromEntries(entries) as BannerCrops,
  }));
}
