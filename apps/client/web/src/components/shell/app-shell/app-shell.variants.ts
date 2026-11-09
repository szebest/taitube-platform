import { tv } from '@vp/ui';
import type { AppShellRailState, AppShellVariant } from './types';

export const appShellStyles = tv({
  slots: {
    root: 'group/shell grid min-h-dvh grid-cols-[auto_minmax(0,1fr)] grid-rows-[auto_1fr] bg-bg font-sans text-fg',
    skipLink:
      'sr-only focus:not-sr-only focus:fixed focus:start-inline focus:top-inline focus:z-popover focus:rounded-control focus:bg-raised focus:px-inset-control focus:py-inline focus-ring',
    header:
      'sticky top-0 z-header col-span-full flex h-header items-center gap-stack border-b-divider border-transparent bg-bg/90 transition-colors duration-fast data-scrolled:border-border px-gutter-compact backdrop-blur-ambient medium:px-gutter-medium group-data-[variant=immersive]/shell:hidden',
    headerStart: 'flex shrink-0 items-center gap-inline',
    headerSearch: 'flex min-w-0 flex-1 justify-end medium:justify-center',
    searchTrigger:
      'flex size-control-md shrink-0 cursor-pointer items-center justify-center gap-inline rounded-full border-0 bg-transparent p-0 font-sans text-body text-fg transition-colors duration-fast touch-target hover:bg-tint focus-ring medium:w-full medium:max-w-[40rem] medium:shrink medium:justify-start medium:rounded-control medium:border-control medium:border-border medium:bg-surface medium:px-inset-control medium:text-fg-muted',
    searchLabel: 'sr-only medium:not-sr-only medium:truncate',
    searchHint: 'ms-auto hidden medium:inline-flex',
    headerEnd: 'flex shrink-0 items-center gap-inline',
    rail: 'group/rail sticky top-header z-rail hidden h-[calc(100dvh-var(--layout-header))] bg-bg flex-col gap-inline overflow-y-auto p-inline transition-[width,margin] duration-base ease-settle motion-reduce:transition-none medium:flex group-data-[variant=immersive]/shell:hidden',
    drawerNav: 'group/rail flex flex-col gap-inline pb-stack',
    group: 'flex flex-col gap-inline',
    groupHeading:
      'm-0 hidden px-inset-control text-label group-data-[labels=shown]/rail:block large:group-data-[state=open]/rail:block',
    groupDivider:
      'm-0 hidden border-0 border-t-divider border-border group-data-[labels=shown]/rail:block large:group-data-[state=open]/rail:block',
    list: 'm-0 flex list-none flex-col gap-inline p-0',
    item: 'flex',
    label:
      'sr-only group-data-[labels=shown]/rail:not-sr-only large:group-data-[state=open]/rail:not-sr-only',
    link: 'flex min-h-touch-target flex-1 flex-col items-center justify-center gap-inline rounded-control px-inline py-inline text-caption text-fg no-underline transition-colors hover:bg-tint focus-ring aria-[current=page]:bg-accent-soft aria-[current=page]:text-accent-ink group-data-[labels=shown]/rail:flex-row group-data-[labels=shown]/rail:justify-start group-data-[labels=shown]/rail:gap-stack group-data-[labels=shown]/rail:px-inset-control group-data-[labels=shown]/rail:text-body-sm large:group-data-[state=open]/rail:flex-row large:group-data-[state=open]/rail:justify-start large:group-data-[state=open]/rail:gap-stack large:group-data-[state=open]/rail:px-inset-control large:group-data-[state=open]/rail:text-body-sm',
    tabBar:
      'fixed inset-x-0 bottom-0 z-sticky flex h-[3.5rem] border-t-divider border-border bg-bg pb-[env(safe-area-inset-bottom)] medium:hidden group-data-[variant=immersive]/shell:hidden',
    tabLink:
      'flex min-h-touch-target flex-1 flex-col items-center justify-center gap-inline py-inline text-caption text-fg no-underline focus-ring aria-[current=page]:text-accent-ink',
    nowPlaying:
      'sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom)+var(--gap-inline))] z-sticky col-start-2 px-inline empty:hidden medium:bottom-stack medium:px-gutter-medium large:px-gutter-expanded group-data-[variant=immersive]/shell:hidden',
    main: 'col-start-2 min-w-0 px-gutter-compact pt-stack pb-[calc(3.5rem+var(--section))] outline-none medium:px-gutter-medium medium:pb-section large:px-gutter-expanded',
  },
  variants: {
    railState: {
      collapsed: { rail: 'w-rail-collapsed' },
      open: { rail: 'w-rail-collapsed large:w-rail-expanded' },
    } satisfies Record<AppShellRailState, object>,
    overlay: {
      true: {
        rail: 'w-rail-expanded me-[calc(var(--layout-rail-collapsed)-var(--layout-rail-expanded))] border-e-divider border-border bg-raised shadow-3',
      },
      false: {},
    },
    labelled: {
      true: {
        item: 'hidden group-data-[labels=shown]/rail:flex large:group-data-[state=open]/rail:flex',
      },
      false: {},
    },
    variant: {
      default: {},
      immersive: { main: 'col-start-1 col-span-full p-0' },
    } satisfies Record<AppShellVariant, object>,
  },
  defaultVariants: { railState: 'open', variant: 'default', labelled: false, overlay: false },
});
