import type { TokenGroup, TokenSet } from '@vp/design-tokens';

export const COMPACT = { spacing: 'compact', sizing: 'small' } as const;

export const DENSITIES = ['comfortable', 'compact'] as const;

export type Density = (typeof DENSITIES)[number];

/** Compact is compact spacing with small sizing; any other pair is the theme's own comfortable. */
export function densityOf(sets: { readonly [G in TokenGroup]: TokenSet<G> }): Density {
  return sets.spacing.id === COMPACT.spacing && sets.sizing.id === COMPACT.sizing
    ? 'compact'
    : 'comfortable';
}
