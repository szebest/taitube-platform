import { type RefObject, useLayoutEffect, useState } from 'react';

const INITIAL_GRID = { columns: 4, rowGap: 24 };

/** The columns the list's `auto-fill` grid lays out, read back from its width, `--layout-card-min` and gap. */
export function useGridColumns(list: RefObject<HTMLElement | null>) {
  const [grid, setGrid] = useState(INITIAL_GRID);

  useLayoutEffect(() => {
    const element = list.current;
    if (!element) {
      return;
    }

    const measure = () => {
      const style = getComputedStyle(element);
      const min = Number.parseFloat(style.getPropertyValue('--layout-card-min'));
      const gap = Number.parseFloat(style.columnGap) || 0;
      if (Number.isNaN(min) || element.clientWidth === 0) {
        return;
      }

      setGrid({
        columns: Math.max(1, Math.floor((element.clientWidth + gap) / (min + gap))),
        rowGap: Number.parseFloat(style.rowGap) || 0,
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [list]);

  return grid;
}
