import { tv } from '../../lib/class-names';
import type { DialogSide, DialogSize } from './types';

export const dialogStyles = tv({
  slots: {
    overlay: 'tw:fixed tw:inset-0 tw:z-overlay tw:bg-scrim tw:motion-enter tw:motion-enter-scrim',
    content:
      'tw:fixed tw:z-modal tw:flex tw:flex-col tw:gap-stack tw:border-divider tw:border-border tw:bg-raised tw:p-inset-card tw:font-sans tw:text-fg tw:shadow-3 tw:outline-none tw:motion-enter',
    header: 'tw:flex tw:flex-col tw:gap-inline tw:pe-control-md',
    title: 'tw:m-0 tw:text-title-lg',
    description: 'tw:m-0 tw:text-body-sm tw:text-fg-muted',
    body: 'tw:min-h-0 tw:flex-1 tw:overflow-y-auto',
    footer: 'tw:flex tw:flex-col-reverse tw:gap-inline tw:medium:flex-row tw:medium:justify-end',
    close: 'tw:absolute tw:end-3 tw:top-3',
  },
  variants: {
    side: {
      centred: {
        content:
          'tw:inset-0 tw:m-auto tw:h-fit tw:max-h-[calc(100dvh-2rem)] tw:w-[calc(100%-2rem)] tw:rounded-sheet',
      },
      'inline-start': {
        content:
          'tw:inset-y-0 tw:start-0 tw:w-3/4 tw:rounded-e-sheet tw:motion-enter-sheet tw:motion-from-inline-start',
      },
      'inline-end': {
        content:
          'tw:inset-y-0 tw:end-0 tw:w-3/4 tw:rounded-s-sheet tw:motion-enter-sheet tw:motion-from-inline-end',
      },
    } satisfies Record<DialogSide | 'centred', object>,
    size: {
      sm: { content: 'tw:max-w-[24rem]' },
      md: { content: 'tw:max-w-[32rem]' },
      lg: { content: 'tw:max-w-[42rem]' },
    } satisfies Record<DialogSize, object>,
  },
  defaultVariants: { side: 'centred', size: 'md' },
});
