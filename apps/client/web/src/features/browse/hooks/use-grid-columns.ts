import { type RefObject, useLayoutEffect, useState } from 'react';

const INITIAL_COLUMNS = 4;

/** The columns the list's `auto-fill` grid lays out, read back from its width, `--layout-card-min` and gap. */
export function useGridColumns(list: RefObject<HTMLElement | null>) {
  const [columns, setColumns] = useState(INITIAL_COLUMNS);

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

      setColumns(Math.max(1, Math.floor((element.clientWidth + gap) / (min + gap))));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [list]);

  return columns;
}
