import { tv } from '@vp/ui';
import type { InspectorSide } from './types';

export const studioWorkspaceStyles = tv({
  slots: {
    root: 'tw:group/workspace tw:grid tw:min-h-dvh tw:grid-rows-[auto_1fr] tw:bg-bg tw:font-sans tw:text-fg',
    skipLink:
      'tw:sr-only tw:focus:not-sr-only tw:focus:fixed tw:focus:start-inline tw:focus:top-inline tw:focus:z-popover tw:focus:rounded-control tw:focus:bg-raised tw:focus:px-inset-control tw:focus:py-inline tw:focus-ring',
    nav: 'tw:group/nav tw:sticky tw:top-0 tw:z-rail tw:col-start-1 tw:row-span-2 tw:row-start-1 tw:hidden tw:h-dvh tw:w-rail-collapsed tw:flex-col tw:gap-inline tw:overflow-y-auto tw:border-e-divider tw:border-border tw:p-inline tw:transition-[inline-size] tw:duration-base tw:ease-settle tw:motion-reduce:transition-none tw:medium:flex tw:large:w-rail-expanded',
    drawerNav: 'tw:group/nav tw:flex tw:flex-col tw:gap-inline tw:pb-stack',
    navItem:
      'tw:flex tw:min-h-touch-target tw:items-center tw:justify-center tw:gap-stack tw:rounded-control tw:px-inline tw:text-body-sm tw:text-fg tw:no-underline tw:transition-colors tw:duration-fast tw:ease-standard tw:hover:bg-tint tw:focus-ring tw:aria-[current=page]:bg-accent-soft tw:aria-[current=page]:text-accent-ink tw:large:justify-start tw:large:px-inset-control tw:group-data-[surface=drawer]/nav:justify-start tw:group-data-[surface=drawer]/nav:px-inset-control',
    navLabel:
      'tw:sr-only tw:large:not-sr-only tw:group-data-[surface=drawer]/nav:not-sr-only tw:truncate',
    toolbar:
      'tw:sticky tw:top-0 tw:z-sticky tw:row-start-1 tw:flex tw:h-header tw:min-w-0 tw:items-center tw:gap-inline tw:border-b-divider tw:border-border tw:bg-bg tw:px-gutter-compact tw:medium:px-gutter-medium',
    menu: 'tw:medium:hidden',
    toolbarItems: 'tw:flex tw:min-w-0 tw:flex-1 tw:items-center tw:gap-inline',
    progress: 'tw:absolute tw:inset-x-0 tw:bottom-0 tw:h-[var(--border-focus)] tw:rounded-none',
    content:
      'tw:row-start-2 tw:min-w-0 tw:px-gutter-compact tw:py-stack tw:outline-none tw:medium:px-gutter-medium tw:large:px-gutter-expanded',
    inspector:
      'tw:sticky tw:top-0 tw:row-span-2 tw:row-start-1 tw:flex tw:h-dvh tw:w-[20rem] tw:flex-col tw:gap-stack tw:overflow-y-auto tw:border-border tw:p-inset-card tw:outline-none',
    inspectorTitle: 'tw:m-0 tw:text-title',
    inspectorEmpty: 'tw:m-0 tw:text-body-sm tw:text-fg-muted',
    overlay: 'tw:max-w-[20rem]',
  },
  variants: {
    inspectorSide: {
      'inline-end': {
        root: 'tw:grid-cols-[auto_minmax(0,1fr)_auto]',
        toolbar: 'tw:col-start-2',
        content: 'tw:col-start-2',
        inspector: 'tw:col-start-3 tw:border-s-divider',
      },
      'inline-start': {
        root: 'tw:grid-cols-[auto_auto_minmax(0,1fr)]',
        toolbar: 'tw:col-start-3',
        content: 'tw:col-start-3',
        inspector: 'tw:col-start-2 tw:border-e-divider',
      },
    } satisfies Record<InspectorSide, object>,
  },
  defaultVariants: { inspectorSide: 'inline-end' },
});
