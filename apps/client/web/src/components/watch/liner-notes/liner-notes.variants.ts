import { cardStyles, tv } from '@vp/ui';
import type { LinerNotesLayout } from './types';

export const linerNotesStyles = tv({
  slots: {
    root: 'group/liner flex flex-col gap-inline text-fg',
    meta: 'm-0 text-label [&_a]:text-accent-ink [&_a]:underline',
    body: 'm-0 h-[3lh] max-w-[68ch] overflow-hidden text-body break-words whitespace-pre-line transition-[height] duration-base ease-settle [interpolate-size:allow-keywords] group-data-expanded/liner:h-auto motion-reduce:transition-none [&_a]:text-accent-ink [&_a]:underline',
    toggle: 'self-start px-0',
    timecode:
      'inline cursor-pointer rounded-xs border-0 bg-transparent p-0 font-mono text-mono text-accent-ink hover:underline focus-ring',
    chapters:
      'relative -mx-inline flex gap-inline overflow-x-auto scroll-fade px-inline py-inline group-data-expanded/liner:max-medium:flex-col group-data-expanded/liner:max-medium:overflow-visible',
    chapter: 'h-auto min-h-control-sm flex-col items-start gap-1 py-1',
    chapterLabel: 'block',
    chapterTime: 'font-mono text-mono',
    chapterThumb: 'hidden h-[3.375rem] w-[6rem] rounded-thumb object-cover large:block',
  },
  variants: {
    layout: {
      card: { root: cardStyles({ variant: 'solid', size: 'md' }).root() },
      flat: {},
    } satisfies Record<LinerNotesLayout, object>,
  },
  defaultVariants: { layout: 'card' },
});
