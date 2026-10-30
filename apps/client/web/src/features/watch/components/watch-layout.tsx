import type { ReactNode } from 'react';

export interface WatchLayoutProps {
  /** The stage, title, engagement bar and notes. */
  main: ReactNode;
  /** Beside the main column from expanded up, below it under that. */
  aside?: ReactNode;
}

/** Two columns from expanded up, one below. */
export function WatchLayout({ main, aside }: WatchLayoutProps) {
  return (
    <div
      data-slot="watch-layout"
      className="tw:mx-auto tw:grid tw:w-full tw:max-w-[100rem] tw:grid-cols-1 tw:gap-stack tw:p-inline tw:expanded:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)] tw:expanded:p-stack"
    >
      <div className="tw:flex tw:min-w-0 tw:flex-col tw:gap-stack">{main}</div>
      {aside && <aside className="tw:flex tw:min-w-0 tw:flex-col tw:gap-stack">{aside}</aside>}
    </div>
  );
}
