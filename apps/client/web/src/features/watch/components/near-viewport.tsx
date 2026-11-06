import { type ReactNode, useEffect, useRef, useState } from 'react';

const DEFAULT_MARGIN = '0px 0px 600px 0px';

export interface NearViewportProps {
  /** What stands in, at the loaded height, until the section nears the viewport. */
  fallback: ReactNode;
  rootMargin?: string;
  /** Mounts the children at once, for a section the page was opened to show. */
  eager?: boolean;
  children: ReactNode;
}

/** Mounts its children once, the first time it comes within `rootMargin` of the viewport. */
export function NearViewport({
  fallback,
  rootMargin = DEFAULT_MARGIN,
  eager = false,
  children,
}: NearViewportProps) {
  const target = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(eager);

  useEffect(() => {
    const node = target.current;
    if (near || !node) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setNear(true);
        }
      },
      { rootMargin }
    );
    observer.observe(node);

    const stopObserving = () => observer.disconnect();
    return stopObserving;
  }, [near, rootMargin]);

  return <div ref={target}>{near ? children : fallback}</div>;
}
