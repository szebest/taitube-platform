import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { type RefObject, useLayoutEffect, useState } from 'react';

const INITIAL_VIEWPORT = { width: 1280, height: 900 };

const OVERSCAN_ROWS = 4;

export interface WindowRowsOptions {
  list: RefObject<HTMLElement | null>;
  rowCount: number;
  estimateRowHeight: number;
  gap: number;
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
 * in as padding, so the rows stay in normal flow: their gaps, order and focus order are the list's own.
 * The first render, on the server too, mounts the rows of an `INITIAL_VIEWPORT`.
 */
export function useWindowRows({
  list,
  rowCount,
  estimateRowHeight,
  gap,
  getRowKey,
}: WindowRowsOptions): WindowRows {
  const [scrollMargin, setScrollMargin] = useState(0);

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
    const top = list.current?.getBoundingClientRect().top;
    if (top !== undefined) {
      setScrollMargin(Math.round(top + window.scrollY));
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
