import { useEffect, useRef } from 'react';

/** Scrolls the item marked `aria-current` into view when the current one changes, never on the first render. */
export function useScrollToCurrent<Element extends HTMLElement>(currentId: string) {
  const listRef = useRef<Element>(null);
  const shown = useRef(currentId);

  useEffect(() => {
    if (currentId !== shown.current) {
      listRef.current?.querySelector('[aria-current="true"]')?.scrollIntoView?.({ block: 'nearest' });
    }
    shown.current = currentId;
  }, [currentId]);

  return listRef;
}
