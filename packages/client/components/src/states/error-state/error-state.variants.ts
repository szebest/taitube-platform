import { tv } from '@vp/ui';

export const errorStateStyles = tv({
  slots: {
    root: 'tw:flex tw:flex-wrap tw:items-center tw:justify-center tw:gap-x-stack tw:gap-y-inline tw:py-section tw:text-center tw:font-sans tw:text-fg',
    illustration:
      'tw:flex tw:basis-full tw:justify-center tw:text-accent tw:*:block tw:*:h-auto tw:*:w-[11.25rem]',
    title: 'tw:m-0 tw:basis-full tw:text-title-lg',
    description:
      'tw:m-0 tw:box-border tw:basis-full tw:px-[max(0px,calc(50%-16.25rem))] tw:text-body tw:text-fg-muted',
    reference:
      'tw:flex tw:basis-full tw:items-center tw:justify-center tw:gap-inline tw:text-caption tw:text-fg-muted',
    referenceValue: 'tw:font-mono tw:text-mono tw:text-fg',
    details: 'tw:basis-full tw:text-start tw:text-body-sm tw:text-fg-muted',
    detailsSummary: 'tw:cursor-pointer tw:text-center',
    detailsBody:
      'tw:m-0 tw:mt-inline tw:overflow-x-auto tw:rounded-card tw:bg-surface tw:p-inset-control tw:font-mono tw:text-mono tw:text-fg',
  },
});
