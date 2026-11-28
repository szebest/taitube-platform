import type { ShelfRootProps } from '../shelf';

export type ContentSectionLayout =
  | { readonly type: 'shelf' | 'list' | 'hero' | 'masonry' }
  | { readonly type: 'grid'; readonly columns: number };

export type ContentSectionDensity = 'compact' | 'comfortable';

export type ContentSectionShelfVariant = NonNullable<ShelfRootProps['variant']>;
