import { tv } from '@vp/ui';
import type { InspectorSide } from './types';

export const studioWorkspaceStyles = tv({
  slots: {
    root: 'group/workspace grid min-h-dvh grid-rows-[auto_1fr] bg-bg font-sans text-fg',
    skipLink:
      'sr-only focus:not-sr-only focus:fixed focus:start-inline focus:top-inline focus:z-popover focus:rounded-control focus:bg-raised focus:px-inset-control focus:py-inline focus-ring',
    nav: 'group/nav sticky top-0 z-rail col-start-1 row-span-2 row-start-1 hidden h-dvh w-rail-collapsed flex-col gap-inline overflow-y-auto border-e-divider border-border p-inline transition-[inline-size] duration-base ease-settle motion-reduce:transition-none medium:flex large:w-rail-expanded',
    drawerNav: 'group/nav flex flex-col gap-inline pb-stack',
    navItem:
      'flex min-h-touch-target items-center justify-center gap-stack rounded-control px-inline text-body-sm text-fg no-underline transition-colors duration-fast ease-standard hover:bg-tint focus-ring aria-[current=page]:bg-accent-soft aria-[current=page]:text-accent-ink large:justify-start large:px-inset-control group-data-[surface=drawer]/nav:justify-start group-data-[surface=drawer]/nav:px-inset-control',
    navLabel: 'sr-only large:not-sr-only group-data-[surface=drawer]/nav:not-sr-only truncate',
    toolbar:
      'sticky top-0 z-sticky row-start-1 flex h-header min-w-0 items-center gap-inline border-b-divider border-border bg-bg px-gutter-compact medium:px-gutter-medium',
    menu: 'medium:hidden',
    toolbarItems: 'flex min-w-0 flex-1 items-center gap-inline',
    progress: 'absolute inset-x-0 bottom-0 h-[var(--border-focus)] rounded-none',
    content:
      'row-start-2 min-w-0 px-gutter-compact py-stack outline-none medium:px-gutter-medium large:px-gutter-expanded',
    inspector:
      'sticky top-0 row-span-2 row-start-1 flex h-dvh w-[20rem] flex-col gap-stack overflow-y-auto border-border p-inset-card outline-none',
    inspectorTitle: 'm-0 text-title',
    inspectorEmpty: 'm-0 text-body-sm text-fg-muted',
    overlay: 'max-w-[20rem]',
  },
  variants: {
    inspectorSide: {
      'inline-end': {
        root: 'grid-cols-[auto_minmax(0,1fr)_auto]',
        toolbar: 'col-start-2',
        content: 'col-start-2',
        inspector: 'col-start-3 border-s-divider',
      },
      'inline-start': {
        root: 'grid-cols-[auto_auto_minmax(0,1fr)]',
        toolbar: 'col-start-3',
        content: 'col-start-3',
        inspector: 'col-start-2 border-e-divider',
      },
    } satisfies Record<InspectorSide, object>,
  },
  defaultVariants: { inspectorSide: 'inline-end' },
});
