import { tv } from '@vp/ui';

export const errorStateStyles = tv({
  slots: {
    root: 'flex flex-wrap items-center justify-center gap-x-stack gap-y-inline py-section text-center font-sans text-fg',
    illustration: 'flex basis-full justify-center text-accent *:block *:h-auto *:w-[11.25rem]',
    title: 'm-0 basis-full text-title-lg',
    description:
      'm-0 box-border basis-full px-[max(0px,calc(50%-16.25rem))] text-body text-fg-muted',
    reference: 'flex basis-full items-center justify-center gap-inline text-caption text-fg-muted',
    referenceValue: 'font-mono text-mono text-fg',
    details: 'basis-full text-start text-body-sm text-fg-muted',
    detailsSummary: 'cursor-pointer text-center',
    detailsBody:
      'm-0 mt-inline overflow-x-auto rounded-card bg-surface p-inset-control font-mono text-mono text-fg',
  },
});
