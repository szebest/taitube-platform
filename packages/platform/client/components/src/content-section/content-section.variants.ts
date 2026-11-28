import { tv } from '@kit/ui';
import type { ContentSectionDensity, ContentSectionLayout } from './types';

export const GRID_COLUMN_CLASSES: Readonly<Record<number, string>> = {
  2: 'grid-cols-1 medium:grid-cols-2',
  3: 'grid-cols-1 medium:grid-cols-2 expanded:grid-cols-3',
  4: 'grid-cols-1 medium:grid-cols-2 expanded:grid-cols-4',
  5: 'grid-cols-2 medium:grid-cols-3 expanded:grid-cols-5',
  6: 'grid-cols-2 medium:grid-cols-3 expanded:grid-cols-6',
};

export const contentSectionStyles = tv({
  slots: {
    list: 'm-0 min-w-0 list-none p-0',
    item: 'min-w-0',
  },
  variants: {
    layout: {
      shelf: {},
      grid: { list: 'grid' },
      list: { list: 'flex flex-col' },
      hero: { list: 'grid grid-cols-1' },
      masonry: {
        list: 'columns-1 medium:columns-2 expanded:columns-3',
        item: 'break-inside-avoid',
      },
    } satisfies Record<ContentSectionLayout['type'], object>,
    density: {
      compact: { list: 'gap-inline' },
      comfortable: { list: 'gap-stack' },
    } satisfies Record<ContentSectionDensity, object>,
  },
  compoundVariants: [
    { layout: 'masonry', density: 'compact', item: 'mb-inline' },
    { layout: 'masonry', density: 'comfortable', item: 'mb-stack' },
  ],
});
