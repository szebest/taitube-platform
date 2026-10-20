import { type Ref, type RefAlias, type RefKey, refAlias } from './schema/ref';
import type { Theme } from './schema/theme';
import type { TokenGroup, TokenSet, TokenValues } from './schema/token-group';

export const defineTokenSet = <G extends TokenGroup, const Id extends string>(
  group: G,
  id: Id,
  values: TokenValues<G>
): TokenSet<G, Id> => ({ group, id, values });

export const defineRef = <const R extends Ref>(ramps: R) => ({
  ramps,
  ref: (key: RefKey<R>): RefAlias => refAlias(key),
});

export const defineTheme = <const T extends Theme>(theme: T): T => theme;

type Offer = { readonly [G in TokenGroup]: readonly [TokenSet<G>, ...TokenSet<G>[]] };

type OfferedTheme<O extends Offer> = Theme & {
  readonly defaults: { readonly [G in TokenGroup]: O[G][number] };
};

export const defineAppearance = <
  const O extends Offer,
  const Themes extends readonly [OfferedTheme<O>, ...OfferedTheme<O>[]],
>(appearance: {
  readonly themes: Themes;
  readonly defaultTheme: Themes[number];
  readonly offer: O;
}) => appearance;
