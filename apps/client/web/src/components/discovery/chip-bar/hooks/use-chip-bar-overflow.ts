import { type RefObject, useEffect, useState } from 'react';
import { type Overflow, readOverflow } from './chip-bar-track';

export function useChipBarOverflow(trackRef: RefObject<HTMLElement | null>): Overflow {
  const [overflow, setOverflow] = useState<Overflow>({ start: false, end: false });

  useEffect(() => {
    const track = trackRef.current;
    if (track === null) {
      return;
    }
    const measure = () => setOverflow(readOverflow(track));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    track.addEventListener('scroll', measure, { passive: true });
    return () => {
      observer.disconnect();
      track.removeEventListener('scroll', measure);
    };
  }, [trackRef]);

  return overflow;
}
