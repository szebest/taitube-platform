import { type Rgba, toGamma, toLinear } from './rgb';

export type Oklch = Readonly<{ l: number; c: number; h: number }>;

type Triple = readonly [number, number, number];

type Matrix = readonly [Triple, Triple, Triple];

const dot = ([a, b, c]: Triple, [x, y, z]: Triple) => a * x + b * y + c * z;

const multiply = ([first, second, third]: Matrix, vector: Triple): Triple => [
  dot(first, vector),
  dot(second, vector),
  dot(third, vector),
];

const each = ([x, y, z]: Triple, map: (value: number) => number): Triple => [map(x), map(y), map(z)];

const LINEAR_SRGB_TO_LMS: Matrix = [
  [0.4122214708, 0.5363325363, 0.0514459929],
  [0.2119034982, 0.6806995451, 0.1073969566],
  [0.0883024619, 0.2817188376, 0.6299787005],
];

const LMS_TO_OKLAB: Matrix = [
  [0.2104542553, 0.793617785, -0.0040720468],
  [1.9779984951, -2.428592205, 0.4505937099],
  [0.0259040371, 0.7827717662, -0.808675766],
];

const OKLAB_TO_LMS: Matrix = [
  [1, 0.3963377774, 0.2158037573],
  [1, -0.1055613458, -0.0638541728],
  [1, -0.0894841775, -1.291485548],
];

const LMS_TO_LINEAR_SRGB: Matrix = [
  [4.0767416621, -3.3077115913, 0.2309699292],
  [-1.2684380046, 2.6097574011, -0.3413193965],
  [-0.0041960863, -0.7034186147, 1.707614701],
];

const DEGREES = 180 / Math.PI;

export const toOklch = ({ r, g, b }: Rgba): Oklch => {
  const lms = multiply(LINEAR_SRGB_TO_LMS, each([r, g, b], toLinear));
  const [l, a, bAxis] = multiply(LMS_TO_OKLAB, each(lms, Math.cbrt));
  return { l, c: Math.hypot(a, bAxis), h: (Math.atan2(bAxis, a) * DEGREES + 360) % 360 };
};

const toLinearSrgb = ({ l, c, h }: Oklch) => {
  const lab: Triple = [l, c * Math.cos(h / DEGREES), c * Math.sin(h / DEGREES)];
  return multiply(LMS_TO_LINEAR_SRGB, each(multiply(OKLAB_TO_LMS, lab), (value) => value ** 3));
};

const GAMUT_EPSILON = 1e-6;

const inGamut = (color: Oklch) =>
  toLinearSrgb(color).every((value) => value >= -GAMUT_EPSILON && value <= 1 + GAMUT_EPSILON);

const CHROMA_STEPS = 24;

const clipChroma = (color: Oklch): Oklch => {
  if (inGamut(color)) {
    return color;
  }
  let low = 0;
  let high = color.c;
  for (let step = 0; step < CHROMA_STEPS; step++) {
    const middle = (low + high) / 2;
    if (inGamut({ ...color, c: middle })) {
      low = middle;
    } else {
      high = middle;
    }
  }
  return { ...color, c: low };
};

const clamp = (value: number) => Math.min(1, Math.max(0, value));

export const fromOklch = (color: Oklch): Rgba => {
  const linear = toLinearSrgb(clipChroma({ ...color, l: clamp(color.l) }));
  const [r, g, b] = each(linear, (value) => toGamma(clamp(value)));
  return { r, g, b, alpha: 1 };
};
