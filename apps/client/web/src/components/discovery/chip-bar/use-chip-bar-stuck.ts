import { type RefObject, useEffect, useState } from 'react';

export function useChipBarStuck(rootRef: RefObject<HTMLElement | null>): boolean {
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    if (root === null) {
      return;
    }
    const check = () => {
      const pinnedAt = Number.parseFloat(getComputedStyle(root).top);
      setStuck(window.scrollY > 0 && root.getBoundingClientRect().top <= pinnedAt);
    };
    check();
    window.addEventListener('scroll', check, { passive: true });
    return () => window.removeEventListener('scroll', check);
  }, [rootRef]);

  return stuck;
}
