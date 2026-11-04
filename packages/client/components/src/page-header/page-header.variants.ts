import { tv } from '@vp/ui';
import type { PageHeaderTitleStyle } from './types';

export const pageHeaderStyles = tv({
  slots: {
    root: 'grid grid-flow-dense grid-cols-1 gap-x-stack gap-y-inline py-stack font-sans text-fg medium:grid-cols-[minmax(0,1fr)_auto]',
    back: 'col-span-full text-body-sm text-fg-muted',
    title: 'm-0 text-title-lg text-balance expanded:text-headline',
    description: 'm-0 max-w-reading-max text-body text-fg-muted medium:col-start-1',
    actions:
      'flex flex-wrap items-center gap-inline medium:col-start-2 medium:row-start-auto medium:justify-end',
    tabs: 'col-span-full border-b border-border border-divider',
    sentinel: 'pointer-events-none absolute inset-x-0 -top-px h-px',
    secondary: 'hidden items-center gap-inline medium:flex',
    overflow: 'medium:hidden',
  },
  variants: {
    titleStyle: {
      headline: {},
      display: {
        title: 'large:text-display',
        description: 'font-editorial text-editorial',
      },
    } satisfies Record<PageHeaderTitleStyle, object>,
    sticky: {
      true: {
        root: 'sticky top-header z-sticky border-b-divider border-transparent bg-bg transition-colors duration-fast ease-standard data-stuck:border-border',
      },
      false: {},
    },
  },
  defaultVariants: { titleStyle: 'headline', sticky: false },
});
