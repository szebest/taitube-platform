import { ErrorCodes, type InputFailure } from '@vp/errors';
import { andThen, err, map, ok, type Result } from '@vp/result';
import { ColorSchema } from '../schema/values';

export type Rgba = Readonly<{ r: number; g: number; b: number; alpha: number }>;

export type InvalidColour = InputFailure<typeof ErrorCodes.VALIDATION_FAILED, { value: string }>;

const channel = (hex: string, at: number) => Number.parseInt(hex.slice(at, at + 2), 16) / 255;

export const parseHex = (hex: string, field = 'hex'): Result<Rgba, InvalidColour> => {
  if (!ColorSchema.safeParse(hex).success) {
    return err({
      code: ErrorCodes.VALIDATION_FAILED,
      message: `${field} is not a #RRGGBB or #RRGGBBAA colour`,
      field,
      value: hex,
    });
  }
  return ok({
    r: channel(hex, 1),
    g: channel(hex, 3),
    b: channel(hex, 5),
    alpha: hex.length === 9 ? channel(hex, 7) : 1,
  });
};

export const clampUnit = (value: number) => Math.min(1, Math.max(0, value));

const toByte = (value: number) =>
  Math.round(clampUnit(value) * 255)
    .toString(16)
    .padStart(2, '0');

export const formatHex = ({ r, g, b }: Rgba) =>
  `#${toByte(r)}${toByte(g)}${toByte(b)}`.toUpperCase();

export const composite = (top: Rgba, under: Rgba): Rgba => {
  const alpha = top.alpha + under.alpha * (1 - top.alpha);
  const blend = (front: number, back: number) =>
    alpha === 0 ? 0 : (front * top.alpha + back * under.alpha * (1 - top.alpha)) / alpha;
  return {
    r: blend(top.r, under.r),
    g: blend(top.g, under.g),
    b: blend(top.b, under.b),
    alpha,
  };
};

export const overGround = <T>(
  foreground: string,
  background: string,
  paint: (foreground: Rgba, background: Rgba) => T
): Result<T, InvalidColour> =>
  andThen(parseHex(foreground, 'foreground'), (top) =>
    map(parseHex(background, 'background'), (ground) => paint(top, ground))
  );

export const compositeOver = (foreground: string, background: string) =>
  overGround(foreground, background, (top, ground) => formatHex(composite(top, ground)));

export const toLinear = (value: number) =>
  value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;

export const toGamma = (value: number) =>
  value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055;
