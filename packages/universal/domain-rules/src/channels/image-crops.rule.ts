import { BANNER_ASPECTS, BANNER_TARGETS, type BannerCrops, type CropRect } from '@vp/domain';
import { type Result, all, andThen, map, ok } from '@vp/result';
import {
  type ChannelImageKind,
  type ImageDimensions,
  type ImageTooSmall,
  type InvalidCropRect,
  validateChannelImageDimensions,
  validateCropRect,
} from '@vp/validation';

export type ImageCrops =
  | { readonly kind: 'avatar'; readonly crop: CropRect }
  | { readonly kind: 'banner'; readonly crops: BannerCrops };

export type DecideImageCropsFailure = ImageTooSmall | InvalidCropRect;

type CropsOf<K extends ChannelImageKind> = Extract<ImageCrops, { kind: K }>;

/**
 * An avatar is cropped square, a banner once per target to that target's shape; every crop lies
 * inside the image the worker will read, so the job never meets a rectangle it cannot cut.
 */
export function decideImageCrops(
  crops: ImageCrops,
  image: ImageDimensions
): Result<ImageCrops, DecideImageCropsFailure> {
  return andThen(validateChannelImageDimensions(crops.kind, image), () =>
    crops.kind === 'avatar' ? avatarCrop(crops, image) : bannerCrops(crops, image)
  );
}

function avatarCrop(
  { crop }: CropsOf<'avatar'>,
  image: ImageDimensions
): Result<ImageCrops, InvalidCropRect> {
  return map(validateCropRect('crop', crop, image, 1), (checked) => ({
    kind: 'avatar' as const,
    crop: checked,
  }));
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
