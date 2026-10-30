import { tv } from '@vp/ui';
import type { ReactNode } from 'react';

import { usePlayerTheater } from '#app/features/player';

const watchLayoutStyles = tv({
  slots: {
    root: 'tw:mx-auto tw:grid tw:w-full tw:max-w-[100rem] tw:grid-cols-1 tw:gap-stack tw:p-inline tw:[grid-template-areas:"stage"_"details"_"aside"_"discussion"] tw:expanded:grid-cols-[minmax(0,1fr)_25rem] tw:expanded:p-stack tw:large:grid-cols-[minmax(0,1fr)_26.25rem]',
    stage: 'tw:min-w-0 tw:[grid-area:stage]',
    details: 'tw:flex tw:min-w-0 tw:flex-col tw:gap-stack tw:[grid-area:details]',
    discussion: 'tw:min-w-0 tw:[grid-area:discussion]',
    aside: 'tw:flex tw:min-w-0 tw:flex-col tw:gap-stack tw:[grid-area:aside]',
  },
  variants: {
    theater: {
      false: {
        root: 'tw:expanded:[grid-template-areas:"stage_aside"_"details_aside"_"discussion_aside"]',
      },
      true: {
        root: 'tw:expanded:[grid-template-areas:"stage_stage"_"details_details"_"discussion_aside"]',
      },
    },
  },
});

export interface WatchLayoutProps {
  stage: ReactNode;
  /** The title, the engagement bar and the notes. */
  details: ReactNode;
  discussion?: ReactNode;
  /** The queue and its recommendations: beside the stage from expanded up, below the details under that. */
  aside?: ReactNode;
}

/** Two columns from expanded up, one below; in theater mode the stage runs the full width and the aside sits beside the discussion. */
export function WatchLayout({ stage, details, discussion, aside }: WatchLayoutProps) {
  const theater = usePlayerTheater();
  const styles = watchLayoutStyles({ theater });

  return (
    <div data-slot="watch-layout" data-theater={theater || undefined} className={styles.root()}>
      <div className={styles.stage()}>{stage}</div>
      <div className={styles.details()}>{details}</div>
      {discussion && <div className={styles.discussion()}>{discussion}</div>}
      {aside && <aside className={styles.aside()}>{aside}</aside>}
    </div>
  );
}
