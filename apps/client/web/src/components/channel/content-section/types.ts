import type { ShelfRootProps } from '@kit/components';
import type { ResolvedSectionView } from '@vp/api-contracts';

type ContentSectionView = Extract<ResolvedSectionView, { kind: 'content' }>;

export type ContentSectionLayout = ContentSectionView['layout'];
export type ContentSectionDensity = ContentSectionView['presentation']['density'];
export type ContentSectionShelfVariant = NonNullable<ShelfRootProps['variant']>;
