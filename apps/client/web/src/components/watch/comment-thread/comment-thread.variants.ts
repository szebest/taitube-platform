import { tv } from '@vp/ui';
import type { CommentThreadLayout } from './types';

export const commentThreadStyles = tv({
  slots: {
    root: 'flex flex-col gap-section text-fg',
    header:
      'flex flex-col items-start gap-stack medium:flex-row medium:items-center medium:justify-between',
    heading: 'm-0 text-title-lg',
    composer: 'grid grid-cols-[auto_minmax(0,1fr)] gap-x-stack gap-y-inline',
    composerAvatar: 'max-medium:size-avatar-md',
    composerField: 'col-start-2 max-w-reading-max',
    composerError:
      'col-start-2 m-0 flex items-center gap-inline text-body-sm text-danger-ink',
    composerActions:
      'col-start-2 flex justify-end gap-inline max-medium:*:flex-1 motion-safe:animate-fade-in',
    list: 'm-0 flex list-none flex-col gap-section p-0 transition-opacity duration-fast ease-standard',
    item: 'motion-safe:has-data-[state=pending]:animate-fade-in',
    more: 'self-center',
  },
  variants: {
    layout: {
      inline: {},
      sheet: {
        root: 'h-full min-h-0 gap-stack',
        list: 'min-h-0 flex-1 overflow-y-auto overscroll-contain',
        composer: 'sticky bottom-0 bg-raised py-inline',
      },
    } satisfies Record<CommentThreadLayout, object>,
  },
  defaultVariants: { layout: 'inline' },
});
