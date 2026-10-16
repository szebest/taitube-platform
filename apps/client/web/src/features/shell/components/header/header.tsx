import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useT } from '@vp/intl-react';
import { BrandLogo, IconButton, Input, ThemeMenu } from '@vp/ui';
import { Menu, Search, X } from 'lucide-react';
import { type FormEvent, useEffect, useRef, useState } from 'react';

import { Login } from '#app/layout/components';

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
            className="tw:pr-9 tw:[&::-webkit-search-cancel-button]:hidden"
          />
          {term && (
            <IconButton
              aria-label={tOr('shell.clearSearch', {}, '')}
              size="sm"
              onClick={handleClear}
              className="tw:absolute tw:inset-y-0 tw:right-0.5 tw:my-auto"
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

export type HeaderProps = {
  sidebarId: string;
  sidebarExpanded: boolean;
  onToggleSidebar: () => void;
};

export function Header({ sidebarId, sidebarExpanded, onToggleSidebar }: HeaderProps) {
  const { q = '' } = useSearch({ strict: false });
  const { tOr } = useT();

  return (
    <header className="tw:fixed tw:inset-x-0 tw:top-0 tw:z-10 tw:flex tw:h-18 tw:items-center tw:gap-4 tw:border-b tw:border-border tw:bg-surface tw:px-4">
      <div className="tw:flex tw:shrink-0 tw:items-center tw:gap-2">
        <IconButton
          aria-label={tOr('shell.menu', {}, '')}
          aria-controls={sidebarId}
          aria-expanded={sidebarExpanded}
          onClick={onToggleSidebar}
          className="tw:hidden tw:xl:inline-flex"
        >
          <Menu aria-hidden="true" />
        </IconButton>
        <Link to="/" aria-label={tOr('shell.brandHome', {}, '')} className="tw:flex">
          <BrandLogo compact />
        </Link>
      </div>
      <div className="tw:flex tw:flex-1 tw:justify-center">
        <SearchBox key={q} query={q} />
      </div>
      <div className="tw:flex tw:shrink-0 tw:items-center tw:gap-2">
        <ThemeMenu />
        <Login />
      </div>
    </header>
  );
}
