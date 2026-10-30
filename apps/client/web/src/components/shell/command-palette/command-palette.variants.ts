import { tv } from '@vp/ui';
import type { CommandPaletteVariant } from './types';

export const commandPaletteStyles = tv({
  slots: {
    content: 'tw:gap-0 tw:overflow-hidden tw:p-0 tw:[&>[data-slot=icon-button]]:hidden',
    command: 'tw:min-h-0 tw:flex-1 tw:rounded-none tw:border-0 tw:bg-transparent tw:shadow-none',
    inputRow:
      'tw:flex tw:items-center tw:gap-inline tw:border-b-divider tw:border-border tw:pe-inset-control tw:*:first:min-w-0 tw:*:first:flex-1 tw:*:first:border-0',
    loading: 'tw:h-[0.125rem] tw:shrink-0 tw:rounded-none',
    list: 'tw:min-h-0 tw:flex-1',
    item: 'tw:h-auto tw:gap-stack tw:py-inline tw:text-body tw:no-underline tw:data-[selected=true]:bg-accent-soft tw:data-[selected=true]:text-accent-ink tw:[&_mark]:bg-transparent tw:[&_mark]:font-(weight:--type-title-weight) tw:[&_mark]:text-current',
    leading:
      'tw:flex tw:size-control-md tw:shrink-0 tw:items-center tw:justify-center tw:overflow-hidden tw:rounded-sm tw:bg-tint tw:*:size-full tw:*:object-cover',
    text: 'tw:min-w-0 tw:flex-1 tw:truncate',
    end: 'tw:ms-auto tw:flex tw:shrink-0 tw:items-center tw:gap-inline',
    meta: 'tw:hidden tw:text-body-sm tw:text-fg-muted tw:large:inline',
    notice:
      'tw:flex tw:items-center tw:gap-inline tw:border-b-divider tw:border-border tw:px-inset-control tw:py-inline tw:text-body-sm tw:text-fg-muted',
    footer:
      'tw:flex tw:items-center tw:gap-stack tw:border-t-divider tw:border-border tw:px-inset-control tw:py-inline tw:text-caption tw:text-fg-muted',
    hint: 'tw:flex tw:items-center tw:gap-inline',
  },
  variants: {
    variant: {
      dialog: {
        content:
          'tw:mt-[12vh] tw:max-h-[min(36rem,76dvh)] tw:max-w-[35rem] tw:expanded:max-w-[40rem]',
        list: 'tw:max-h-[min(28rem,56dvh)]',
        item: 'tw:min-h-control-lg',
      },
      sheet: {
        content:
          'tw:m-0 tw:h-dvh tw:max-h-none tw:w-full tw:max-w-none tw:rounded-none tw:border-0',
        list: 'tw:max-h-none',
        item: 'tw:min-h-[3.5rem]',
        hint: 'tw:hidden',
      },
    } satisfies Record<CommandPaletteVariant, object>,
  },
  defaultVariants: { variant: 'dialog' },
});
