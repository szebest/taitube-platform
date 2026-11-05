import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { type RefObject, useLayoutEffect, useState } from 'react';

const INITIAL_VIEWPORT = { width: 1280, height: 900 };

const OVERSCAN_ROWS = 4;

const INITIAL_GAP = 24;

export interface WindowRowsOptions {
  list: RefObject<HTMLElement | null>;
  rowCount: number;
  estimateRowHeight: number;
  getRowKey: (row: number) => string;
}

export interface WindowRows {
  rows: readonly { index: number; key: string }[];
  /** The space the unmounted rows above and below the mounted ones stand for. */
  padding: { paddingTop: number; paddingBottom: number };
  measureRow: (element: HTMLElement | null) => void;
}

/**
 * Mounts only the rows near the viewport of a list that scrolls with the page and stands the rest
 * in as padding, so the rows stay in normal flow: their gaps, order and focus order are the list's own,
 * and the gap between rows is the list's own `row-gap`.
 * The first render, on the server too, mounts the rows of an `INITIAL_VIEWPORT`.
 */
export function useWindowRows({
  list,
  rowCount,
  estimateRowHeight,
  getRowKey,
}: WindowRowsOptions): WindowRows {
  const [scrollMargin, setScrollMargin] = useState(0);
  const [gap, setGap] = useState(INITIAL_GAP);

  const virtualizer = useWindowVirtualizer({
    count: rowCount,
    estimateSize: () => estimateRowHeight,
    gap,
    overscan: OVERSCAN_ROWS,
    scrollMargin,
    getItemKey: getRowKey,
    initialRect: INITIAL_VIEWPORT,
  });

  useLayoutEffect(() => {
    const element = list.current;
    if (element) {
      setScrollMargin(Math.round(element.getBoundingClientRect().top + window.scrollY));
      setGap(Number.parseFloat(getComputedStyle(element).rowGap) || 0);
    }
  });

  const items = virtualizer.getVirtualItems();
  const first = items.at(0);
  const last = items.at(-1);

  return {
    rows: items.map(({ index, key }) => ({ index, key: String(key) })),
    padding: {
      paddingTop: first ? first.start - scrollMargin : 0,
      paddingBottom: last ? virtualizer.getTotalSize() - (last.end - scrollMargin) : 0,
    },
    measureRow: virtualizer.measureElement,
  };
}
