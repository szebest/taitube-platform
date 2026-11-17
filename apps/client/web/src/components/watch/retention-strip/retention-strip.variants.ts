import { tv } from '@vp/ui';

export const retentionStripStyles = tv({
  slots: {
    root: 'relative h-12 w-full pt-3',
    bars: 'flex h-full items-end gap-px',
    bar: 'min-h-px flex-1 rounded-t-xs opacity-80',
    marker:
      'absolute top-0 -translate-x-1/2 rtl:translate-x-1/2 min-h-0 min-w-0 size-4 p-0 [@media(pointer:coarse)]:size-6',
  },
});
