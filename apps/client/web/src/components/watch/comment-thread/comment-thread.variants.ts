import { tv } from '@vp/ui';
import type { CommentThreadLayout } from './types';

export const commentThreadStyles = tv({
  slots: {
    root: 'tw:flex tw:flex-col tw:gap-section tw:text-fg',
    header:
      'tw:flex tw:flex-col tw:items-start tw:gap-stack tw:medium:flex-row tw:medium:items-center tw:medium:justify-between',
    heading: 'tw:m-0 tw:text-title-lg',
    composer: 'tw:grid tw:grid-cols-[auto_minmax(0,1fr)] tw:gap-x-stack tw:gap-y-inline',
    composerAvatar: 'tw:max-medium:size-avatar-md',
    composerField: 'tw:col-start-2 tw:max-w-reading-max',
    composerError:
      'tw:col-start-2 tw:m-0 tw:flex tw:items-center tw:gap-inline tw:text-body-sm tw:text-danger-ink',
    composerActions:
      'tw:col-start-2 tw:flex tw:justify-end tw:gap-inline tw:max-medium:*:flex-1 tw:motion-safe:animate-fade-in',
    list: 'tw:m-0 tw:flex tw:list-none tw:flex-col tw:gap-section tw:p-0 tw:transition-opacity tw:duration-fast tw:ease-standard',
    item: 'tw:motion-safe:has-data-[state=pending]:animate-fade-in',
    more: 'tw:self-center',
  },
  variants: {
    layout: {
      inline: {},
      sheet: {
        root: 'tw:h-full tw:min-h-0 tw:gap-stack',
        list: 'tw:min-h-0 tw:flex-1 tw:overflow-y-auto tw:overscroll-contain',
        composer: 'tw:sticky tw:bottom-0 tw:bg-raised tw:py-inline',
      },
    } satisfies Record<CommentThreadLayout, object>,
  },
  defaultVariants: { layout: 'inline' },
});
