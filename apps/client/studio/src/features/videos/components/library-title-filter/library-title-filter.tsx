import { Input } from '@kit/ui';
import { type ChangeEvent, useEffect, useRef } from 'react';
import { useT } from '#app/lib/messages';

const SETTLE_MS = 300;

export interface LibraryTitleFilterProps {
  value: string | undefined;
  /** Called once typing has paused, with the trimmed title, or nothing for an empty box. */
  onSettle: (q: string | undefined) => void;
}

export function LibraryTitleFilter({ value, onSettle }: LibraryTitleFilterProps) {
  const pending = useRef<ReturnType<typeof setTimeout>>(undefined);
  const { tOr } = useT();
  const label = tOr('studio.libraryFilter', {}, '');

  useEffect(() => {
    const cancelPending = () => clearTimeout(pending.current);
    return cancelPending;
  }, []);

  const changeTitle = (event: ChangeEvent<HTMLInputElement>) => {
    const q = event.target.value.trim() || undefined;
    clearTimeout(pending.current);
    pending.current = setTimeout(() => onSettle(q), SETTLE_MS);
  };

  return (
    <Input
      type="search"
      aria-label={label}
      placeholder={label}
      defaultValue={value ?? ''}
      onChange={changeTitle}
    />
  );
}
