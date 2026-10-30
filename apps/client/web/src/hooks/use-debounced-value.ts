import { useEffect, useState } from 'react';

/** `value` as it stood `delayMs` ago, once it has held still that long. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    const cancel = () => clearTimeout(timer);
    return cancel;
  }, [value, delayMs]);

  return settled;
}
