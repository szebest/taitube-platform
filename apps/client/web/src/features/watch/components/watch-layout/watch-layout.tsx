import { tv } from '@vp/ui';
import type { ReactNode } from 'react';
import { usePlayerTheater } from '#app/components/player/taitube-player';

const watchLayoutStyles = tv({
  slots: {
    root: 'mx-auto grid w-full max-w-[100rem] grid-cols-1 gap-stack p-inline [grid-template-areas:"stage"_"details"_"aside"_"discussion"] expanded:grid-cols-[minmax(0,1fr)_25rem] expanded:p-stack large:grid-cols-[minmax(0,1fr)_26.25rem]',
    stage: 'min-w-0 [grid-area:stage]',
    details: 'flex min-w-0 flex-col gap-stack [grid-area:details]',
    discussion: 'min-w-0 [grid-area:discussion]',
    aside: 'flex min-w-0 flex-col gap-stack [grid-area:aside]',
  },
  variants: {
    theater: {
      false: {
        root: 'expanded:[grid-template-areas:"stage_aside"_"details_aside"_"discussion_aside"]',
      },
      true: {
        root: 'expanded:[grid-template-areas:"stage_stage"_"details_details"_"discussion_aside"]',
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
