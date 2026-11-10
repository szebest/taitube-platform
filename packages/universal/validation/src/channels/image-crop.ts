import { type Result, err, ok } from '@vp/result';
import { type InvalidField, invalidField } from '../failures';
import type { ImageDimensions } from './channel-image-upload';

export interface CropRectInput {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export type InvalidCropRect = InvalidField<{ image: ImageDimensions; aspect: number | null }>;

const ASPECT_TOLERANCE = 0.02;

/**
 * A crop is whole pixels of the uploaded image and, when the target has a shape, within two
 * percent of its aspect ratio, so a rounding of the client's zoom never fails a valid crop.
 */
export function validateCropRect(
  field: string,
  rect: CropRectInput,
  image: ImageDimensions,
  aspect: number | null
): Result<CropRectInput, InvalidCropRect> {
  const { x, y, width, height } = rect;
  const whole = [x, y, width, height].every(Number.isInteger);
  const inside = x >= 0 && y >= 0 && width > 0 && height > 0;
  const within = x + width <= image.width && y + height <= image.height;
  const shaped = aspect === null || Math.abs(width / height - aspect) / aspect <= ASPECT_TOLERANCE;

  return whole && inside && within && shaped
    ? ok(rect)
    : err(invalidField(field, `The ${field} crop does not fit the image`, { image, aspect }));
}
