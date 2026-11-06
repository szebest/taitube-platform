import { useVirtualizer } from '@tanstack/react-virtual';
import { useState } from 'react';

export const CUE_ROW_HEIGHT = 64;
const OVERSCAN_ROWS = 6;

/** The rows of a long list of cues that are near the viewport of the element given to `scrollerRef`. */
export function useCueWindow(cueCount: number) {
  const [scroller, setScroller] = useState<HTMLElement | null>(null);
  const virtualizer = useVirtualizer({
    count: cueCount,
    getScrollElement: () => scroller,
    estimateSize: () => CUE_ROW_HEIGHT,
    overscan: OVERSCAN_ROWS,
  });

  return {
    scrollerRef: setScroller,
    rows: virtualizer.getVirtualItems(),
    totalSize: virtualizer.getTotalSize(),
  };
}
