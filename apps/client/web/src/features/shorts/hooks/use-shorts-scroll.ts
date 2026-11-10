import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '#app/hooks/use-reduced-motion';

interface ShortsScrollOptions {
  count: number;
  initialIndex: number;
  onIndexChange: (index: number) => void;
}

/**
 * The scroll of the Shorts container: which Short fills it, a move to another, and the Short kept in view
 * when the container changes size. The container snaps; this reads where it came to rest.
 */
export function useShortsScroll({ count, initialIndex, onIndexChange }: ShortsScrollOptions) {
  const reduced = useReducedMotion();
  const element = useRef<HTMLElement | null>(null);
  const heading = useRef<number | undefined>(undefined);
  const [index, setIndex] = useState(initialIndex);
  const current = useRef(index);

  const show = (next: number) => {
    current.current = next;
    setIndex(next);
    onIndexChange(next);
  };

  const attach = (node: HTMLElement | null) => {
    element.current = node;
    if (node) {
      node.scrollTop = current.current * node.clientHeight;
    }
  };

  const goTo = (target: number) => {
    const node = element.current;
    const next = Math.min(Math.max(target, 0), count - 1);
    if (!node || next === current.current) {
      return;
    }

    heading.current = next;
    show(next);
    node.scrollTo({ top: next * node.clientHeight, behavior: reduced ? 'auto' : 'smooth' });
  };

  const handleScroll = () => {
    const node = element.current;
    if (!node || node.clientHeight === 0) {
      return;
    }

    if (heading.current !== undefined) {
      if (Math.abs(node.scrollTop - heading.current * node.clientHeight) < 1) {
        heading.current = undefined;
      }
      return;
    }

    const next = Math.round(node.scrollTop / node.clientHeight);
    if (next !== current.current) {
      show(next);
    }
  };

  const takeOver = () => {
    heading.current = undefined;
  };

  useEffect(() => {
    const node = element.current;
    if (!node) {
      return;
    }

    const observer = new ResizeObserver(() => {
      node.scrollTop = current.current * node.clientHeight;
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return {
    index,
    attach,
    goTo,
    handlers: { onScroll: handleScroll, onTouchStart: takeOver, onWheel: takeOver },
  };
}
