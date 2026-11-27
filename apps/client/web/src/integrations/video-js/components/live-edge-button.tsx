import { LiveButton } from '@videojs/react';
import type { ReactNode } from 'react';

interface LiveEdgeButtonProps {
  /** The button's name: at the edge it says the stream is live, behind it that it goes back there. */
  label: (atLiveEdge: boolean) => string;
  children: (atLiveEdge: boolean) => ReactNode;
}

/** Shows whether a live stream plays at its live edge, and seeks back there when pressed. */
export function LiveEdgeButton({ label, children }: LiveEdgeButtonProps) {
  return (
    <LiveButton
      label={({ liveEdge }) => label(liveEdge)}
      className="inline-flex h-control-md items-center rounded-control border-0 bg-transparent px-inline focus-ring"
      render={(props, { liveEdge }) => (
        <button type="button" {...props}>
          {children(liveEdge)}
        </button>
      )}
    />
  );
}
