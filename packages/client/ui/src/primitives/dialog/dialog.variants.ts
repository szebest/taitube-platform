import { tv } from '../../lib/class-names';
import type { DialogSide, DialogSize } from './types';

export const dialogStyles = tv({
  slots: {
    overlay: 'fixed inset-0 z-overlay bg-scrim motion-enter motion-enter-scrim',
    content:
      'fixed z-modal flex flex-col gap-stack border-divider border-border bg-raised p-inset-card font-sans text-fg shadow-3 outline-none motion-enter',
    header: 'flex flex-col gap-inline pe-control-md',
    title: 'm-0 text-title-lg',
    description: 'm-0 text-body-sm text-fg-muted',
    body: 'min-h-0 flex-1 overflow-y-auto',
    footer: 'flex flex-col-reverse gap-inline medium:flex-row medium:justify-end',
    close: 'absolute end-3 top-3',
  },
  variants: {
    side: {
      centred: {
        content:
          'inset-0 m-auto h-fit max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] rounded-sheet',
      },
      'inline-start': {
        content:
          'inset-y-0 start-0 w-3/4 rounded-e-sheet motion-enter-sheet motion-from-inline-start',
      },
      'inline-end': {
        content:
          'inset-y-0 end-0 w-3/4 rounded-s-sheet motion-enter-sheet motion-from-inline-end',
      },
    } satisfies Record<DialogSide | 'centred', object>,
    size: {
      sm: { content: 'max-w-[24rem]' },
      md: { content: 'max-w-[32rem]' },
      lg: { content: 'max-w-[42rem]' },
    } satisfies Record<DialogSize, object>,
  },
  defaultVariants: { side: 'centred', size: 'md' },
});
