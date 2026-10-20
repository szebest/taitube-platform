import { ErrorCodes, type InputFailure } from '@vp/errors';
import { andThen, err, map, ok, type Result } from '@vp/result';
import { ColorSchema } from '../schema/values';

export type Rgba = Readonly<{ r: number; g: number; b: number; alpha: number }>;

export type InvalidColour = InputFailure<typeof ErrorCodes.VALIDATION_FAILED, { value: string }>;

const channel = (hex: string, at: number) => Number.parseInt(hex.slice(at, at + 2), 16) / 255;

const invalidColour = (field: string, value: string, message: string): InvalidColour => ({
  code: ErrorCodes.VALIDATION_FAILED,
  message,
  field,
  value,
});

const parseHex = (hex: string, field = 'hex'): Result<Rgba, InvalidColour> =>
  ColorSchema.safeParse(hex).success
    ? ok({
        r: channel(hex, 1),
        g: channel(hex, 3),
        b: channel(hex, 5),
        alpha: hex.length === 9 ? channel(hex, 7) : 1,
      })
    : err(invalidColour(field, hex, `${field} is not a #RRGGBB or #RRGGBBAA colour`));

export const parseGround = (hex: string, field = 'ground') =>
  andThen(parseHex(hex, field), (ground) =>
    ground.alpha === 1
      ? ok(ground)
      : err(invalidColour(field, hex, `${field} is translucent, composite it over a ground first`))
  );

export const clampUnit = (value: number) => Math.min(1, Math.max(0, value));

const OPAQUE_BYTE = 255;

const toByte = (value: number) => Math.round(clampUnit(value) * OPAQUE_BYTE);

export const snapToBytes = ({ r, g, b, alpha }: Rgba): Rgba => ({
  r: toByte(r) / OPAQUE_BYTE,
  g: toByte(g) / OPAQUE_BYTE,
  b: toByte(b) / OPAQUE_BYTE,
  alpha: toByte(alpha) / OPAQUE_BYTE,
});

export const formatHex = ({ r, g, b, alpha }: Rgba) => {
  const bytes = toByte(alpha) === OPAQUE_BYTE ? [r, g, b] : [r, g, b, alpha];
  const digits = bytes.map((value) => toByte(value).toString(16).padStart(2, '0'));
  return `#${digits.join('')}`.toUpperCase();
};

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
    map(parseGround(background, 'background'), (ground) => paint(top, ground))
  );

export const compositeOver = (foreground: string, background: string) =>
  overGround(foreground, background, (top, ground) => formatHex(composite(top, ground)));

export const toLinear = (value: number) =>
  value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;

export const toGamma = (value: number) =>
  value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055;
