import { useState } from 'react';

export function useClamped() {
  const [clamped, setClamped] = useState(false);

  const measure = (node: HTMLParagraphElement | null) => {
    if (!node || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setClamped(node.scrollHeight > node.clientHeight));
    observer.observe(node);
    return () => observer.disconnect();
  };

  return { clamped, measure };
}
