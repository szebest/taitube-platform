import {
  defaultRangeExtractor,
  elementScroll,
  observeElementOffset,
  observeElementRect,
  observeWindowOffset,
  observeWindowRect,
  useVirtualizer,
  windowScroll,
} from '@tanstack/react-virtual';
import { type RefObject, useLayoutEffect, useState } from 'react';

const INITIAL_VIEWPORT = { width: 1280, height: 900 };

const OVERSCAN_ROWS = 4;

const isWindow = (target: unknown) => typeof window !== 'undefined' && target === window;

const INITIAL_GAP = 24;

export interface WindowRowsOptions {
  list: RefObject<HTMLElement | null>;
  rowCount: number;
  estimateRowHeight: number;
  getRowKey: (row: number) => string;
  /** The list scrolls inside this element rather than with the page. */
  scroller?: RefObject<HTMLElement | null>;
  /** Rows that stay mounted wherever the viewport is. */
  pinned?: readonly number[];
}

export interface WindowRows {
  /** `spaceBefore` is the gap a pinned row far from its neighbour leaves, as a margin. */
  rows: readonly { index: number; key: string; spaceBefore: number }[];
  /** The space the unmounted rows above and below the mounted ones stand for. */
  padding: { paddingTop: number; paddingBottom: number };
  measureRow: (element: HTMLElement | null) => void;
}

/**
 * Mounts only the rows near the viewport of a list that scrolls with the page, or inside `scroller`, and stands the rest
 * in as padding, so the rows stay in normal flow: their gaps, order and focus order are the list's own,
 * and the gap between rows is the list's own `row-gap`.
 * The first render, on the server too, mounts the rows of an `INITIAL_VIEWPORT`.
 */
export function useWindowRows({
  list,
  rowCount,
  estimateRowHeight,
  getRowKey,
  scroller,
  pinned = [],
}: WindowRowsOptions): WindowRows {
  const [scrollMargin, setScrollMargin] = useState(0);
  const [gap, setGap] = useState(INITIAL_GAP);

  const virtualizer = useVirtualizer<Element, HTMLElement>({
    count: rowCount,
    estimateSize: () => estimateRowHeight,
    gap,
    overscan: OVERSCAN_ROWS,
    scrollMargin,
    getItemKey: getRowKey,
    initialRect: INITIAL_VIEWPORT,
    initialOffset: 0,
    // The library types the window as an Element here; its window observers are the ones used for it.
    getScrollElement: () =>
      scroller?.current ?? (typeof window === 'undefined' ? null : (window as never)),
    observeElementRect: (instance, callback) =>
      isWindow(instance.scrollElement)
        ? observeWindowRect(instance as never, callback)
        : observeElementRect(instance, callback),
    observeElementOffset: (instance, callback) =>
      isWindow(instance.scrollElement)
        ? observeWindowOffset(instance as never, callback)
        : observeElementOffset(instance, callback),
    scrollToFn: (offset, options, instance) =>
      isWindow(instance.scrollElement)
        ? windowScroll(offset, options, instance as never)
        : elementScroll(offset, options, instance),
    rangeExtractor: (range) =>
      [...new Set([...defaultRangeExtractor(range), ...pinned])].toSorted((a, b) => a - b),
  });

  useLayoutEffect(() => {
    const element = list.current;
    if (element) {
      if (!scroller) {
        setScrollMargin(Math.round(element.getBoundingClientRect().top + window.scrollY));
      }
      setGap(Number.parseFloat(getComputedStyle(element).rowGap) || 0);
    }
  });

  const items = virtualizer.getVirtualItems();
  const first = items.at(0);
  const last = items.at(-1);

  return {
    rows: items.map(({ index, key, start }, position) => {
      const before = items[position - 1];

      return {
        index,
        key: String(key),
        spaceBefore: before ? Math.max(0, start - before.end - gap) : 0,
      };
    }),
    padding: {
      paddingTop: first ? first.start - scrollMargin : 0,
      paddingBottom: last ? virtualizer.getTotalSize() - (last.end - scrollMargin) : 0,
    },
    measureRow: virtualizer.measureElement,
  };
}
