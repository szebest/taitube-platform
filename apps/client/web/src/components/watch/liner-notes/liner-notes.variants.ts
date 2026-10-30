import { cardStyles, tv } from '@vp/ui';
import type { LinerNotesLayout } from './types';

export const linerNotesStyles = tv({
  slots: {
    root: 'tw:group/liner tw:flex tw:flex-col tw:gap-inline tw:text-fg',
    meta: 'tw:m-0 tw:text-label tw:[&_a]:text-accent-ink tw:[&_a]:underline',
    body: 'tw:m-0 tw:h-[3lh] tw:max-w-[68ch] tw:overflow-hidden tw:text-body tw:break-words tw:whitespace-pre-line tw:transition-[height] tw:duration-base tw:ease-settle tw:[interpolate-size:allow-keywords] tw:group-data-expanded/liner:h-auto tw:motion-reduce:transition-none tw:[&_a]:text-accent-ink tw:[&_a]:underline',
    toggle: 'tw:self-start tw:px-0',
    timecode:
      'tw:inline tw:cursor-pointer tw:rounded-xs tw:border-0 tw:bg-transparent tw:p-0 tw:font-mono tw:text-mono tw:text-accent-ink tw:hover:underline tw:focus-ring',
    chapters:
      'tw:relative tw:-mx-inline tw:flex tw:gap-inline tw:overflow-x-auto tw:scroll-fade tw:px-inline tw:py-inline tw:group-data-expanded/liner:max-medium:flex-col tw:group-data-expanded/liner:max-medium:overflow-visible',
    chapter: 'tw:h-auto tw:min-h-control-sm tw:flex-col tw:items-start tw:gap-1 tw:py-1',
    chapterLabel: 'tw:block',
    chapterTime: 'tw:font-mono tw:text-mono',
    chapterThumb:
      'tw:hidden tw:h-[3.375rem] tw:w-[6rem] tw:rounded-thumb tw:object-cover tw:large:block',
  },
  variants: {
    layout: {
      card: { root: cardStyles({ variant: 'solid', size: 'md' }).root() },
      flat: {},
    } satisfies Record<LinerNotesLayout, object>,
  },
  defaultVariants: { layout: 'card' },
});
