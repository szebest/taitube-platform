import { tv } from '@vp/ui';
import type { EmptyStateSize, EmptyStateTitleStyle } from './types';

export const emptyStateStyles = tv({
  slots: {
    root: 'flex flex-wrap items-center gap-x-stack gap-y-inline font-sans text-fg',
    illustration: 'flex basis-full justify-center text-accent *:block *:h-auto',
    title: 'm-0 basis-full',
    description: 'm-0 box-border basis-full text-body text-fg-muted',
    secondary: 'text-body text-accent-ink underline',
  },
  variants: {
    size: {
      page: {
        root: 'justify-center py-section text-center',
        illustration: '*:w-[11.25rem]',
        description: 'px-[max(0px,calc(50%-16.25rem))]',
      },
      section: {
        root: 'justify-center p-inset-card text-center',
        illustration: '*:w-[7.5rem]',
        description: 'px-[max(0px,calc(50%-16.25rem))]',
      },
      inline: { root: 'justify-start text-start', illustration: 'hidden' },
    } satisfies Record<EmptyStateSize, object>,
    titleStyle: {
      'title-lg': { title: 'text-title-lg' },
      editorial: { title: 'font-editorial text-editorial' },
    } satisfies Record<EmptyStateTitleStyle, object>,
  },
  compoundVariants: [{ size: 'inline', class: { title: 'text-body' } }],
  defaultVariants: { size: 'page', titleStyle: 'title-lg' },
});
