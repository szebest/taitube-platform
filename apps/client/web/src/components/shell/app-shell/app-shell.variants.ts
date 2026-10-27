import { tv } from '@vp/ui';
import type { AppShellRailState, AppShellVariant } from './types';

export const appShellStyles = tv({
  slots: {
    root: 'tw:group/shell tw:grid tw:min-h-dvh tw:grid-cols-[auto_minmax(0,1fr)] tw:grid-rows-[auto_1fr] tw:bg-bg tw:font-sans tw:text-fg',
    skipLink:
      'tw:sr-only tw:focus:not-sr-only tw:focus:fixed tw:focus:start-inline tw:focus:top-inline tw:focus:z-popover tw:focus:rounded-control tw:focus:bg-raised tw:focus:px-inset-control tw:focus:py-inline tw:focus-ring',
    header:
      'tw:sticky tw:top-0 tw:z-sticky tw:col-span-full tw:flex tw:h-header tw:items-center tw:gap-stack tw:border-b-divider tw:border-transparent tw:bg-bg/90 tw:transition-colors tw:duration-fast tw:data-scrolled:border-border tw:px-gutter-compact tw:backdrop-blur-ambient tw:medium:px-gutter-medium tw:group-data-[variant=immersive]/shell:hidden',
    headerStart: 'tw:flex tw:shrink-0 tw:items-center tw:gap-inline',
    headerSearch: 'tw:flex tw:min-w-0 tw:flex-1 tw:justify-end tw:medium:justify-center',
    searchTrigger:
      'tw:flex tw:size-control-md tw:shrink-0 tw:cursor-pointer tw:items-center tw:justify-center tw:gap-inline tw:rounded-full tw:border-0 tw:bg-transparent tw:p-0 tw:font-sans tw:text-body tw:text-fg tw:transition-colors tw:duration-fast tw:touch-target tw:hover:bg-tint tw:focus-ring tw:medium:w-full tw:medium:max-w-[40rem] tw:medium:shrink tw:medium:justify-start tw:medium:rounded-control tw:medium:border-control tw:medium:border-border tw:medium:bg-surface tw:medium:px-inset-control tw:medium:text-fg-muted',
    searchLabel: 'tw:sr-only tw:medium:not-sr-only tw:medium:truncate',
    searchHint: 'tw:ms-auto tw:hidden tw:medium:inline-flex',
    headerEnd: 'tw:flex tw:shrink-0 tw:items-center tw:gap-inline',
    rail: 'tw:group/rail tw:sticky tw:top-header tw:z-rail tw:hidden tw:h-[calc(100dvh-var(--spacing-header))] tw:flex-col tw:gap-inline tw:overflow-y-auto tw:p-inline tw:transition-[width,margin] tw:duration-base tw:ease-settle tw:motion-reduce:transition-none tw:medium:flex tw:group-data-[variant=immersive]/shell:hidden',
    drawerNav: 'tw:group/rail tw:flex tw:flex-col tw:gap-inline tw:pb-stack',
    group: 'tw:flex tw:flex-col tw:gap-inline',
    groupHeading:
      'tw:m-0 tw:hidden tw:px-inset-control tw:text-label tw:group-data-[labels=shown]/rail:block tw:large:group-data-[state=open]/rail:block',
    groupDivider:
      'tw:m-0 tw:hidden tw:border-0 tw:border-t-divider tw:border-border tw:group-data-[labels=shown]/rail:block tw:large:group-data-[state=open]/rail:block',
    list: 'tw:m-0 tw:flex tw:list-none tw:flex-col tw:gap-inline tw:p-0',
    item: 'tw:flex',
    label:
      'tw:sr-only tw:group-data-[labels=shown]/rail:not-sr-only tw:large:group-data-[state=open]/rail:not-sr-only',
    link: 'tw:flex tw:min-h-touch-target tw:flex-1 tw:flex-col tw:items-center tw:justify-center tw:gap-inline tw:rounded-control tw:px-inline tw:py-inline tw:text-caption tw:text-fg tw:no-underline tw:transition-colors tw:hover:bg-tint tw:focus-ring tw:aria-[current=page]:bg-accent-soft tw:aria-[current=page]:text-accent-ink tw:group-data-[labels=shown]/rail:flex-row tw:group-data-[labels=shown]/rail:justify-start tw:group-data-[labels=shown]/rail:gap-stack tw:group-data-[labels=shown]/rail:px-inset-control tw:group-data-[labels=shown]/rail:text-body-sm tw:large:group-data-[state=open]/rail:flex-row tw:large:group-data-[state=open]/rail:justify-start tw:large:group-data-[state=open]/rail:gap-stack tw:large:group-data-[state=open]/rail:px-inset-control tw:large:group-data-[state=open]/rail:text-body-sm',
    tabBar:
      'tw:fixed tw:inset-x-0 tw:bottom-0 tw:z-sticky tw:flex tw:h-[3.5rem] tw:border-t-divider tw:border-border tw:bg-bg tw:pb-[env(safe-area-inset-bottom)] tw:medium:hidden tw:group-data-[variant=immersive]/shell:hidden',
    tabLink:
      'tw:flex tw:min-h-touch-target tw:flex-1 tw:flex-col tw:items-center tw:justify-center tw:gap-inline tw:py-inline tw:text-caption tw:text-fg tw:no-underline tw:focus-ring tw:aria-[current=page]:text-accent-ink',
    nowPlaying:
      'tw:sticky tw:bottom-[calc(3.5rem+env(safe-area-inset-bottom)+var(--spacing-inline))] tw:z-sticky tw:col-start-2 tw:px-inline tw:empty:hidden tw:medium:bottom-stack tw:medium:px-gutter-medium tw:large:px-gutter-expanded tw:group-data-[variant=immersive]/shell:hidden',
    main: 'tw:col-start-2 tw:min-w-0 tw:px-gutter-compact tw:pt-stack tw:pb-[calc(3.5rem+var(--spacing-section))] tw:outline-none tw:medium:px-gutter-medium tw:medium:pb-section tw:large:px-gutter-expanded',
  },
  variants: {
    railState: {
      collapsed: { rail: 'tw:w-rail-collapsed' },
      open: { rail: 'tw:w-rail-collapsed tw:large:w-rail-expanded' },
    } satisfies Record<AppShellRailState, object>,
    overlay: {
      true: {
        rail: 'tw:w-rail-expanded tw:me-[calc(var(--spacing-rail-collapsed)-var(--spacing-rail-expanded))] tw:border-e-divider tw:border-border tw:bg-raised tw:shadow-3',
      },
      false: {},
    },
    labelled: {
      true: {
        item: 'tw:hidden tw:group-data-[labels=shown]/rail:flex tw:large:group-data-[state=open]/rail:flex',
      },
      false: {},
    },
    variant: {
      default: {},
      immersive: { main: 'tw:col-start-1 tw:col-span-full tw:p-0' },
    } satisfies Record<AppShellVariant, object>,
  },
  defaultVariants: { railState: 'open', variant: 'default', labelled: false, overlay: false },
});
