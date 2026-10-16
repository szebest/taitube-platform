import { useNavigate } from '@tanstack/react-router';
import { useT } from '@vp/intl-react';
import { IconButton, Input, ThemeMenu } from '@vp/ui';
import { Search, X } from 'lucide-react';
import { type FormEvent, useEffect, useRef, useState } from 'react';

import { Login, Logo } from '#app/layout/components';

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

function SearchBox() {
  const [term, setTerm] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { tOr } = useT();

  useEffect(() => {
    const focusOnSlash = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }
      if (isTypingTarget(event.target)) {
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
    navigate({ to: '/search', search: { q: term } });
  };

  const handleClear = () => {
    setTerm('');
    inputRef.current?.focus();
  };

  return (
    <search className="tw:w-full tw:max-w-xl">
      <form onSubmit={handleSubmit} className="tw:relative tw:flex tw:items-center tw:gap-1">
        <Input
          ref={inputRef}
          type="search"
          aria-label={tOr('shell.search', {}, '')}
          placeholder={tOr('shell.search', {}, '')}
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          className="tw:pr-9 tw:[&::-webkit-search-cancel-button]:hidden"
        />
        {term && (
          <IconButton
            aria-label={tOr('shell.clearSearch', {}, '')}
            size="sm"
            onClick={handleClear}
            className="tw:absolute tw:right-11"
          >
            <X aria-hidden="true" />
          </IconButton>
        )}
        <IconButton type="submit" aria-label={tOr('shell.search', {}, '')}>
          <Search aria-hidden="true" />
        </IconButton>
      </form>
    </search>
  );
}

export function Header() {
  return (
    <header className="tw:fixed tw:inset-x-0 tw:top-0 tw:z-10 tw:flex tw:h-18 tw:items-center tw:gap-4 tw:border-b tw:border-border tw:bg-surface tw:px-4">
      <div className="tw:shrink-0">
        <Logo hideLogoPart />
      </div>
      <div className="tw:flex tw:flex-1 tw:justify-center">
        <SearchBox />
      </div>
      <div className="tw:flex tw:shrink-0 tw:items-center tw:gap-2">
        <ThemeMenu />
        <Login />
      </div>
    </header>
  );
}
