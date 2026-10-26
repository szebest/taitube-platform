import { useNavigate, useSearch } from '@tanstack/react-router';
import { useT } from '@vp/intl-react';
import { IconButton, Input } from '@vp/ui';
import { Search, X } from 'lucide-react';
import { type FormEvent, useEffect, useRef, useState } from 'react';

function ownsKeystrokes(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
    target.closest('[role="menu"], [role="dialog"]') !== null
  );
}

function isSearchShortcut(event: KeyboardEvent) {
  if (event.key !== '/' || event.defaultPrevented || event.isComposing) {
    return false;
  }
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return false;
  }

  return !ownsKeystrokes(event.target);
}

function SearchBox({ query }: { query: string }) {
  const [term, setTerm] = useState(query);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { tOr } = useT();

  useEffect(() => {
    const focusOnSlash = (event: KeyboardEvent) => {
      if (!isSearchShortcut(event)) {
        return;
      }

      event.preventDefault();
      inputRef.current?.focus();
    };

    document.addEventListener('keydown', focusOnSlash);
    const stopListening = () => document.removeEventListener('keydown', focusOnSlash);
    return stopListening;
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const words = term.trim();
    if (!words) {
      return;
    }

    navigate({ to: '/search', search: { q: words } });
  };

  const handleClear = () => {
    setTerm('');
    inputRef.current?.focus();
  };

  return (
    <search className="tw:w-full tw:max-w-xl">
      <form onSubmit={handleSubmit} className="tw:flex tw:items-center tw:gap-1">
        <div className="tw:relative tw:flex-1">
          <Input
            ref={inputRef}
            type="search"
            aria-label={tOr('shell.search', {}, '')}
            placeholder={tOr('shell.search', {}, '')}
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            className="tw:pe-9 tw:[&::-webkit-search-cancel-button]:hidden"
          />
          {term && (
            <IconButton
              aria-label={tOr('shell.clearSearch', {}, '')}
              size="sm"
              onClick={handleClear}
              className="tw:absolute tw:inset-y-0 tw:end-0.5 tw:my-auto"
            >
              <X aria-hidden="true" />
            </IconButton>
          )}
        </div>
        <IconButton type="submit" aria-label={tOr('shell.search', {}, '')}>
          <Search aria-hidden="true" />
        </IconButton>
      </form>
    </search>
  );
}

export function ShellSearch() {
  const { q = '' } = useSearch({ strict: false });

  return <SearchBox key={q} query={q} />;
}
