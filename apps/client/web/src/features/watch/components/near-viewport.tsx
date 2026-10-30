import { type ReactNode, useEffect, useRef, useState } from 'react';

const DEFAULT_MARGIN = '0px 0px 600px 0px';

export interface NearViewportProps {
  /** What stands in, at the loaded height, until the section nears the viewport. */
  fallback: ReactNode;
  rootMargin?: string;
  children: ReactNode;
}

/** Mounts its children once, the first time it comes within `rootMargin` of the viewport. */
export function NearViewport({
  fallback,
  rootMargin = DEFAULT_MARGIN,
  children,
}: NearViewportProps) {
  const target = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);

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
