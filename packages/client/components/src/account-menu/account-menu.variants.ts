import { tv } from '@vp/ui';

export const accountMenuStyles = tv({
  slots: {
    item: 'text-fg no-underline',
    trigger:
      'inline-flex cursor-pointer rounded-full border-0 bg-transparent p-0 transition-opacity duration-fast ease-standard hover:opacity-85 focus-ring',
  },
});
