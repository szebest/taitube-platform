import { tv } from '@vp/ui';
import type { CommandPaletteVariant } from './types';

export const commandPaletteStyles = tv({
  slots: {
    content: 'gap-0 overflow-hidden p-0 [&>[data-slot=icon-button]]:hidden',
    command: 'min-h-0 flex-1 rounded-none border-0 bg-transparent shadow-none',
    inputRow:
      'flex items-center gap-inline border-b-divider border-border pe-inset-control *:first:min-w-0 *:first:flex-1 *:first:border-0',
    loading: 'h-[0.125rem] shrink-0 rounded-none',
    list: 'min-h-0 flex-1',
    item: 'h-auto gap-stack py-inline text-body no-underline data-[selected=true]:bg-accent-soft data-[selected=true]:text-accent-ink [&_mark]:bg-transparent [&_mark]:font-(weight:--type-title-weight) [&_mark]:text-current',
    leading:
      'flex size-control-md shrink-0 items-center justify-center overflow-hidden rounded-sm bg-tint *:size-full *:object-cover',
    text: 'min-w-0 flex-1 truncate',
    end: 'ms-auto flex shrink-0 items-center gap-inline',
    meta: 'hidden text-body-sm text-fg-muted large:inline',
    notice:
      'flex items-center gap-inline border-b-divider border-border px-inset-control py-inline text-body-sm text-fg-muted',
    footer:
      'flex items-center gap-stack border-t-divider border-border px-inset-control py-inline text-caption text-fg-muted',
    hint: 'flex items-center gap-inline',
  },
  variants: {
    variant: {
      dialog: {
        content: 'mt-[12vh] max-h-[min(36rem,76dvh)] max-w-[35rem] expanded:max-w-[40rem]',
        list: 'max-h-[min(28rem,56dvh)]',
        item: 'min-h-control-lg',
      },
      sheet: {
        content: 'm-0 h-dvh max-h-none w-full max-w-none rounded-none border-0',
        list: 'max-h-none',
        item: 'min-h-[3.5rem]',
        hint: 'hidden',
      },
    } satisfies Record<CommandPaletteVariant, object>,
  },
  defaultVariants: { variant: 'dialog' },
});
