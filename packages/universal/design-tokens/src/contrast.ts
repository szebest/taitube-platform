import { unwrapOr } from '@vp/result';
import { composite, overGround, type Rgba, toLinear } from './color/rgb';

export type ContrastPair = Readonly<{ foreground: string; background: string; floor: number }>;

export type ContrastFailure<Pair extends ContrastPair> = Pair & Readonly<{ ratio: number }>;

const relativeLuminance = ({ r, g, b }: Rgba) =>
  0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

const ratioBetween = (first: Rgba, second: Rgba) => {
  const luminances = [relativeLuminance(first), relativeLuminance(second)];
  return (Math.max(...luminances) + 0.05) / (Math.min(...luminances) + 0.05);
};

export const contrastRatio = (foreground: string, background: string) =>
  unwrapOr(
    overGround(foreground, background, (top, ground) =>
      ratioBetween(composite(top, ground), ground)
    ),
    NaN
  );

export const checkContrast = <Pair extends ContrastPair>(pairs: readonly Pair[]) =>
  pairs
    .map(
      (pair): ContrastFailure<Pair> => ({
        ...pair,
        ratio: contrastRatio(pair.foreground, pair.background),
      })
    )
    // Not `ratio < floor`: an unmeasurable pair's NaN ratio has to fail.
    .filter(({ ratio, floor }) => !(ratio >= floor));
