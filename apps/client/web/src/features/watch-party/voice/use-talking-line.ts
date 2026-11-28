import { useEffect, useRef, useState } from 'react';

const LINE_INTERVAL_MS = 1000;
const SEPARATOR = '\u0000';

/** `names`, but changing at most once a second, so a screen reader is not read every flicker of the speakers. */
export function useTalkingLine(names: readonly string[]): readonly string[] {
  const [line, setLine] = useState<readonly string[]>(names);
  const lastChange = useRef(0);
  const key = names.join(SEPARATOR);

  useEffect(() => {
    const next = key === '' ? [] : key.split(SEPARATOR);
    const wait = Math.max(0, lastChange.current + LINE_INTERVAL_MS - Date.now());
    const timer = setTimeout(() => {
      lastChange.current = Date.now();
      setLine(next);
    }, wait);
    return () => clearTimeout(timer);
  }, [key]);

  return line;
}
